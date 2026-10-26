/**
 * Google Drive Storage — Utruha v2.0
 *
 * Menyimpan progres proyek mahasiswa di Google Drive mereka sendiri.
 * Menggunakan OAuth2 dengan scope drive.file (hanya file yang dibuat aplikasi ini).
 *
 * Arsitektur:
 * - Frontend: Google Identity Services (GIS) untuk OAuth popup
 * - Backend proxy di Vercel untuk refresh token & API calls yang butuh server key
 * - File disimpan sebagai JSON di folder /Utruha/{project-id}/
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProyekTersimpan {
  project_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  sections: Record<string, { markdown: string; key_sentences: string[]; last_edited: string }>;
  references: Array<{
    id: string;
    source: Record<string, unknown>;
    verification: string;
    edited_manually: boolean;
  }>;
  ai_sessions: Array<{
    id: string;
    provider: string;
    prompt: string;
    result: string;
    imported: boolean;
    timestamp: string;
  }>;
  edit_history: Array<{
    section: string;
    action: string;
    before: string;
    after: string;
    timestamp: string;
  }>;
}

export interface DriveFileMeta {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  parents?: string[];
}

// ─── Konfigurasi ──────────────────────────────────────────────────────────────

const APP_FOLDER = "Utruha";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

/** Client ID harus diisi dari env variable. */
function getClientId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
}

// ─── OAuth Flow (Frontend) ────────────────────────────────────────────────────

/**
 * Pemuatan Google Identity Services (GIS) yang dibagi bersama.
 *
 * Perbaikan dari pola lama: dulu setiap pemanggil memasang <script> sendiri
 * dan `requestDriveAccess()` TIDAK memasang `error_callback`. Akibatnya bila
 * popup Google gagal — ditutup pengguna, diblokir browser, origin belum
 * diizinkan, atau akses ditolak — tidak ada callback yang terpanggil sama
 * sekali dan UI menggantung selamanya di "Menghubungkan...". Kini semua
 * jalur kegagalan berakhir sebagai Error berpesan jelas + batas waktu.
 */
let janjiGIS: Promise<void> | null = null;

export function muatGIS(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("GIS hanya tersedia di browser."));
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve();
  if (janjiGIS) return janjiGIS;
  janjiGIS = new Promise<void>((resolve, reject) => {
    const selesai = window.setInterval(() => {
      if ((window as any).google?.accounts?.oauth2) {
        window.clearInterval(selesai);
        window.clearTimeout(batas);
        resolve();
      }
    }, 100);
    const batas = window.setTimeout(() => {
      window.clearInterval(selesai);
      janjiGIS = null;
      reject(new Error("Google Identity Services tidak termuat dalam 15 detik. Periksa koneksi internet lalu muat ulang halaman."));
    }, 15000);
    if (!document.getElementById("google-identity-services")) {
      const script = document.createElement("script");
      script.id = "google-identity-services";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onerror = () => {
        window.clearInterval(selesai);
        window.clearTimeout(batas);
        janjiGIS = null;
        reject(new Error("Gagal memuat skrip Google Identity Services dari accounts.google.com."));
      };
      document.head.appendChild(script);
    }
  });
  return janjiGIS;
}

/** Terjemahkan kode error GIS menjadi pesan yang bisa ditindaklanjuti. */
function pesanErrorGIS(type: string | undefined): string {
  switch (type) {
    case "popup_closed":
    case "popup_closed_by_user":
      return "Popup Google ditutup sebelum login selesai. Klik tombol masuk lagi dan selesaikan pilihan akun di popup. Bila popup sempat menampilkan pesan dari Google (mis. Error 400 atau “Access blocked”), catat teksnya — penyebabnya ada di pengaturan Google Cloud (alamat situs/pengguna uji), bukan di tombol ini.";
    case "popup_failed_to_open":
      return "Popup Google gagal dibuka — browser memblokirnya. Izinkan popup untuk situs ini lalu coba lagi.";
    case "access_denied":
      return "Google menolak akun ini. Penyebab tersering: akun Anda belum didaftarkan pengelola sebagai pengguna uji (aplikasi masih mode pengujian), atau izin Drive tidak diberikan. Pakai akun yang terdaftar dan setujui izinnya; bila tetap ditolak, sampaikan pesan ini ke pengelola.";
    case "idpiframe_initialization_failed":
      return "Browser memblokir cookie pihak ketiga yang dibutuhkan login Google. Matikan pemblokiran cookie untuk situs ini, hindari mode incognito/penyamaran, atau coba Google Chrome.";
    case "invalid_request":
      return "Google menolak permintaan login dari alamat situs ini. Alamat situs (origin) kemungkinan belum didaftarkan di Google Cloud Console → Credentials → Authorized JavaScript origins.";
    default:
      return `Login Google gagal (${type ?? "kesalahan tidak dikenal"}). Coba lagi di Google Chrome dengan popup & cookie diizinkan; bila berulang, catat pesan ini untuk pengelola.`;
  }
}

