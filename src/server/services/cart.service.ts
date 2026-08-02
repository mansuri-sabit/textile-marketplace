import { Types } from "mongoose";
import { AppError } from "../lib/api";
import { connectDB } from "../lib/db";
import { effectiveUnitPrice, orderTotals } from "../lib/pricing";
import { Cart, Product } from "../models";
import type { AddToCartInput } from "../validators/cart";

/**
 * A cart line resolved against the live product, which is what the client
 * renders. The stored cart holds only ids, quantities and a price snapshot —
 * everything else is looked up so a supplier's edits show up immediately.
 */
export type ResolvedCartItem = {
  productId: string;
  slug: string;
  name: string;
  image?: string;
  category: string;
  color?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  /** Price when the item was added, if it has since changed. */
  priceChangedFrom?: number;
  minimumOrderQuantity: number;
  availableStock: number;
  supplier: { id: string; name: string; slug: string };
  issues: string[];
};

async function loadCart(buyerId: string) {
  await connectDB();
  const cart = await Cart.findOneAndUpdate(
    { buyer: new Types.ObjectId(buyerId) },
    { $setOnInsert: { buyer: new Types.ObjectId(buyerId), items: [] } },
    { upsert: true, returnDocument: "after" },
  );
  if (!cart) throw new AppError("CART_ERROR", "Could not open your cart.", 500);
  return cart;
}

/**
 * Resolves stored cart lines against live products.
 *
 * Anything that would block checkout is reported per line as an `issue` rather
 * than thrown, so the cart page can show every problem at once instead of
 * failing on the first one.
 */
export async function getCart(buyerId: string) {
  const cart = await loadCart(buyerId);

  const ids = cart.items.map((i) => i.product);
  const products = ids.length
    ? await Product.find({ _id: { $in: ids } })
        .populate("supplier", "businessName slug")
        .lean()
    : [];
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const items: ResolvedCartItem[] = [];
  const orphaned: string[] = [];

  for (const line of cart.items) {
    const product = byId.get(String(line.product));
    if (!product) {
      orphaned.push(String(line.product));
      continue;
    }

    const unitPrice = effectiveUnitPrice(
      product.pricePerUnit,
      product.bulkTiers,
      line.quantity,
    );

    const issues: string[] = [];
    if (product.status !== "active") issues.push("This product is no longer available");
    if (product.stock < line.quantity) {
      issues.push(`Only ${product.stock} ${product.unit} in stock`);
    }
    if (line.quantity < (product.minimumOrderQuantity ?? 1)) {
      issues.push(`Minimum order is ${product.minimumOrderQuantity} ${product.unit}`);
    }

    const supplier = product.supplier as unknown as {
      _id: unknown;
      businessName: string;
      slug: string;
    };

    items.push({
      productId: String(product._id),
      slug: product.slug,
      name: product.name,
      image: product.images?.[0],
      category: product.category,
      color: line.color ?? undefined,
      unit: product.unit,
      quantity: line.quantity,
      unitPrice,
      lineTotal: unitPrice * line.quantity,
      priceChangedFrom:
        line.priceSnapshot !== product.pricePerUnit ? line.priceSnapshot : undefined,
      minimumOrderQuantity: product.minimumOrderQuantity ?? 1,
      availableStock: product.stock,
      supplier: {
        id: String(supplier._id),
        name: supplier.businessName,
        slug: supplier.slug,
      },
      issues,
    });
  }

  // A deleted product would otherwise sit in the cart forever, unrenderable.
  if (orphaned.length) {
    await Cart.updateOne(
      { _id: cart._id },
      { $pull: { items: { product: { $in: orphaned.map((id) => new Types.ObjectId(id)) } } } },
    );
  }

  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);

  // Grouped by supplier because checkout splits into one order each, and the
  // buyer should see that split before they place the order, not after.
  const bySupplier = new Map<string, { supplier: ResolvedCartItem["supplier"]; items: ResolvedCartItem[]; subtotal: number }>();
  for (const item of items) {
    const group = bySupplier.get(item.supplier.id) ?? {
      supplier: item.supplier,
      items: [],
      subtotal: 0,
    };
    group.items.push(item);
    group.subtotal += item.lineTotal;
    bySupplier.set(item.supplier.id, group);
  }

  return {
    items,
    groups: [...bySupplier.values()],
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
    lineCount: items.length,
    ...orderTotals(subtotal),
    hasIssues: items.some((i) => i.issues.length > 0),
  };
}

