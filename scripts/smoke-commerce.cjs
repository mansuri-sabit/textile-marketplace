/**
 * End-to-end commerce smoke test — run against a live dev server:
 *   npm run dev
 *   node scripts/smoke-commerce.cjs
 *
 * Walks the full marketplace loop: buyer registers, fills a multi-supplier
 * cart, checks out, and the supplier then sees and advances that order.
 * Also asserts the guards: MOQ, stock, role separation and status transitions.
 */
const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";

let pass = 0;
let fail = 0;
function check(label, cond, extra) {
  if (cond) {
    pass++;
    console.log("  PASS  " + label);
  } else {
    fail++;
    console.log("  FAIL  " + label + (extra !== undefined ? "  -> " + JSON.stringify(extra) : ""));
  }
}

function makeClient() {
  const jar = {};
  return {
    jar,
    async call(method, path, body) {
      const res = await fetch(BASE + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; "),
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: "manual",
      });
      for (const c of res.headers.getSetCookie?.() ?? []) {
        const [pair] = c.split(";");
        const i = pair.indexOf("=");
        const k = pair.slice(0, i);
        const v = pair.slice(i + 1);
        if (v === "") delete jar[k];
        else jar[k] = v;
      }
      const ct = res.headers.get("content-type") || "";
      const payload = ct.includes("json") ? await res.json() : null;
      return { status: res.status, payload, data: payload && payload.data, error: payload && payload.error };
    },
  };
}

