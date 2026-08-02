import { AppError, ok, route } from "@/server/lib/api";
import { connectDB } from "@/server/lib/db";
import { Product, SupplierProfile } from "@/server/models";

export const runtime = "nodejs";

/** GET /api/suppliers/:slug — public storefront: profile plus active catalog. */
export const GET = route(
  async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
    const { slug } = await ctx.params;
    await connectDB();

    const supplier = await SupplierProfile.findOne({ slug }).lean();
    if (!supplier) {
      throw new AppError("NOT_FOUND", "That supplier does not exist.", 404);
    }

    const [products, productCount] = await Promise.all([
      Product.find({ supplier: supplier._id, status: { $in: ["active", "out_of_stock"] } })
        .select("name slug category images pricePerUnit unit stock status rating featured")
        .sort({ featured: -1, rating: -1 })
        .limit(24)
        .lean(),
      Product.countDocuments({ supplier: supplier._id }),
    ]);

    return ok({ supplier, products, productCount });
  },
);
