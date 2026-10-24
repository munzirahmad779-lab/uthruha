# VPS Selalu-Hidup + Proteksi Ketat

Dokumen ini menjawab dua kebutuhan:

1. Server LLM yang **tetap jalan walau laptop Anda mati**.
2. Domain publik yang **tidak bisa dipakai orang asing**, apalagi ditembus.

---

## 1. Kenapa Google Colab TIDAK bisa jadi VPS selalu-hidup

Ini penting supaya Anda berhenti berharap pada hal yang tidak mungkin.

| Batas Colab (gratis) | Akibat |
|---|---|
| Runtime diputus setelah ±90 menit tanpa interaksi | Agent ngrok mati → `ERR_NGROK_3200` |
| Sesi maksimal ±12 jam | Harus di-restart tiap hari |
| GPU quota harian | Tiba-tiba mati di tengah pemakaian |
| Runtime ikut mati saat tab/browser ditutup | Persis keluhan Anda |
| Ketentuan Google | Colab bukan untuk layanan produksi berjalan terus |

Kesimpulan jujur: **Colab bagus untuk eksperimen GPU, bukan untuk server yang harus online 24/7.** Skrip `JALANKAN_DI_COLAB.py` / `COLAB_NGROK_VPS.py` hanya bisa memperpanjang umur dan menyambung ulang, tapi tidak menghilangkan batas di atas.

---

## 2. Pilihan yang benar: VPS gratis permanen

**Oracle Cloud Always Free** — cocok untuk Ollama:

- ARM Ampere: 4 OCPU + 24 GB RAM, gratis selamanya
- Cukup untuk `qwen2.5:7b` (bahkan 14b kuantisasi)
- Tidak ada batas waktu sesi

Alternatif lain: Hetzner CX22 (~€4/bln), Contabo, atau PC bekas yang dinyalakan terus di rumah.

---

## 3. Pemasangan di VPS (ringkas)

```bash
# --- Ollama ---
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl edit ollama   # lalu sesuaikan dengan deploy/ollama.service
ollama pull qwen2.5:7b

# --- Aplikasi ---
sudo mkdir -p /opt/uthruha && sudo chown $USER /opt/uthruha
# salin proyek ke /opt/uthruha, lalu:
cd /opt/uthruha
npm ci
npm run build

# --- Layanan ---
sudo cp deploy/ollama.service /etc/systemd/system/
sudo cp deploy/uthruha.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ollama uthruha
```

Buat `/opt/uthruha/.env.local`:

```
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:7b
UTH_ACCESS_KEY=<kunci-acak-panjang>
```

Buat kunci acak:

```bash
openssl rand -base64 32
```

---

## 4. Cloudflare Tunnel (pengganti ngrok)

```bash
cloudflared tunnel login
cloudflared tunnel create uthruha
cloudflared tunnel route dns uthruha uthruha.domainanda.com
sudo cp deploy/cloudflared-config.yml /etc/cloudflared/config.yml
sudo cloudflared service install
```

Hasilnya:

- `https://uthruha.domainanda.com` → `127.0.0.1:3300`
- Hostname tetap, tidak pernah berubah
- **Tidak ada port yang dibuka** di VPS (koneksi keluar)
- Tidak ada halaman peringatan peramban seperti ngrok free

---

## 5. Proteksi berlapis (urut dari luar ke dalam)

| Lapis | Alat | Fungsi |
|---|---|---|
| 1 | **Cloudflare Access** (Zero Trust) | Wajib login email OTP / service token sebelum halaman terbuka |
| 2 | **Cloudflare rate limiting** | Batasi permintaan per IP di edge, sebelum menyentuh server |
| 3 | **`UTH_ACCESS_KEY`** (middleware) | Gerbang kedua bila Access dilewati |
| 4 | **Rate limit API** | 10/jam khalfiyah, 30/menit refs — berlapis IP + global |
| 5 | **Security headers + CSP** | Cegah XSS, clickjacking, sniffing |
| 6 | **Ollama di 127.0.0.1** | LLM tidak pernah terekspos langsung |

