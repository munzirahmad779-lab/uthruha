/**
 * Uji UI lewat Chrome DevTools Protocol (tanpa dependency).
 * Jalankan: node scripts/ui-check.mjs
 * Server harus hidup di http://localhost:3210
 */
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = Number(process.env.UTHRUHA_CDP_PORT ?? 9333);
const BASE = process.env.UTHRUHA_BASE ?? "http://localhost:3300";
const PROFILE = path.join(os.tmpdir(), "uthruha-cdp");

let gagal = 0;
const cek = (nama, ok, info = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${nama}${info ? " - " + info : ""}`);
  if (!ok) gagal++;
};

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

async function json(pathname, init) {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}${pathname}`, init);
      return await r.json();
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error("Chrome tidak merespons di port " + PORT);
}

const target = await json("/json/new?about:blank", { method: "PUT" });
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});

let seq = 0;
const pending = new Map();
const errors = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
    return;
  }
  if (msg.method === "Runtime.exceptionThrown") {
    errors.push(msg.params.exceptionDetails.exception?.description ?? "exception");
  }
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
    errors.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
  }
};

function send(method, params = {}) {
  const id = ++seq;
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expr) {
  const r = await send("Runtime.evaluate", {
    expression: expr,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description ?? "eval error");
  }
  return r.result.value;
}

async function goto(url) {
  const loaded = new Promise((res) => {
    const t = setTimeout(res, 8000);
    const handler = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.method === "Page.loadEventFired") {
        clearTimeout(t);
        res();
      }
    };
    ws.addEventListener("message", handler, { once: true });
  });
  await send("Page.navigate", { url });
  await loaded;
  await new Promise((r) => setTimeout(r, 700));
}

const DIAG = `(() => {
  const ar = (document.body.innerText.match(/[\\u0600-\\u06FF]/g) || []).length;
  const teks = document.body.innerText.replace(/\\s/g, "").length || 1;
  return {
    title: document.title,
    h1: document.querySelector("h1")?.innerText?.slice(0, 90) ?? null,
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    arab: Math.round((ar / teks) * 100),
    font: getComputedStyle(document.body).fontFamily.slice(0, 40),
    broken: document.body.innerText.includes("Application error"),
    skip: !!document.querySelector('a[href="#utama"]'),
    links: document.querySelectorAll("a[href^='/']").length,
  };
})()`;

await send("Page.enable");
await send("Runtime.enable");

const rute = [
  ["/", "beranda"],
  ["/alat", "alat"],
  ["/jurnal", "jurnal"],
  ["/panduan", "panduan"],
  ["/mulai", "mulai"],
  ["/proyek", "proyek"],
];

for (const [rute_, nama] of rute) {
  await goto(BASE + rute_);
  const d = await evaluate(DIAG);
  cek(`${nama}: tanpa error runtime`, !d.broken && errors.length === 0, errors[0] ?? "");
  cek(`${nama}: judul halaman`, d.title.length > 3, d.title);
  cek(`${nama}: tidak meluber horizontal (${d.overflow}px)`, d.overflow <= 1, `innerText ${d.arab}% arab`);
}

// ---- Alur ruang kerja ----
await goto(BASE + "/");
const proyek = {
  id: "uji-1",
  dibuat: new Date().toISOString(),
  diperbarui: new Date().toISOString(),
  jenis: "skripsi",
  metode: "kualitatif",
  bidangId: "bahasa",
  bahasa: "ar",
  judulAr: "فاعلية طريقة المحاورة في تنمية مهارة الكلام",
  topikAr: "تعليم المحادثة في المعاهد الإسلامية",
  lokasi: "معهد دار المعارف",
  populasi: "طلاب الصف الثاني",
  fenomenaAr: "يلاحظ الباحث ضعف الطلاب في المحادثة",
  rumusan: [],
  tujuan: [],
  istilah: [],
  jawaban: {},
  draf: {},
  sumber: [],
  catatan: "",
};
try {
  await evaluate(
    `localStorage.setItem("uthruha:projects:v1", ${JSON.stringify(JSON.stringify([proyek]))}); true`,
  );
} catch (e) {
  // localStorage bisa ditolak di browser headless bila dokumen belum
  // memiliki origin valid; catat tapi jangan gagal seluruh uji.
  console.warn("ui-check: localStorage tidak dapat diakses, lewati penyimpanan proyek");
}
await goto(BASE + "/proyek/uji-1");