/**
 * Deteksi browser DALAM aplikasi (WhatsApp, Instagram, Facebook, TikTok, dsb.).
 * Google menolak login OAuth di webview semacam itu, jadi pengguna harus
 * diarahkan membuka situs di Chrome/browser penuh sebelum mencoba login.
 */
export function browserDalamAplikasi(ua?: string): boolean {
  const s = (ua ?? (typeof navigator !== "undefined" ? navigator.userAgent : "")).toLowerCase();
  if (!s) return false;
  return (
    s.includes("whatsapp") ||
    s.includes("instagram") ||
    s.includes("fban") ||
    s.includes("fbav") ||
    s.includes("tiktok") ||
    s.includes("musical_ly") ||
    s.includes("line/") ||
    s.includes("telegram") ||
    (s.includes("android") && s.includes("; wv)"))
  );
}

/**
 * Minta access token Drive lewat popup GIS.
 * Melempar Error berpesan jelas pada SEMUA kegagalan (tidak pernah menggantung).
 */
export async function mintaTokenDrive(): Promise<string> {
  await muatGIS();
  const clientId = getClientId();
  if (!clientId || clientId.includes("PASTE_")) {
    throw new Error("NEXT_PUBLIC_GOOGLE_CLIENT_ID belum diatur di server, jadi login Drive belum bisa dipakai. Hubungi pengelola web.");
  }
  const google = (window as any).google;
  return new Promise<string>((resolve, reject) => {
    let selesai = false;
    const batas = window.setTimeout(() => {
      if (selesai) return;
      selesai = true;
      reject(new Error("Login Google tidak selesai dalam 90 detik (popup mungkin tertutup atau terblokir). Coba lagi dan selesaikan pilihan akun di popup."));
    }, 90000);
    const akhiri = (fn: () => void) => {
      if (selesai) return;
      selesai = true;
      window.clearTimeout(batas);
      fn();
    };
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response: any) => {
        akhiri(() => {
          if (response?.access_token) resolve(response.access_token);
          else reject(new Error(pesanErrorGIS(response?.error)));
        });
      },
      error_callback: (err: any) => {
        akhiri(() => reject(new Error(pesanErrorGIS(err?.type))));
      },
    });
    client.requestAccessToken();
  });
}

/** Kompat lama: token atau null (kesalahan dicatat ke konsol). */
export async function requestDriveAccess(): Promise<string | null> {
  try {
    return await mintaTokenDrive();
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    return null;
  }
}

/** Inisialisasi lama — dipertahankan agar pemanggil lawas tidak rusak. */
export function initGoogleAuth(onToken: (token: string) => void): void {
  void mintaTokenDrive().then(onToken).catch(() => undefined);
}

// ─── Simpanan token (sessionStorage, sadar kedaluwarsa ±1 jam) ────────────────

const KEY_TOKEN = "uthruha_gdrive_token";
const KEY_TOKEN_EXP = "uthruha_gdrive_token_exp";

/** Simpan token + perkiraan kedaluwarsanya (token GIS berlaku ±3600 detik). */
export function simpanTokenDrive(token: string): void {
  try {
    sessionStorage.setItem(KEY_TOKEN, token);
    sessionStorage.setItem(KEY_TOKEN_EXP, String(Date.now() + 55 * 60 * 1000));
  } catch { /* abaikan */ }
}

/** Ambil token tersimpan; null bila tidak ada atau sudah kedaluwarsa. */
export function ambilTokenDrive(): string | null {
  try {
    const token = sessionStorage.getItem(KEY_TOKEN);
    const exp = Number(sessionStorage.getItem(KEY_TOKEN_EXP) ?? 0);
    if (!token || !exp || Date.now() > exp) return null;
    return token;
  } catch {
    return null;
  }
}

/** Buang token tersimpan (logout / token ditolak server). */
export function hapusTokenDrive(): void {
  try {
    sessionStorage.removeItem(KEY_TOKEN);
    sessionStorage.removeItem(KEY_TOKEN_EXP);
  } catch { /* abaikan */ }
}

/** Benar bila pesan error berasal dari token yang ditolak (HTTP 401). */
export function galatToken(pesan: string): boolean {
  return /\b401\b/.test(pesan);
}

// ─── Drive CRUD ───────────────────────────────────────────────────────────────