### Mengaktifkan Cloudflare Access

Dashboard Cloudflare → **Zero Trust → Access → Applications → Add**:

- Domain: `uthruha.domainanda.com`
- Policy: `Allow` → `Emails` → masukkan email Anda saja
- Session duration: 24 jam

Setelah ini, orang yang menemukan domain Anda tetap melihat halaman login Cloudflare dan **tidak bisa menyentuh server sama sekali**.

---

## 6. Catatan jujur soal "jangan sampai direplika"

Yang **bisa** dicegah:

- Orang memakai aplikasi Anda tanpa izin → gerbang akses + Access
- Orang memakai GPU/LLM Anda → semua port tertutup, tunnel berlapis
- Orang menyalahgunakan API → rate limit berlapis + origin check
- Kebocoran versi framework → `poweredByHeader: false`
- XSS / clickjacking → CSP + header keamanan

Yang **tidak bisa** dicegah sepenuhnya:

- Menyalin HTML/CSS/JS yang sudah terkirim ke peramban yang sah. Ini mustahil dari sisi server — siapa pun yang boleh melihat halaman, boleh menyimpan tampilannya.
- Meniru tampilan secara manual.

Yang membuat replika tidak berguna: **isi berharganya ada di server** — kunci API, prompt sistem, model, dan data rujukan. Itu tidak pernah ikut terkirim ke peramban.

---

## 7. Daftar periksa keamanan

- [ ] `UTH_ACCESS_KEY` diisi (minimal 16 karakter, acak)
- [ ] Cloudflare Access aktif untuk domain aplikasi
- [ ] Ollama hanya di `127.0.0.1`
- [ ] Tidak ada port lain terbuka (`sudo ss -tulpn` → hanya 22)
- [ ] SSH: `PasswordAuthentication no`, pakai kunci
- [ ] `ufw` aktif, hanya izinkan 22
- [ ] Rate limit Cloudflare untuk `/api/*`
- [ ] `npm audit` bersih
- [ ] Pembaruan rutin: `apt upgrade`, `npm ci`
---

## 8. Login otomatis untuk laptop Anda sendiri

Gerbang akses punya dua jenis cookie:

| Cookie | Umur | Kapan dibuat |
|---|---|---|
| `uthruha_akses` | 7 hari | Setiap kali mengetik kunci |
| `uthruha_perangkat` | 365 hari | Hanya bila centang **"Ingat perangkat ini"** |

**Cara pakainya:**

1. Buka `https://domainanda.com/masuk`
2. Masukkan `UTH_ACCESS_KEY`
3. Biarkan centang **"Ingat perangkat ini"** terpasang
4. Klik **Buka ruang kerja**

Setelah itu laptop Anda **langsung masuk sendiri** selama 1 tahun. Membuka `/masuk`
saat sudah masuk akan langsung dialihkan ke tujuan semula — tidak ada halaman kunci.

Masa berlaku perangkat diperpanjang otomatis setiap kali dipakai (*sliding*), jadi
selama Anda memakainya minimal sekali setahun, Anda tidak akan pernah diminta kunci lagi.

**Mencabut akses semua perangkat:** ganti nilai `UTH_ACCESS_KEY`, lalu restart.
Semua cookie lama otomatis tidak sah — termasuk milik Anda sendiri.

**Jangan centang** "Ingat perangkat ini" bila membuka dari komputer warnet,
komputer kantor bersama, atau perangkat orang lain.

**Bila memakai http biasa di jaringan lokal** (bukan https), cookie `Secure` akan
ditolak peramban. Tambahkan ini ke `.env.local`:

```
UTH_COOKIE_SECURE=0
```

Sebaiknya hanya untuk uji lokal — untuk domain publik tetap https.
