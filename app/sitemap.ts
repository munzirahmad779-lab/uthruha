import type { MetadataRoute } from "next";

const BASE = "https://kitabah.web.id";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${BASE}/panduan`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/alat`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/jurnal`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/mulai`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
    { url: `${BASE}/privasi`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/ketentuan`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
