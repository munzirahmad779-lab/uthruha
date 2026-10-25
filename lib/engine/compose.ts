import { FRASA } from "@/lib/content/frasa";
import { getBidang } from "@/lib/content/bidang";
import { getMetode } from "@/lib/content/metode";
import { strukturProyek, findSectionProyek } from "@/lib/content/struktur";
import type { FrasaEntry } from "@/lib/content/types";
import type { Project } from "@/lib/engine/project";
import { keAngkaArab } from "@/lib/engine/cite";
import { hasilkanKandidatFootnote, sisipkanFootnoteTerpilih, pangkasSatuHalaman } from "@/lib/engine/auto-ref";
export type { KandidatFootnote } from "@/lib/engine/auto-ref";

interface Vars {
  topik: string;
  bidang: string;
  metode: string;
  fenomena: string;
  populasi: string;
  lokasi: string;
  teori: string;
  data: string;
  hasil: string;
}

const PLACEHOLDER: Record<string, string> = {
  fenomena: "[صِف الظاهرة التي تلاحظها في الميدان هنا]",
  populasi: "[المجتمع أو العينة البحثية]",
  lokasi: "[مكان تنفيذ البحث]",
  teori: "[النظرية الأساسية]",
  data: "[اعرض بياناتك في جدول هنا]",
  hasil: "[اكتب نتيجة التحليل هنا]",
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function isi(tpl: string, v: Vars): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (m, k: string) => {
    const val = (v as unknown as Record<string, string>)[k];
    return val && val.trim().length > 0 ? val : (PLACEHOLDER[k] ?? m);
  });
}

function pilih(section: string, jumlah: number, seed: number): FrasaEntry[] {
  const pool = FRASA.filter((f) => f.section === section);
  if (pool.length === 0) return [];
  return pool
    .map((f) => ({ f, k: hash(f.id + seed) }))
    .sort((a, b) => a.k - b.k)
    .slice(0, jumlah)
    .map((x) => x.f);
}

function par(...bagian: string[]): string {
  return bagian.filter((b) => b.trim().length > 0).join("\n\n");
}

function daftar(items: string[]): string {
  return items.map((s, i) => `${i + 1}. ${s}`).join("\n");
}

function poin(items: string[]): string {
  return items.map((s) => `- ${s}`).join("\n");
}

function tabel(head: string[], rows: string[][]): string {
  const garis = `| ${head.join(" | ")} |`;
  const pemisah = `| ${head.map(() => "---").join(" | ")} |`;
  const isi2 = rows.map((r) => `| ${r.map((c) => c.replace(/\n/g, " ")).join(" | ")} |`);
  return [garis, pemisah, ...isi2].join("\n");
}

export function variabelProyek(p: Project): Vars {
  const bidang = getBidang(p.bidangId);
  const metode = getMetode(p.metode);
  return {
    topik: p.topikAr || p.judulAr || "[موضوع البحث]",
    bidang: bidang.labelAr,
    metode: metode.labelAr,
    fenomena: p.fenomenaAr,
    populasi: p.populasi,
    lokasi: p.lokasi,
    teori: bidang.teori[0]?.ar ?? "[النظرية الأساسية]",
    data: "",
    hasil: "",
  };
}

export function rumusanDefault(p: Project): string[] {
  if (p.rumusan.filter(Boolean).length > 0) return p.rumusan.filter(Boolean);
  const t = p.topikAr || p.judulAr || "[موضوع البحث]";
  const lok = p.lokasi || "[مكان البحث]";
  const pop = p.populasi || "[المجتمع البحثي]";
  if (p.jenis === "jurnal") {
    return p.metode === "kuantitatif"
      ? [
          `ما مدى تأثير ${t} في ${lok}؟`,
          `هل توجد فروق ذات دلالة إحصائية في ${t} لدى ${pop}؟`,
        ]
      : [
          `كيف يُفهم ${t} ويُمارس في ${lok}؟`,
          `ما العوامل التي تُشكّل ${t} لدى ${pop}؟`,
        ];
  }
  if (p.metode === "kuantitatif") {
    return [
      `كيف واقع ${t} لدى ${pop} في ${lok}؟`,
      `هل توجد فروق ذات دلالة إحصائية في ${t} تُعزى إلى المتغيرات الديموغرافية؟`,
      `هل يوجد أثر ذو دلالة إحصائية لـ${t} في النتائج المتحققة؟`,
    ];
  }
  if (p.metode === "mixed") {
    return [
      `كيف واقع ${t} لدى ${pop} في ${lok}؟`,
      `هل يوجد أثر ذو دلالة إحصائية لـ${t} في النتائج؟`,
      `كيف يفسّر المشاركون في البحث أسباب هذه النتائج؟`,
    ];
  }
  return [
    `كيف يُفهم ${t} ويُمارس لدى ${pop} في ${lok}؟`,
    `ما العوامل التي تُشكّل ${t} في السياق المدروس؟`,
    `كيف يمكن تطوير ${t} في ضوء نتائج البحث؟`,
  ];
}

