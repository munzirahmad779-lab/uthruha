import type { FieldDef } from "./types";

/**
 * Bidang keilmuan yang lazim menulis dalam bahasa Arab di perguruan tinggi
 * keislaman Indonesia dan dunia Arab. Kata kunci dipakai untuk mencocokkan
 * jurnal dan memilih frasa.
 */
export const BIDANG: FieldDef[] = [
  {
    id: "quran",
    labelId: "Ilmu Al-Qur'an & Tafsir",
    labelAr: "علوم القرآن والتفسير",
    keywords: [
      "tafsir", "quran", "al-qur'an", "ulumul quran", "asbabun nuzul", "mufassir",
      "التفسير", "القرآن", "علوم القرآن", "أسباب النزول", "المفسرون", "المنهج التفسيري",
    ],
    teori: [
      { ar: "مناهج التفسير (التحليلي، الإجمالي، المقارن، الموضوعي)", id: "Metode tafsir: tahlili, ijmali, muqaran, maudhu'i" },
      { ar: "قواعد التفسير وأصوله", id: "Kaidah dan ushul tafsir" },
      { ar: "الإعجاز القرآني", id: "I'jaz Al-Qur'an" },
      { ar: "المكي والمدني", id: "Makkiyah–Madaniyah" },
      { ar: "الناسخ والمنسوخ", id: "Nasakh–mansukh" },
    ],
    rujukanKunci: [
      "الجامع لأحكام القرآن — القرطبي",
      "تفسير القرآن العظيم — ابن كثير",
      "البرهان في علوم القرآن — الزركشي",
      "الإتقان في علوم القرآن — السيوطي",
      "مناهل العرفان — عبد العظيم الزرقاني",
    ],
    contohTopik: [
      { ar: "المنهج الموضوعي في تفسير آيات الرحمة", id: "Metode maudhu'i dalam tafsir ayat-ayat rahmat" },
      { ar: "أثر أسباب النزول في فهم آيات الأحكام", id: "Pengaruh asbabun nuzul terhadap pemahaman ayat hukum" },
      { ar: "الإعجاز البلاغي في سورة يوسف", id: "I'jaz balaghi dalam Surah Yusuf" },
    ],
  },
  {
    id: "hadis",
    labelId: "Ilmu Hadis",
    labelAr: "علوم الحديث",
    keywords: [
      "hadis", "hadith", "sunnah", "sanad", "matan", "takhrij", "jarh", "ta'dil",
      "الحديث", "السنة", "السند", "المتن", "التخريج", "الجرح والتعديل", "مصطلح الحديث",
    ],
    teori: [
      { ar: "علم مصطلح الحديث: الصحة والحسن والضعف", id: "Klasifikasi sahih, hasan, dha'if" },
      { ar: "الجرح والتعديل وعلل الحديث", id: "Jarh wa ta'dil dan 'ilal hadis" },
      { ar: "علم التخريج ودراسة الأسانيد", id: "Takhrij dan studi sanad" },
      { ar: "فقه الحديث ودلالة النصوص", id: "Fiqh al-hadith dan dalalah nash" },
      { ar: "المحدثون ومناهجهم في التصنيف", id: "Metodologi para muhaddithin" },
    ],
    rujukanKunci: [
      "صحيح البخاري وصحيح مسلم",
      "مقدمة ابن الصلاح",
      "تدريب الراوي في شرح تقريب النواوي — السيوطي",
      "فتح المغيث بشرح ألفية الحديث — السخاوي",
      "نصب الراية — الزيلعي",
    ],
    contohTopik: [
      { ar: "منهج الإمام البخاري في انتقاء الأحاديث", id: "Metode Imam Bukhari dalam seleksi hadis" },
      { ar: "التعليل الخفي في الأسانيد", id: "'Ilal khafi dalam sanad" },
      { ar: "دلالة الحديث على مقاصد الشريعة", id: "Dalalah hadis terhadap maqashid syariah" },
    ],
  },
  {
    id: "fiqh",
    labelId: "Fiqh & Ushul Fiqh",
    labelAr: "الفقه وأصوله",
    keywords: [
      "fiqh", "fikih", "ushul fiqh", "fatwa", "maqashid", "qawaid", "mazhab", "ijtihad",
      "الفقه", "أصول الفقه", "الفتوى", "المقاصد", "القواعد الفقهية", "المذاهب", "الاجتهاد",
    ],
    teori: [
      { ar: "المقاصد الشرعية عند الشاطبي", id: "Maqashid syariah menurut al-Syathibi" },
      { ar: "القواعد الفقهية الكبرى", id: "Kaidah fiqhiyah kubra" },
      { ar: "الاجتهاد والتقليد والتلفيق", id: "Ijtihad, taklid, talfiq" },
      { ar: "الفتوى ومناهج الإفتاء المعاصر", id: "Fatwa dan metodologi ifta' kontemporer" },
      { ar: "القياس والمصالح المرسلة", id: "Qiyas dan mashalih mursalah" },
    ],
    rujukanKunci: [
      "الموافقات في أصول الشريعة — الشاطبي",
      "المغني — ابن قدامة",
      "المجموع شرح المهذب — النووي",
      "بدائع الصنائع — الكاساني",
      "أصول الفقه — محمد أبو زهرة",
    ],
    contohTopik: [
      { ar: "تطبيق المقاصد الشرعية في الفتاوى المعاصرة", id: "Penerapan maqashid dalam fatwa kontemporer" },
      { ar: "أثر القواعد الفقهية في حل النوازل", id: "Peran kaidah fiqhiyah dalam nawazil" },
      { ar: "الاجتهاد الجماعي في المؤسسات الفقهية", id: "Ijtihad jama'i dalam lembaga fatwa" },
    ],
  },
  {
    id: "tarbiyah",
    labelId: "Pendidikan Islam",
    labelAr: "التربية الإسلامية",
    keywords: [
      "tarbiyah", "pendidikan", "kurikulum", "guru", "siswa", "pembelajaran",
      "التربية", "التعليم", "المنهج الدراسي", "المعلم", "الطلاب", "الوسائل التعليمية",
    ],
    teori: [
      { ar: "التربية الإسلامية عند الغزالي وابن خلدون", id: "Konsep tarbiyah al-Ghazali & Ibn Khaldun" },
      { ar: "نظريات التعلم (السلوكية، المعرفية، البنائية)", id: "Teori belajar behavioristik, kognitif, konstruktivis" },
      { ar: "المنهج الدراسي ومكوناته", id: "Komponen kurikulum" },
      { ar: "تقويم التعليم وقياس النتائج", id: "Evaluasi pembelajaran dan pengukuran hasil" },
      { ar: "بيئة التعلم والوسائل التعليمية", id: "Lingkungan belajar dan media pembelajaran" },
    ],
    rujukanKunci: [
      "إحياء علوم الدين — الغزالي (كتاب العلم)",
      "مقدمة ابن خلدون (فصل التعليم)",
      "التربية الإسلامية — محمد منير مرسي",
      "أصول التربية الإسلامية — علي أحمد مدكور",
    ],
    contohTopik: [
      { ar: "أثر استخدام الوسائل التعليمية في تحصيل الطلاب", id: "Pengaruh media pembelajaran terhadap hasil belajar" },
      { ar: "تطبيق المنهج التكاملي في تعليم اللغة العربية", id: "Penerapan kurikulum integratif dalam pembelajaran bahasa Arab" },
      { ar: "دور المعلم في تنمية القيم الإسلامية", id: "Peran guru dalam penanaman nilai Islam" },
    ],
  },
  {
    id: "bahasa",
    labelId: "Bahasa & Sastra Arab",
    labelAr: "اللغة العربية وآدابها",
    keywords: [
      "bahasa arab", "nahwu", "sharaf", "balaghah", "sastra", "muhadatsah", "imla",
      "اللغة العربية", "النحو", "الصرف", "البلاغة", "الأدب", "المحادثة", "الإملاء", "تعليم اللغة",
    ],
    teori: [
      { ar: "النحو العربي ومناهج التأليف النحوي", id: "Nahwu dan metodologi penyusunan kitab nahwu" },
      { ar: "علم الصرف والأبنية الصرفية", id: "Sharaf dan struktur morfologis" },
      { ar: "البلاغة: المعاني والبيان والبديع", id: "Balaghah: ma'ani, bayan, badi'" },
      { ar: "اللسانيات التطبيقية وتعليم اللغة", id: "Linguistik terapan dan pengajaran bahasa" },
      { ar: "تحليل الأخطاء اللغوية", id: "Analisis kesalahan berbahasa (tahlil al-akhta')" },
    ],
    rujukanKunci: [
      "الكتاب — سيبويه",
      "الخصائص — ابن جني",
      "دلائل الإعجاز — عبد القاهر الجرجاني",
      "المزهر في علوم اللغة — السيوطي",
      "جامع الدروس العربية — مصطفى الغلاييني",
    ],
    contohTopik: [
      { ar: "الأخطاء النحوية الشائعة في كتابة الطلاب", id: "Kesalahan nahwu dalam tulisan mahasiswa" },
      { ar: "فاعلية طريقة المحاورة في تعليم المحادثة", id: "Efektivitas metode hiwar dalam pembelajaran muhadatsah" },
      { ar: "البلاغة في شعر أحمد شوقي", id: "Balaghah dalam puisi Ahmad Syauqi" },
    ],
  },
  {
    id: "tarikh",
    labelId: "Sejarah & Peradaban Islam",
    labelAr: "التاريخ والحضارة الإسلامية",
    keywords: [
      "sejarah", "tarikh", "peradaban", "khilafah", "daulah", "nusantara", "sumber lokal",
      "التاريخ", "الحضارة", "الخلافة", "الدولة", "الأندلس", "المصادر", "الاستشراق",
    ],
    teori: [
      { ar: "مناهج المؤرخين المسلمين", id: "Metodologi sejarawan Muslim" },
      { ar: "نظرية الدورات الحضارية عند ابن خلدون", id: "Teori siklus peradaban Ibn Khaldun" },
      { ar: "الاستشراق ودراسة التاريخ الإسلامي", id: "Orientalisme dan kajian sejarah Islam" },
      { ar: "تاريخ العلوم عند المسلمين", id: "Sejarah sains dalam peradaban Islam" },
    ],
    rujukanKunci: [
      "تاريخ الرسل والملوك — الطبري",
      "الكامل في التاريخ — ابن الأثير",
      "البداية والنهاية — ابن كثير",
      "سير أعلام النبلاء — الذهبي",
      "المقدمة — ابن خلدون",
    ],
    contohTopik: [
      { ar: "العلاقات العلمية بين الأندلس والمشرق", id: "Relasi keilmuan Andalusia dan Masyriq" },
      { ar: "دور المخطوطات في دراسة تاريخ نوسانتارا", id: "Peran manuskrip dalam sejarah Nusantara" },
      { ar: "المؤسسات التعليمية في العصر العباسي", id: "Lembaga pendidikan era Abbasiyah" },
    ],
  },
  {
    id: "iqtishad",
    labelId: "Ekonomi Syariah",
    labelAr: "الاقتصاد الإسلامي",
    keywords: [
      "ekonomi", "syariah", "riba", "zakat", "wakaf", "murabahah", "bank", "keuangan",
      "الاقتصاد", "التمويل", "الربا", "الزكاة", "الوقف", "المرابحة", "المصرفية", "المال",
    ],
    teori: [
      { ar: "المال والكسب في الفقه الإسلامي", id: "Harta dan usaha dalam fiqh" },
      { ar: "الربا وأنواعه وأثره الاقتصادي", id: "Riba, jenis, dan dampak ekonominya" },
      { ar: "الوقف والزكاة كأدوات تمويل اجتماعي", id: "Wakaf dan zakat sebagai instrumen keuangan sosial" },
      { ar: "عقود المعاملات المالية المعاصرة", id: "Akad muamalah kontemporer" },
      { ar: "المقاصد الاقتصادية للشريعة", id: "Maqashid ekonomi syariah" },
    ],
    rujukanKunci: [
      "إحياء علوم الدين — الغزالي (كتاب الكسب)",
      "الخراج — أبو يوسف",
      "الفقه الإسلامي وأدلته — وهبة الزحيلي",
      "الاقتصاد الإسلامي — محمد شوقي الفنجري",
    ],
    contohTopik: [
      { ar: "تطبيق عقود المرابحة في المصارف الإسلامية", id: "Penerapan akad murabahah di bank syariah" },
      { ar: "أثر الوقف الإنتاجي في التنمية", id: "Dampak wakaf produktif terhadap pembangunan" },
      { ar: "الشمول المالي الإسلامي لدى المشروعات الصغيرة", id: "Inklusi keuangan syariah pada UMKM" },
    ],
  },
  {
    id: "dakwah",
    labelId: "Dakwah & Komunikasi Islam",
    labelAr: "الدعوة والاتصال",
    keywords: [
      "dakwah", "da'wah", "tabligh", "khutbah", "media sosial", "komunikasi", "retorika",
      "الدعوة", "الخطابة", "الاتصال", "الإعلام", "المنبر", "المحتوى الرقمي", "الترغيب والترهيب",
    ],
    teori: [
      { ar: "أصول الدعوة وأساليبها", id: "Prinsip dan metode dakwah" },
      { ar: "الترغيب والترهيب في الدعوة", id: "Targhib dan tarhib" },
      { ar: "الإعلام الإسلامي ونظريات الاتصال", id: "Media Islam dan teori komunikasi" },
      { ar: "الدعوة في المنصات الرقمية", id: "Dakwah di platform digital" },
    ],
    rujukanKunci: [
      "تفسير القرآن الكريم (آيات الدعوة)",
      "البيان والتبيين — الجاحظ (الخطابة والبلاغة)",
      "الدعوة الإسلامية وأساليبها",
      "الإعلام في الإسلام",
    ],
    contohTopik: [
      { ar: "استراتيجية الدعوة في وسائل التواصل الاجتماعي", id: "Strategi dakwah di media sosial" },
      { ar: "فاعلية الخطابة في تكوين الوعي الديني", id: "Efektivitas khutbah dalam kesadaran keagamaan" },
      { ar: "مقاصد الدعوة في القرآن الكريم", id: "Maqashid dakwah dalam Al-Qur'an" },
    ],
  },
  {
    id: "falsafah",
    labelId: "Filsafat & Kalam",
    labelAr: "الفلسفة وعلم الكلام",
    keywords: [
      "filsafat", "kalam", "tauhid", "aqidah", "mantiq", "tasawuf", "teologi",
      "الفلسفة", "الكلام", "التوحيد", "العقيدة", "المنطق", "التصوف", "الإلهيات", "النبوة",
    ],
    teori: [
      { ar: "الإلهيات والنبوات والسمعيات", id: "Ilahiyyat, nubuwwat, sam'iyyat" },
      { ar: "مذاهب أهل السنة والمعتزلة", id: "Ahlu Sunnah dan Mu'tazilah" },
      { ar: "المنطق وأدواته عند الفارابي وابن سينا", id: "Logika al-Farabi dan Ibn Sina" },
      { ar: "التصوف: مراتبه ومقاماته", id: "Tasawuf: maqamat dan ahwal" },
      { ar: "التوفيق بين العقل والنقل", id: "Harmoni akal dan naql" },
    ],
    rujukanKunci: [
      "تهافت الفلاسفة — الغزالي",
      "الشفاء (الإلهيات) — ابن سينا",
      "فصل المقال — ابن رشد",
      "شرح العقائد النسفية — التفتازاني",
      "الرسالة القشيرية — القشيري",
    ],
    contohTopik: [
      { ar: "مسألة خلق الأفعال بين الماتريدية والأشعرية", id: "Masalah khalq al-af'al antara Maturidi dan Asy'ari" },
      { ar: "نقد الغزالي لعلماء المنطق", id: "Kritik al-Ghazali terhadap ahli logika" },
      { ar: "مقامات التصوف عند القشيري", id: "Maqamat tasawuf menurut al-Qusyairi" },
    ],
  },
];

export const getBidang = (id: string) => BIDANG.find((b) => b.id === id) ?? BIDANG[0];
