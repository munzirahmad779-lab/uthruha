"use client";

import { useState, useCallback } from "react";
import type { KandidatFootnote, HasilPencarianRef } from "@/lib/engine/auto-ref";
import type { StatusVerifikasi } from "@/lib/engine/auto-ref";
import { LABEL_STATUS_VERIFIKASI, PERINGATAN_UTAMA, formatPeringatan, PERINGATAN_EKSPOR } from "@/lib/engine/peringatan";
import { AI_PROVIDERS, siapkanEkspor, parseHasilAI, generateDiff } from "@/lib/engine/ai-handoff";
import type { DiffSegment } from "@/lib/engine/ai-handoff";

// ─── Props ────────────────────────────────────────────────────────────────────

interface RefSearchPanelProps {
  hasilPencarian: HasilPencarianRef[];
  markdownAsli: string;
  sectionId: string;
  onTerapkanFootnote?: (kandidat: KandidatFootnote[]) => void;
  onImporAI?: (teksBaru: string) => void;
}

// ─── Komponen Utama ───────────────────────────────────────────────────────────

export function RefSearchPanel({
  hasilPencarian,
  markdownAsli,
  sectionId,
  onTerapkanFootnote,
  onImporAI,
}: RefSearchPanelProps) {
  const [filterJenis, setFilterJenis] = useState<string>("semua");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedRefs, setSelectedRefs] = useState<Set<string>>(new Set());
  const [showAIImport, setShowAIImport] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [diffSegments, setDiffSegments] = useState<DiffSegment[]>([]);
  const [showDiff, setShowDiff] = useState(false);

  // Toggle pilih referensi
  const toggleSelect = useCallback((id: string) => {
    setSelectedRefs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Filter kandidat berdasarkan jenis
  const semuaKandidat = hasilPencarian.flatMap((h) => h.kandidat);
  const filtered = filterJenis === "semua"
    ? semuaKandidat
    : semuaKandidat.filter((k) => k.klasifikasi === filterJenis);

  // Jenis unik untuk filter
  const jenisUnik = [...new Set(semuaKandidat.map((k) => k.klasifikasi))];

  // Terapkan footnote terpilih
  const handleTerapkan = () => {
    const terpilih = semuaKandidat.filter((k) => selectedRefs.has(k.id));
    onTerapkanFootnote?.(terpilih);
  };

  // Ekspor ke AI
  const handleEksporAI = (providerId: string) => {
    const payload = siapkanEkspor(markdownAsli, providerId, sectionId);
    if (!payload) return;

    if (payload.terpotong) {
      alert(formatPeringatan(PERINGATAN_EKSPOR, { provider: payload.provider.nama }) +
        `\n\n${formatPeringatan("⚠️ Naskah terpotong dari {asli} ke {final} karakter.", {
          asli: String(payload.panjangAsli),
          final: String(payload.panjangFinal),
        })}`);
    }

    navigator.clipboard.writeText(payload.promptLengkap).then(() => {
      window.open(payload.url, "_blank");
    });
  };

  // Impor hasil AI
  const handleImporAI = () => {
    const hasil = parseHasilAI(aiInput);
    if (!hasil.berhasil) {
      alert(hasil.pesanError ?? "Gagal memparse hasil AI.");
      return;
    }

    const diff = generateDiff(markdownAsli, hasil.teksNaskah);
    setDiffSegments(diff);
    setShowDiff(true);
  };

  const handleKonfirmasiImpor = () => {
    const hasil = parseHasilAI(aiInput);
    if (hasil.berhasil) {
      onImporAI?.(hasil.teksNaskah);
      setShowDiff(false);
      setShowAIImport(false);
      setAiInput("");
    }
  };

  if (hasilPencarian.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
        Tidak ada referensi yang cocok ditemukan untuk bagian ini.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ⚠️ Peringatan Kritis */}
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm text-amber-900">{PERINGATAN_UTAMA}</p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Filter:</span>
        <button
          onClick={() => setFilterJenis("semua")}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            filterJenis === "semua"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Semua ({semuaKandidat.length})
        </button>
        {jenisUnik.map((j) => {
          const count = semuaKandidat.filter((k) => k.klasifikasi === j).length;
          return (
            <button
              key={j}
              onClick={() => setFilterJenis(j)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterJenis === j
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {j.charAt(0).toUpperCase() + j.slice(1)} ({count})
            </button>
          );
        })}
      </div>

      {/* Daftar Referensi */}
      <div className="space-y-2">
        {filtered.map((k) => {
          const isExpanded = expandedId === k.id;
          const isSelected = selectedRefs.has(k.id);
          const statusInfo = LABEL_STATUS_VERIFIKASI[k.statusVerifikasi] ?? LABEL_STATUS_VERIFIKASI["يحتاج_تحقق"]!;

          return (
            <div
              key={k.id}
              className={`border rounded-lg transition-all ${
                isSelected ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white"
              }`}
            >
              {/* Header Row — selalu terlihat */}
              <div className="flex items-start gap-3 p-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(k.id)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Badge Jenis Sumber */}
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-800">
                      {k.klasifikasi.toUpperCase()}
                    </span>
                    {/* Skor % */}
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      k.skorPersen >= 60 ? "bg-green-100 text-green-800" :
                      k.skorPersen >= 40 ? "bg-yellow-100 text-yellow-800" :
                      "bg-red-100 text-red-800"
                    }`}>
                      {k.skorPersen}% selaras
                    </span>
                    {/* Status Verifikasi */}
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{ backgroundColor: `${statusInfo.warna}20`, color: statusInfo.warna }}
                    >
                      {statusInfo.label}
                    </span>
                  </div>
                  {/* Judul Sumber */}
                  <p className="mt-1 text-sm font-medium text-gray-900 truncate" dir="rtl">
                    {k.sumber.judul}
                  </p>
                  {/* Penulis + Tahun */}
                  <p className="text-xs text-gray-500" dir="rtl">
                    {k.sumber.penulis}، {k.sumber.tahun}
                  </p>
                </div>
                {/* Toggle Detail */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : k.id)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={isExpanded ? "Tutup detail" : "Buka detail"}
                >
                  {isExpanded ? "▲" : "▼"}
                </button>
              </div>

              {/* Expanded Detail — collapsible popup */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-0 ml-7 space-y-2 border-t border-gray-100">
                  {/* Alasan Kecocokan */}
                  <div className="mt-2">
                    <p className="text-xs font-medium text-gray-600">Alasan kecocokan:</p>
                    <p className="text-sm text-gray-800 mt-0.5" dir="rtl">{k.alasan}</p>
                  </div>
                  {/* Kalimat Kunci yang Dicocokkan */}
                  <div>
                    <p className="text-xs font-medium text-gray-600">Kalimat kunci:</p>
                    <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded mt-0.5" dir="rtl">
                      {k.kalimatKunci}
                    </p>
                  </div>
                  {/* Footnote Preview */}
                  <div>
                    <p className="text-xs font-medium text-gray-600">Preview footnote:</p>
                    <p className="text-xs text-gray-700 bg-yellow-50 p-2 rounded mt-0.5 font-mono" dir="rtl">
                      {k.teksFootnote}
                    </p>
                  </div>
                  {/* Status Verifikasi Detail */}
                  <div>
                    <p className="text-xs" style={{ color: statusInfo.warna }}>
                      {statusInfo.deskripsi}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 pt-2">
        <button
          onClick={handleTerapkan}
          disabled={selectedRefs.size === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          ✅ Terapkan {selectedRefs.size} Footnote Terpilih
        </button>
        <button
          onClick={() => setShowAIImport(!showAIImport)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
        >
          🤖 Impor Hasil AI
        </button>
      </div>

      {/* AI Export Buttons */}
      <div className="pt-2">
        <p className="text-xs font-medium text-gray-600 mb-2">Kirim draft ke AI eksternal:</p>
        <div className="flex flex-wrap gap-2">
          {AI_PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => handleEksporAI(p.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: p.warna }}
            >
              {p.nama}
            </button>
          ))}
        </div>
      </div>

      {/* AI Import Panel */}
      {showAIImport && (
        <div className="border border-purple-200 rounded-lg p-4 bg-purple-50 space-y-3">
          <p className="text-sm font-medium text-purple-900">
            Paste hasil dari AI eksternal di bawah ini:
          </p>
          <textarea
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            placeholder="Paste hasil AI di sini (format ---BEGIN_RESULT--- ... ---END_RESULT--- atau footnote [^N])"
            className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            rows={6}
            dir="rtl"
          />
          <div className="flex gap-2">
            <button
              onClick={handleImporAI}
              disabled={!aiInput.trim()}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:bg-gray-300 transition-colors"
            >
              Preview Diff
            </button>
            <button
              onClick={() => { setShowAIImport(false); setAiInput(""); setShowDiff(false); }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Diff Preview */}
      {showDiff && diffSegments.length > 0 && (
        <div className="border border-orange-200 rounded-lg p-4 bg-orange-50 space-y-3">
          <p className="text-sm font-medium text-orange-900">
            Preview perubahan sebelum diterapkan:
          </p>
          <div className="p-3 bg-white rounded border text-sm leading-relaxed" dir="rtl">
            {diffSegments.map((seg, i) => (
              <span
                key={i}
                className={
                  seg.type === "added" ? "bg-green-200 text-green-900 px-0.5 rounded" :
                  seg.type === "removed" ? "bg-red-200 text-red-900 px-0.5 line-through rounded" :
                  ""
                }
              >
                {seg.text}{" "}
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleKonfirmasiImpor}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              ✅ Terapkan Perubahan
            </button>
            <button
              onClick={() => setShowDiff(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
            >
              ❌ Buang
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
