import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        allow: ["/", "/gigs/", "/merch/", "/p/", "/stuff/", "/support", "/t/", "/u/"],
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
          "/saved",
          "/search",
          "/signup",
        ],
        userAgent: "*",
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
