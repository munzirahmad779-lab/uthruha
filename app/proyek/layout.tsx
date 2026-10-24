import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ruang kerja",
  description:
    "Susun struktur, tulis per bagian, kelola istilah dan rujukan, periksa ortografi, lalu ekspor naskah Arab sebagai .docx.",
  robots: { index: false, follow: false },
};

export default function ProyekLayout({ children }: { children: React.ReactNode }) {
  return children;
}
