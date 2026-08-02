/**
 * Buyer journey smoke test — run against a live dev server:
 *   npm run dev
 *   node scripts/smoke-journey.cjs
 *
 * Covers the screens rather than just the APIs: onboarding for both roles
 * (including the redirect loop that a stale token claim would cause), then
 * cart → checkout → confirmation → orders → dashboard. Every page assertion
 * here is a route that returned 404 before it existed, so this suite is what
 * stops that regressing.
 *
 * Creates throwaway accounts and places real orders on each run.
 */
const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const stamp = Date.now();

const buyer = {
  name: "Journey Buyer",
  email: `journey.buyer${stamp}@example.com`,
  password: "Passw0rd123",
  role: "buyer",
};
const supplier = {
  name: "Journey Supplier",
  email: `journey.sup${stamp}@example.com`,
  password: "Passw0rd123",
  role: "supplier",
};

let jar = {};

function cookieHeader() {
  return Object.entries(jar)
    .map(([k, v]) => k + "=" + v)
    .join("; ");
}

function absorb(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const idx = pair.indexOf("=");
    const k = pair.slice(0, idx);
    const v = pair.slice(idx + 1);
    if (v === "") delete jar[k];
    else jar[k] = v;
  }
}

/**
 * Turbopack compiles a route on first request, which can outrun undici's
 * headers timeout on a cold dev server. One retry turns that into a slow pass
 * rather than a spurious failure.
 */
async function attempt(fn) {
  try {
    return await fn();
  } catch {
    return fn();
  }
}

async function call(method, path, body, opts = {}) {
  return attempt(async () => {
    const res = await fetch(BASE + path, {
      method,
      headers: { "Content-Type": "application/json", Cookie: cookieHeader() },
      body: body ? JSON.stringify(body) : undefined,
      redirect: opts.redirect || "follow",
    });
    absorb(res);
    const ct = res.headers.get("content-type") || "";
    const payload = ct.includes("json") ? await res.json() : null;
    return { status: res.status, payload, location: res.headers.get("location") };
  });
}

/** Fetches a page as a browser would, without following proxy redirects. */
async function page(path) {
  return attempt(async () => {
    const res = await fetch(BASE + path, {
      headers: { Cookie: cookieHeader() },
      redirect: "manual",
    });
    const html = await res.text();
    return { status: res.status, html, location: res.headers.get("location") };
  });
}

let pass = 0;
let fail = 0;
function check(label, cond, extra) {
  if (cond) {
    pass++;
    console.log("  PASS  " + label);
  } else {
    fail++;
    console.log("  FAIL  " + label + (extra ? "  -> " + JSON.stringify(extra) : ""));
  }
}

const BUYER_ANSWERS = {
  businessType: "Garment Factory",
  industry: "Apparel & Fashion",
  interestedCategories: ["Cotton", "Linen"],
  preferredFabricTypes: ["Woven"],
  typicalOrderQuantity: "500 - 2,000",
  budgetRange: "₹50,000 - ₹2,00,000",
  notes: "GOTS certification required for EU shipments.",
};

const SUPPLIER_ANSWERS = {
  businessName: `Journey Mills ${stamp}`,
  businessType: "Manufacturer",
  description: "Smoke-test mill.",
  contactEmail: supplier.email,
  contactPhone: "+91 98450 00000",
  address: {
    line1: "14 Mill Road",
    city: "Coimbatore",
    state: "Tamil Nadu",
    postalCode: "641001",
  },
  operatingHours: "standard",
  categories: ["Cotton"],
  fabricTypes: ["Woven"],
  minimumOrderQuantity: 100,
};

