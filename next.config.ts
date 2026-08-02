import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Catalog and supplier-uploaded imagery is all re-hosted on Cloudinary.
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  // Server Components import the service layer directly; keep Mongoose out of
  // the bundler's module graph so its dynamic requires resolve at runtime.
  serverExternalPackages: ["mongoose", "bcryptjs"],
};

export default nextConfig;
