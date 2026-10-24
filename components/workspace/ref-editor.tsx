"use client";

import { useState, useCallback } from "react";
import type { Sumber } from "@/lib/engine/cite";
import type { StatusVerifikasi } from "@/lib/engine/auto-ref";
import { LABEL_STATUS_VERIFIKASI } from "@/lib/engine/peringatan";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EditHistory {
  section: string;
  action: "edit_ref" | "edit_naskah" | "hapus_ref" | "tambah_ref";
  before: string;
  after: string;
  timestamp: string;
}

interface RefEditorProps {
  sumber: Sumber;
  statusVerifikasi: StatusVerifikasi;
  onSave: (updated: Sumber, history: EditHistory) => void;
  onDelete?: (id: string, history: EditHistory) => void;
}

// ─── Komponen Editor Rujukan ──────────────────────────────────────────────────

export function RefEditor({ sumber, statusVerifikasi, onSave, onDelete }: RefEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Sumber>({ ...sumber });
  const statusInfo = LABEL_STATUS_VERIFIKASI[statusVerifikasi] ?? LABEL_STATUS_VERIFIKASI["يحتاج_تحقق"]!;

  const handleSave = () => {
    const history: EditHistory = {
      section: "", // Diisi oleh parent
      action: "edit_ref",
      before: JSON.stringify(sumber),
      after: JSON.stringify(draft),
      timestamp: new Date().toISOString(),
    };
    onSave(draft, history);
    setEditing(false);
  };

  const handleDelete = () => {
    if (!onDelete) return;
    if (!confirm("Hapus rujukan ini?")) return;
    const history: EditHistory = {
      section: "",
      action: "hapus_ref",
      before: JSON.stringify(sumber),
      after: "",
      timestamp: new Date().toISOString(),
    };
    onDelete(sumber.id, history);
  };

  const handleCancel = () => {
    setDraft({ ...sumber });
    setEditing(false);
  };

  const updateField = (field: keyof Sumber, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  if (!editing) {
    return (
      <div className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg bg-white group hover:border-blue-300 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-800">
              {sumber.jenis.toUpperCase()}
            </span>
            <span
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: `${statusInfo.warna}20`, color: statusInfo.warna }}
            >
              {statusInfo.label}
            </span>
            {statusVerifikasi === "محرر_يدويًّا" && (
              <span className="text-xs text-purple-600 italic">✏️ Diedit manual</span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-900" dir="rtl">{sumber.judul}</p>
          <p className="text-xs text-gray-500" dir="rtl">
            {sumber.penulis}، {sumber.tahun}
            {sumber.halaman ? `، ص ${sumber.halaman}` : ""}
          </p>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setEditing(true)}
            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
          >
            ✏️ Edit
          </button>
          {onDelete && (
            <button
              onClick={handleDelete}
              className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
            >
              🗑️
            </button>
          )}
        </div>
      </div>
    );
  }

  // Editing mode
  const fields: Array<{ key: keyof Sumber; label: string; rtl?: boolean }> = [
    { key: "penulis", label: "Penulis", rtl: true },
    { key: "judul", label: "Judul", rtl: true },
    { key: "tahun", label: "Tahun" },
    { key: "kota", label: "Kota", rtl: true },
    { key: "penerbit", label: "Penerbit", rtl: true },
    { key: "jurnal", label: "Jurnal", rtl: true },
    { key: "volume", label: "Volume" },
    { key: "nomor", label: "Nomor" },
    { key: "halaman", label: "Halaman" },
    { key: "doi", label: "DOI" },
    { key: "url", label: "URL" },
    { key: "jilid", label: "Jilid" },
  ];

  return (
    <div className="p-4 border-2 border-blue-400 rounded-lg bg-blue-50 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-blue-900">Edit Rujukan</h4>
        <span className="text-xs text-purple-600 italic">Status akan berubah ke ✏️ Diedit Manual</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map(({ key, label, rtl }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
            <input
              type="text"
              value={(draft[key] as string) ?? ""}
              onChange={(e) => updateField(key, e.target.value)}
              dir={rtl ? "rtl" : "ltr"}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          💾 Simpan
        </button>
        <button
          onClick={handleCancel}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
        >
          Batal
        </button>
      </div>
    </div>
  );
}

// ─── Riwayat Perubahan ────────────────────────────────────────────────────────

interface HistoryPanelProps {
  history: EditHistory[];
  onUndo?: (index: number) => void;
}

export function HistoryPanel({ history, onUndo }: HistoryPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (history.length === 0) return null;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 bg-gray-50 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors flex justify-between items-center"
      >
        <span>📋 Riwayat Perubahan ({history.length})</span>
        <span>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
          {[...history].reverse().map((h, i) => (
            <div key={i} className="px-4 py-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-800">
                  {h.action === "edit_ref" ? "✏️ Edit rujukan" :
                   h.action === "edit_naskah" ? "✏️ Edit naskah" :
                   h.action === "hapus_ref" ? "🗑️ Hapus rujukan" :
                   "➕ Tambah rujukan"}
                </span>
                <span className="text-gray-400">
                  {new Date(h.timestamp).toLocaleString("id-ID")}
                </span>
              </div>
              {onUndo && (
                <button
                  onClick={() => onUndo(history.length - 1 - i)}
                  className="mt-1 text-blue-600 hover:text-blue-800 text-xs underline"
                >
                  Undo
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
