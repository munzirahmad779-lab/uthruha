import { FRASA } from "@/lib/content/frasa";
import { getBidang } from "@/lib/content/bidang";
import { getMetode } from "@/lib/content/metode";
import { strukturProyek, findSectionProyek } from "@/lib/content/struktur";
import type { FrasaEntry } from "@/lib/content/types";
import type { Project } from "@/lib/engine/project";
import { keAngkaArab } from "@/lib/engine/cite";
import { hasilkanKandidatFootnote, sisipkanFootnoteTerpilih, pangkasSatuHalaman } from "@/lib/engine/auto-ref";
import { bersihSelTabel } from "@/lib/engine/tabel-markdown";
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
  const garis = `| ${head.map(bersihSelTabel).join(" | ")} |`;
  const pemisah = `| ${head.map(() => "---").join(" | ")} |`;
  const isi2 = rows.map((r) => `| ${r.map(bersihSelTabel).join(" | ")} |`);
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
  const pola: Array<(x: string) => string> = [
    (x) => `الكشف عن واقع ${x} في الميدان المدروس`,
    (x) => `تحليل العوامل المؤثرة في ${x}`,
    (x) => `تقديم مقترحات لتطوير ${x} في ضوء نتائج البحث`,
  ];
  const jumlah = rumusanDefault(p).length;
  return Array.from({ length: jumlah }, (_, i) =>
    i < pola.length ? pola[i]!(t) : `تحليل جانب ${keAngkaArab(i + 1)} من ${t}`,
  );
}

type BagianFn = (p: Project, v: Vars, seed: number) => string;