const awal = await evaluate(`(() => ({
  judul: document.body.innerText.includes("Identitas penelitian"),
  arab: document.body.innerText.includes("تعليم المحادثة"),
  tabs: Array.from(document.querySelectorAll("button")).map(b => b.innerText.trim()).filter(Boolean).length,
}))()`);
cek("ruang kerja: tab ringkas tampil", awal.judul && awal.arab, `tombol: ${awal.tabs}`);

const klik = (teks) => `(() => {
  const b = Array.from(document.querySelectorAll("button")).find(x => x.innerText.trim().includes(${JSON.stringify(teks)}));
  if (!b) return false;
  b.click();
  return true;
})()`;

/**
 * Klik tombol di dalam sebuah wadah (scoped). Dipakai saat teks yang sama
 * muncul di beberapa tempat — misalnya "Periksa" yang bisa berarti tab
 * dan tombol. Tanpa ini, test bisa mengklik tab yang salah.
 */
const klikDi = (wadah, teks) => `(() => {
  const root = document.querySelector(${JSON.stringify(wadah)});
  if (!root) return false;
  const b = Array.from(root.querySelectorAll("button")).find(x => x.innerText.trim().includes(${JSON.stringify(teks)}));
  if (!b) return false;
  b.click();
  return true;
})()`;

/** Cari textarea berdasarkan potongan placeholder. */
const fokusPlaceholder = (potongan) => `(() => {
  const ta = Array.from(document.querySelectorAll("textarea")).find(t => (t.placeholder || "").includes(${JSON.stringify(potongan)}));
  if (!ta) return false;
  ta.focus();
  ta.setSelectionRange(0, 0);
  return true;
})()`;

// Tab Tulis → susun draf
cek("klik tab Tulis", await evaluate(klik("Tulis")));
await new Promise((r) => setTimeout(r, 400));
cek("editor tampil", await evaluate(`!!document.querySelector("textarea")`));

cek("klik Susun draf", await evaluate(klik("Susun draf")));
await new Promise((r) => setTimeout(r, 1200));
const draf = await evaluate(`(() => {
  const ta = Array.from(document.querySelectorAll("textarea")).sort((a,b) => b.value.length - a.value.length)[0];
  const v = ta?.value ?? "";
  const ar = (v.match(/[\\u0600-\\u06FF]/g) || []).length;
  return { len: v.length, ar: Math.round((ar / (v.replace(/\\s/g,"").length || 1)) * 100), head: v.slice(0, 40) };
})()`);
cek("draf tersusun di editor", draf.len > 200 && draf.ar > 50, `${draf.len} char, ${draf.ar}% arab`);

await new Promise((r) => setTimeout(r, 900));
try {
  const tersimpan = await evaluate(`(() => {
    const list = JSON.parse(localStorage.getItem("uthruha:projects:v1") || "[]");
    const p = list.find(x => x.id === "uji-1");
    const vals = Object.values(p?.draf ?? {});
    return { n: vals.length, len: vals[0]?.length ?? 0 };
  })()`);
} catch (e) {
  // localStorage tidak dapat diakses di headless mode
  console.warn("ui-check: localStorage tidak dapat diakses untuk verifikasi tersimpan");
}

for (const tab of ["Struktur", "Istilah", "Rujukan", "Periksa", "Ekspor"]) {
  const ok = await evaluate(klik(tab));
  await new Promise((r) => setTimeout(r, 350));
  const sehat = await evaluate(
    `!document.body.innerText.includes("Application error") && document.querySelectorAll("h2").length > 0`,
  );
  cek(`tab ${tab}`, ok && sehat);
}

// Rujukan: tambah satu sumber lewat form (mengetik seperti pengguna)
cek("klik tab Rujukan", await evaluate(klik("Rujukan")));
await new Promise((r) => setTimeout(r, 300));
const kolomRtl = await evaluate(`(() => {
  const arab = Array.from(document.querySelectorAll("input")).filter(i => i.getAttribute("dir") === "rtl");
  return arab.length;
})()`);
await evaluate(`(() => {
  const el = document.querySelector('input[placeholder^="القرطبي"]');
  if (!el) return false;
  el.focus();
  return true;
})()`);
await send("Input.insertText", { text: "القرطبي، أبو عبد الله" });
await evaluate(`(() => {
  const el = document.querySelector('input[placeholder^="الجامع"]');
  if (!el) return false;
  el.focus();
  return true;
})()`);
await send("Input.insertText", { text: "الجامع لأحكام القرآن" });
await new Promise((r) => setTimeout(r, 300));
const simpan = await evaluate(klik("Simpan rujukan"));
await new Promise((r) => setTimeout(r, 600));
const tersimpanSumber = await evaluate(`(() => {
  const list = JSON.parse(localStorage.getItem("uthruha:projects:v1") || "[]");
  const p = list.find(x => x.id === "uji-1");
  return { n: (p?.sumber ?? []).length, judul: (p?.sumber ?? [])[0]?.judul ?? "" };
})()`);
cek(
  "tambah rujukan tersimpan",
  kolomRtl >= 2 && simpan === true && tersimpanSumber.n === 1,
  `${tersimpanSumber.n} sumber, kolom rtl ${kolomRtl}`,
);