async function driveAPI(path: string, token: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    // Sertakan pesan asli Google agar penyebabnya terbaca (mis. Drive API
    // belum diaktifkan di project, kuota, atau token ditolak) — bukan sekadar kode.
    let rincian = "";
    try {
      const badan = await res.json();
      const pesan: string | undefined = badan?.error?.message;
      const alasan: string | undefined = badan?.error?.errors?.[0]?.reason;
      if (pesan) rincian = ` — ${pesan}${alasan ? ` (${alasan})` : ""}`;
    } catch { /* badan bukan JSON; abaikan */ }
    if (res.status === 403 && /has not been used in project|accessNotConfigured|Drive API/i.test(rincian)) {
      throw new Error(`Drive API error: 403${rincian}. Pengelola: aktifkan "Google Drive API" di Google Cloud Console → APIs & Services untuk project ini.`);
    }
    throw new Error(`Drive API error: ${res.status} ${res.statusText}${rincian}`);
  }
  return res.json();
}

// ─── Konversi Project workspace ↔ ProyekTersimpan ────────────────────────────
import type { Project } from "@/lib/engine/project";

/**
 * Project (bentuk workspace/localStorage) → ProyekTersimpan (bentuk Drive).
 * Arah sebaliknya TIDAK di sini: muat dari Drive wajib lewat gerbang
 * migrasiProyek() di lib/engine/project.ts agar bentuk lama tetap terbaca.
 */
export function projectKeTersimpan(p: Project): ProyekTersimpan {
  const sekarang = new Date().toISOString();
  return {
    project_id: p.id,
    title: p.judulAr || p.topikAr || "",
    created_at: p.dibuat,
    updated_at: p.diperbarui || sekarang,
    sections: Object.fromEntries(
      Object.entries(p.draf).map(([id, markdown]) => [
        id,
        { markdown, key_sentences: [], last_edited: sekarang },
      ]),
    ),
    references: p.sumber.map((s) => ({
      id: s.id,
      source: { ...s } as unknown as Record<string, unknown>,
      verification: s.perluVerifikasi ? "perlu-verifikasi" : "terverifikasi",
      edited_manually: (s.sumberImpor ?? "manual") === "manual",
    })),
    ai_sessions: [],
    edit_history: [],
  };
}

/** Cari atau buat folder /Utruha di root Drive. */
export async function pastikanFolderApp(token: string): Promise<string> {
  // Cari folder Utruha
  const q = `name='${APP_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const result = await driveAPI(`/files?q=${encodeURIComponent(q)}&fields=files(id)`, token);

  if (result.files?.length > 0) return result.files[0].id;

  // Buat baru
  const created = await driveAPI("/files", token, {
    method: "POST",
    body: JSON.stringify({
      name: APP_FOLDER,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  return created.id;
}

/** Simpan proyek ke Drive. */
export async function simpanProyekKeDrive(
  token: string,
  proyek: ProyekTersimpan,
): Promise<string> {
  const folderId = await pastikanFolderApp(token);
  const fileName = `${proyek.project_id}.json`;

  // Cek apakah file sudah ada
  const q = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
  const existing = await driveAPI(`/files?q=${encodeURIComponent(q)}&fields=files(id)`, token);

  const body = JSON.stringify(proyek, null, 2);

  if (existing.files?.length > 0) {
    // Update
    await driveAPI(`/files/${existing.files[0].id}`, token, {
      method: "PATCH",
      body: body,
    });
    return existing.files[0].id;
  } else {
    // Create
    const metadata = {
      name: fileName,
      parents: [folderId],
      mimeType: "application/json",
    };

    const formData = new FormData();
    formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    formData.append("file", new Blob([body], { type: "application/json" }));

    const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!res.ok) throw new Error(`Upload gagal: ${res.status}`);
    const data = await res.json();
    return data.id;
  }
}

/** Muat proyek dari Drive. */
export async function muatProyekDariDrive(
  token: string,
  projectId: string,
): Promise<ProyekTersimpan | null> {
  const folderId = await pastikanFolderApp(token);
  const fileName = `${projectId}.json`;

  const q = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
  const result = await driveAPI(`/files?q=${encodeURIComponent(q)}&fields=files(id)`, token);

  if (!result.files?.length) return null;

  const fileId = result.files[0].id;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;
  return res.json();
}

/** List semua proyek di Drive. */
export async function listProyekDiDrive(token: string): Promise<Array<{ id: string; name: string; modified: string }>> {
  const folderId = await pastikanFolderApp(token);
  const q = `'${folderId}' in parents and mimeType='application/json' and trashed=false`;
  const result = await driveAPI(`/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)`, token);

  return (result.files ?? []).map((f: any) => ({
    id: f.name.replace(".json", ""),
    name: f.name,
    modified: f.modifiedTime,
  }));
}

/** Hapus proyek dari Drive. */
export async function hapusProyekDariDrive(token: string, projectId: string): Promise<boolean> {
  const folderId = await pastikanFolderApp(token);
  const fileName = `${projectId}.json`;

  const q = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
  const result = await driveAPI(`/files?q=${encodeURIComponent(q)}&fields=files(id)`, token);

  if (!result.files?.length) return false;

  await driveAPI(`/files/${result.files[0].id}`, token, { method: "DELETE" });
  return true;
}
