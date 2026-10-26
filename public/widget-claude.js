/* Widget Chat Yusuf AI — Pintu Web
 * Cara pasang: sesuaikan MAILBOX_URL di bawah dengan alamat kotak surat
 * di website ini, lalu sertakan berkas ini sebelum </body>:
 *   <script src="/widget-claude.js"></script>
 * Widget murni vanilla JS, tanpa dependensi.
 */
(function () {
  var MAILBOX_URL = "https://kotak-surat-muse.munzirahmad779.workers.dev"; // mis. https://webku.sch.id/mailbox
  var session = localStorage.getItem("claude-widget-session");
  if (!session) {
    session = "s-" + (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
    localStorage.setItem("claude-widget-session", session);
  }

  var css = [
    "#cw-tombol{position:fixed;right:18px;bottom:18px;z-index:9998;background:#1f6f4a;color:#fff;border:none;border-radius:999px;padding:12px 18px;font-size:15px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25)}",
    "#cw-kotak{position:fixed;right:18px;bottom:74px;z-index:9999;width:min(92vw,360px);height:480px;max-height:70vh;background:#fff;border:1px solid #ddd;border-radius:14px;box-shadow:0 10px 34px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden;font-family:system-ui,sans-serif}",
    "#cw-kotak.terbuka{display:flex}",
    "#cw-kepala{background:#1f6f4a;color:#fff;padding:12px 14px;font-weight:600;font-size:15px}",
    "#cw-isi{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#f7f7f5}",
    ".cw-pesan{max-width:85%;padding:8px 11px;border-radius:12px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}",
    ".cw-user{align-self:flex-end;background:#dff0e6}",
    ".cw-bot{align-self:flex-start;background:#fff;border:1px solid #e3e3e0}",
    ".cw-status{align-self:flex-start;color:#666;font-size:12.5px;font-style:italic}",
    "#cw-bawah{display:flex;gap:8px;padding:10px;border-top:1px solid #e3e3e0;background:#fff}",
    "#cw-teks{flex:1;border:1px solid #ccc;border-radius:9px;padding:9px;font-size:14px}",
    "#cw-kirim{background:#1f6f4a;color:#fff;border:none;border-radius:9px;padding:9px 14px;cursor:pointer;font-size:14px}",
    "#cw-kirim:disabled{opacity:.5;cursor:wait}"
  ].join("\n");
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var tombol = document.createElement("button");
  tombol.id = "cw-tombol";
  tombol.textContent = "Tanya Yusuf AI";
  document.body.appendChild(tombol);

  var kotak = document.createElement("div");
  kotak.id = "cw-kotak";
  kotak.innerHTML =
    '<div id="cw-kepala">Asisten Yusuf AI</div>' +
    '<div id="cw-isi"><div class="cw-pesan cw-bot">Halo! Silakan tulis pertanyaanmu, nanti kujawab di sini. Chat ini dijawab langsung pukul 19.00–00.00 WITA — di luar jam itu pertanyaanmu tetap masuk dan kujawab saat jendela buka.</div></div>' +
    '<div id="cw-bawah"><input id="cw-teks" type="text" placeholder="Tulis pertanyaan..." maxlength="1000">' +
    '<button id="cw-kirim">Kirim</button></div>';
  document.body.appendChild(kotak);

  var isi = kotak.querySelector("#cw-isi");
  var teks = kotak.querySelector("#cw-teks");
  var kirim = kotak.querySelector("#cw-kirim");

  tombol.addEventListener("click", function () {
    kotak.classList.toggle("terbuka");
    if (kotak.classList.contains("terbuka")) teks.focus();
  });

  function tambah(cls, isiTeks) {
    var d = document.createElement("div");
    d.className = "cw-pesan " + cls;
    d.textContent = isiTeks;
    isi.appendChild(d);
    isi.scrollTop = isi.scrollHeight;
    return d;
  }

  var KUNCI_TERTUNDA = "cw-jobs-tertunda";
  var BATAS_JOB_MS = 24 * 60 * 60 * 1000;

  function bacaTertunda() {
    try { return JSON.parse(localStorage.getItem(KUNCI_TERTUNDA) || "[]"); } catch (e) { return []; }
  }
  function tulisTertunda(daftar) {
    try { localStorage.setItem(KUNCI_TERTUNDA, JSON.stringify(daftar)); } catch (e) { /* penyimpanan diblokir: abaikan */ }
  }
  function jamWita() {
    return parseInt(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Makassar", hour: "2-digit", hourCycle: "h23" }).format(new Date()), 10);
  }
  function diJendelaLayanan() { return jamWita() >= 19; }

  // Pantau satu job sampai dijawab, lalu panggil tampilkan(jawaban).
  function pantau(job, tampilkan) {
    // Rem kuota kotak surat (ditambahkan Muse saat memasang tambalan audit):
    // 2 detik pada 5 menit pertama, lalu melambat ke 20 detik, dan berhenti
    // sesudah 2 jam. Job tetap tersimpan; membuka lagi halaman melanjutkan
    // pemantauan. Tanpa rem, satu tab yang lupa ditutup membaca kotak surat
    // puluhan ribu kali dan bisa menghabiskan kuota untuk semua pengunjung.
    var mulai = Date.now();
    var berhenti = false;
    function jadwal() {
      if (berhenti) return;
      var jalan = Date.now() - mulai;
      if (jalan > 2 * 60 * 60 * 1000) return;
      setTimeout(cekSekali, jalan < 5 * 60 * 1000 ? 2000 : 20000);
    }
    function cekSekali() {
      fetch(MAILBOX_URL + "/jawaban/" + encodeURIComponent(job.id) + "?session=" + encodeURIComponent(session))
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j.status === "dijawab") {
            berhenti = true;
            tulisTertunda(bacaTertunda().filter(function (x) { return x.id !== job.id; }));
            tampilkan(j.answer);
          } else {
            jadwal();
          }
        })
        .catch(function () { jadwal(); });
    }
    jadwal();
  }

  // Pertanyaan yang belum terjawab (mis. ditanya di luar jam) dipulihkan saat halaman dibuka lagi.
  function pulihkan() {
    var sekarang = Date.now();
    var daftar = bacaTertunda().filter(function (x) { return sekarang - x.dibuat < BATAS_JOB_MS; });
    tulisTertunda(daftar);
    daftar.forEach(function (job) {
      tambah("cw-status", "Pertanyaan sebelumnya masih menunggu jawaban: " + job.teks);
      pantau(job, function (jawaban) { tambah("cw-bot", jawaban); });
    });
  }

  function tanya() {
    if (kirim.disabled) return; // Enter saat masih menunggu jawaban: jangan kirim ganda
    var t = teks.value.trim();
    if (!t) return;
    teks.value = "";
    tambah("cw-user", t);
    kirim.disabled = true;

    var mulai = Date.now();
    var status = tambah("cw-status", "");
    function tampilStatus() {
      var dtk = Math.round((Date.now() - mulai) / 1000);
      var dasar = diJendelaLayanan()
        ? "Sedang diproses Yusuf AI — biasanya 10–30 detik, mohon ditunggu."
        : "Di luar jam layanan (19.00–00.00 WITA). Pertanyaanmu sudah tercatat dan dijawab saat jendela buka; kamu boleh menutup halaman ini.";
      status.textContent = dasar + " (" + dtk + " dtk)";
    }
    tampilStatus();
    var pewaktu = setInterval(tampilStatus, 1000);

    function selesai(pesan, isBot) {
      clearInterval(pewaktu);
      status.remove();
      tambah(isBot ? "cw-bot" : "cw-status", pesan);
      kirim.disabled = false;
      teks.focus();
    }

    fetch(MAILBOX_URL + "/tanya", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session: session, text: t })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok || !res.j.job_id) {
          return selesai(res.j.error || "Maaf, lagi ada gangguan. Coba lagi ya.", false);
        }
        var job = { id: res.j.job_id, teks: t.slice(0, 60), dibuat: Date.now() };
        tulisTertunda(bacaTertunda().concat([job]));
        pantau(job, function (jawaban) { selesai(jawaban, true); });
        // Setelah 5 menit, pengguna boleh bertanya lagi, tetapi pemantauan tetap berjalan.
        setTimeout(function () {
          if (!kirim.disabled) return;
          clearInterval(pewaktu);
          status.textContent = "Jawaban belum datang. Pertanyaanmu tetap tercatat dan akan muncul di sini saat tersedia.";
          kirim.disabled = false;
        }, 300000);
      })
      .catch(function () { selesai("Maaf, tidak bisa terhubung. Coba lagi ya.", false); });
  }

  kirim.addEventListener("click", tanya);
  teks.addEventListener("keydown", function (e) { if (e.key === "Enter") tanya(); });
  pulihkan();
})();
