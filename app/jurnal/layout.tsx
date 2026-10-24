import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Direktori jurnal berbahasa Arab",
  description:
    "30 jurnal kajian Islam Indonesia dan internasional yang menerima naskah berbahasa Arab, lengkap dengan pemadu berbasis kata kunci dan catatan verifikasi.",
  alternates: { canonical: "/jurnal" },
};

export default function JurnalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
