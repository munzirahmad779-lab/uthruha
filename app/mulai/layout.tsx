import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mulai proyek baru",
  description:
    "Lima langkah singkat: pilih jenis karya, bidang, metode, data penelitian, dan rumusan masalah. Tanpa akun, tanpa biaya.",
  alternates: { canonical: "/mulai" },
};

export default function MulaiLayout({ children }: { children: React.ReactNode }) {
  return children;
}