export function tujuanDefault(p: Project): string[] {
  if (p.tujuan.filter(Boolean).length > 0) return p.tujuan.filter(Boolean);
  const t = p.topikAr || p.judulAr || "[موضوع البحث]";
  return [
    `الكشف عن واقع ${t} في الميدان المدروس`,
    `تحليل العوامل المؤثرة في ${t}`,
    `تقديم مقترحات لتطوير ${t} في ضوء نتائج البحث`,
  ];
}

type BagianFn = (p: Project, v: Vars, seed: number) => string;

const BAB: Record<string, BagianFn> = {
  khalfiya: (p, v, seed) => {
    const f1 = pilih("khalfiya", 3, seed).map((f) => isi(f.ar, v));
    const gap = pilih("dirasat", 2, seed + 3).map((f) => isi(f.ar, v));
    return par(
      `## ${findSectionProyek(p, "khalfiya")?.section.headingAr ?? "خلفية البحث"}`,
      ...f1,
      v.fenomena ? isi("ويظهر ما سبق جليًّا في {{fenomena}}.", v) : "ويظهر ما سبق جليًّا في الظاهرة التي يلاحظها الباحث في الميدان.",
      ...gap,
      "ومن هنا تبرز الحاجة إلى إجراء هذه الدراسة للكشف عن أبعاد الموضوع، وتقديم إجابة علمية موثقة عن الأسئلة التي لم تُجب عنها الدراسات السابقة.",
    );
  },

  masalah: (p, v) => {
    const r = rumusanDefault(p);
    return par(
      "## تحديد المشكلة",
      isi("انطلاقًا من خلفية البحث السابقة، يرى الباحث أن {{topik}} يستحق دراسة متأنية، لأن الفهم النظري له لا يكفي وحده لتفسير ما يجري في الميدان.", v),
      "وعليه، يمكن صياغة مشكلة البحث في الأسئلة الآتية:",
      daftar(r),
      p.jenis === "jurnal" ? "" : "ويقتصر البحث على معالجة هذه الأسئلة دون سواها، على أن يُعاد النظر في بعضها إذا اقتضت ذلك نتائج الميدان.",
    );
  },

  ahdaf: (p, v) => {
    const t = tujuanDefault(p);
    return par(
      "## أهداف البحث",
      isi("يهدف هذا البحث إلى ما يأتي:", v),
      daftar(t),
      "وتُقابل هذه الأهدافُ أسئلة البحث السابقة واحدًا بواحد، بحيث تكون كل نتيجة في الفصل الرابع إجابةً مباشرة على أحدها.",
    );
  },

  fawaid: (p, v, seed) => {
    const teoretis = pilih("fawaid", 2, seed).map((f) => isi(f.ar, v));
    return par(
      "## فوائد البحث",
      "### أولًا: الفوائد النظرية",
      ...teoretis,
      isi("ويسهم هذا البحث في إثراء الدراسات المتعلقة بـ{{bidang}}، ويضيف إلى المكتبة العلمية وصفًا دقيقًا لـ{{topik}} في السياق الذي يدرسه.", v),
      "### ثانيًا: الفوائد العملية",
      isi("أما الفوائد العملية فتتمثل في أن نتائج هذا البحث يمكن أن يستفيد منها القائمون على {{bidang}} في {{lokasi}}، إلى جانب الباحثين الذين سيتابعون الدراسة في الموضوع نفسه.", v),
      "ويمكن أن تكون هذه النتائج أساسًا لمراجعة بعض الإجراءات العلمية والعملية في المؤسسة محل البحث.",
    );
  },

  hudud: (p, v) => {
    return par(
      "## حدود البحث",
      isi("اقتصر هذا البحث على الموضوع الآتي: {{topik}}. أما من حيث الحدود المكانية فقد جرى البحث في {{lokasi}}، ومن حيث الحدود الزمانية فقد جرى في الفترة التي حددها الباحث في خطة البحث.", v),
      poin([
        "**الحدود الموضوعية:** " + (p.topikAr || "[موضوع البحث]") + " دون غيره من الموضوعات المتصلة به.",
        "**الحدود المكانية:** " + (p.lokasi || "[مكان البحث]"),
        "**الحدود الزمانية:** الفترة التي جرى فيها جمع البيانات وتحليلها.",
        "**الحدود البشرية:** " + (p.populasi || "[المجتمع أو العينة]"),
      ]),
      "ولا يعني هذا التحديد ضيق أفق البحث، وإنما هو شرط منهجي يجعل النتائج قابلة للتحقق والمناقشة.",
    );
  },

  mustalahat: (p, v) => {
    const bidang = getBidang(p.bidangId);
    const istilah = p.istilah.filter((i) => i.id_label || i.ar).slice(0, 6);
    const rows =
      istilah.length > 0
        ? istilah.map((i) => [i.id_label || "—", i.ar || "—"])
        : bidang.teori.slice(0, 4).map((t) => [t.id, t.ar]);
    return par(
      "## تحديد المصطلحات",
      isi("لتفادي الاختلاف في الفهم، يُحدد الباحث المصطلحات الآتية تحديدًا إجرائيًّا يلزم الباحث في جميع فصول البحث:", v),
      tabel(["المصطلح", "التعريف الإجرائي المعتمد في البحث"], rows),
      "وقد اعتمد الباحث هذه التعريفات في استخراج المعنى من النصوص وتحليل البيانات، فإذا ورد المصطلح في موضع آخر من البحث فهو محمول على هذا التعريف.",
    );
  },

  ithar: (p, v, seed) => {
    const bidang = getBidang(p.bidangId);
    const teori = bidang.teori.slice(0, 4);
    const urutan = ["أولًا", "ثانيًا", "ثالثًا", "رابعًا", "خامسًا"];
    const sub = teori.map((t, i) =>
      par(
        `### ${urutan[i] ?? `${i + 1}.`}: ${t.ar}`,
        isi(`يُعدّ ${t.ar} من المفاهيم الأساسية التي ينبني عليها هذا البحث، وقد تنوعت آراء الباحثين في تحديده، وهو ما يدعو الباحث إلى عرضه ثم الاختيار منه في ضوء حاجة الدراسة.`, v),
        isi(`ويتصل هذا المفهوم بـ{{topik}} اتصالًا مباشرًا، من حيث إن الأول يقدم الإطار الذي يفسر به الثاني.`, v),
      ),
    );
    return par(
      "## الإطار النظري",
      isi("تتطلب هذه الدراسة عرض الإطار النظري الذي تُبنى عليه، إذ تنطلق من مفاهيم {{bidang}} كما صاغها العلماء، ثم تختار منها ما يصلح لتحليل {{topik}}.", v),
      pilih("ithar", 2, seed).map((f) => isi(f.ar, v)).join("\n\n"),
      ...sub,
      "### التأصيل النظري في المصادر الأصلية",
      "ويلزم التنبيه إلى أن المصادر الأصلية مقدمة على غيرها في هذا البحث، ولذلك يعتمد الباحث على المصادر الآتية، ويرجع إليها عند نقل المسائل:",
      poin(bidang.rujukanKunci),
    );
  },

  dirasat: (p, v, seed) => {
    return par(
      "## الدراسات السابقة",
      isi("لجأ الباحث إلى استعراض الدراسات السابقة للتأكد من موقع هذه الدراسة في خريطة البحث العلمي في مجال {{bidang}}، وتُعرض هنا مقارنةً موجزةً بينها:", v),
      tabel(
        ["الدارسة", "السنة", "موضوعها", "منهجها", "الفرق عن هذه الدراسة"],
        [
          ["[اسم الباحث]", "[السنة]", "[موضوع الدراسة]", "[المنهج]", "[الفرق]"],
          ["[اسم الباحث]", "[السنة]", "[موضوع الدراسة]", "[المنهج]", "[الفرق]"],
          ["[اسم الباحث]", "[السنة]", "[موضوع الدراسة]", "[المنهج]", "[الفرق]"],
        ],
      ),
      pilih("dirasat", 2, seed + 1).map((f) => isi(f.ar, v)).join("\n\n"),
      isi("وبالمقارنة يتبين أن موضع الاختلاف بين هذه الدراسة وما سبقها يظهر في {{fenomena}}، وهو ما يشكل الفراغ البحثي الذي تسعى الدراسة الحالية إلى ملئه.", v),
    );
  },

  itharFikri: (p, v, seed) => {
    const r = rumusanDefault(p);
    return par(
      "## الإطار الفكري",
      isi("يجري الباحث في هذه الدراسة وفق تسلسل منطقي، تبدأ فيه الأسباب من واقع {{topik}} ثم تنتقل إلى تحليل عناصره، ثم إلى النتائج التي نُبني عليها المقترحات. ويمكن تصوير ذلك في الكيفية الآتية:", v),
      "**المتغير المستقل / الظاهرة المدروسة:** " + (p.topikAr || "[موضوع البحث]"),
      "**العناصر الوسيطة:** " + (p.bidangId ? getBidang(p.bidangId).teori.slice(0, 2).map((t) => t.ar).join("، ") : "[المفاهيم الوسيطة]"),
      "**النتائج المتوقعة:** " + r[r.length - 1],
      pilih("itharFikri", 1, seed).map((f) => isi(f.ar, v)).join("\n\n"),
      "وتُجسِّد هذه البنية المنطقية العلاقةَ بين أجزاء البحث، بحيث لا يُتوقع نتيجةٌ في الفصل الرابع لم يكن لها موضع في هذا الإطار.",
    );
  },

  farudhiyat: (p, v) => {
    const r = rumusanDefault(p).slice(0, 3);
    const rows = r.map((q, i) => [
      `H${keAngkaArab(i + 1)}`,
      `يوجد أثر ذو دلالة إحصائية لـ${p.topikAr || "[المتغير المستقل]"} في النتائج المرتبطة بالسؤال ${keAngkaArab(i + 1)}.`,
      `H0${keAngkaArab(i + 1)}`,
      "لا يوجد أثر ذو دلالة إحصائية.",
    ]);
    return par(
      "## الفرضيات",
      isi("صياغةً لما تقدم، يختبر هذا البحث الفرضيات الآتية عند مستوى دلالة (α = ٠٫٠٥):", v),
      tabel(["الفرضية", "صياغتها", "الفرضية الصفرية", "صياغتها"], rows),
      "ويُحكم على كل فرضية بقبولها أو رفضها بناءً على نتيجة الاختبار الإحصائي المناسب، لا على أساس التوقع الشخصي للباحث.",
      ">[ملاحظة منهجية] تُكتب صياغة الفرضيات بعد استقرار أدوات البحث وبياناته، لأن تغيير المتغيرات يستلزم إعادة صياغتها.",
    );
  },

  manhajNau: (p, v, seed) => {
    const metode = getMetode(p.metode);
    const desain = metode.desain;
    return par(
      "## نوع البحث ومدخله",
      isi("اعتمد الباحث في هذه الدراسة على {{metode}}، لأنه الأنسب لطبيعة المشكلة المطروحة، إذ يقتضي موضوع {{topik}} جمع بيانات يمكن تحليلها والاستدلال بها على ما يجري في الميدان.", v),
      pilih("manhajNau", 2, seed).map((f) => isi(f.ar, v)).join("\n\n"),
      "وفي ضوء ذلك اختار الباحث التصميم الآتي:",
      poin(desain.map((d) => `**${d.ar}** — ${d.id}`)),
      ">[ملاحظة منهجية] يُختار تصميم واحد فقط، ويُبرر اختياره، ولا تُذكر تصاميم لم تُستخدم.",
    );
  },

  masadir: (p, v, seed) => {
    return par(
      "## مصادر البيانات",
      isi("تتحدد مصادر البيانات في هذا البحث فيما يأتي:", v),
      tabel(
        ["نوع البيانات", "المصدر", "أداة الحصول عليها"],
        [
          ["بيانات أولية", p.populasi || "[المستجيبون / المبحوثون]", "الاستبانة / المقابلة / الملاحظة"],
          ["بيانات أولية", p.lokasi || "[مكان البحث]", "الملاحظة الميدانية والوثائق"],
          ["بيانات ثانوية", "المصادر العلمية والوثائق الرسمية", "الدراسة المكتبية"],
        ],
      ),
      isi("وأما المجتمع البحثي فهو {{populasi}} في {{lokasi}}، وقد اختار الباحث عينةً ممثلة له بالطريقة التي يناسبها تصميم الدراسة، مع مراعاة شروط التمثيل وحجم العينة.", v),
      pilih("masadir", 1, seed).map((f) => isi(f.ar, v)).join("\n\n"),
      ">[ملاحظة منهجية] اذكر عدد أفراد المجتمع، وحجم العينة، وتقنية السحب (عشوائية بسيطة، طبقية، قصدية…)، ثم علل اختيارها.",
    );
  },

  adawat: (p, v, seed) => {
    const metode = getMetode(p.metode);
    return par(
      "## أدوات جمع البيانات",
      isi("استعان الباحث في جمع البيانات بالأدوات الآتية:", v),
      poin(metode.teknik.map((t) => `**${t.ar}** — ${t.id}`)),
      "### التحقق من الأداة",
      isi("وقبل تطبيق الأداة، تحقق الباحث من صلاحيتها للقياس بالطريقة المناسبة لطبيعة البحث:", v),
      poin(metode.keabsahan.map((k) => `**${k.ar}** — ${k.id}`)),
      pilih("adawat", 1, seed + 2).map((f) => isi(f.ar, v)).join("\n\n"),
      ">[ملاحظة منهجية] أرفق نص الأداة كاملة في الملاحق، مع جدول نتائج التحكيم ونتائج حساب الثبات.",
    );
  },

  tahlil: (p, v, seed) => {
    const metode = getMetode(p.metode);
    return par(
      "## تحليل البيانات",
      isi("يسير تحليل البيانات في هذا البحث على المراحل الآتية، بالترتيب:", v),
      daftar(metode.analisis.map((a) => `**${a.ar}** — ${a.id}`)),
      pilih("tahlil", 1, seed).map((f) => isi(f.ar, v)).join("\n\n"),
      ">[ملاحظة منهجية] اذكر اسم البرنامج المستخدم وإصداره (مثل SPSS ٢٦ أو NVivo ١٤)، فهو جزء من قابلية التكرار.",
    );
  },

  wasf: (p, v, seed) => {
    return par(
      "## وصف البيانات",
      isi("يعرض الباحث في هذا الفصل البيانات التي جمعها من ميدان الدراسة في {{lokasi}}، بعد التأكد من اكتمالها وصلاحيتها للتحليل.", v),
      "### أولًا: وصف عام لميدان البحث",
      isi("يقع ميدان البحث في {{lokasi}}، ويتمثل مجتمعه في {{populasi}}. وفيما يأتي وصف موجز للسياق الذي جُمعت فيه البيانات:", v),
      pilih("wasf", 2, seed).map((f) => isi(f.ar, v)).join("\n\n"),
      "### ثانيًا: عرض البيانات",
      "يُعرض توزيع البيانات في الجدول الآتي:",
      tabel(
        ["البيان", "التكرار", "النسبة المئوية"],
        [
          ["[الفئة الأولى]", "[…]", "[…]٪"],
          ["[الفئة الثانية]", "[…]", "[…]٪"],
          ["المجموع", "[…]", "١٠٠٪"],
        ],
      ),
      ">[ملاحظة] الجدول يُصمم بحسب متغيرات بحثك، ويُرقَّم ويُعنون قبل التحليل.",
    );
  },

  tahlilNataij: (p, v, seed) => {
    const r = rumusanDefault(p);
    const blok = r
      .map((q, i) =>
        par(
          `### ${["السؤال الأول", "السؤال الثاني", "السؤال الثالث", "السؤال الرابع"][i] ?? `السؤال ${i + 1}`}: ${q}`,
          "يعرض الباحث هنا البيانات المرتبطة بهذا السؤال، ثم يحللها على النحو الآتي:",
          tabel(["المؤشر", "القيمة", "الدلالة"], [["[…]", "[…]", "[…]"], ["[…]", "[…]", "[…]"]]),
          "[اكتب تفسير النتيجة هنا، مع الإشارة إلى الجدول أو الشكل الذي تُعرض فيه]",
        ),
      )
      .join("\n\n");
    return par(
      "## تحليل النتائج",
      isi("يحلل الباحث في هذا المبحث البيانات التي جمعها للإجابة عن أسئلة البحث، وقد جاءت النتائج على النحو الآتي:", v),
      blok,
      pilih("tahlilNataij", 1, seed).map((f) => isi(f.ar, v)).join("\n\n"),
      ">[ملاحظة] لا تُكرر عرض البيانات في التحليل؛ بل فسّرها وقارنها، ثم انتقل إلى مناقشتها.",
    );
  },

  munazara: (p, v, seed) => {
    return par(
      "## مناقشة النتائج",
      isi("بعد عرض النتائج، ينتقل الباحث إلى مناقشتها في ضوء الإطار النظري الذي عرضه في الفصل الثاني، والدراسات السابقة التي استعرضها:", v),
      pilih("munazara", 2, seed).map((f) => isi(f.ar, v)).join("\n\n"),
      isi("ويتضح من ذلك أن نتائج هذه الدراسة تتفق مع ما ذهب إليه {{teori}} في الجانب النظري، وتختلف مع بعض الدراسات السابقة في جانب التطبيق، ويعود هذا الاختلاف إلى طبيعة {{topik}} في السياق المدروس.", v),
      ">[ملاحظة] لكل نتيجة: قارنها بنتيجة دراسة سابقة محددة، واشرح سبب الاتفاق أو الاختلاف، ثم اذكر حدود تفسيرك.",
    );
  },

  khulasah: (p, v) => {
    const r = rumusanDefault(p);
    return par(
      "## الخلاصة",
      isi("بعد عرض البيانات وتحليلها ومناقشتها، يمكن تلخيص نتائج هذا البحث في النقاط الآتية:", v),
      daftar(r.map((q, i) => `**${["أولًا", "ثانيًا", "ثالثًا", "رابعًا"][i] ?? `${i + 1}.`}:** [اكتب خلاصة الإجابة عن: ${q}]`)),
      "وهذه النتائج إجابة مباشرة عن أسئلة البحث التي وردت في الفصل الأول، ولم تُضف إليها بيانات جديدة خارج ما عُرض في الفصل الرابع.",
    );
  },

  iqtirahat: (p, v) => {
    return par(
      "## الاقتراحات",
      isi("في ضوء نتائج البحث وتجاربه الميدانية، يقترح الباحث ما يأتي:", v),
      poin([
        isi("**للباحثين:** دراسة {{topik}} بتصميم مختلف أو في سياق آخر، للتأكد من قابلية النتائج للتعميم.", v),
        isi("**للمؤسسة:** مراجعة الإجراءات المتعلقة بـ{{topik}} في {{lokasi}} بالاستناد إلى النتائج العملية.", v),
        "**للدراسات التابعة:** إجراء دراسة طولية تتابع الأثر بعد مدة من الزمن، لأن هذه الدراسة محدودة بالزمن.",
      ]),
    );
  },

  mulakhkhas: (p, v, seed) => {
    return par(
      "## الملخص",
      isi("يهدف هذا البحث إلى الكشف عن {{topik}} في {{lokasi}}، وقد استخدم الباحث {{metode}}، وجمع البيانات من {{populasi}} بالأدوات المناسبة لطبيعة البحث.", v),
      "[اكتب هنا الفكرة الأساسية للنتائج: ما الذي انتهى إليه البحث في سطرين؟]",
      isi("وانتهى البحث إلى نتائج تشير إلى وجود علاقة واضحة بين عناصر {{topik}} والنتائج المتحققة، ويقترح الباحث في ضوئها جملة من المقترحات العملية.", v),
      "**الكلمات المفتاحية:** " + (p.bidangId ? getBidang(p.bidangId).keywords.slice(0, 4).join("، ") : "[كلمة، كلمة، كلمة]"),
      pilih("mulakhkhas", 1, seed).length ? "" : "",
    );
  },

  muqaddima: (p, v, seed) => {
    return par(
      "## المقدمة",
      isi("يُعدّ {{topik}} من الموضوعات التي تشغل الباحثين في مجال {{bidang}}، لما له من أثر في الممارسة العلمية والعملية.", v),
      ...pilih("muqaddima", 3, seed).map((f) => isi(f.ar, v)),
      isi("وعلى الرغم من التراكم المعرفي في هذا الباب، فإن الدراسات التي تناولت {{topik}} في {{lokasi}} لا تزال محدودة، وهو ما يشكل الفراغ البحثي الذي يسدّه هذا المقال.", v),
      isi("ولذلك يهدف هذا المقال إلى الإجابة عن سؤال رئيس، هو: كيف يمكن فهم {{topik}} وتفسير تحولاته في السياق المدروس؟", v),
    );
  },

  tariqa: (p, v, seed) => {
    const metode = getMetode(p.metode);
    return par(
      "## الطريقة",
      isi("اعتمد هذا المقال {{metode}}، وقد اختير لملاءمته طبيعة الظاهرة وطبيعة البيانات المتاحة عنها.", v),
      poin(metode.desain.slice(0, 2).map((d) => `**${d.ar}** — ${d.id}`)),
      isi("وجُمعت البيانات من {{populasi}} في {{lokasi}}، بالأدوات الآتية:", v),
      poin(metode.teknik.map((t) => `**${t.ar}** — ${t.id}`)),
      isi("أما تحليل البيانات فقد جرى على النحو الآتي:", v),
      daftar(metode.analisis.map((a) => `**${a.ar}** — ${a.id}`)),
      pilih("tariqa", 1, seed).map((f) => isi(f.ar, v)).join("\n\n"),
    );
  },

  nataij: (p, v, seed) => {
    return par(
      "## النتائج والمناقشة",
      isi("تكشف البيانات عن مجموعة من النتائج المتصلة بـ{{topik}}، تُعرض في هذا المبحث مقرونةً بتفسيرها ومقارنتها بالأدبيات السابقة.", v),
      "[اعرض النتيجة الأولى هنا، ثم الجدول أو الشكل الدال عليها]",
      ...pilih("nataij", 2, seed).map((f) => isi(f.ar, v)),
      "[اقرن النتيجة بدراسة سابقة محددة، واشرح وجه الاتفاق أو الاختلاف]",
      isi("وتشير النتائج إلى أن {{topik}} يتأثر بعوامل متداخلة، وهو ما يفسر تفاوت النتائج في الدراسات السابقة باختلاف السياق الذي أُجريت فيه.", v),
    );
  },

  khatima: (p, v, seed) => {
    return par(
      "## الخاتمة",
      isi("خلص هذا المقال إلى أن {{topik}} ظاهرة متعددة الأبعاد لا تُفسَّر بعامل واحد، وأن فهمها يقتضي جمع {{metode}} مع النظر في السياق المحلي.", v),
      "[اكتب في جملتين أهم ما يميز نتائج هذا المقال عن الدراسات السابقة]",
      "ويوصي الباحث بدراسات تالية تختبر النتائج في سياقات أخرى، وبتطبيق المقترحات العملية في المؤسسات المعنية.",
      pilih("khatima", 1, seed).length ? "" : "",
    );
  },

  maraji: (p, v, seed) => {
    return par(
      "## المراجع",
      "[تُنسخ المراجع هنا من لسان «المراجع» في مساحة العمل بعد التحقق من كل مدخل على مصدره الأصلي]",
      poin([
        "الكتب تُرتب ألفبائيًّا باسم العائلة أو اللقب.",
        "المقالات تُذكر باسم المجلة والمجلد والعدد والصفحات.",
        "المصادر الإلكترونية تُذكر بتاريخ الوصول.",
        "التنسيق يتبع دليل الجامعة أو المجلة المستهدفة، لا الذوق الشخصي.",
      ]),
    );
  },
};

