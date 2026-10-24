# ==============================================================================
# Google Colab: Server Ollama dengan Localtunnel (100% Gratis Tanpa Akun/Daftar)
# ==============================================================================

# --- SEL 1: Pasang Ollama & Node.js ---
!sudo apt-get update -qq && sudo apt-get install -y -qq zstd curl
!curl -fsSL https://ollama.com/install.sh | sh
!npm install -g localtunnel

# --- SEL 2: Jalankan Ollama & Model Qwen 7B ---
import subprocess
import time

subprocess.Popen(["ollama", "serve"])
time.sleep(5)
!ollama pull qwen2.5:7b

# --- SEL 3: Jalankan Localtunnel ---
import urllib.request
ip = urllib.request.urlopen('https://ipv4.icanhazip.com').read().decode('utf8').strip()
print("PASSWORD TUNNEL (Bila diminta di browser pertama kali):", ip)
!lt --port 11434
