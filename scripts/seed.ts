/**
 * Seeds the marketplace with suppliers, a fabric catalog, a demo buyer and
 * sample orders.
 *
 *   npm run seed              # full run
 *   npm run seed -- --wipe    # clear existing data first
 *   npm run seed -- --no-images      # reuse cache / placeholders, skip Pexels
 *   npm run seed -- --no-embeddings  # skip semantic search vectors
 *
 * Photo sourcing is cached in scripts/seed-images.json and committed, so a
 * re-seed costs no Pexels quota and works without an API key.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";

import { connectDB } from "../src/server/lib/db";
import { embed } from "../src/server/lib/embeddings";
import { hashPassword } from "../src/server/lib/password";
import { searchPhotos } from "../src/server/lib/pexels";
import { uploadFromUrl } from "../src/server/lib/cloudinary";
import { pooled, slugify } from "../src/server/lib/slug";
import { integrations } from "../src/server/lib/env";
import { Cart, Order, Product, SupplierProfile, User } from "../src/server/models";
import { SEED_SUPPLIERS } from "../src/server/data/suppliers";
import { SEED_FABRICS, type SeedFabric } from "../src/server/data/fabrics";

const args = new Set(process.argv.slice(2));
const WIPE = args.has("--wipe");
const DO_IMAGES = !args.has("--no-images");
const DO_EMBEDDINGS = !args.has("--no-embeddings");

const CACHE_PATH = resolve(process.cwd(), "scripts/seed-images.json");
const IMAGES_PER_PRODUCT = 3;

type CachedPhoto = { url: string; photographer: string; sourceUrl: string };
type ImageCache = Record<string, CachedPhoto[]>;

/**
 * Deterministic PRNG so repeated seeds produce identical stock levels and
 * ratings — a diff between two seed runs should be empty, not noise.
 */
function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function log(msg: string) {
  console.log(msg);
}

function loadCache(): ImageCache {
  if (!existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_PATH, "utf8")) as ImageCache;
  } catch {
    return {};
  }
}

function saveCache(cache: ImageCache) {
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + "\n", "utf8");
}

/**
 * Resolves photography for one fabric: cache first, then Pexels + Cloudinary.
 * Falls back to an empty list rather than throwing — a missing photo should
 * degrade one product card, not abort the whole seed.
 */
async function sourceImages(
  fabric: SeedFabric,
  cache: ImageCache,
): Promise<CachedPhoto[]> {
  const key = fabric.imageQuery;
  if (cache[key]?.length) return cache[key];

  if (!DO_IMAGES || !integrations.cloudinary() || !process.env.PEXELS_API_KEY) {
    return [];
  }

  try {
    const photos = await searchPhotos(key, IMAGES_PER_PRODUCT);
    const slug = slugify(fabric.name);

    const uploaded = await pooled(photos, 3, async (photo, i) => {
      const { url } = await uploadFromUrl(photo.url, `${slug}-${i + 1}`);
      return {
        url,
        photographer: photo.photographer,
        sourceUrl: photo.pexelsUrl,
      };
    });

    cache[key] = uploaded;
    return uploaded;
  } catch (err) {
    console.warn(`  ! images failed for "${fabric.name}": ${(err as Error).message}`);
    return [];
  }
}

/** The text the semantic index actually matches against. */
function embeddingText(f: SeedFabric, name: string): string {
  return [
    name,
    f.category,
    f.fabricType,
    f.composition,
    f.description,
    f.weave,
    f.finish,
    f.tags.join(" "),
    f.colors.map((c) => c.name).join(" "),
  ].join(". ");
}

