# Panduan Setup Google Drive OAuth untuk Utruha

## Langkah 1: Buat Project di Google Cloud Console

1. Buka https://console.cloud.google.com/
2. Klik **"Select a project"** → **"New Project"**
3. Nama: `Utruha App`
4. Klik **Create**

## Langkah 2: Aktifkan Google Drive API

1. Di sidebar kiri, klik **"APIs & Services"** → **"Library"**
2. Cari **"Google Drive API"**
3. Klik → **"Enable"**

## Langkah 3: Konfigurasi OAuth Consent Screen

1. Klik **"APIs & Services"** → **"OAuth consent screen"**
2. Pilih **"External"** → Create
3. Isi:
   - App name: `Utruha`
   - User support email: email kamu
   - Developer contact: email kamu
4. Klik **"Save and Continue"**
5. Di halaman **Scopes**, klik **"Add or Remove Scopes"**
6. Cari dan tambahkan: `.../auth/drive.file`
7. Klik **"Update"** → **"Save and Continue"**
8. Di halaman **Test users**, tambahkan email kamu sebagai test user
9. Klik **"Save and Continue"** → **"Back to Dashboard"**

## Langkah 4: Buat OAuth Credentials

1. Klik **"APIs & Services"** → **"Credentials"**
2. Klik **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. Application type: **"Web application"**
4. Name: `Utruha Web`
5. **Authorized JavaScript origins:**
   ```
   http://localhost:3300
   https://uthruha.vercel.app
   ```
6. **Authorized redirect URIs:**
   ```
   http://localhost:3300
   https://uthruha.vercel.app
   ```
7. Klik **"Create"**
8. **Copy Client ID** (format: `xxxxx.apps.googleusercontent.com`)

## Langkah 5: Tambahkan ke Environment Variables

### Lokal (.env.local)
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
```

### Vercel
1. Buka https://vercel.com/dashboard → pilih project `uthruha`
2. Klik **"Settings"** → **"Environment Variables"**
3. Tambah:
   - Key: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
   - Value: `xxxxx.apps.googleusercontent.com`
   - Environments: ✅ Production ✅ Preview ✅ Development
4. Klik **"Save"**
5. Redeploy: `vercel --prod`

## Langkah 6: Verifikasi

Setelah setup selesai:
1. Buka https://uthruha.vercel.app
2. Login dengan akun Google
3. Buat proyek baru
4. Cek Google Drive → folder `/Utruha/` harus muncul dengan file JSON proyek

## Catatan Penting

- Scope `drive.file` hanya memberi akses ke file yang **dibuat oleh aplikasi ini**. Tidak bisa membaca file lain di Drive pengguna.
- Untuk production, submit verifikasi ke Google (bisa memakan waktu beberapa minggu). Selama masa development, mode "Testing" sudah cukup untuk test users yang terdaftar.
- Client ID bersifat publik (aman di-expose di frontend). Jangan pernah expose Client Secret.
