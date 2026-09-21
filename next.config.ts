import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  {
    key: "Content-Security-Policy",
    value: ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"].join("; "),
  },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

// Only this shop's Cloudinary account: otherwise /_next/image would fetch, resize and
// cache images from anyone's account. Must be set at build time and at runtime.
const cloudinaryCloud = process.env.CLOUDINARY_CLOUD_NAME?.trim();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 85],
    localPatterns: [{ pathname: "/media/**" }, { pathname: "/images/**" }],
    remotePatterns:
      cloudinaryCloud && /^[A-Za-z0-9_-]+$/.test(cloudinaryCloud)
        ? [{ protocol: "https", hostname: "res.cloudinary.com", port: "", pathname: `/${cloudinaryCloud}/image/upload/**`, search: "" }]
        : [],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      {
        source: "/order/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          // Order links are secret; pages opened from one only learn our origin (overrides the rule above).
          { key: "Referrer-Policy", value: "strict-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
