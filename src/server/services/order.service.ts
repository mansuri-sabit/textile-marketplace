import { Types } from "mongoose";
import { AppError } from "../lib/api";
import { connectDB } from "../lib/db";
import { orderTotals } from "../lib/pricing";
import {
  canTransition,
  LOW_STOCK_THRESHOLD,
  type OrderStatus,
} from "../constants/marketplace";
import { Cart, Order, Product } from "../models";
import { getCart } from "./cart.service";
import type { CheckoutInput } from "../validators/cart";

function orderNumber(index: number): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.floor(Math.random() * 1296)
    .toString(36)
    .toUpperCase()
    .padStart(2, "0");
  return `TM-${stamp}${rand}${index}`;
}

/**
 * Checkout: turns the cart into one order per supplier.
 *
 * Stock is decremented with a conditional update per line (`stock >= quantity`)
 * and compensated on failure, rather than wrapped in a transaction. Conditional
 * updates are atomic per document, which is where the actual race is, and this
 * keeps checkout working on deployments without a replica set.
 */
export async function placeOrder(buyerId: string, input: CheckoutInput) {
  await connectDB();

  const cart = await getCart(buyerId);
  if (!cart.items.length) {
    throw new AppError("EMPTY_CART", "Your cart is empty.", 422);
  }
  if (cart.hasIssues) {
    throw new AppError(
      "CART_HAS_ISSUES",
      "Some items need attention before you can place this order.",
      422,
      cart.items
        .filter((i) => i.issues.length)
        .map((i) => ({ product: i.name, issues: i.issues })),
    );
  }

  const decremented: Array<{ productId: string; quantity: number }> = [];

  try {
    for (const item of cart.items) {
      const res = await Product.updateOne(
        { _id: new Types.ObjectId(item.productId), stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity, orderCount: 1 } },
      );

      if (res.modifiedCount !== 1) {
        throw new AppError(
          "INSUFFICIENT_STOCK",
          `"${item.name}" sold out while you were checking out.`,
          409,
        );
      }
      decremented.push({ productId: item.productId, quantity: item.quantity });
    }

    // Mark anything that just hit zero, so it stops appearing as orderable.
    await Product.updateMany(
      { _id: { $in: decremented.map((d) => new Types.ObjectId(d.productId)) }, stock: 0 },
      { $set: { status: "out_of_stock" } },
    );

    const checkoutGroupId = new Types.ObjectId().toString();
    const created = [];

    for (const [index, group] of cart.groups.entries()) {
      const totals = orderTotals(group.subtotal);

      const order = await Order.create({
        orderNumber: orderNumber(index + 1),
        buyer: new Types.ObjectId(buyerId),
        supplier: new Types.ObjectId(group.supplier.id),
        checkoutGroupId,
        items: group.items.map((i) => ({
          product: new Types.ObjectId(i.productId),
          name: i.name,
          image: i.image,
          color: i.color,
          unit: i.unit,
          quantity: i.quantity,
          pricePerUnit: i.unitPrice,
          lineTotal: i.lineTotal,
        })),
        shippingAddress: input.shippingAddress,
        buyerNote: input.buyerNote,
        ...totals,
        status: "pending",
        statusHistory: [{ status: "pending", at: new Date() }],
      });

      created.push(order);
    }

    await Cart.updateOne({ buyer: new Types.ObjectId(buyerId) }, { $set: { items: [] } });

    return {
      checkoutGroupId,
      orders: created.map((o) => ({
        orderNumber: o.orderNumber,
        supplier: cart.groups.find((g) => g.supplier.id === String(o.supplier))?.supplier,
        total: o.total,
        itemCount: o.items.length,
      })),
      grandTotal: created.reduce((sum, o) => sum + o.total, 0),
    };
  } catch (err) {
    // Give the stock back — a failed checkout must not silently consume it.
    for (const d of decremented) {
      await Product.updateOne(
        { _id: new Types.ObjectId(d.productId) },
        { $inc: { stock: d.quantity, orderCount: -1 } },
      ).catch(() => {});
    }
    await Product.updateMany(
      {
        _id: { $in: decremented.map((d) => new Types.ObjectId(d.productId)) },
        stock: { $gt: 0 },
        status: "out_of_stock",
      },
      { $set: { status: "active" } },
    ).catch(() => {});

    throw err;
  }
}