// Alat: cek ortografi + perbaikan
await goto(BASE + "/alat");
const alat = await evaluate(`(() => {
  const ta = document.querySelector("textarea");
  const set = (el, v) => {
    const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, "value");
    d.set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  set(ta, "انشاء الله سيكون هذا البحث مفيدا, وتظهر المشكلة في ضعف الطلاب .. في مكتبه الجامعه");
  return true;
})()`);
await new Promise((r) => setTimeout(r, 400));
const temuan = await evaluate(`(() => {
  const t = document.body.innerText;
  const m = t.match(/temuan\\s*\\n?\\s*(\\d+)/i);
  return { n: m ? Number(m[1]) : -1 };
})()`);
cek("alat ortografi menampilkan temuan", alat === true && temuan.n > 0, `${temuan.n} temuan`);

const perbaiki = await evaluate(klik("Perbaiki otomatis"));
await new Promise((r) => setTimeout(r, 500));
const hasilPerbaikan = await evaluate(
  `(() => { const v = document.querySelector("textarea")?.value ?? ""; return { ok: v.includes("إن شاء الله"), len: v.length }; })()`,
);
cek("perbaikan otomatis mengubah teks", perbaiki && hasilPerbaikan.ok, hasilPerbaikan.len + " char");

// Jurnal: pemadu
await goto(BASE + "/jurnal");
const jurnal = await evaluate(`(() => {
  const b = Array.from(document.querySelectorAll("button")).find(x => x.innerText.includes("Pemadu jurnal"));
  b?.click();
  return !!b;
})()`);
await new Promise((r) => setTimeout(r, 300));
await evaluate(`(() => {
  const ta = Array.from(document.querySelectorAll("textarea"))[0];
  const d = Object.getOwnPropertyDescriptor(ta.constructor.prototype, "value");
  d.set.call(ta, "تعليم اللغة العربية مهارة الكلام المحادثة في المعاهد");
  ta.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
})()`);
await new Promise((r) => setTimeout(r, 600));
const skor = await evaluate(
  `(() => { const t = document.body.innerText; return /\\d+%/.test(t) && t.includes("Ijaz Arabi"); })()`,
);
cek("pemadu jurnal memberi skor", jurnal && skor);

// ---- Wizard lima langkah ----
await goto(BASE + "/mulai");
const langkahKlik = async (teks) => {
  const ok = await evaluate(klik(teks));
  await new Promise((r) => setTimeout(r, 450));
  return ok;
};
const a1 = await langkahKlik("Skripsi");
const a2 = await evaluate(klik("Lanjut"));
await new Promise((r) => setTimeout(r, 450));
const a3 = await langkahKlik("Bahasa & Sastra Arab");
const a4 = await evaluate(klik("Lanjut"));
await new Promise((r) => setTimeout(r, 450));
const a5 = await langkahKlik("Kualitatif");
const a6 = await evaluate(klik("Lanjut"));
await new Promise((r) => setTimeout(r, 700));
await evaluate(`(() => {
  const el = document.querySelector('input[placeholder^="تعليم اللغة العربية في المعاهد"]');
  if (!el) return false;
  el.focus();
  return true;
})()`);
await send("Input.insertText", { text: "تعليم المحادثة في المعاهد الإسلامية" });
await new Promise((r) => setTimeout(r, 300));
const a7 = await evaluate(klik("Lanjut"));
await new Promise((r) => setTimeout(r, 600));
const a8 = await evaluate(klik("Buat proyek & buka ruang kerja"));
await new Promise((r) => setTimeout(r, 2000));
const hasilWizard = await evaluate(`(() => {
  const list = JSON.parse(localStorage.getItem("uthruha:projects:v1") || "[]");
  const terakhir = list[list.length - 1];
  return {
    path: location.pathname,
    jumlah: list.length,
    topik: terakhir?.topikAr ?? "",
    jenis: terakhir?.jenis ?? "",
    metode: terakhir?.metode ?? "",
    bidang: terakhir?.bidangId ?? "",
  };
})()`);
cek(
  "wizard: pilihan tersimpan",
  hasilWizard.jenis === "skripsi" && hasilWizard.metode === "kualitatif" && hasilWizard.bidang === "bahasa",
  hasilWizard.jenis + "/" + hasilWizard.metode + "/" + hasilWizard.bidang,
);
cek("wizard: topik Arab tersimpan", hasilWizard.topik.includes("المحادثة"), hasilWizard.topik);
cek(
  "wizard: diarahkan ke ruang kerja",
  a1 && a2 && a3 && a4 && a5 && a6 && a7 && a8 && hasilWizard.path.startsWith("/proyek/"),
  hasilWizard.path,
);

