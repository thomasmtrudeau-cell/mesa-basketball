import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.mesabasketballtraining.com";
  return [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/schedule`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/my-bookings`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];
}