export async function addItem(buyerId: string, input: AddToCartInput) {
  await connectDB();

  const product = await Product.findById(input.productId).lean();
  if (!product) throw new AppError("NOT_FOUND", "That product does not exist.", 404);
  if (product.status !== "active") {
    throw new AppError("UNAVAILABLE", "This product is not available right now.", 409);
  }

  const moq = product.minimumOrderQuantity ?? 1;
  if (input.quantity < moq) {
    throw new AppError(
      "BELOW_MOQ",
      `This supplier's minimum order is ${moq} ${product.unit}.`,
      422,
    );
  }
  if (input.quantity > product.stock) {
    throw new AppError(
      "INSUFFICIENT_STOCK",
      `Only ${product.stock} ${product.unit} available.`,
      409,
    );
  }
  if (input.color && !product.colors?.some((c) => c.name === input.color)) {
    throw new AppError("INVALID_COLOR", "That colour is not offered for this product.", 422);
  }

  const cart = await loadCart(buyerId);
  const existing = cart.items.find(
    (i) => String(i.product) === input.productId && (i.color ?? undefined) === input.color,
  );

  // Adding the same product and colour tops up the line rather than creating a
  // duplicate row — but the combined quantity still has to fit in stock.
  if (existing) {
    const combined = existing.quantity + input.quantity;
    if (combined > product.stock) {
      throw new AppError(
        "INSUFFICIENT_STOCK",
        `You already have ${existing.quantity} in your cart and only ${product.stock} are available.`,
        409,
      );
    }
    existing.quantity = combined;
    existing.priceSnapshot = product.pricePerUnit;
  } else {
    cart.items.push({
      product: new Types.ObjectId(input.productId),
      quantity: input.quantity,
      color: input.color,
      priceSnapshot: product.pricePerUnit,
      addedAt: new Date(),
    });
  }

  await cart.save();
  return getCart(buyerId);
}

export async function updateItem(
  buyerId: string,
  productId: string,
  quantity: number,
  color?: string,
) {
  await connectDB();

  // Quantity zero is the "remove" gesture from a stepper control.
  if (quantity === 0) return removeItem(buyerId, productId, color);

  const product = await Product.findById(productId).lean();
  if (!product) throw new AppError("NOT_FOUND", "That product does not exist.", 404);

  const moq = product.minimumOrderQuantity ?? 1;
  if (quantity < moq) {
    throw new AppError("BELOW_MOQ", `Minimum order is ${moq} ${product.unit}.`, 422);
  }
  if (quantity > product.stock) {
    throw new AppError("INSUFFICIENT_STOCK", `Only ${product.stock} ${product.unit} available.`, 409);
  }

  const cart = await loadCart(buyerId);
  const line = cart.items.find(
    (i) => String(i.product) === productId && (i.color ?? undefined) === color,
  );
  if (!line) throw new AppError("NOT_FOUND", "That item is not in your cart.", 404);

  line.quantity = quantity;
  await cart.save();
  return getCart(buyerId);
}

export async function removeItem(buyerId: string, productId: string, color?: string) {
  await connectDB();
  await loadCart(buyerId);

  // `color: null` matches both an explicit null and a missing field, which is
  // exactly the "line with no colour selected" case.
  const match = {
    product: new Types.ObjectId(productId),
    color: color ?? null,
  };

  const res = await Cart.updateOne(
    { buyer: new Types.ObjectId(buyerId) },
    { $pull: { items: match } },
  );

  if (res.modifiedCount !== 1) {
    throw new AppError("NOT_FOUND", "That item is not in your cart.", 404);
  }

  return getCart(buyerId);
}

export async function clearCart(buyerId: string) {
  await connectDB();
  await Cart.updateOne({ buyer: new Types.ObjectId(buyerId) }, { $set: { items: [] } });
  return getCart(buyerId);
}
