import mongoose from "mongoose";
import { connectDB } from "../src/server/lib/db";
import { Product, SupplierProfile, Order, User } from "../src/server/models";

async function main() {
  await connectDB();

  const total = await Product.countDocuments();
  const active = await Product.countDocuments({ status: "active" });
  const oos = await Product.countDocuments({ status: "out_of_stock" });
  const featured = await Product.countDocuments({ featured: true });
  console.log(`products: ${total} (active ${active}, out of stock ${oos}, featured ${featured})`);

  const noImages = await Product.countDocuments({ images: { $size: 0 } });
  console.log(`products with no images: ${noImages}`);

  const byCat = await Product.aggregate([
    { $group: { _id: "$category", n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]);
  console.log("by category:", byCat.map((c) => `${c._id}=${c.n}`).join(", "));

  const withEmbedding = await Product.countDocuments({ embedding: { $exists: true } });
  const sample = await Product.findOne({ featured: true })
    .select("+embedding +embeddingMeta")
    .lean();
  console.log(`embedded: ${withEmbedding}/${total}`);
  console.log(
    `sample vector: dim=${sample?.embedding?.length} meta=${JSON.stringify(sample?.embeddingMeta)}`,
  );

  const variantNames = await Product.find({ name: /—/ }).select("name").limit(3).lean();
  console.log("variant naming:", variantNames.map((p) => p.name).join(" | "));

  const priceRange = await Product.aggregate([
    { $group: { _id: null, min: { $min: "$pricePerUnit" }, max: { $max: "$pricePerUnit" } } },
  ]);
  console.log(`price range: ₹${priceRange[0].min} - ₹${priceRange[0].max}`);

  console.log(`suppliers: ${await SupplierProfile.countDocuments()}`);
  console.log(`orders: ${await Order.countDocuments()}`);
  console.log(`users: ${await User.countDocuments()}`);

  // Confirm the hosted images actually resolve.
  const withImg = await Product.findOne({ "images.0": { $exists: true } }).lean();
  const url = withImg?.images?.[0];
  if (url) {
    const res = await fetch(url, { method: "HEAD" });
    console.log(`image HEAD ${res.status} ${res.headers.get("content-type")} ${res.headers.get("content-length")} bytes`);
    console.log(`credit: ${JSON.stringify(withImg?.imageCredits?.[0])}`);
  }

  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
