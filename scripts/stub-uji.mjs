/**
 * Stub lokal rangkaian uji Fase 3 — BUKAN bagian dari aplikasi.
 * Meniru tiga layanan luar pada satu port (bawaan 3999):
 *  - LLM OpenAI-compatible di /llm/v1/chat/completions (untuk kolam mode uji)
 *  - Midtrans Snap di /snap/v1/transactions
 *  - Google Drive di /drive/v3/* dan /upload/drive/v3/*
 * Semua jawaban bersifat kalengan & deterministik agar bukti uji stabil.
 * Label: hasil dari stub ini adalah SIMULASI untuk layanan yang ditirunya.
 */
import http from "node:http";

const PORT = Number(process.env.STUB_PORT || 3999);

function json(res, kode, objek) {
  const badan = JSON.stringify(objek);
  res.writeHead(kode, { "Content-Type": "application/json" });
  res.end(badan);
}

const TRIAL_JSON = {
  kalimatKunci: ["أثر طريقة المناقشة", "تنمية مهارة الكلام", "تعليم اللغة العربية"],
  khalfiyah: [
    "تعد مهارة الكلام من أهم مهارات اللغة العربية التي يسعى متعلموها إلى إتقانها، لأنها وسيلة التواصل الفعلية داخل الفصل وخارجه. غير أن كثيرا من الطلاب ما زالوا يجدون صعوبة في التعبير الشفهي الحر، إذ يغلب على دروسهم الحفظ والتلقين دون ممارسة حقيقية للحوار.",
    "ومن هنا تبرز الحاجة إلى طرائق تدريس تمنح الطالب فرصة أوسع للممارسة، ومن أبرزها طريقة المناقشة التي تجعل المتعلم محورا للعملية التعليمية. ففي هذا السياق لا يكون الطالب متلقيا سلبيا، بل مشاركا فعالا يبني فهمه من خلال التفاعل وتبادل الآراء مع زملائه ومعلمه.",
    "وتأسيسا على ذلك يسعى هذا البحث إلى الكشف عن أثر طريقة المناقشة في تنمية مهارة الكلام لدى الطلاب، حتى تتضح الصورة عن مدى فاعليتها في سياق تعليم اللغة العربية. وينطلق البحث من أسئلة محددة وأهداف واضحة سيجري بيانها في الفقرات الآتية من هذا البحث.",
  ],
  isykaliyat: [
    "كيف يطبق المعلم طريقة المناقشة في تعليم مهارة الكلام؟",
    "ما أثر طريقة المناقشة في تنمية مهارة الكلام لدى الطلاب؟",
  ],
  ahdaf: [
    "لمعرفة كيفية تطبيق طريقة المناقشة في تعليم مهارة الكلام.",
    "لمعرفة أثر طريقة المناقشة في تنمية مهارة الكلام لدى الطلاب.",
  ],
};

const PROFIL_JSON = {
  arab: ["فقه المعاملات المعاصرة", "أحكام التعامل المالي"],
  indonesia: ["fiqh muamalah kontemporer", "transaksi keuangan modern"],
  inggris: ["contemporary islamic finance jurisprudence"],
};

const server = http.createServer((req, res) => {
  let badan = "";
  req.on("data", (c) => (badan += c));
  req.on("end", () => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (url.pathname === "/llm/v1/chat/completions") {
      let pesan = "";
      try {
        const j = JSON.parse(badan || "{}");
        pesan = (j.messages || []).map((m) => String(m.content || "")).join("\n");
      } catch { /* abaikan */ }
      let isi;
      if (pesan.includes("profil kata kunci pencarian akademik")) {
        isi = JSON.stringify(PROFIL_JSON);
      } else if (pesan.includes("kalimatKunci") || pesan.includes("JUDUL:")) {
        isi = JSON.stringify(TRIAL_JSON);
      } else {
        isi = "Jawaban agen uji: saya agen Uthruha versi stub pengujian. Pertanyaan Anda tercatat dan dijawab secara deterministik oleh stub lokal.";
      }
      return json(res, 200, { choices: [{ message: { content: isi } }] });
    }
    if (url.pathname === "/snap/v1/transactions") {
      return json(res, 200, { token: "snap-token-uji", redirect_url: "https://stub.contoh/snap/snap-token-uji" });
    }
    if (url.pathname === "/drive/v3/files" && req.method === "GET") {
      return json(res, 200, { files: [] });
    }
    if (url.pathname === "/drive/v3/files" && req.method === "POST") {
      return json(res, 200, { id: "folder-uji-1", name: "folder uji" });
    }
    if (url.pathname === "/upload/drive/v3/files") {
      return json(res, 200, { id: "doc-uji-1", webViewLink: "https://drive.contoh/doc-uji-1" });
    }
    return json(res, 404, { error: "stub: jalur tidak dikenal", path: url.pathname });
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`stub-uji mendengarkan di 127.0.0.1:${PORT}`);
});
