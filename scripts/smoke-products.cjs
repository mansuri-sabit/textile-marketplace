/**
 * Product API smoke test — run against a live dev server:
 *   npm run dev
 *   node scripts/smoke-products.cjs
 *
 * Exercises listing, filtering, faceting, sorting, pagination, semantic search
 * and similar-product ranking against the seeded catalog.
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

async function get(path) {
  const res = await fetch(BASE + path);
  const payload = await res.json().catch(() => null);
  return { status: res.status, payload, data: payload && payload.data };
}

(async () => {
  console.log("\n== listing ==");
  let r = await get("/api/products");
  check("list -> 200", r.status === 200, r.payload);
  check("default page size 24", r.data?.products?.length === 24, r.data?.products?.length);
  check("total is the full catalog", r.data?.total === 105, r.data?.total);
  check("mode is browse without a query", r.data?.mode === "browse", r.data?.mode);
  check("embedding never leaks to client", !JSON.stringify(r.data.products).includes("embedding"));
  check(
    "supplier is populated, not a bare id",
    typeof r.data?.products?.[0]?.supplier?.businessName === "string",
    r.data?.products?.[0]?.supplier,
  );

  console.log("\n== filtering ==");
  r = await get("/api/products?category=Silk");
  check("category filter", r.data.products.every((p) => p.category === "Silk"), r.data.total);
  check("silk count matches seed", r.data.total === 10, r.data.total);

  r = await get("/api/products?category=Cotton,Linen");
  check("multi-category filter", r.data.total === 26, r.data.total);

  r = await get("/api/products?minPrice=1000");
  check("minPrice filter", r.data.products.every((p) => p.pricePerUnit >= 1000), r.data.total);

  r = await get("/api/products?inStockOnly=true");
  check("inStockOnly excludes depleted", r.data.products.every((p) => p.stock > 0));
  check("in-stock total is 94", r.data.total === 94, r.data.total);

  r = await get("/api/products?certification=GOTS");
  check("certification filter returns results", r.data.total > 0, r.data.total);

  r = await get("/api/products?supplier=kanchi-heritage-silks");
  check("supplier slug filter", r.data.total > 0, r.data.total);

  r = await get("/api/products?supplier=does-not-exist");
  check("unknown supplier returns nothing, not everything", r.data.total === 0, r.data.total);

  console.log("\n== sorting ==");
  r = await get("/api/products?sort=price_asc&limit=5");
  const prices = r.data.products.map((p) => p.pricePerUnit);
  check("price ascending", prices.every((v, i) => i === 0 || v >= prices[i - 1]), prices);

  r = await get("/api/products?sort=price_desc&limit=5");
  const desc = r.data.products.map((p) => p.pricePerUnit);
  check("price descending", desc.every((v, i) => i === 0 || v <= desc[i - 1]), desc);

  console.log("\n== pagination ==");
  const p1 = await get("/api/products?limit=10&page=1");
  const p2 = await get("/api/products?limit=10&page=2");
  check("pages report correctly", p1.data.pages === 11, p1.data.pages);
  check(
    "page 2 has different products",
    p1.data.products[0].slug !== p2.data.products[0].slug,
  );

  console.log("\n== facets ==");
  r = await get("/api/products/facets");
  check("facets -> 200", r.status === 200);
  check("all 12 categories counted", r.data.categories.length === 12, r.data.categories.length);
  check("price range present", r.data.price.min > 0 && r.data.price.max > r.data.price.min, r.data.price);
  check("certifications faceted", r.data.certifications.length > 0, r.data.certifications.length);

  r = await get("/api/products/facets?category=Silk");
  check(
    "facets respect active filters",
    r.data.categories.length === 1 && r.data.categories[0].value === "Silk",
    r.data.categories,
  );

  console.log("\n== semantic search ==");
  r = await get("/api/products?q=" + encodeURIComponent("breathable fabric for summer shirts"));
  check("semantic mode engaged", r.data.mode === "semantic", r.data.mode);
  check("returns results", r.data.total > 0, r.data.total);
  console.log("        top 3:", r.data.products.slice(0, 3).map((p) => p.name).join(" | "));

  r = await get("/api/products?q=" + encodeURIComponent("something for a wedding lehenga with gold work"));
  check("understands intent without keyword overlap", r.data.total > 0, r.data.total);
  console.log("        top 3:", r.data.products.slice(0, 3).map((p) => p.name).join(" | "));

  r = await get("/api/products?q=" + encodeURIComponent("heavy denim") + "&category=Denim");
  check("search combines with filters", r.data.products.every((p) => p.category === "Denim"), r.data.total);

  console.log("\n== detail ==");
  r = await get("/api/products/combed-cotton-poplin");
  check("detail -> 200", r.status === 200, r.payload);
  check("has specifications", Boolean(r.data.product.specifications.composition));
  check("supplier profile populated", Boolean(r.data.product.supplier.businessName));
  check("image credits present", r.data.product.imageCredits.length > 0);
  check("embedding not exposed", !JSON.stringify(r.data.product).includes('"embedding"'));

  r = await get("/api/products/no-such-product");
  check("unknown slug -> 404", r.status === 404, r.status);

  console.log("\n== similar ==");
  r = await get("/api/products/kanchipuram-mulberry-silk-with-zari-border/similar?limit=5");
  check("similar -> 200", r.status === 200);
  check("returns 5", r.data.products.length === 5, r.data.products.length);
  check(
    "excludes the source product",
    !r.data.products.some((p) => p.slug === "kanchipuram-mulberry-silk-with-zari-border"),
  );
  console.log("        similar:", r.data.products.map((p) => p.name).join(" | "));

  console.log("\n== suppliers ==");
  r = await get("/api/suppliers");
  check("supplier directory -> 200", r.status === 200);
  check("10 suppliers", r.data.suppliers.length === 10, r.data.suppliers.length);
  check(
    "product counts attached",
    r.data.suppliers.every((s) => typeof s.productCount === "number" && s.productCount > 0),
  );

  r = await get("/api/suppliers/tirupur-knit-works");
  check("supplier storefront -> 200", r.status === 200);
  check("storefront lists products", r.data.products.length > 0, r.data.products.length);

  console.log(`\n---- ${pass} passed, ${fail} failed ----\n`);
  process.exit(fail ? 1 : 0);
})();