export async function listBuyerOrders(
  buyerId: string,
  opts: { status?: OrderStatus; page?: number; limit?: number } = {},
) {
  await connectDB();
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;

  const filter: Record<string, unknown> = { buyer: new Types.ObjectId(buyerId) };
  if (opts.status) filter.status = opts.status;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate("supplier", "businessName slug address.city")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  return { orders, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getBuyerOrder(buyerId: string, orderNumber: string) {
  await connectDB();
  const order = await Order.findOne({ orderNumber, buyer: new Types.ObjectId(buyerId) })
    .populate("supplier", "businessName slug contactEmail contactPhone address")
    .lean();

  // Same 404 whether the order is missing or belongs to someone else — an
  // owner-aware error would let anyone probe for valid order numbers.
  if (!order) throw new AppError("NOT_FOUND", "Order not found.", 404);
  return order;
}

export async function listSupplierOrders(
  supplierId: string,
  opts: { status?: OrderStatus; page?: number; limit?: number } = {},
) {
  await connectDB();
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;

  const filter: Record<string, unknown> = { supplier: new Types.ObjectId(supplierId) };
  if (opts.status) filter.status = opts.status;

  const [orders, total, counts] = await Promise.all([
    Order.find(filter)
      .populate("buyer", "name email phone")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
    Order.aggregate<{ _id: OrderStatus; n: number }>([
      { $match: { supplier: new Types.ObjectId(supplierId) } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
  ]);

  return {
    orders,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    statusCounts: Object.fromEntries(counts.map((c) => [c._id, c.n])),
  };
}

export async function updateOrderStatus(
  supplierId: string,
  orderNumber: string,
  next: OrderStatus,
  note?: string,
) {
  await connectDB();

  const order = await Order.findOne({
    orderNumber,
    supplier: new Types.ObjectId(supplierId),
  });
  if (!order) throw new AppError("NOT_FOUND", "Order not found.", 404);

  const current = order.status as OrderStatus;
  if (!canTransition(current, next)) {
    throw new AppError(
      "INVALID_TRANSITION",
      `An order cannot move from ${current} to ${next}.`,
      422,
      { from: current, to: next },
    );
  }

  // A cancelled order returns its stock; any other transition does not touch it.
  if (next === "cancelled") {
    for (const item of order.items) {
      await Product.updateOne(
        { _id: item.product },
        { $inc: { stock: item.quantity }, $set: { status: "active" } },
      ).catch(() => {});
    }
  }

  order.status = next;
  order.statusHistory.push({ status: next, at: new Date(), note });
  await order.save();

  return order.toJSON();
}

/** Widget data for the supplier dashboard, in one round trip per metric. */
export async function supplierDashboard(supplierId: string) {
  await connectDB();
  const supplier = new Types.ObjectId(supplierId);

  const [productStats, orderStats, recentOrders, lowStock] = await Promise.all([
    Product.aggregate([
      { $match: { supplier } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
          outOfStock: { $sum: { $cond: [{ $eq: ["$status", "out_of_stock"] }, 1, 0] } },
          inventoryValue: { $sum: { $multiply: ["$stock", "$pricePerUnit"] } },
        },
      },
    ]),
    Order.aggregate([
      { $match: { supplier } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
          inProgress: {
            $sum: {
              $cond: [{ $in: ["$status", ["accepted", "preparing", "ready_for_dispatch"]] }, 1, 0],
            },
          },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          revenue: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$total", 0] },
          },
        },
      },
    ]),
    Order.find({ supplier })
      .populate("buyer", "name")
      .select("orderNumber status total createdAt items")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Product.find({ supplier, stock: { $lte: LOW_STOCK_THRESHOLD } })
      .select("name slug stock unit status images")
      .sort({ stock: 1 })
      .limit(8)
      .lean(),
  ]);

  const p = productStats[0] ?? { total: 0, active: 0, outOfStock: 0, inventoryValue: 0 };
  const o = orderStats[0] ?? {
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    revenue: 0,
  };

  return {
    products: {
      total: p.total,
      active: p.active,
      outOfStock: p.outOfStock,
      inventoryValue: Math.round(p.inventoryValue),
    },
    orders: {
      total: o.total,
      pending: o.pending,
      inProgress: o.inProgress,
      completed: o.completed,
      revenue: Math.round(o.revenue),
    },
    recentOrders,
    inventoryAlerts: lowStock,
  };
}
