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
 * Inisialisasi Google Identity Services.
 * Dipanggil sekali saat app mount.
 */
export function initGoogleAuth(onToken: (token: string) => void): void {
  if (typeof window === "undefined") return;

  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.onload = () => {
    const google = (window as any).google;
    if (!google) return;

    google.accounts.oauth2
      .initTokenClient({
        client_id: getClientId(),
        scope: SCOPES,
        callback: (response: any) => {
          if (response.access_token) {
            onToken(response.access_token);
          }
        },
      })
      .requestAccessToken();
  };
  document.head.appendChild(script);
}

/**
 * Request access token via popup.
 */
export function requestDriveAccess(): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") { resolve(null); return; }

    const google = (window as any).google;
    if (!google || !google.accounts || !google.accounts.oauth2) {
      console.error("Google Identity Services belum siap.");
      resolve(null);
      return;
    }

    const clientId = getClientId();
    if (!clientId || clientId.includes("PASTE_")) {
      console.error("NEXT_PUBLIC_GOOGLE_CLIENT_ID belum dikonfigurasi.");
      resolve(null);
      return;
    }

    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response: any) => {
        resolve(response.access_token ?? null);
      },
    });
    client.requestAccessToken();
  });
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
  if (!res.ok) throw new Error(`Drive API error: ${res.status} ${res.statusText}`);
  return res.json();
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