export interface HasilKomposisi {
  markdown: string;
  seed: number;
  sectionId: string;
  frasa: number;
  /** Kandidat footnote yang bisa dipilih/dibuang user di UI. */
  kandidatFootnote: import("@/lib/engine/auto-ref").KandidatFootnote[];
}

export function composeSection(p: Project, sectionId: string, seed = 0): HasilKomposisi {
  const found = findSectionProyek(p, sectionId);
  const v = variabelProyek(p);
  const fn = BAB[sectionId];
  // Benih HARUS stabil terhadap isi proyek, bukan terhadap identitasnya.
  // Dulu benih memakai `p.id` yang dibuat dengan Math.random(), sehingga
  // menyusun ulang bagian yang sama bisa menghasilkan teks berbeda. Akibatnya
  // naskah tidak bisa direproduksi dan cacat template jadi hilang-timbul
  // saat diuji. Proyek yang sama wajib menghasilkan naskah yang sama.
  const tandaStabil = [
    p.jenis,
    p.metode,
    p.bidangId ?? "",
    p.judulAr ?? "",
    p.topikAr ?? "",
    p.lokasi ?? "",
    p.populasi ?? "",
  ].join("|");
  const hash0 = hash(`${tandaStabil}|${sectionId}|${seed}`);
  let markdown = fn
    ? fn(p, v, hash0)
    : par(
        `## ${found?.section.headingAr ?? sectionId}`,
        isi("[هذا القسم لم يُحرَّر بعد — استخدم أسئلة التوجيه أعلاه ثم اكتب هنا]", v),
      );

  // Pangkas agar tidak melebihi 1 halaman DULU, baru sisipkan referensi.
  markdown = pangkasSatuHalaman(markdown);

  // Hasilkan kandidat footnote kontekstual (opsional — user memilih di UI).
  const kandidatFootnote = hasilkanKandidatFootnote(p, sectionId, markdown);

  // Untuk draf otomatis, sisipkan semua kandidat sebagai default.
  // User bisa membuang/menambahkan lewat UI nanti.
  if (kandidatFootnote.length > 0) {
    markdown = sisipkanFootnoteTerpilih(markdown, kandidatFootnote);
  }

  return { markdown: markdown.replace(/\n{3,}/g, "\n\n").trim(), seed, sectionId, frasa: FRASA.filter((f) => f.section === sectionId).length, kandidatFootnote };
}

export function composeNaskah(p: Project): string {
  const st = strukturProyek(p);
  const bagian: string[] = [];
  bagian.push(`# ${p.judulAr || p.topikAr || "عنوان البحث"}`);
  bagian.push(
    [
      `**نوع البحث:** ${st.labelAr} (${st.labelId})`,
      `**المنهج:** ${getMetode(p.metode).labelAr}`,
      `**المجال:** ${getBidang(p.bidangId).labelAr}`,
      `**الباحث:** [الاسم]`,
      `**السنة:** ${keAngkaArab(new Date().getFullYear())}`,
    ].join("  \n"),
  );
  for (const chapter of st.chapters) {
    bagian.push(`# ${chapter.labelAr}`);
    for (const section of chapter.sections) {
      const draf = p.draf[section.id];
      if (draf && draf.trim().length > 20) {
        bagian.push(draf.trim());
      } else {
        const hasil = composeSection(p, section.id);
        bagian.push(`> *(مسودة تلقائية — لم تُراجع بعد)*\n\n${hasil.markdown}`);
      }
    }
  }
  return bagian.join("\n\n---\n\n");
}
