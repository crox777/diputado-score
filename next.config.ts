import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Diputado photos: Delfino CloudFront (robots-permitted). asamblea.go.cr/SiteAssets is
      // robots-disallowed, so it is NOT used as an image source.
      { protocol: "https", hostname: "d1qqtien6gys07.cloudfront.net" },
      { protocol: "https", hostname: "delfino.cr" },
      { protocol: "https", hostname: "acontecer.co.cr" },
    ],
  },
};

export default nextConfig;