async function seedSuppliers() {
  log("\nSuppliers");
  const passwordHash = await hashPassword("Supplier123");
  const byKey = new Map<string, mongoose.Types.ObjectId>();

  for (const s of SEED_SUPPLIERS) {
    const user = await User.findOneAndUpdate(
      { email: s.account.email },
      {
        $set: {
          name: s.account.name,
          email: s.account.email,
          passwordHash,
          role: "supplier",
          phone: s.contactPhone,
          onboardingCompleted: true,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );

    const profile = await SupplierProfile.findOneAndUpdate(
      { slug: s.slug },
      {
        $set: {
          user: user._id,
          businessName: s.businessName,
          slug: s.slug,
          businessType: s.businessType,
          description: s.description,
          contactEmail: s.contactEmail,
          contactPhone: s.contactPhone,
          website: s.website,
          address: { ...s.address, country: "India" },
          categories: s.categories,
          fabricTypes: s.fabricTypes,
          minimumOrderQuantity: s.minimumOrderQuantity,
          gstNumber: s.gstNumber,
          yearEstablished: s.yearEstablished,
          verified: s.verified,
          rating: s.rating,
          ratingCount: s.ratingCount,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );

    byKey.set(s.key, profile._id as mongoose.Types.ObjectId);
    log(`  ${s.businessName} (${s.address.city})`);
  }

  return byKey;
}

async function seedProducts(supplierIds: Map<string, mongoose.Types.ObjectId>) {
  log("\nCatalog");
  const cache = loadCache();
  const rand = makeRandom(20260802);

  let created = 0;
  let embedded = 0;
  let embeddingProvider = "";

  for (const fabric of SEED_FABRICS) {
    const photos = await sourceImages(fabric, cache);
    const supplier = supplierIds.get(fabric.supplierKey);
    if (!supplier) continue;

    // A base SKU plus its sibling weights, all sharing the same photography.
    const editions = [
      { name: fabric.name, gsm: fabric.gsm, price: fabric.pricePerUnit },
      ...(fabric.variants ?? []).map((v) => ({
        name: `${fabric.name} — ${v.suffix}`,
        gsm: v.gsm,
        price: fabric.pricePerUnit + v.priceDelta,
      })),
    ];

    for (const edition of editions) {
      const stock = Math.round(rand() * 1800) + 40;
      // A handful of deliberately depleted SKUs so the supplier dashboard's
      // inventory alerts and the "out of stock" UI have something to show.
      const depleted = rand() < 0.08;

      const slug = slugify(edition.name);

      const doc: Record<string, unknown> = {
        supplier,
        name: edition.name,
        slug,
        description: fabric.description,
        category: fabric.category,
        fabricType: fabric.fabricType,
        images: photos.map((p) => p.url),
        imageCredits: photos.map((p) => ({
          photographer: p.photographer,
          sourceUrl: p.sourceUrl,
        })),
        colors: fabric.colors.map((c) => ({ ...c, inStock: true })),
        specifications: {
          gsm: edition.gsm,
          widthInches: fabric.widthInches,
          composition: fabric.composition,
          weave: fabric.weave,
          finish: fabric.finish,
          shrinkage: fabric.shrinkage,
          careInstructions: fabric.careInstructions,
          certifications: fabric.certifications ?? [],
        },
        pricePerUnit: edition.price,
        unit: fabric.unit ?? "metre",
        currency: "INR",
        bulkTiers: [
          {
            minQuantity: fabric.minimumOrderQuantity * 5,
            pricePerUnit: Math.round(edition.price * 0.93),
          },
          {
            minQuantity: fabric.minimumOrderQuantity * 20,
            pricePerUnit: Math.round(edition.price * 0.86),
          },
        ],
        stock: depleted ? 0 : stock,
        minimumOrderQuantity: fabric.minimumOrderQuantity,
        status: depleted ? "out_of_stock" : "active",
        featured: Boolean(fabric.featured) && edition.name === fabric.name,
        tags: fabric.tags,
        rating: Math.round((3.6 + rand() * 1.4) * 10) / 10,
        ratingCount: Math.round(rand() * 180) + 8,
        viewCount: Math.round(rand() * 4000),
        orderCount: Math.round(rand() * 120),
      };

      if (DO_EMBEDDINGS) {
        try {
          const result = await embed(embeddingText(fabric, edition.name));
          doc.embedding = result.vector;
          doc.embeddingMeta = { provider: result.provider, dim: result.dim };
          embeddingProvider = result.provider;
          embedded++;
        } catch (err) {
          console.warn(`  ! embedding failed for "${edition.name}": ${(err as Error).message}`);
        }
      }

      await Product.findOneAndUpdate({ slug }, { $set: doc }, { upsert: true });
      created++;
    }

    log(
      `  ${fabric.name} -> ${editions.length} SKU${editions.length > 1 ? "s" : ""}, ${photos.length} image${photos.length === 1 ? "" : "s"}`,
    );
  }

  saveCache(cache);
  log(`\n  ${created} products, ${embedded} embedded via ${embeddingProvider || "none"}`);
}

async function seedBuyerAndOrders() {
  log("\nDemo buyer and orders");
  const passwordHash = await hashPassword("Buyer123");

  const buyer = await User.findOneAndUpdate(
    { email: "buyer@demo.test" },
    {
      $set: {
        name: "Priya Menon",
        email: "buyer@demo.test",
        passwordHash,
        role: "buyer",
        phone: "+91 98450 22178",
        onboardingCompleted: true,
        buyerPreferences: {
          businessType: "Boutique / Designer",
          industry: "Apparel & Fashion",
          interestedCategories: ["Cotton", "Linen", "Silk"],
          preferredFabricTypes: ["Handloom", "Woven"],
          typicalOrderQuantity: "100 - 500",
          budgetRange: "₹2,00,000 - ₹10,00,000",
          notes:
            "Sources natural fibres for a Bengaluru-based womenswear label. Prefers GOTS or handloom certified suppliers and small-batch runs.",
        },
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );

  await Cart.findOneAndUpdate(
    { buyer: buyer._id },
    { $setOnInsert: { buyer: buyer._id, items: [] } },
    { upsert: true },
  );

  // Orders spread across statuses so both dashboards have content on first load.
  const statuses = ["pending", "accepted", "preparing", "ready_for_dispatch", "completed"] as const;
  const shippingAddress = {
    fullName: "Priya Menon",
    phone: "+91 98450 22178",
    line1: "42 Kasturba Cross Road",
    line2: "Shanthala Nagar",
    city: "Bengaluru",
    state: "Karnataka",
    postalCode: "560001",
  };

  await Order.deleteMany({ buyer: buyer._id });

  const products = await Product.find({ status: "active" }).limit(40).lean();
  const rand = makeRandom(99);
  let made = 0;

  for (let i = 0; i < statuses.length; i++) {
    const picked = products.slice(i * 3, i * 3 + 2);
    if (picked.length === 0) continue;

    const items = picked.map((p) => {
      const quantity = (p.minimumOrderQuantity ?? 1) * (1 + Math.floor(rand() * 4));
      return {
        product: p._id,
        name: p.name,
        image: p.images?.[0],
        color: p.colors?.[0]?.name,
        unit: p.unit,
        quantity,
        pricePerUnit: p.pricePerUnit,
        lineTotal: quantity * p.pricePerUnit,
      };
    });

    const subtotal = items.reduce((sum, it) => sum + it.lineTotal, 0);
    const taxAmount = Math.round(subtotal * 0.05);
    const daysAgo = (statuses.length - i) * 4;

    await Order.create({
      orderNumber: `TM-${20260000 + i + 1}`,
      buyer: buyer._id,
      supplier: picked[0].supplier,
      checkoutGroupId: `seed-group-${i + 1}`,
      items,
      shippingAddress,
      subtotal,
      shippingFee: 0,
      taxAmount,
      total: subtotal + taxAmount,
      status: statuses[i],
      statusHistory: [{ status: "pending", at: new Date(Date.now() - daysAgo * 86400000) }],
      createdAt: new Date(Date.now() - daysAgo * 86400000),
    });
    made++;
  }

  log(`  buyer@demo.test / Buyer123 with ${made} orders`);
}

async function main() {
  const started = Date.now();
  await connectDB();
  log(`Connected to ${mongoose.connection.name}`);

  if (WIPE) {
    log("\nWiping existing marketplace data");
    await Promise.all([
      Product.deleteMany({}),
      SupplierProfile.deleteMany({}),
      Order.deleteMany({}),
      Cart.deleteMany({}),
      User.deleteMany({ email: /@demo\.test$/ }),
    ]);
  }

  const supplierIds = await seedSuppliers();
  await seedProducts(supplierIds);
  await seedBuyerAndOrders();

  const counts = {
    users: await User.countDocuments(),
    suppliers: await SupplierProfile.countDocuments(),
    products: await Product.countDocuments(),
    orders: await Order.countDocuments(),
  };

  log(`\nDone in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  log(`  users=${counts.users} suppliers=${counts.suppliers} products=${counts.products} orders=${counts.orders}`);
  log("\nDemo logins");
  log("  buyer     buyer@demo.test / Buyer123");
  log("  supplier  supplier.meridian@demo.test / Supplier123");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("\nSeed failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