(async () => {
  const stamp = Date.now();
  const buyer = makeClient();
  const supplier = makeClient();
  const anon = makeClient();

  console.log("\n== setup ==");
  let r = await buyer.call("POST", "/api/auth/register", {
    name: "Commerce Tester",
    email: `commerce${stamp}@example.com`,
    password: "Passw0rd123",
    role: "buyer",
  });
  check("buyer registered", r.status === 201, r.payload);

  r = await supplier.call("POST", "/api/auth/login", {
    email: "supplier.meridian@demo.test",
    password: "Supplier123",
  });
  check("seeded supplier logs in", r.status === 200, r.payload);

  console.log("\n== access control ==");
  r = await anon.call("GET", "/api/cart");
  check("anonymous cart -> 401", r.status === 401, r.status);

  r = await supplier.call("GET", "/api/cart");
  check("supplier cannot use a buyer cart -> 403", r.status === 403, r.status);

  r = await buyer.call("GET", "/api/supplier/dashboard");
  check("buyer cannot see supplier dashboard -> 403", r.status === 403, r.status);

  console.log("\n== picking products from two suppliers ==");
  const listA = await anon.call("GET", "/api/products?supplier=meridian-cotton-mills&inStockOnly=true&limit=1");
  const listB = await anon.call("GET", "/api/products?supplier=kanchi-heritage-silks&inStockOnly=true&limit=1");
  const prodA = listA.data.products[0];
  const prodB = listB.data.products[0];
  check("found a product from each supplier", Boolean(prodA && prodB));
  console.log(`        A: ${prodA.name} (MOQ ${prodA.minimumOrderQuantity})`);
  console.log(`        B: ${prodB.name} (MOQ ${prodB.minimumOrderQuantity})`);

  console.log("\n== cart guards ==");
  r = await buyer.call("POST", "/api/cart", { productId: prodA._id, quantity: 1 });
  check("below MOQ rejected -> 422", r.status === 422 && r.error.code === "BELOW_MOQ", r.error);

  // Above available stock but inside the schema's sanity ceiling, so this
  // exercises the stock check rather than the validator.
  r = await buyer.call("POST", "/api/cart", { productId: prodA._id, quantity: 90000 });
  check("above stock rejected -> 409", r.status === 409 && r.error.code === "INSUFFICIENT_STOCK", r.error);

  r = await buyer.call("POST", "/api/cart", { productId: prodA._id, quantity: 999999 });
  check("absurd quantity rejected by validator -> 422", r.status === 422, r.error);

  r = await buyer.call("POST", "/api/cart", {
    productId: prodA._id,
    quantity: prodA.minimumOrderQuantity,
    color: "Not A Real Colour",
  });
  check("unknown colour rejected -> 422", r.status === 422 && r.error.code === "INVALID_COLOR", r.error);

  console.log("\n== cart ==");
  const qtyA = prodA.minimumOrderQuantity;
  const qtyB = prodB.minimumOrderQuantity;

  r = await buyer.call("POST", "/api/cart", { productId: prodA._id, quantity: qtyA });
  check("add item A -> 200", r.status === 200, r.error);
  check("cart has 1 line", r.data.lineCount === 1, r.data.lineCount);

  r = await buyer.call("POST", "/api/cart", { productId: prodA._id, quantity: qtyA });
  check("re-adding tops up the same line", r.data.lineCount === 1 && r.data.items[0].quantity === qtyA * 2, r.data.items[0]);

  r = await buyer.call("POST", "/api/cart", { productId: prodB._id, quantity: qtyB });
  check("add item B from another supplier", r.data.lineCount === 2, r.data.lineCount);
  check("cart splits into 2 supplier groups", r.data.groups.length === 2, r.data.groups.length);
  check("totals computed", r.data.subtotal > 0 && r.data.total > r.data.subtotal, {
    subtotal: r.data.subtotal,
    tax: r.data.taxAmount,
    total: r.data.total,
  });
  check("no blocking issues", r.data.hasIssues === false, r.data.items.map((i) => i.issues));

  r = await buyer.call("PATCH", `/api/cart/items/${prodA._id}`, { quantity: qtyA });
  check("update quantity", r.data.items.find((i) => i.productId === prodA._id).quantity === qtyA);

  r = await buyer.call("PATCH", `/api/cart/items/${prodA._id}`, { quantity: 1 });
  check("update below MOQ rejected", r.status === 422, r.error);

  console.log("\n== checkout ==");
  r = await buyer.call("POST", "/api/orders", {
    shippingAddress: {
      fullName: "Commerce Tester",
      phone: "+91 98450 11111",
      line1: "12 Residency Road",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "56000",
    },
  });
  check("invalid PIN code rejected -> 422", r.status === 422, r.error);

  const stockBefore = (await anon.call("GET", `/api/products/${prodA.slug}`)).data.product.stock;

  r = await buyer.call("POST", "/api/orders", {
    shippingAddress: {
      fullName: "Commerce Tester",
      phone: "+91 98450 11111",
      line1: "12 Residency Road",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560025",
    },
    buyerNote: "Please ship in one consignment if possible.",
  });
  check("checkout -> 201", r.status === 201, r.payload);
  check("split into 2 orders (one per supplier)", r.data.orders.length === 2, r.data.orders);
  check("orders share a checkout group", Boolean(r.data.checkoutGroupId));
  const orderNumbers = r.data.orders.map((o) => o.orderNumber);
  console.log(`        orders: ${orderNumbers.join(", ")}  grand total ₹${r.data.grandTotal}`);

  const stockAfter = (await anon.call("GET", `/api/products/${prodA.slug}`)).data.product.stock;
  check("stock decremented by ordered quantity", stockBefore - stockAfter === qtyA, {
    before: stockBefore,
    after: stockAfter,
    ordered: qtyA,
  });

  r = await buyer.call("GET", "/api/cart");
  check("cart emptied after checkout", r.data.lineCount === 0, r.data.lineCount);

  r = await buyer.call("POST", "/api/orders", {
    shippingAddress: {
      fullName: "Commerce Tester",
      phone: "+91 98450 11111",
      line1: "12 Residency Road",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560025",
    },
  });
  check("checkout with empty cart -> 422", r.status === 422 && r.error.code === "EMPTY_CART", r.error);

  console.log("\n== buyer order views ==");
  r = await buyer.call("GET", "/api/orders");
  check("buyer sees own orders", r.data.total === 2, r.data.total);

  const mine = orderNumbers[0];
  r = await buyer.call("GET", `/api/orders/${mine}`);
  check("order detail", r.status === 200 && r.data.order.orderNumber === mine, r.status);
  check("status history seeded with pending", r.data.order.statusHistory[0].status === "pending");
  check("shipping address stored", r.data.order.shippingAddress.city === "Bengaluru");

  console.log("\n== supplier order management ==");
  r = await supplier.call("GET", "/api/supplier/orders");
  check("supplier sees incoming orders", r.status === 200 && r.data.total > 0, r.data && r.data.total);
  const supplierOrder = r.data.orders.find((o) => orderNumbers.includes(o.orderNumber));
  check("the new order reached the right supplier", Boolean(supplierOrder), orderNumbers);
  check("status counts provided for tabs", typeof r.data.statusCounts === "object");

  const target = supplierOrder.orderNumber;

  r = await supplier.call("PATCH", `/api/supplier/orders/${target}`, { status: "completed" });
  check("cannot skip stages -> 422", r.status === 422 && r.error.code === "INVALID_TRANSITION", r.error);

  r = await supplier.call("PATCH", `/api/supplier/orders/${target}`, { status: "accepted", note: "Yarn in stock" });
  check("pending -> accepted", r.status === 200 && r.data.order.status === "accepted", r.error);

  r = await supplier.call("PATCH", `/api/supplier/orders/${target}`, { status: "pending" });
  check("cannot move backwards -> 422", r.status === 422, r.error);

  for (const next of ["preparing", "ready_for_dispatch", "completed"]) {
    r = await supplier.call("PATCH", `/api/supplier/orders/${target}`, { status: next });
    check(`advance -> ${next}`, r.status === 200 && r.data.order.status === next, r.error);
  }

  r = await supplier.call("PATCH", `/api/supplier/orders/${target}`, { status: "cancelled" });
  check("completed is terminal -> 422", r.status === 422, r.error);

  r = await buyer.call("PATCH", `/api/supplier/orders/${target}`, { status: "accepted" });
  check("buyer cannot change order status -> 403", r.status === 403, r.status);

  console.log("\n== supplier dashboard ==");
  r = await supplier.call("GET", "/api/supplier/dashboard");
  check("dashboard -> 200", r.status === 200, r.payload);
  check("product stats", r.data.products.total > 0, r.data.products);
  check("order stats", r.data.orders.total > 0, r.data.orders);
  check("recent orders listed", Array.isArray(r.data.recentOrders) && r.data.recentOrders.length > 0);
  check("inventory alerts array present", Array.isArray(r.data.inventoryAlerts));
  console.log(`        products ${r.data.products.total} (${r.data.products.active} active) | orders ${r.data.orders.total} | revenue ₹${r.data.orders.revenue}`);

  console.log("\n== supplier inventory ==");
  r = await supplier.call("GET", "/api/supplier/products?limit=1");
  check("supplier lists own catalog", r.status === 200 && r.data.products.length === 1, r.status);
  const own = r.data.products[0];

  r = await supplier.call("PATCH", `/api/supplier/products/${own._id}/stock`, { stock: 0 });
  check("stock 0 flips status to out_of_stock", r.data.product.status === "out_of_stock", r.data.product.status);

  r = await supplier.call("PATCH", `/api/supplier/products/${own._id}/stock`, { stock: 500 });
  check("restocking flips it back to active", r.data.product.status === "active", r.data.product.status);

  r = await supplier.call("POST", "/api/supplier/products", {
    name: `Smoke Test Fabric ${stamp}`,
    description: "A fabric created by the automated commerce smoke test to verify supplier product creation.",
    category: "Cotton",
    fabricType: "Woven",
    images: ["https://res.cloudinary.com/demo/image/upload/sample.jpg"],
    pricePerUnit: 199,
    stock: 300,
    minimumOrderQuantity: 25,
  });
  check("create product -> 201", r.status === 201, r.error);
  const createdId = r.data && r.data.product && r.data.product.id;
  const createdSlug = r.data && r.data.product && r.data.product.slug;
  check("slug generated", Boolean(createdSlug), createdSlug);

  r = await anon.call("GET", `/api/products/${createdSlug}`);
  check("new product is publicly visible", r.status === 200, r.status);

  r = await supplier.call("PATCH", `/api/supplier/products/${createdId}`, { pricePerUnit: 249 });
  check("update product", r.status === 200 && r.data.product.pricePerUnit === 249, r.error);

  r = await buyer.call("DELETE", `/api/supplier/products/${createdId}`);
  check("buyer cannot delete a supplier product -> 403", r.status === 403, r.status);

  r = await supplier.call("DELETE", `/api/supplier/products/${createdId}`);
  check("supplier deletes own product", r.status === 200, r.error);

  r = await anon.call("GET", `/api/products/${createdSlug}`);
  check("deleted product is gone -> 404", r.status === 404, r.status);

  console.log(`\n---- ${pass} passed, ${fail} failed ----\n`);
  process.exit(fail ? 1 : 0);
})();
