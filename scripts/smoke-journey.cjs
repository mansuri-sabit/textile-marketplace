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

  console.log(`\n---- ${pass} passed, ${fail} failed ----\n`);
  process.exit(fail ? 1 : 0);
})();