(async () => {
  console.log("\n== buyer onboarding ==");
  let r = await call("POST", "/api/auth/register", buyer);
  check("register -> 201", r.status === 201, r.payload);
  check("onboarding starts incomplete", r.payload?.data?.user?.onboardingCompleted === false);

  let p = await page("/onboarding");
  check("/onboarding renders (not 404)", p.status === 200, p.status);

  p = await page("/cart");
  check(
    "incomplete account bounced to /onboarding",
    p.status >= 300 && p.status < 400 && (p.location || "").includes("/onboarding"),
    p.location,
  );

  r = await call("GET", "/api/onboarding");
  check("saved state readable", r.status === 200 && r.payload?.data?.role === "buyer", r.payload);

  r = await call("POST", "/api/onboarding", { ...BUYER_ANSWERS, interestedCategories: [] });
  check("no categories -> 422", r.status === 422, r.payload);

  r = await call("POST", "/api/onboarding", { ...BUYER_ANSWERS, businessType: "Pirate" });
  check("unknown business type -> 422", r.status === 422, r.payload);

  const tokenBefore = jar.mkt_at;
  r = await call("POST", "/api/onboarding", BUYER_ANSWERS);
  check("onboarding submit -> 200", r.status === 200, r.payload);
  check("onboarding marked complete", r.payload?.data?.user?.onboardingCompleted === true);
  check("access token re-issued with the new claim", jar.mkt_at !== tokenBefore);

  p = await page("/cart");
  check("no redirect loop back into onboarding", p.status === 200, {
    status: p.status,
    location: p.location,
  });

  r = await call("GET", "/api/auth/me");
  check(
    "preferences persisted",
    r.payload?.data?.user?.buyerPreferences?.industry === "Apparel & Fashion",
    r.payload?.data?.user?.buyerPreferences,
  );

  p = await page("/onboarding");
  check("onboarding stays reachable as a preferences editor", p.status === 200, p.status);

  console.log("\n== cart -> checkout ==");
  r = await call("GET", "/api/products?limit=1");
  const product = r.payload?.data?.products?.[0];
  check("catalog has a product to buy", Boolean(product?._id), r.payload?.data?.total);

  r = await call("POST", "/api/cart", {
    productId: product._id,
    quantity: product.minimumOrderQuantity,
  });
  check("add to cart -> 200", r.status === 200, r.payload);
  check("cart totals computed", r.payload?.data?.total > 0, r.payload?.data);

  p = await page("/cart");
  check("/cart renders", p.status === 200, p.status);
  // Cart contents are client-rendered from the store, so the server HTML holds
  // the shell only — the line items are asserted through /api/cart above.
  check("cart page renders its own shell", p.html.includes("Your cart"), p.status);

  p = await page("/checkout");
  check("/checkout renders", p.status === 200, p.status);

  r = await call("POST", "/api/orders", {
    shippingAddress: {
      fullName: "Journey Buyer",
      phone: "+91 98450 11111",
      line1: "Unit 4, Ambattur Industrial Estate",
      city: "Chennai",
      state: "Tamil Nadu",
      postalCode: "600053",
    },
    buyerNote: "Smoke test order.",
  });
  check("place order -> 201", r.status === 201, r.payload);

  const group = r.payload?.data?.checkoutGroupId;
  const orderNumber = r.payload?.data?.orders?.[0]?.orderNumber;
  check("checkout group returned", Boolean(group));
  check("order number returned", Boolean(orderNumber));

  console.log("\n== confirmation and tracking ==");
  p = await page(`/checkout/confirmation/${group}`);
  check("confirmation renders", p.status === 200, p.status);
  check("confirmation names the order", p.html.includes(orderNumber), orderNumber);

  p = await page("/checkout/confirmation/000000000000000000000000");
  check("unknown checkout group -> 404", p.status === 404, p.status);

  r = await call("GET", `/api/orders?group=${group}`);
  check(
    "group filter returns only that checkout",
    r.status === 200 &&
      r.payload?.data?.orders?.length > 0 &&
      r.payload.data.orders.every((o) => o.checkoutGroupId === group),
    r.payload?.data?.orders?.length,
  );

  p = await page("/orders");
  check("/orders renders", p.status === 200, p.status);
  check("orders list shows the new order", p.html.includes(orderNumber));

  p = await page(`/orders/${orderNumber}`);
  check("/orders/[orderNumber] renders", p.status === 200, p.status);
  check("order detail shows the shipping address", p.html.includes("Ambattur"));

  p = await page("/orders/TM-DOESNOTEXIST");
  check("unknown order number -> 404", p.status === 404, p.status);

  console.log("\n== buyer dashboard ==");
  p = await page("/buyer");
  check("/buyer renders", p.status === 200, p.status);
  check("dashboard lists the open order", p.html.includes(orderNumber));
  check("dashboard shows the sourcing profile", p.html.includes("Garment Factory"));

  p = await page("/buyer/profile");
  check("/buyer/profile renders", p.status === 200, p.status);
  check("profile shows the account email", p.html.includes(buyer.email));

  console.log("\n== every link a signed-in buyer can click ==");
  /**
   * Exactly the hrefs in Navbar and Footer. A signed-in buyer clicking any of
   * them must land on a page — a supplier-only route is allowed to redirect
   * them home, but nothing may 404. This is the regression that shipped once.
   */
  const CLICKABLE = [
    "/",
    "/products",
    "/products?category=Cotton",
    "/products?category=Silk",
    "/products?category=Linen",
    "/products?category=Knits+%26+Jersey",
    "/products?sort=popular",
    "/products?certification=GOTS",
    "/suppliers",
    "/cart",
    "/orders",
    "/buyer",
    "/buyer/profile",
    "/register?role=buyer",
    "/register?role=supplier",
    "/supplier",
    "/supplier/products",
  ];

  for (const href of CLICKABLE) {
    const res = await attempt(() =>
      fetch(BASE + href, { headers: { Cookie: cookieHeader() }, redirect: "follow" }),
    );
    check(`${href} -> no dead end`, res.status === 200, res.status);
  }

  console.log("\n== assistant ==");
  /**
   * The assistant is retrieval-grounded: the cards come from the database, so
   * they must be real rows regardless of what the model wrote. These assertions
   * hold whether or not a chat provider answered — `generated: false` is a
   * supported state, not a failure.
   */
  r = await call("POST", "/api/assistant", {
    messages: [
      { role: "user", content: "lightweight breathable cotton for summer shirting" },
    ],
  });
  check("assistant answers -> 200", r.status === 200, r.payload?.error);
  check("reply is non-empty", (r.payload?.data?.reply ?? "").length > 10);
  check("grounded in real products", r.payload?.data?.products?.length > 0, r.payload?.data?.products?.length);
  check(
    "every card is a real catalog row",
    (r.payload?.data?.products ?? []).every((p) => p._id && p.slug && p.pricePerUnit > 0),
  );
  check(
    "grounding markers stripped from the prose",
    !/\[\d+\]/.test(r.payload?.data?.reply ?? ""),
    r.payload?.data?.reply,
  );
  check("deep link to the full search", Boolean(r.payload?.data?.searchUrl));
  check("follow-up suggestions offered", r.payload?.data?.suggestions?.length > 0);

  const suggested = r.payload?.data?.products?.[0]?.slug;

  r = await call("POST", "/api/assistant", {
    messages: [{ role: "user", content: "what is this best used for?" }],
    productSlug: suggested,
  });
  check("product Q&A -> 200", r.status === 200, r.payload?.error);
  check("product Q&A anchors on that fabric", r.payload?.data?.mode === "product", r.payload?.data?.mode);
  check(
    "the anchored fabric is first",
    r.payload?.data?.products?.[0]?.slug === suggested,
    r.payload?.data?.products?.[0]?.slug,
  );

  const two = (await call("GET", "/api/products?limit=2")).payload?.data?.products ?? [];
  r = await call("POST", "/api/assistant", {
    messages: [{ role: "user", content: "compare these" }],
    compareSlugs: two.map((p) => p.slug),
  });
  check("comparison -> 200", r.status === 200, r.payload?.error);
  check("comparison mode engaged", r.payload?.data?.mode === "compare", r.payload?.data?.mode);
  check("both fabrics retrieved", r.payload?.data?.products?.length === 2, r.payload?.data?.products?.length);

  r = await call("POST", "/api/assistant", { messages: [] });
  check("empty conversation -> 422", r.status === 422, r.status);

  r = await call("POST", "/api/assistant", {
    messages: [{ role: "user", content: "x".repeat(1500) }],
  });
  check("over-long message -> 422", r.status === 422, r.status);

  console.log("\n== in-page links ==");
  // Not in the nav, but on the two most travelled pages in the journey.
  const anyProduct = (await call("GET", "/api/products?limit=1")).payload?.data?.products?.[0];
  for (const href of [
    `/products/${anyProduct.slug}`,
    `/suppliers/${anyProduct.supplier.slug}`,
  ]) {
    const res = await attempt(() =>
      fetch(BASE + href, { headers: { Cookie: cookieHeader() }, redirect: "follow" }),
    );
    check(`${href} -> no dead end`, res.status === 200, res.status);
  }

  p = await page("/suppliers/not-a-real-supplier");
  check("unknown supplier storefront -> 404", p.status === 404, p.status);

  console.log("\n== cross-role guards ==");
  r = await call("POST", "/api/supplier/onboarding", SUPPLIER_ANSWERS);
  check("buyer cannot run supplier onboarding -> 403", r.status === 403, r.payload);

  console.log("\n== supplier onboarding ==");
  jar = {};
  r = await call("POST", "/api/auth/register", supplier);
  check("supplier register -> 201", r.status === 201, r.payload);

  p = await page("/supplier/onboarding");
  check("/supplier/onboarding renders (not 404)", p.status === 200, p.status);

  r = await call("POST", "/api/onboarding", BUYER_ANSWERS);
  check("supplier cannot run buyer onboarding -> 403", r.status === 403, r.payload);

  r = await call("GET", "/api/supplier/dashboard");
  check("no profile yet -> dashboard refuses", r.status === 409, r.status);

  r = await call("POST", "/api/supplier/onboarding", {
    ...SUPPLIER_ANSWERS,
    address: { ...SUPPLIER_ANSWERS.address, postalCode: "12" },
  });
  check("bad PIN code -> 422", r.status === 422, r.payload);

  const supplierTokenBefore = jar.mkt_at;
  r = await call("POST", "/api/supplier/onboarding", SUPPLIER_ANSWERS);
  check("supplier onboarding -> 200", r.status === 200, r.payload);
  check("profile created with a slug", Boolean(r.payload?.data?.user?.profile?.slug), r.payload?.data);
  check("access token re-issued", jar.mkt_at !== supplierTokenBefore);

  const slug = r.payload?.data?.user?.profile?.slug;

  r = await call("GET", "/api/supplier/dashboard");
  check("dashboard reachable once the profile exists", r.status === 200, r.status);

  p = await page("/supplier/onboarding");
  check("supplier onboarding stays reachable for edits", p.status === 200, p.status);

  r = await call("POST", "/api/supplier/onboarding", {
    ...SUPPLIER_ANSWERS,
    minimumOrderQuantity: 250,
  });
  check("re-running updates in place", r.status === 200 && r.payload?.data?.user?.profile?.slug === slug, {
    slug,
    got: r.payload?.data?.user?.profile?.slug,
  });

  console.log("\n== supplier console ==");
  for (const href of [
    "/supplier",
    "/supplier/products",
    "/supplier/products/new",
    "/supplier/orders",
    "/supplier/profile",
  ]) {
    const res = await attempt(() =>
      fetch(BASE + href, { headers: { Cookie: cookieHeader() }, redirect: "follow" }),
    );
    check(`${href} -> no dead end`, res.status === 200, res.status);
  }

  console.log("\n== supplier inventory lifecycle ==");
  const listing = {
    name: `Smoke Poplin ${stamp}`,
    description:
      "A tightly woven combed cotton poplin created by the journey smoke test.",
    category: "Cotton",
    fabricType: "Woven",
    images: ["https://res.cloudinary.com/demo/image/upload/sample.jpg"],
    pricePerUnit: 240,
    unit: "metre",
    stock: 800,
    minimumOrderQuantity: 100,
    status: "active",
  };

  r = await call("POST", "/api/supplier/products", listing);
  check("create listing -> 201", r.status === 201, r.payload);
  const productId = r.payload?.data?.product?.id ?? r.payload?.data?.product?._id;
  check("product id returned", Boolean(productId));

  p = await page(`/supplier/products/${productId}/edit`);
  check("edit page renders", p.status === 200, p.status);
  check("edit form is prefilled", p.html.includes(listing.name), listing.name);

  // A PATCH must leave out what it does not mention. Zod defaults surviving
  // `.partial()` once made an unrelated field update zero the stock and wipe
  // the tags, which is silent data loss.
  r = await call("PATCH", `/api/supplier/products/${productId}`, {
    name: `${listing.name} Mk II`,
  });
  const patched = r.payload?.data?.product;
  check("partial update keeps stock", patched?.stock === listing.stock, patched?.stock);
  check(
    "partial update keeps MOQ",
    patched?.minimumOrderQuantity === listing.minimumOrderQuantity,
    patched?.minimumOrderQuantity,
  );
  check("partial update keeps unit", patched?.unit === listing.unit, patched?.unit);
  check("partial update applies the change", patched?.name?.endsWith("Mk II"), patched?.name);

  r = await call("PATCH", `/api/supplier/products/${productId}`, { status: "draft" });
  check("unlist -> draft", r.payload?.data?.product?.status === "draft", r.payload?.data?.product?.status);

  // The inventory table edits stock and status independently, so restocking an
  // unlisted product must not silently republish it.
  r = await call("PATCH", `/api/supplier/products/${productId}/stock`, { stock: 1200 });
  check(
    "restocking keeps a draft unlisted",
    r.payload?.data?.product?.status === "draft",
    r.payload?.data?.product?.status,
  );

  r = await call("PATCH", `/api/supplier/products/${productId}`, { status: "active" });
  check("republish -> active", r.payload?.data?.product?.status === "active");

  r = await call("PATCH", `/api/supplier/products/${productId}/stock`, { stock: 0 });
  check(
    "zero stock flips an active listing out of stock",
    r.payload?.data?.product?.status === "out_of_stock",
    r.payload?.data?.product?.status,
  );

  r = await call("DELETE", `/api/supplier/products/${productId}`);
  check("delete listing -> 200", r.status === 200, r.payload);

  p = await page(`/supplier/products/${productId}/edit`);
  check("deleted listing 404s", p.status === 404, p.status);

  p = await page("/supplier/products/not-a-real-id/edit");
  check("malformed product id -> 404", p.status === 404, p.status);

  p = await page("/supplier/orders/TM-DOESNOTEXIST");
  check("unknown supplier order -> 404", p.status === 404, p.status);

  console.log(`\n---- ${pass} passed, ${fail} failed ----\n`);
  process.exit(fail ? 1 : 0);
})();
