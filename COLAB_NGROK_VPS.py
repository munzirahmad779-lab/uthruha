# ==============================================================================
# UTHRUHA â€” Colab VPS: Ollama + ngrok STATIC DOMAIN (auto-reconnect)
# ==============================================================================
# Perbaikan dari JALANKAN_DI_COLAB.py:
#   1. Memakai DOMAIN TETAP  â†’ domain tidak berubah tiap restart
#      (hug-nanny-lively.ngrok-free.dev)
#   2. Token ngrok dibaca dari Colab Secrets / env, bukan ditulis di kode
#   3. Cek Ollama benar-benar hidup sebelum tunnel dibuka
#   4. Uji tunnel dari luar sebelum Anda copy URL ke .env.local
#   5. Auto-reconnect: kalau agent putus, tunnel dibuka ulang sendiri
#
# CARA PAKAI:
#   1. Buka https://colab.research.google.com  â†’ Runtime â†’ Change runtime type
#      â†’ T4 GPU
#   2. Tempel SELURUH isi file ini ke satu sel, lalu RUN.
#   3. Di panel kiri (ikon kunci) â†’ Secrets â†’ tambahkan NGROK_AUTHTOKEN
#      = token dari https://dashboard.ngrok.com/get-started/your-authtoken
#      (aktifkan "Notebook access").
#   PENTING - BATAS YANG TIDAK BISA DILAWAN DENGAN SKRIP INI:
#     Colab memutus runtime setelah +-90 menit idle, maksimal +-12 jam per sesi,
#     dan saat kuota GPU habis. Jadi Colab TIDAK BISA menjadi VPS selalu-hidup.
#     Untuk server yang harus online 24/7, lihat deploy/SETUP_VPS_AMAN.md
#     (Oracle Cloud Always Free + Cloudflare Tunnel).
#
#   4. BIAKKAN TAB COLAB TERBUKA. Kalau tab ditutup / laptop sleep,
#      runtime mati dan domain jadi offline lagi (ERR_NGROK_3200).
# ==============================================================================

DOMAIN = "hug-nanny-lively.ngrok-free.dev"   # domain statis Anda
MODEL  = "qwen2.5:3b"                        # samakan dengan OLLAMA_MODEL di .env.local

# --- 1. Pasang dependensi -----------------------------------------------------
!sudo apt-get update -qq && sudo apt-get install -y -qq zstd curl
!curl -fsSL https://ollama.com/install.sh | sh
!pip install -q pyngrok requests

# --- 2. Ambil token ngrok -----------------------------------------------------
import os
from pyngrok import ngrok, conf

TOKEN = os.environ.get("NGROK_AUTHTOKEN", "")
if not TOKEN:
    try:
        from google.colab import userdata
        TOKEN = userdata.get("NGROK_AUTHTOKEN")
    except Exception:
        pass
if not TOKEN:
    from getpass import getpass
    TOKEN = getpass("Tempel NGROK_AUTHTOKEN Anda: ")
conf.get_default().auth_token = TOKEN.strip()
print("Token ngrok terpasang.")

# --- 3. Jalankan Ollama di latar belakang -------------------------------------
import subprocess, time, requests

subprocess.Popen(["ollama", "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

hidup = False
for i in range(30):
    try:
        requests.get("http://127.0.0.1:11434/api/tags", timeout=2)
        hidup = True
        break
    except Exception:
        time.sleep(2)

if not hidup:
    raise RuntimeError("Ollama gagal start. Coba Runtime > Restart session, lalu RUN ulang.")
print("Ollama hidup di 127.0.0.1:11434")

# Unduh model hanya kalau belum ada (hemat waktu saat restart)
punya = requests.get("http://127.0.0.1:11434/api/tags", timeout=10).json().get("models", [])
if not any(m.get("name") == MODEL for m in punya):
    print(f"Mengunduh {MODEL} ...")
    !ollama pull {MODEL}
else:
    print(f"Model {MODEL} sudah ada.")

# --- 4. Buka tunnel dengan domain statis --------------------------------------
def buka_tunnel():
    """Bersihkan agent lama lalu sambungkan domain statis."""
    try:
        ngrok.kill()
    except Exception:
        pass
    time.sleep(1)
    return ngrok.connect(11434, domain=DOMAIN, proto="http")

tunnel = buka_tunnel()
URL = tunnel.public_url
print("\n" + "=" * 64)
print("URL OLLAMA ANDA :", URL)
print("=" * 64)

# --- 5. Uji tunnel dari luar (bukan dari localhost) ---------------------------
# Header ini WAJIB: tanpa itu, domain *.ngrok-free.dev mengembalikan halaman
# peringatan HTML, bukan JSON â€” dan aplikasi akan gagal parse.
HEADER_NGROK = {"ngrok-skip-browser-warning": "true"}

def uji(url):
    try:
        r = requests.get(f"{url}/api/tags", headers=HEADER_NGROK, timeout=15)
        if r.status_code == 200 and "models" in r.text:
            print(f"âœ“ Tunnel sehat â€” {len(r.json().get('models', []))} model terbaca lewat internet.")
            return True
        print(f"âœ— Status {r.status_code}: {r.text[:200]}")
    except Exception as e:
        print("âœ— Gagal dihubungi:", e)
    return False

if uji(URL):
    print("\nIsi .env.local di komputer Anda dengan:")
    print(f"  OLLAMA_HOST={URL}")
    print(f"  OLLAMA_MODEL={MODEL}")
    print("\nLalu restart `npm run dev` agar env baru terbaca.")

# --- 6. Auto-reconnect: jaga agent tetap hidup -------------------------------
print("\nMode jaga-hidup aktif. Hentikan sel ini (tombol stop) bila sudah selesai.")
print("JANGAN tutup tab Colab â€” kalau ditutup, runtime mati dan domain offline.\n")

while True:
    time.sleep(60)
    try:
        ngrok.get_tunnels()   # lempar error bila agent sudah mati
    except Exception:
        print("Agent putus â€” menyambung ulang ...")
        try:
            tunnel = buka_tunnel()
            URL = tunnel.public_url
            print("Tersambung lagi:", URL)
            uji(URL)
        except Exception as e:
            print("Gagal menyambung ulang:", e)
            time.sleep(15)
