import { ok, route } from "@/server/lib/api";
import { connectDB } from "@/server/lib/db";
import { Product, SupplierProfile } from "@/server/models";

export const runtime = "nodejs";

/** GET /api/suppliers — directory listing with live product counts. */
export const GET = route(async () => {
  await connectDB();

  const suppliers = await SupplierProfile.find()
    .select("businessName slug businessType description logoUrl address categories verified rating ratingCount minimumOrderQuantity yearEstablished")
    .sort({ verified: -1, rating: -1 })
    .lean();

  // One grouped count beats N per-supplier queries.
  const counts = await Product.aggregate<{ _id: unknown; count: number }>([
    { $match: { status: { $in: ["active", "out_of_stock"] } } },
    { $group: { _id: "$supplier", count: { $sum: 1 } } },
  ]);
  const countBySupplier = new Map(counts.map((c) => [String(c._id), c.count]));

  return ok({
    suppliers: suppliers.map((s) => ({
      ...s,
      productCount: countBySupplier.get(String(s._id)) ?? 0,
    })),
  });
});
