import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        allow: ["/", "/u/"],
        disallow: [
          "/account",
          "/admin",
          "/api",
          "/auth",
          "/forgot-password",
          "/login",
          "/messages",
          "/notifications",
          "/reset-password",
          "/search",
        ],
        userAgent: "*",
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