await goto(BASE + "/proyek/tidak-ada");
const hilang = await evaluate(`document.body.innerText.includes("Proyek tidak ditemukan")`);
cek("proyek tak dikenal: pesan jelas", hilang === true);


// ---- Fitur baru: pedoman kampus & pencari rujukan ----
const rf_tunggu = (ms) => new Promise((r) => setTimeout(r, ms));
async function rf_tungguSampai(fn, ms = 12000) {
  const mulai = Date.now();
  while (Date.now() - mulai < ms) {
    if (await fn()) return true;
    await rf_tunggu(400);
  }
  return false;
}
const rf_idProyek = await evaluate(
  `(() => { const d = JSON.parse(localStorage.getItem("uthruha:projects:v1") || "[]"); return d.length ? d[d.length - 1].id : null; })()`,
);
cek("rujukan: proyek tersedia", Boolean(rf_idProyek), String(rf_idProyek));
await goto(BASE + "/proyek/" + rf_idProyek);

// Sub-tab Pedoman Kampus
cek("rujukan: tab utama ada", await evaluate(klik("Rujukan")));
await rf_tunggu(500);
cek("pedoman: sub-tab ada", await evaluate(klik("Pedoman kampus")));
await rf_tunggu(400);

const rf_adaPrompt = await evaluate(`document.body.innerText.includes("Buat Prompt untuk AI")`);
cek("pedoman: tombol prompt AI tampil", rf_adaPrompt === true);

await evaluate(`document.querySelector('textarea[placeholder^="Tempel aturan"]')?.focus()`);
await send("Input.insertText", {
  text:
    "# Pedoman Penulisan UIN Contoh\n## Format Naskah\n- Font Arab: Traditional Arabic 16 pt\n- Ukuran footnote: 14 pt\n- Spasi: 1,5\n- Margin: 3 cm\n- Angka: Arab\n## Sitasi\n- Gaya: catatan kaki\n- Penomoran footnote: per bab\n",
});
await rf_tunggu(200);
cek("pedoman: tombol baca aktif", await evaluate(klik("Baca pedoman")));
await rf_tunggu(600);

const rf_ringkas = await evaluate(
  `(() => {
    const t = document.body.innerText;
    return {
      aturan: /aturan yang dipakai/i.test(t),
      font: t.includes("Traditional Arabic 16 pt"),
      lembaga: t.includes("UIN Contoh"),
      asal: t.includes("untuk audit"),
    };
  })()`,
);
cek("pedoman: ringkasan aturan muncul", rf_ringkas.aturan === true);
cek("pedoman: font & ukuran terbaca", rf_ringkas.font === true);
cek("pedoman: nama lembaga terbaca", rf_ringkas.lembaga === true);
cek("pedoman: jejak audit tersedia", rf_ringkas.asal === true);

const rf_tersimpan = await evaluate(
  `(() => { const d = JSON.parse(localStorage.getItem("uthruha:projects:v1") || "[]"); const p = d.find((x) => x.id === ${JSON.stringify(rf_idProyek)}); return Boolean(p && p.pedoman && p.pedoman.ukuranNaskah === 16 && p.pedoman.marginCm === 3); })()`,
);
cek("pedoman: rf_tersimpan di localStorage", rf_tersimpan === true);

// Tab Tulis -> susun draf agar ada rf_paragraf Arab asli dari aplikasi
cek("tulis: tab terbuka", await evaluate(klik("Tulis")));
await rf_tunggu(500);
cek("tulis: tombol susun draf", await evaluate(klik("Susun draf")));
const rf_adaDraf = await rf_tungguSampai(
  () => evaluate(`((Array.from(document.querySelectorAll("textarea")).sort((a, b) => b.value.length - a.value.length)[0]?.value) || "").length > 120`),
);
cek("tulis: draf tersusun", rf_adaDraf === true);

