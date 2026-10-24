# ==============================================================================
# SCRIPT OTOMATIS GOOGLE COLAB UNTUK UTHRUHA (TOKEN NGROK SUDAH TERPASANG)
# ==============================================================================
# Petunjuk: Copy seluruh isi file ini ke 1 SEL di Google Colab, lalu tekan RUN!

!sudo apt-get update -qq && sudo apt-get install -y -qq zstd curl
!curl -fsSL https://ollama.com/install.sh | sh
!pip install -q pyngrok

import subprocess
import time
from pyngrok import ngrok

# 1. Jalankan Ollama
subprocess.Popen(["ollama", "serve"])
time.sleep(5)

# 2. Download Model Qwen 2.5 7B di GPU Colab
!ollama pull qwen2.5:7b

# 3. Hubungkan Ngrok otomatis (Masukkan token Ngrok Anda)
# ngrok.set_auth_token("MASUKKAN_TOKEN_NGROK_ANDA")
ngrok.kill()
tunnel = ngrok.connect(11434)

print("\n" + "=" * 60)
print("BERIKUT URL SERVER COLAB ANDA:")
print(tunnel.public_url)
print("=" * 60)
