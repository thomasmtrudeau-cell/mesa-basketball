import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/about", "/schedule"],
      disallow: ["/login", "/signup", "/my-bookings", "/settings", "/admin", "/forgot-password", "/reset-password"],
    },
    sitemap: "https://www.mesabasketballtraining.com/sitemap.xml",
  };
}