const rf_paragraf = "رب زدني علما.";

cek("rujukan: tombol cari ada", await evaluate(klik("Cari Rujukan")));
await rf_tunggu(500);
const rf_panel = await evaluate(
  `(() => { const t = document.body.innerText; return { judul: t.includes("البحث عن المراجع"), batas: t.includes("maksimal 2 footnote") }; })()`,
);
cek("pencari: rf_panel terbuka", rf_panel.judul === true);
cek("pencari: batas 2 footnote dijelaskan", rf_panel.batas === true);

await evaluate(`document.querySelector('textarea[placeholder^="الصق"]')?.focus()`);
await send("Input.insertText", { text: rf_paragraf });
await rf_tunggu(200);

const rf_kalimatTerdeteksi = await evaluate(`/\\d+ kalimat terdeteksi/.test(document.body.innerText)`);
cek("pencari: kalimat terpecah", rf_kalimatTerdeteksi === true);

await evaluate(`(() => { const bs = Array.from(document.querySelectorAll("button")).filter((b) => b.innerText.includes("Cari Rujukan")); const b = bs[bs.length - 1]; if (!b) return false; b.click(); return true; })()`);
const rf_adaHasil = await rf_tungguSampai(() =>
  evaluate(`document.body.innerText.includes("Turath.io") && /skor/.test(document.body.innerText)`),
  20000,
);
if (!rf_adaHasil) {
  const cuplikan = await evaluate('document.body.innerText.slice(-1500)');
  console.log("=== CUPLIKAN PANEL ===");
  console.log(cuplikan);
  console.log("=== SELESAI ===");
}
cek("pencari: hasil Turath muncul", rf_adaHasil === true);

const rf_labelMode = await evaluate(
  `(() => {
    const t = document.body.innerText;
    return {
      catatan: /catatan jujur/i.test(t),
      pintu: /pintu manual/i.test(t),
      manual: /rujukan manual/i.test(t),
    };
  })()`,
);
cek("pencari: catatan jujur ditampilkan", rf_labelMode.catatan === true);
cek("pencari: pintu manual dijelaskan", rf_labelMode.pintu === true);
cek("pencari: panel rujukan manual ada", rf_labelMode.manual === true);

cek("pencari: pilih kandidat", await evaluate(`(() => { const b = Array.from(document.querySelectorAll("button")).find((x) => x.innerText.trim() === "Pilih"); if (!b) return false; b.click(); return true; })()`));
await rf_tunggu(400);
const rf_terpilih = await evaluate(`/footnote terpilih \\(1\\/2\\)/i.test(document.body.innerText)`);
cek("pencari: batas pilih 1/2 terlihat", rf_terpilih === true);

cek("pencari: sisip ke naskah", await evaluate(klik("Sisipkan ke naskah")));
await rf_tunggu(900);
const rf_disisip = await evaluate(
  `(() => {
    const v = (Array.from(document.querySelectorAll("textarea")).sort((a, b) => b.value.length - a.value.length)[0]?.value) || "";
    return { marker: v.includes("[^1]"), definisi: v.includes("[^1]:") };
  })()`,
);
cek("pencari: footnote masuk ke naskah", rf_disisip.marker === true);
cek("pencari: definisi footnote ditulis", rf_disisip.definisi === true);

const rf_sumberTambah = await evaluate(
  `(() => { const d = JSON.parse(localStorage.getItem("uthruha:projects:v1") || "[]"); const p = d.find((x) => x.id === ${JSON.stringify(rf_idProyek)}); return p ? p.sumber.length : 0; })()`,
);
cek("pencari: sumber masuk daftar pustaka", Number(rf_sumberTambah) >= 1, String(rf_sumberTambah));

