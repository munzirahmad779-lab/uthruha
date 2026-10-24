import Link from "next/link";
import { BrandMark } from "@/components/brand";

export default function NotFound() {
  return (
    <div className="wrap grid min-h-[60vh] place-items-center py-20">
      <div className="max-w-md text-center">
        <BrandMark className="mx-auto h-12 w-12" />
        <p className="mt-6 font-arabic text-2xl text-ink-700" dir="rtl">
          الصفحة غير موجودة
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink-900">
          Halaman tidak ditemukan
        </h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-ink-600">
          Tautan mungkin sudah berubah. Proyek Anda tetap tersimpan di peramban ini dan bisa
          dibuka dari daftar proyek.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/" className="btn-primary">
            Ke beranda
          </Link>
          <Link href="/proyek" className="btn-ghost">
            Daftar proyek
          </Link>
        </div>
      </div>
    </div>
  );
}