const BAB: Record<string, BagianFn> = {
  kontribusi: (p, v) => {
    return par(
      "## إسهام البحث",
      isi("يُتوقَّع أن يقدّم هذا البحث إسهامًا نظريًّا في مجال {{bidang}}، إذ يعيد قراءة {{topik}} في ضوء {{teori}}، ويعرض فهمًا أكثر دقة لعلاقات عناصره مما كان متاحًا في الدراسات السابقة.", v),
      isi("أما الإسهام العملي، فيتمثل في أن نتائج هذا البحث تقدّم للقائمين على {{bidang}} في " + (p.lokasi || "المؤسسة محل البحث") + " أساسًا موثّقًا لاتخاذ القرارات ومراجعة الممارسات القائمة، بدل الاعتماد على الانطباعات غير المختبرة.", v),
      "ويضيف البحث إلى الدراسات الإسلامية والتراثية بُعدًا تطبيقيًّا، حين يربط النصوص المؤسِّسة بالممارسة المعاصرة ربطًا منهجيًّا قابلًا للمناقشة والتحقق، لا ربطًا خطابيًّا عامًّا.",
    );
  },

  sintesisTeori: (p, v) => {
    return par(
      "## تركيب النظرية ونقدها",
      isi("لا يقف هذا البحث عند عرض النظريات المتصلة بـ{{topik}}، بل يقارن بينها مقارنة نقدية: فمنها ما يفسّر الظاهرة من زاوية بنيوية، ومنها ما يفسّرها من زاوية الممارسة والفاعلين، ولكلٍّ منها حدود لا تستطيع تجاوزها وحدها.", v),
      isi("ويرى الباحث أن {{teori}} — مع قوتها التفسيرية — تحتاج إلى أن تُستكمل بعناصر من المقاربات الأخرى؛ لأن الظاهرة المدروسة متعددة الأبعاد، والاكتفاء بنظرية واحدة يجعل جزءًا منها خارج الصورة.", v),
      "وعلى هذا الأساس يبني الباحث موقفه النظري الذي ستجري عليه فصول التحليل التالية، وسيظهر أثر هذا الموقف في اختيار الأدوات وفي قراءة النتائج ومناقشتها.",
    );
  },

  kebaruan: (p, v) => {
    return par(
      "## جدة البحث وأصالته",
      isi("يدّعي هذا البحث الجدةَ والأصالة في معالجة {{topik}} من وجوه محددة يمكن التحقق منها، لا بدعوى عامة؛ فالدراسات السابقة — على كثرتها وقيمتها — لم تتناول هذا الموضوع من الزاوية التي يتناولها منها هذا البحث، ولم تجب عن الأسئلة التي يطرحها.", v),
      poin([
        "**من جهة الموضوع والسياق:** يدرس البحث الظاهرة في سياق لم تصل إليه الدراسات السابقة دراسة مستقلة موثقة.",
        "**من جهة المنهج:** يوظف البحث " + (v.metode || "المنهج المعتمد") + " بتوظيف يتيح كشف ما لا تكشفه المقاربات المعتادة.",
        "**من جهة الجواب:** يقدّم البحث إجابة أو قراءة جديدة قابلة للاختبار والمناقشة، صيغت تفاصيلها في الفصل الأخير من فصول التحليل.",
      ]),
      "[بعد مقارنة منهجية مع أقرب الدراسات، اكتب هنا موضع الفراغ البحثي الذي يملؤه هذا البحث]",
    );
  },

  petaJalan: (p, v) => {
    return par(
      "## خارطة البحث وموقعه",
      isi("مرّت دراسة {{topik}} بمراحل متعاقبة: بدأت بمعالجات وصفية عامة، ثم انتقلت إلى دراسات تحليلية ركّز أغلبها على الجانب النظري، ثم ظهر اتجاه حديث يعنى بالتطبيق والميدان، وما تزال جوانب من الظاهرة خارج التغطية المنهجية.", v),
      "وتتوزع الدراسات السابقة على اتجاهات كبرى يختلف بعضها عن بعض في الأسئلة والأدوات والنتائج، وقد عُرضت هذه الاتجاهات في الدراسات السابقة مقارنةً ونقدًا، وتبيّن منها أن الفراغ البحثي الحقيقي لا يكمن في غياب الدراسات، بل في غياب معالجة تجمع بين الأصالة النصية والتحقق الميداني.",
      isi("ويقع هذا البحث في موضع محدد من هذه الخارطة: إنه يستكمل الاتجاه الحديث في دراسة {{bidang}}، ويصحّح بعض ما تراكم فيه من تعميمات، ويقدّم المادة الموثقة التي يمكن أن تنطلق منها دراسات لاحقة.", v),
    );
  },

  abstrakEn: (p, v) => {
    const topic = p.topikAr || p.judulAr || "the research topic";
    return par(
      "## Abstract",
      `This study examines ${topic} within the field of Islamic/Arabic studies. It aims to describe the phenomenon as it actually occurs, analyse the factors that shape it, and formulate conclusions that are accountable to the primary sources and to field data.`,
      `The study employs a documented research method appropriate to its questions, drawing on classical and contemporary references. Data were collected and analysed systematically so that every finding presented in this article can be traced back to its evidence.`,
      "[Write the main findings here once the analysis is complete.]",
      "Keywords: " + (p.topikAr || "research") + "; Islamic studies; Arabic scholarship",
    );
  },

  kataKunciArtikel: (p, v) => {
    return par(
      "## الكلمات المفتاحية",
      isi("الكلمات المفتاحية: {{topik}}؛ {{bidang}}؛ الدراسات الإسلامية؛ البحث العلمي.", v),
      "Keywords: [write 3–5 English keywords matching the title and abstract]",
      "[اختر الكلمات المفتاحية من مصطلحات قواعد البيانات، وطابِقها مع العنوان والملخص]",
    );
  },

  keterbatasan: (p, v) => {
    return par(
      "## حدود البحث",
      isi("يعترف الباحث بأن لهذا البحث قيودًا ينبغي أن تُقرأ النتائج في ضوئها؛ فمن جهة البيانات، اقتصرت المادة على ما أمكن الوصول إليه من مصادر وميدان، ومن جهة المنهج، فإن طبيعة {{metode}} تجعل بعض الأسئلة خارج نطاق الإجابة القاطعة.", v),
      "ومن جهة التعميم، لا يدّعي الباحث أن نتائجه تنسحب آليًّا على سياقات مختلفة عن سياق الدراسة في " + (p.lokasi || "مكان البحث") + "، وإنما يقدّم قراءة موثقة لهذا السياق تصلح أساسًا للمقارنة، لا بديلًا عن دراسته في سياقات أخرى.",
      "وقد بُيّنت هذه القيود هنا لا اعتذارًا عن البحث، بل لأن تحديد ما لا يستطيع البحث إثباته جزء من أمانته العلمية وقيمته للباحثين من بعده.",
    );
  },

  pendanaan: (p, v) => {
    return par(
      "## شكر وتقدير",
      "[اكتب هنا الجهات التي تستحق الشكر ممن أسهموا دون أن يكونوا مؤلفين]",
      "[اكتب مصدر التمويل، أو صرّح بأنه لم يتلقَّ البحث تمويلًا خاصًّا]",
    );
  },

  pernyataanEtik: (p, v) => {
    return par(
      "## الإفصاح عن تضارب المصالح وتوفر البيانات",
      "[اكتب هنا: هل يوجد تضارب مصالح؟ إن لم يوجد فصرّح بذلك]",
      "[اكتب هنا: مكان توفر البيانات وشروط الوصول إليها، أو سبب عدم توفرها]",
    );
  },

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
    return par(
      "## الإطار الفكري",
      isi("يجري الباحث في هذه الدراسة وفق تسلسل منطقي، تبدأ فيه الأسباب من واقع {{topik}} ثم تنتقل إلى تحليل عناصره، ثم إلى النتائج التي نُبني عليها المقترحات. ويمكن تصوير ذلك في الكيفية الآتية:", v),
      "**المتغير المستقل / الظاهرة المدروسة:** " + (p.topikAr || "[موضوع البحث]"),
      "**العناصر الوسيطة:** " + (p.bidangId ? getBidang(p.bidangId).teori.slice(0, 2).map((t) => t.ar).join("، ") : "[المفاهيم الوسيطة]"),
      "**النتائج المتوقعة:** [اكتب التوقع الذي ترجحه لسؤال البحث الأخير]",
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
    return par(
      "## نوع البحث ومدخله",
      isi("اعتمد الباحث في هذه الدراسة على {{metode}}، لأنه الأنسب لطبيعة المشكلة المطروحة، إذ يقتضي موضوع {{topik}} جمع بيانات يمكن تحليلها والاستدلال بها على ما يجري في الميدان.", v),
      pilih("manhajNau", 2, seed).map((f) => isi(f.ar, v)).join("\n\n"),
      "وفي ضوء ذلك اختار الباحث التصميم الآتي:",
      "[اذكر التصميم الذي اخترته، ثم علل اختياره]",
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
      isi("[اكتب هنا: هل تتفق نتائج الدراسة مع {{teori}} في الجانب النظري أم تخالفها، ولماذا؟]", v),
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

  mulakhkhas: (p, v) => {
    return par(
      "## الملخص",
      isi("يهدف هذا البحث إلى الكشف عن {{topik}} في {{lokasi}}، وقد استخدم الباحث {{metode}}، وجمع البيانات من {{populasi}} بالأدوات المناسبة لطبيعة البحث.", v),
      "[اكتب هنا الفكرة الأساسية للنتائج: ما الذي انتهى إليه البحث في سطرين؟]",
      "[اكتب نتيجة البحث الرئيسة وما يقترحه الباحث في ضوئها]",
      "**الكلمات المفتاحية:** " + (p.bidangId ? getBidang(p.bidangId).keywords.slice(0, 4).join("، ") : "[كلمة، كلمة، كلمة]"),
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
      "[اذكر تصميم البحث المعتمد هنا، ثم علل اختياره]",
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
      isi("[فسّر النتائج بعد اكتمال التحليل: ما الذي تدل عليه بالنسبة إلى {{topik}}؟]", v),
    );
  },

  khatima: (p, v) => {
    return par(
      "## الخاتمة",
      isi("[اكتب خلاصة ما انتهى إليه المقال عن {{topik}} بعد التحقق من نتائج الميدان]", v),
      "[اكتب في جملتين أهم ما يميز نتائج هذا المقال عن الدراسات السابقة]",
      "ويوصي الباحث بدراسات تالية تختبر النتائج في سياقات أخرى، وبتطبيق المقترحات العملية في المؤسسات المعنية.",
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
        `${found?.section.tingkat === 2 ? "###" : "##"} ${found?.section.headingAr ?? sectionId}`,
        isi("[هذا القسم لم يُحرَّر بعد — استخدم أسئلة التوجيه أعلاه ثم اكتب هنا]", v),
      );
  // Judul tercetak mengikuti struktur efektif proyek (termasuk judul yang
  // diganti mahasiswa di daftar isi), bukan judul bawaan generator.
  if (found?.section.headingAr) {
    const prefiks = found.section.tingkat === 2 ? "###" : "##";
    markdown = markdown.replace(/^#{2,3} [^\n]*/, `${prefiks} ${found.section.headingAr}`);
  }

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


/** Apakah blok markdown ini prosa biasa (bukan judul/daftar/kutip/definisi/tabel)? */
function blokProsa(b: string): boolean {
  const t = b.trim();
  if (!t) return false;
  if (/^#{1,6}\s/.test(t)) return false;
  if (/^-{3,}$/.test(t)) return false;
  if (t.startsWith(">")) return false;
  if (/^\[\^[^\]]+\]:/.test(t)) return false;
  if (t.startsWith("|")) return false;
  return t
    .split("\n")
    .every((l) => {
      const s = l.trim();
      return !/^(-|\*|\d+[.)]|[٠-٩]+[.)])\s/.test(s) && !s.startsWith(">") && !s.startsWith("|");
    });
}

/**
 * Rapikan naskah dokumen: kalimat-kalimat hasil susunan yang tadinya berdiri
 * sebagai blok terpisah (enak untuk menyisipkan sumber saat MENULIS) digabung
 * menjadi paragraf mengalir tanpa celah antar-kalimat — sebagaimana tampilan
 * dokumen akhir seharusnya. Judul, daftar, kutip, dan definisi footnote tidak
 * disentuh. Dipakai HANYA pada keluaran tingkat dokumen (composeNaskah) dan
 * hanya untuk bagian hasil susunan; draf tulisan mahasiswa tidak diubah.
 */
export function rapikanNaskah(md: string): string {
  const hasil: string[] = [];
  let prosa = "";
  const tumpah = () => {
    if (prosa) hasil.push(prosa);
    prosa = "";
  };
  for (const b of md.split(/\n\n+/)) {
    const t = b.trim();
    if (!t) continue;
    if (blokProsa(t)) {
      const rata = t.replace(/\n/g, " ").replace(/ {2,}/g, " ");
      prosa = prosa ? `${prosa} ${rata}` : rata;
    } else {
      tumpah();
      hasil.push(t);
    }
  }
  tumpah();
  return hasil.join("\n\n");
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
        bagian.push(`> *(مسودة تلقائية — لم تُراجع بعد)*\n\n${rapikanNaskah(hasil.markdown)}`);
      }
    }
  }
  return bagian.join("\n\n---\n\n");
}