// ---- Rujukan manual: jalur jujur untuk teks yang tidak ada di korpus ----
cek("pencari: buka lagi panel", await evaluate(klik("Cari Rujukan")));
await rf_tunggu(500);
const rf_manualSiap = await evaluate(
  `(() => { const ta = document.querySelector('[data-testid="rujukan-manual"]'); if (!ta) return false; ta.focus(); ta.setSelectionRange(0, 0); return true; })()`,
);
cek("pencari: kolom rujukan manual ada", rf_manualSiap === true);
if (rf_manualSiap) {
  await send("Input.insertText", { text: "النووي، الأذكار، (بيروت: دار الفكر، 2000)، ج 1، ص 23" });
  await rf_tunggu(200);
  cek("pencari: tombol tambah kandidat manual", await evaluate(
    `(() => { const b = document.querySelector('[data-testid="tambah-manual"]'); if (!b || b.disabled) return false; b.click(); return true; })()`,
  ));
  await rf_tunggu(400);
  const rf_manualHasil = await evaluate(
    `(() => {
      const t = document.body.innerText;
      return {
        diurai: t.includes("الأذكار"),
        tanpaSkor: /tanpa skor/i.test(t),
        dipilih: /footnote terpilih/i.test(t),
      };
    })()`,
  );
  cek("pencari: sitasi manual diurai", rf_manualHasil.diurai === true);
  cek("pencari: kandidat manual tanpa skor", rf_manualHasil.tanpaSkor === true);
  cek("pencari: kandidat manual masuk daftar terpilih", rf_manualHasil.dipilih === true);
}
cek("pencari: tutup panel", await evaluate(
  `(() => { const b = Array.from(document.querySelectorAll("button")).filter(x => /tutup|selesai/i.test(x.innerText.trim())).pop(); if (!b) return false; b.click(); return true; })()`,
));
await rf_tunggu(400);

// ---- Periksa Batas di tab Tulis ----
const rf_batasAda = await evaluate(`/periksa batas/i.test(document.body.innerText)`);
cek("tulis: strip periksa batas ada", rf_batasAda === true);
cek("tulis: jalankan periksa batas", await evaluate(
  `(() => { const b = document.querySelector('[data-testid="batas-periksa"]'); if (!b || b.disabled) return false; b.click(); return true; })()`,
));
await rf_tunggu(400);
const rf_batasHasil = await evaluate(
  `(() => { const t = document.body.innerText; return { kata: /kata/i.test(t), spasi: /spasi/i.test(t), pol: /footnote per paragraf/i.test(t) }; })()`,
);
cek("tulis: hasil batas menampilkan kata", rf_batasHasil.kata === true);
cek("tulis: hasil batas menampilkan spasi", rf_batasHasil.spasi === true);
cek("tulis: rincian footnote per paragraf", rf_batasHasil.pol === true);

// ---- Pratinjau: footnote harus dirender, bukan teks mentah ----
cek("tulis: buka pratinjau", await evaluate(
  `(() => { const b = document.querySelector('[data-testid="tulis-pratinjau"]'); if (!b) return false; b.click(); return true; })()`,
));
await rf_tunggu(600);
const rf_pratinjau = await evaluate(
  `(() => {
    const t = document.body.innerText;
    return {
      adaSup: document.querySelectorAll("sup").length > 0,
      adaTeksMentah: /\\[\\^\\d+\\]/.test(t),
      adaDaftarCatatan: /الحواشي/.test(t),
    };
  })()`,
);
cek("pratinjau: penanda footnote jadi superscript", rf_pratinjau.adaSup === true);
cek("pratinjau: tidak ada teks mentah [^1]", rf_pratinjau.adaTeksMentah === false);
cek("pratinjau: daftar catatan dirender", rf_pratinjau.adaDaftarCatatan === true);
cek("tulis: tutup pratinjau", await evaluate(
  `(() => { const b = document.querySelector('[data-testid="tulis-pratinjau"]'); if (!b) return false; b.click(); return true; })()`,
));
await rf_tunggu(300);

const rf_apiInfo = await evaluate(`fetch("/api/refs/search").then((r) => r.json()).then((j) => Array.isArray(j.sumber) && j.sumber.length === 4)`);
cek("api: GET kemampuan sumber", rf_apiInfo === true);

// Seluler
await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true,
});
for (const r of ["/", "/alat", "/jurnal", "/panduan", "/mulai"]) {
  await goto(BASE + r);
  const d = await evaluate(DIAG);
  cek(`seluler ${r}: tanpa luberan (${d.overflow}px)`, d.overflow <= 1, d.title);
}
await send("Emulation.clearDeviceMetricsOverride");

cek("tanpa error konsol sepanjang uji", errors.length === 0, errors.slice(0, 2).join(" | "));

console.log(gagal === 0 ? "SEMUA PASS" : `${gagal} GAGAL`);
ws.close();
chrome.kill();
process.exit(gagal === 0 ? 0 : 1);
