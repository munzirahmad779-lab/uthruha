import type { Metode, MetodeDef } from "./types";

export const METODE: Record<Metode, MetodeDef> = {
  kuantitatif: {
    id: "kuantitatif",
    labelId: "Kuantitatif",
    labelAr: "البحث الكمي",
    ringkas:
      "Mengukur variabel dengan angka, menguji hipotesis, dan menggeneralisasi pada populasi.",
    desain: [
      { ar: "المنهج الوصفي المسحي", id: "Survei deskriptif — memotret keadaan populasi pada satu waktu" },
      { ar: "المنهج شبه التجريبي (تصميم المجموعتين)", id: "Kuasi-eksperimen dua kelompok" },
      { ar: "التصميم التجريبي الحقيقي بقياس قبلي وبعدي", id: "Eksperimen murni pre-test/post-test" },
      { ar: "المنهج الارتباطي", id: "Korelasional — hubungan antar variabel" },
      { ar: "تصميم تحليل المسار", id: "Analisis jalur (path analysis)" },
    ],
    teknik: [
      { ar: "الاستبانة (المقياس الخماسي ليكرت)", id: "Angket skala Likert" },
      { ar: "الاختبار (قبلي وبعدي)", id: "Tes awal dan akhir" },
      { ar: "الملاحظة المنظمة", id: "Observasi terstruktur" },
      { ar: "المقابلة المنظمة", id: "Wawancara terstruktur" },
      { ar: "تحليل الوثائق الرقمية", id: "Analisis dokumen kuantitatif" },
    ],
    analisis: [
      { ar: "الإحصاء الوصفي: المتوسط والنسبة المئوية والانحراف المعياري", id: "Statistik deskriptif" },
      { ar: "اختبار الطبيعية والتجانس كشرط للتحليل", id: "Uji prasyarat: normalitas & homogenitas" },
      { ar: "اختبار (ت) للعينتين المستقلتين", id: "Uji-t dua sampel independen" },
      { ar: "تحليل التباين الأحادي (ANOVA)", id: "ANOVA satu arah" },
      { ar: "تحليل الانحدار الخطي البسيط والمتعدد", id: "Regresi linear sederhana & berganda" },
      { ar: "معامل ارتباط بيرسون وسبيرمان", id: "Korelasi Pearson/Spearman" },
    ],
    keabsahan: [
      { ar: "الصدق الظاهري وصدق المحتوى من المحكمين", id: "Validitas isi melalui expert judgment" },
      { ar: "الصدق البنائي بالتحليل العاملي", id: "Validitas konstruk (analisis faktor)" },
      { ar: "الثبات بمعادلة ألفا كرونباخ", id: "Reliabilitas Cronbach's alpha" },
      { ar: "حجم العينة المحسوب بمعادلة سلوفين أو كوهين", id: "Ukuran sampel (Slovin/Cohen)" },
    ],
  },
  kualitatif: {
    id: "kualitatif",
    labelId: "Kualitatif",
    labelAr: "البحث الكيفي",
    ringkas:
      "Mendalami makna, proses, dan konteks melalui data naratif; peneliti sebagai instrumen kunci.",
    desain: [
      { ar: "دراسة الحالة", id: "Studi kasus (kasus tunggal/ganda)" },
      { ar: "البحث الإثنوغرافي", id: "Etnografi" },
      { ar: "المنهج الفينومينولوجي", id: "Fenomenologi" },
      { ar: "نظرية المجذَّر (النظرية المتولدة من البيانات)", id: "Grounded theory" },
      { ar: "تحليل الخطاب", id: "Analisis wacana" },
    ],
    teknik: [
      { ar: "المقابلة المتعمقة وشبه المنظمة", id: "Wawancara mendalam semi-terstruktur" },
      { ar: "الملاحظة بالمشاركة", id: "Observasi partisipatif" },
      { ar: "تحليل الوثائق والمخطوطات", id: "Analisis dokumen & manuskrip" },
      { ar: "مجموعة التركيز", id: "FGD" },
      { ar: "التصوير الفوتوغرافي والوسائط", id: "Data visual" },
    ],
    analisis: [
      { ar: "تحليل البيانات عند ميلز وهوبرمان (الاختزال، العرض، الاستنتاج)", id: "Miles & Huberman: reduksi, penyajian, verifikasi" },
      { ar: "التحليل الموضوعي (الترميز المفتوح والمحوري والانتقائي)", id: "Analisis tematik / pengodean bertingkat" },
      { ar: "التحليل الوصفي النوعي للمضمون", id: "Analisis isi kualitatif" },
      { ar: "التفسير الهرمنيوطيقي للنصوص", id: "Hermeneutika teks" },
    ],
    keabsahan: [
      { ar: "التثليث: المصدر والطريقة والباحث", id: "Triangulasi sumber, metode, peneliti" },
      { ar: "مراجعة الأقران والتحقق من المشاركين", id: "Peer debriefing & member checking" },
      { ar: "الإثراء الوصفي وحفظ سلسلة الأدلة", id: "Thick description & audit trail" },
      { ar: "الاعتمادية (Dependability) وقابلية التأكيد", id: "Dependability & confirmability" },
    ],
  },
  mixed: {
    id: "mixed",
    labelId: "Campuran (Mixed Methods)",
    labelAr: "البحث المختلط",
    ringkas:
      "Menggabungkan angka dan makna dengan desain eksplisit, sehingga kesimpulan lebih kokoh daripada salah satu metode saja.",
    desain: [
      { ar: "التصميم التفسيري المتسلسل (كمي ثم كيفي)", id: "Explanatory sequential: kuantitatif lalu kualitatif" },
      { ar: "التصميم الاستكشافي المتسلسل (كيفي ثم كمي)", id: "Exploratory sequential: kualitatif lalu kuantitatif" },
      { ar: "التصميم المتوازن (المتزامن)", id: "Convergent parallel" },
      { ar: "التصميم المضمن (التجريبي مع دراسة حالة)", id: "Embedded design" },
      { ar: "التصميم التحويلي المشارك", id: "Transformative participatory" },
    ],
    teknik: [
      { ar: "الاستبانة والمقابلة في دراسة واحدة", id: "Angket + wawancara" },
      { ar: "الاختبار والملاحظة الصفية", id: "Tes + observasi kelas" },
      { ar: "سجل التأمل والوثائق", id: "Jurnal refleksi & dokumen" },
    ],
    analisis: [
      { ar: "دمج النتائج بجدول مقارنة (Joint Display)", id: "Integrasi lewat joint display" },
      { ar: "تحليل كمي ثم تفسير كيفي للنتائج الشاذة", id: "Kuantitatif lalu dijelaskan kualitatif" },
      { ar: "التحليل البعدي المتقاطع (Meta-inference)", id: "Meta-inferensi lintas strand" },
    ],
    keabsahan: [
      { ar: "التثليث بين المنهجين", id: "Triangulasi antar-metode" },
      { ar: "التحقق من التكامل المنهجي (Legitimation)", id: "Legitimasi integrasi" },
      { ar: "شفافية تسلسل جمع البيانات", id: "Transparansi urutan pengumpulan data" },
    ],
  },
};

export const getMetode = (m: Metode): MetodeDef => METODE[m] ?? METODE.kuantitatif;
