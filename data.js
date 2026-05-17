// data.js - 有機分類帽版

// 1. 選項資料庫 (AnswerBank)
// 包含具體的化合物名稱(中文) 以及 Level 99 需要的英文類別名稱
const AnswerBank = {
    // --- Level 1~6: 化合物中文名稱 ---
    "methane": { type: "compound", content: "甲烷", category: "alkane" },
    "ethane": { type: "compound", content: "乙烷", category: "alkane" },
    "propane": { type: "compound", content: "丙烷", category: "alkane" },
    "butane": { type: "compound", content: "丁烷", category: "alkane" },
    "isobutane": { type: "compound", content: "異丁烷", category: "alkane" },
    "cyclohexane": { type: "compound", content: "環己烷", category: "alkane" },
    "cyclopropane": { type: "compound", content: "環丙烷", category: "alkane" },
    "ethene": { type: "compound", content: "乙烯", category: "alkene" },
    "propene": { type: "compound", content: "丙烯", category: "alkene" },
    "1-butene": { type: "compound", content: "1-丁烯", category: "alkene" },
    "2-butene": { type: "compound", content: "2-丁烯", category: "alkene" },
    "1,3-butadiene": { type: "compound", content: "1,3-丁二烯", category: "alkene" },
    "cyclohexene": { type: "compound", content: "環己烯", category: "alkene" },
    "ethyne": { type: "compound", content: "乙炔", category: "alkyne" },
    "propyne": { type: "compound", content: "丙炔", category: "alkyne" },
    "1-butyne": { type: "compound", content: "1-丁炔", category: "alkyne" },
    "2-butyne": { type: "compound", content: "2-丁炔", category: "alkyne" },
    "methanol": { type: "compound", content: "甲醇", category: "alcohol" },
    "ethanol": { type: "compound", content: "乙醇", category: "alcohol" },
    "propanol": { type: "compound", content: "丙醇", category: "alcohol" },
    "isopropanol": { type: "compound", content: "2-丙醇", category: "alcohol" },
    "tert-butanol": { type: "compound", content: "第三丁醇", category: "alcohol" },
    "ethylene_glycol": { type: "compound", content: "乙二醇", category: "alcohol" },
    "glycerol": { type: "compound", content: "丙三醇（甘油）", category: "alcohol" },
    "cyclohexanol": { type: "compound", content: "環己醇", category: "alcohol" },
    "formaldehyde": { type: "compound", content: "甲醛", category: "aldehyde" },
    "acetaldehyde": { type: "compound", content: "乙醛", category: "aldehyde" },
    "propanal": { type: "compound", content: "丙醛", category: "aldehyde" },
    "butanal": { type: "compound", content: "丁醛", category: "aldehyde" },
    "acetone": { type: "compound", content: "丙酮", category: "ketone" },
    "butanone": { type: "compound", content: "丁酮", category: "ketone" },
    "2-pentanone": { type: "compound", content: "2-戊酮", category: "ketone" },
    "3-pentanone": { type: "compound", content: "3-戊酮", category: "ketone" },
    "cyclohexanone": { type: "compound", content: "環己酮", category: "ketone" },
    "acetophenone": { type: "compound", content: "苯乙酮", category: "ketone" },
    "formic_acid": { type: "compound", content: "甲酸", category: "carboxylic" },
    "acetic_acid": { type: "compound", content: "乙酸", category: "carboxylic" },
    "propionic_acid": { type: "compound", content: "丙酸", category: "carboxylic" },
    "butyric_acid": { type: "compound", content: "丁酸", category: "carboxylic" },
    "oxalic_acid": { type: "compound", content: "草酸", category: "carboxylic" },
    "methyl_formate": { type: "compound", content: "甲酸甲酯", category: "ester" },
    "ethyl_acetate": { type: "compound", content: "乙酸乙酯", category: "ester" },
    "methyl_acetate": { type: "compound", content: "乙酸甲酯", category: "ester" },
    "isoamyl_acetate": { type: "compound", content: "乙酸異戊酯", category: "ester" },
    "ethyl_butyrate": { type: "compound", content: "丁酸乙酯", category: "ester" },
    "methyl_benzoate": { type: "compound", content: "苯甲酸甲酯", category: "ester" },
    "dimethyl_ether": { type: "compound", content: "二甲醚", category: "ether" },
    "diethyl_ether": { type: "compound", content: "二乙醚", category: "ether" },
    "ethyl_methyl_ether": { type: "compound", content: "甲乙醚", category: "ether" },
    "ethylene_oxide": { type: "compound", content: "環氧乙烷", category: "ether" },
    "anisole": { type: "compound", content: "苯甲醚", category: "ether" },
    "methylamine": { type: "compound", content: "甲胺", category: "amine" },
    "ethylamine": { type: "compound", content: "乙胺", category: "amine" },
    "dimethylamine": { type: "compound", content: "二甲胺", category: "amine" },
    "trimethylamine": { type: "compound", content: "三甲胺", category: "amine" },
    "ethylenediamine": { type: "compound", content: "乙二胺", category: "amine" },
    "benzene": { type: "compound", content: "苯", category: "aromatic" },
    "toluene": { type: "compound", content: "甲苯", category: "aromatic" },
    "styrene": { type: "compound", content: "苯乙烯", category: "aromatic" },
    "o-xylene": { type: "compound", content: "鄰-二甲苯", category: "aromatic" },
    "m-xylene": { type: "compound", content: "間-二甲苯", category: "aromatic" },
    "p-xylene": { type: "compound", content: "對-二甲苯", category: "aromatic" },
    "ethylbenzene": { type: "compound", content: "乙苯", category: "aromatic" },
    "naphthalene": { type: "compound", content: "萘", category: "aromatic" },
    "chloromethane": { type: "compound", content: "氯甲烷", category: "halide" },
    "bromoethane": { type: "compound", content: "溴乙烷", category: "halide" },
    "chlorobenzene": { type: "compound", content: "氯苯", category: "halide" },
    "dichloromethane": { type: "compound", content: "二氯甲烷", category: "halide" },
    "chloroform": { type: "compound", content: "三氯甲烷（氯仿）", category: "halide" },
    "iodomethane": { type: "compound", content: "碘甲烷", category: "halide" },
    "vinyl_chloride": { type: "compound", content: "氯乙烯", category: "halide" },
    // 以下原本被歸成 "confused"（易混淆）—— 已改回各自真正的官能基分類
    // phenol 自成一類（與 Level 99 的 CAT_PHENOL 一致）；其餘歸正統官能基
    "phenol": { type: "compound", content: "苯酚", category: "phenol" },
    "o-cresol": { type: "compound", content: "鄰-甲酚", category: "phenol" },
    "m-cresol": { type: "compound", content: "間-甲酚", category: "phenol" },
    "p-cresol": { type: "compound", content: "對-甲酚", category: "phenol" },
    "catechol": { type: "compound", content: "兒茶酚", category: "phenol" },
    "resorcinol": { type: "compound", content: "間苯二酚", category: "phenol" },
    "benzyl_alcohol": { type: "compound", content: "苯甲醇", category: "alcohol" },
    "benzaldehyde": { type: "compound", content: "苯甲醛", category: "aldehyde" },
    "benzoic_acid": { type: "compound", content: "苯甲酸", category: "carboxylic" },
    "aniline": { type: "compound", content: "苯胺", category: "amine" },

    // --- 中文官能基類別 (Beginner difficulty answer pool) ---
    "CAT_ZH_ALKANE":     { type: "categoryZh", content: "烷類",   category: "alkane" },
    "CAT_ZH_ALKENE":     { type: "categoryZh", content: "烯類",   category: "alkene" },
    "CAT_ZH_ALKYNE":     { type: "categoryZh", content: "炔類",   category: "alkyne" },
    "CAT_ZH_ALCOHOL":    { type: "categoryZh", content: "醇",     category: "alcohol" },
    "CAT_ZH_ETHER":      { type: "categoryZh", content: "醚",     category: "ether" },
    "CAT_ZH_ALDEHYDE":   { type: "categoryZh", content: "醛",     category: "aldehyde" },
    "CAT_ZH_KETONE":     { type: "categoryZh", content: "酮",     category: "ketone" },
    "CAT_ZH_CARBOXYLIC": { type: "categoryZh", content: "羧酸",   category: "carboxylic" },
    "CAT_ZH_ESTER":      { type: "categoryZh", content: "酯",     category: "ester" },
    "CAT_ZH_AMINE":      { type: "categoryZh", content: "胺",     category: "amine" },
    "CAT_ZH_HALIDE":     { type: "categoryZh", content: "鹵化物", category: "halide" },
    "CAT_ZH_AROMATIC":   { type: "categoryZh", content: "芳香烴", category: "aromatic" },
    "CAT_ZH_PHENOL":     { type: "categoryZh", content: "酚",     category: "phenol" },

    // --- 英文官能基類別 (Advanced difficulty answer pool, was CAT_*) ---
    "CAT_EN_ALKANE":     { type: "categoryEn", content: "Alkane",             category: "alkane" },
    "CAT_EN_ALKENE":     { type: "categoryEn", content: "Alkene",             category: "alkene" },
    "CAT_EN_ALKYNE":     { type: "categoryEn", content: "Alkyne",             category: "alkyne" },
    "CAT_EN_ALCOHOL":    { type: "categoryEn", content: "Alcohol",            category: "alcohol" },
    "CAT_EN_ALDEHYDE":   { type: "categoryEn", content: "Aldehyde",           category: "aldehyde" },
    "CAT_EN_KETONE":     { type: "categoryEn", content: "Ketone",             category: "ketone" },
    "CAT_EN_CARBOXYLIC": { type: "categoryEn", content: "Carboxylic Acid",    category: "carboxylic" },
    "CAT_EN_ESTER":      { type: "categoryEn", content: "Ester",              category: "ester" },
    "CAT_EN_ETHER":      { type: "categoryEn", content: "Ether",              category: "ether" },
    "CAT_EN_AMINE":      { type: "categoryEn", content: "Amine",              category: "amine" },
    "CAT_EN_AROMATIC":   { type: "categoryEn", content: "Aromatic",           category: "aromatic" },
    "CAT_EN_HALIDE":     { type: "categoryEn", content: "Halide",             category: "halide" },
    "CAT_EN_PHENOL":     { type: "categoryEn", content: "Phenol / Derivative", category: "phenol" }
};

// Legacy aliases: keep CAT_* keys working for any code that hasn't migrated yet.
// Both keys resolve to the same object reference.
AnswerBank.CAT_ALKANE     = AnswerBank.CAT_EN_ALKANE;
AnswerBank.CAT_ALKENE     = AnswerBank.CAT_EN_ALKENE;
AnswerBank.CAT_ALKYNE     = AnswerBank.CAT_EN_ALKYNE;
AnswerBank.CAT_ALCOHOL    = AnswerBank.CAT_EN_ALCOHOL;
AnswerBank.CAT_ALDEHYDE   = AnswerBank.CAT_EN_ALDEHYDE;
AnswerBank.CAT_KETONE     = AnswerBank.CAT_EN_KETONE;
AnswerBank.CAT_CARBOXYLIC = AnswerBank.CAT_EN_CARBOXYLIC;
AnswerBank.CAT_ESTER      = AnswerBank.CAT_EN_ESTER;
AnswerBank.CAT_ETHER      = AnswerBank.CAT_EN_ETHER;
AnswerBank.CAT_AMINE      = AnswerBank.CAT_EN_AMINE;
AnswerBank.CAT_AROMATIC   = AnswerBank.CAT_EN_AROMATIC;
AnswerBank.CAT_HALIDE     = AnswerBank.CAT_EN_HALIDE;
AnswerBank.CAT_PHENOL     = AnswerBank.CAT_EN_PHENOL;

// 2. 題目列表 (QuestionSets)
// 注意：圖片路徑需符合 assets/images/分類資料夾/檔名

// Level 1: 碳氫骨架 (烷、烯、炔、芳香)
const Level1_List = [
    { qType: "img", qContent: "assets/images/01_alkane/01_alkane_methane.svg", aKey: "methane" },
    { qType: "img", qContent: "assets/images/01_alkane/01_alkane_ethane.svg", aKey: "ethane" },
    { qType: "img", qContent: "assets/images/01_alkane/01_alkane_propane.svg", aKey: "propane" },
    { qType: "img", qContent: "assets/images/01_alkane/01_alkane_butane.svg", aKey: "butane" },
    { qType: "img", qContent: "assets/images/01_alkane/01_alkane_isobutane.svg", aKey: "isobutane" },
    { qType: "img", qContent: "assets/images/01_alkane/01_alkane_cyclohexane.svg", aKey: "cyclohexane" },
    { qType: "img", qContent: "assets/images/01_alkane/01_alkane_cyclopropane.svg", aKey: "cyclopropane" },
    { qType: "img", qContent: "assets/images/02_alkene/02_alkene_ethene.svg", aKey: "ethene" },
    { qType: "img", qContent: "assets/images/02_alkene/02_alkene_propene.svg", aKey: "propene" },
    { qType: "img", qContent: "assets/images/02_alkene/02_alkene_1-butene.svg", aKey: "1-butene" },
    { qType: "img", qContent: "assets/images/02_alkene/02_alkene_2-butene.svg", aKey: "2-butene" },
    { qType: "img", qContent: "assets/images/02_alkene/02_alkene_1,3-butadiene.svg", aKey: "1,3-butadiene" },
    { qType: "img", qContent: "assets/images/02_alkene/02_alkene_cyclohexene.svg", aKey: "cyclohexene" },
    { qType: "img", qContent: "assets/images/03_alkyne/03_alkyne_ethyne.svg", aKey: "ethyne" },
    { qType: "img", qContent: "assets/images/03_alkyne/03_alkyne_propyne.svg", aKey: "propyne" },
    { qType: "img", qContent: "assets/images/03_alkyne/03_alkyne_1-butyne.svg", aKey: "1-butyne" },
    { qType: "img", qContent: "assets/images/03_alkyne/03_alkyne_2-butyne.svg", aKey: "2-butyne" },
    { qType: "img", qContent: "assets/images/11_aromatic/11_aromatic_benzene.svg", aKey: "benzene" },
    { qType: "img", qContent: "assets/images/11_aromatic/11_aromatic_toluene.svg", aKey: "toluene" },
    { qType: "img", qContent: "assets/images/11_aromatic/11_aromatic_styrene.svg", aKey: "styrene" },
    { qType: "img", qContent: "assets/images/11_aromatic/11_aromatic_o-xylene.svg", aKey: "o-xylene" },
    { qType: "img", qContent: "assets/images/11_aromatic/11_aromatic_m-xylene.svg", aKey: "m-xylene" },
    { qType: "img", qContent: "assets/images/11_aromatic/11_aromatic_p-xylene.svg", aKey: "p-xylene" },
    { qType: "img", qContent: "assets/images/11_aromatic/11_aromatic_ethylbenzene.svg", aKey: "ethylbenzene" },
    { qType: "img", qContent: "assets/images/11_aromatic/11_aromatic_naphthalene.svg", aKey: "naphthalene" }
];

// Level 2: 單鍵氧 (醇、醚)
const Level2_List = [
    { qType: "img", qContent: "assets/images/04_alcohol/04_alcohol_methanol.svg", aKey: "methanol" },
    { qType: "img", qContent: "assets/images/04_alcohol/04_alcohol_ethanol.svg", aKey: "ethanol" },
    { qType: "img", qContent: "assets/images/04_alcohol/04_alcohol_propanol.svg", aKey: "propanol" },
    { qType: "img", qContent: "assets/images/04_alcohol/04_alcohol_isopropanol.svg", aKey: "isopropanol" },
    { qType: "img", qContent: "assets/images/04_alcohol/04_alcohol_tert-butanol.svg", aKey: "tert-butanol" },
    { qType: "img", qContent: "assets/images/04_alcohol/04_alcohol_ethylene_glycol.svg", aKey: "ethylene_glycol" },
    { qType: "img", qContent: "assets/images/04_alcohol/04_alcohol_glycerol.svg", aKey: "glycerol" },
    { qType: "img", qContent: "assets/images/04_alcohol/04_alcohol_cyclohexanol.svg", aKey: "cyclohexanol" },
    { qType: "img", qContent: "assets/images/13_confused/13_confused_benzyl_alcohol.svg", aKey: "benzyl_alcohol" },
    { qType: "img", qContent: "assets/images/09_ether/09_ether_dimethyl_ether.svg", aKey: "dimethyl_ether" },
    { qType: "img", qContent: "assets/images/09_ether/09_ether_diethyl_ether.svg", aKey: "diethyl_ether" },
    { qType: "img", qContent: "assets/images/09_ether/09_ether_ethyl_methyl_ether.svg", aKey: "ethyl_methyl_ether" },
    { qType: "img", qContent: "assets/images/09_ether/09_ether_ethylene_oxide.svg", aKey: "ethylene_oxide" },
    { qType: "img", qContent: "assets/images/09_ether/09_ether_anisole.svg", aKey: "anisole" }
];

// Level 3: 雙鍵氧 (醛、酮)
const Level3_List = [
    { qType: "img", qContent: "assets/images/05_aldehyde/05_aldehyde_formaldehyde.svg", aKey: "formaldehyde" },
    { qType: "img", qContent: "assets/images/05_aldehyde/05_aldehyde_acetaldehyde.svg", aKey: "acetaldehyde" },
    { qType: "img", qContent: "assets/images/05_aldehyde/05_aldehyde_propanal.svg", aKey: "propanal" },
    { qType: "img", qContent: "assets/images/05_aldehyde/05_aldehyde_butanal.svg", aKey: "butanal" },
    { qType: "img", qContent: "assets/images/13_confused/13_confused_benzaldehyde.svg", aKey: "benzaldehyde" },
    { qType: "img", qContent: "assets/images/06_ketone/06_ketone_acetone.svg", aKey: "acetone" },
    { qType: "img", qContent: "assets/images/06_ketone/06_ketone_butanone.svg", aKey: "butanone" },
    { qType: "img", qContent: "assets/images/06_ketone/06_ketone_2-pentanone.svg", aKey: "2-pentanone" },
    { qType: "img", qContent: "assets/images/06_ketone/06_ketone_3-pentanone.svg", aKey: "3-pentanone" },
    { qType: "img", qContent: "assets/images/06_ketone/06_ketone_cyclohexanone.svg", aKey: "cyclohexanone" },
    { qType: "img", qContent: "assets/images/06_ketone/06_ketone_acetophenone.svg", aKey: "acetophenone" }
];

// Level 4: 雙氧複合 (酸、酯)
const Level4_List = [
    { qType: "img", qContent: "assets/images/07_carboxylic/07_carboxylic_formic_acid.svg", aKey: "formic_acid" },
    { qType: "img", qContent: "assets/images/07_carboxylic/07_carboxylic_acetic_acid.svg", aKey: "acetic_acid" },
    { qType: "img", qContent: "assets/images/07_carboxylic/07_carboxylic_propionic_acid.svg", aKey: "propionic_acid" },
    { qType: "img", qContent: "assets/images/07_carboxylic/07_carboxylic_butyric_acid.svg", aKey: "butyric_acid" },
    { qType: "img", qContent: "assets/images/07_carboxylic/07_carboxylic_oxalic_acid.svg", aKey: "oxalic_acid" },
    { qType: "img", qContent: "assets/images/13_confused/13_confused_benzoic_acid.svg", aKey: "benzoic_acid" },
    { qType: "img", qContent: "assets/images/08_ester/08_ester_methyl_formate.svg", aKey: "methyl_formate" },
    { qType: "img", qContent: "assets/images/08_ester/08_ester_ethyl_acetate.svg", aKey: "ethyl_acetate" },
    { qType: "img", qContent: "assets/images/08_ester/08_ester_methyl_acetate.svg", aKey: "methyl_acetate" },
    { qType: "img", qContent: "assets/images/08_ester/08_ester_isoamyl_acetate.svg", aKey: "isoamyl_acetate" },
    { qType: "img", qContent: "assets/images/08_ester/08_ester_ethyl_butyrate.svg", aKey: "ethyl_butyrate" },
    { qType: "img", qContent: "assets/images/08_ester/08_ester_methyl_benzoate.svg", aKey: "methyl_benzoate" }
];

// Level 5: 雜原子與鹵素 (胺、鹵化物) + 複習前面
const Level5_List = [
    { qType: "img", qContent: "assets/images/10_amine/10_amine_methylamine.svg", aKey: "methylamine" },
    { qType: "img", qContent: "assets/images/10_amine/10_amine_ethylamine.svg", aKey: "ethylamine" },
    { qType: "img", qContent: "assets/images/10_amine/10_amine_dimethylamine.svg", aKey: "dimethylamine" },
    { qType: "img", qContent: "assets/images/10_amine/10_amine_trimethylamine.svg", aKey: "trimethylamine" },
    { qType: "img", qContent: "assets/images/10_amine/10_amine_ethylenediamine.svg", aKey: "ethylenediamine" },
    { qType: "img", qContent: "assets/images/13_confused/13_confused_aniline.svg", aKey: "aniline" },
    { qType: "img", qContent: "assets/images/12_halide/12_halide_chloromethane.svg", aKey: "chloromethane" },
    { qType: "img", qContent: "assets/images/12_halide/12_halide_bromoethane.svg", aKey: "bromoethane" },
    { qType: "img", qContent: "assets/images/12_halide/12_halide_chlorobenzene.svg", aKey: "chlorobenzene" },
    { qType: "img", qContent: "assets/images/12_halide/12_halide_dichloromethane.svg", aKey: "dichloromethane" },
    { qType: "img", qContent: "assets/images/12_halide/12_halide_chloroform.svg", aKey: "chloroform" },
    { qType: "img", qContent: "assets/images/12_halide/12_halide_iodomethane.svg", aKey: "iodomethane" },
    { qType: "img", qContent: "assets/images/12_halide/12_halide_vinyl_chloride.svg", aKey: "vinyl_chloride" }
];

// Level 6: 綜合題 (Level 1~5 大亂鬥) —— 含苯環衍生物 + 前面各關卡題目
// 註：圖片仍放在 13_confused/ 資料夾（資料夾名稱沿用，不影響分類）
const Level6_List = [
    { qType: "img", qContent: "assets/images/13_confused/13_confused_phenol.svg", aKey: "phenol" },
    { qType: "img", qContent: "assets/images/14_phenol/14_phenol_o-cresol.svg", aKey: "o-cresol" },
    { qType: "img", qContent: "assets/images/14_phenol/14_phenol_m-cresol.svg", aKey: "m-cresol" },
    { qType: "img", qContent: "assets/images/14_phenol/14_phenol_p-cresol.svg", aKey: "p-cresol" },
    { qType: "img", qContent: "assets/images/14_phenol/14_phenol_catechol.svg", aKey: "catechol" },
    { qType: "img", qContent: "assets/images/14_phenol/14_phenol_resorcinol.svg", aKey: "resorcinol" },
    // 混合前面的部分難題 (隨機取樣概念，這裡為了簡單全列入或部分列入)
    ...Level1_List,
    ...Level2_List, 
    ...Level3_List, 
    ...Level4_List,
    ...Level5_List
];

// 「龜殼」與它的產地：苯環陷阱關
// 全部都是「含苯環」的化合物，但官能基各不相同。教學重點：看到苯環（六角形帶圈圈）不要急著選「酚」，
// 要先看苯環上接的是什麼官能基、–OH 是不是「直接」接在環上。干擾選項會優先從本關其他苯環衍生物抽。
const LevelShell_List = [
    // 酚（–OH 直接接苯環的碳）
    { qType: "img", qContent: "assets/images/13_confused/13_confused_phenol.svg", aKey: "phenol" },
    { qType: "img", qContent: "assets/images/14_phenol/14_phenol_o-cresol.svg", aKey: "o-cresol" },
    { qType: "img", qContent: "assets/images/14_phenol/14_phenol_m-cresol.svg", aKey: "m-cresol" },
    { qType: "img", qContent: "assets/images/14_phenol/14_phenol_p-cresol.svg", aKey: "p-cresol" },
    { qType: "img", qContent: "assets/images/14_phenol/14_phenol_catechol.svg", aKey: "catechol" },
    { qType: "img", qContent: "assets/images/14_phenol/14_phenol_resorcinol.svg", aKey: "resorcinol" },
    // 醇（苯甲醇：–OH 接在苯環「外面」的 CH₂ 上 → 是醇不是酚，最經典的陷阱）
    { qType: "img", qContent: "assets/images/13_confused/13_confused_benzyl_alcohol.svg", aKey: "benzyl_alcohol" },
    // 醛 / 羧酸（苯甲醛 ↔ 苯甲酸）
    { qType: "img", qContent: "assets/images/13_confused/13_confused_benzaldehyde.svg", aKey: "benzaldehyde" },
    { qType: "img", qContent: "assets/images/13_confused/13_confused_benzoic_acid.svg", aKey: "benzoic_acid" },
    // 胺（苯胺：芳香胺，但仍屬胺類）
    { qType: "img", qContent: "assets/images/13_confused/13_confused_aniline.svg", aKey: "aniline" },
    // 酮
    { qType: "img", qContent: "assets/images/06_ketone/06_ketone_acetophenone.svg", aKey: "acetophenone" },
    // 酯
    { qType: "img", qContent: "assets/images/08_ester/08_ester_methyl_benzoate.svg", aKey: "methyl_benzoate" },
    // 醚（苯甲醚：苯環–O–CH₃）
    { qType: "img", qContent: "assets/images/09_ether/09_ether_anisole.svg", aKey: "anisole" },
    // 鹵化物
    { qType: "img", qContent: "assets/images/12_halide/12_halide_chlorobenzene.svg", aKey: "chlorobenzene" },
    // 純芳香烴（讓「芳香烴」也是真選項，逼玩家分辨「只有苯環/烷基」vs「苯環+其他官能基」）
    { qType: "img", qContent: "assets/images/11_aromatic/11_aromatic_benzene.svg", aKey: "benzene" },
    { qType: "img", qContent: "assets/images/11_aromatic/11_aromatic_toluene.svg", aKey: "toluene" },
    { qType: "img", qContent: "assets/images/11_aromatic/11_aromatic_styrene.svg", aKey: "styrene" },
    { qType: "img", qContent: "assets/images/11_aromatic/11_aromatic_o-xylene.svg", aKey: "o-xylene" },
    { qType: "img", qContent: "assets/images/11_aromatic/11_aromatic_naphthalene.svg", aKey: "naphthalene" }
];

// Level 99: 資優挑戰 (看圖 -> 選英文類別)
const Level99_List = [
    // 烷
    { qType: "img", qContent: "assets/images/01_alkane/01_alkane_ethane.svg", aKey: "CAT_ALKANE" },
    { qType: "img", qContent: "assets/images/01_alkane/01_alkane_propane.svg", aKey: "CAT_ALKANE" },
    { qType: "img", qContent: "assets/images/01_alkane/01_alkane_butane.svg", aKey: "CAT_ALKANE" },
    { qType: "img", qContent: "assets/images/01_alkane/01_alkane_isobutane.svg", aKey: "CAT_ALKANE" },
    { qType: "img", qContent: "assets/images/01_alkane/01_alkane_cyclohexane.svg", aKey: "CAT_ALKANE" },
    // 烯
    { qType: "img", qContent: "assets/images/02_alkene/02_alkene_ethene.svg", aKey: "CAT_ALKENE" },
    { qType: "img", qContent: "assets/images/02_alkene/02_alkene_2-butene.svg", aKey: "CAT_ALKENE" },
    { qType: "img", qContent: "assets/images/02_alkene/02_alkene_1,3-butadiene.svg", aKey: "CAT_ALKENE" },
    // 炔
    { qType: "img", qContent: "assets/images/03_alkyne/03_alkyne_ethyne.svg", aKey: "CAT_ALKYNE" },
    { qType: "img", qContent: "assets/images/03_alkyne/03_alkyne_1-butyne.svg", aKey: "CAT_ALKYNE" },
    { qType: "img", qContent: "assets/images/03_alkyne/03_alkyne_2-butyne.svg", aKey: "CAT_ALKYNE" },
    // 醇
    { qType: "img", qContent: "assets/images/04_alcohol/04_alcohol_ethanol.svg", aKey: "CAT_ALCOHOL" },
    { qType: "img", qContent: "assets/images/04_alcohol/04_alcohol_isopropanol.svg", aKey: "CAT_ALCOHOL" },
    { qType: "img", qContent: "assets/images/04_alcohol/04_alcohol_tert-butanol.svg", aKey: "CAT_ALCOHOL" },
    // 醛
    { qType: "img", qContent: "assets/images/05_aldehyde/05_aldehyde_acetaldehyde.svg", aKey: "CAT_ALDEHYDE" },
    { qType: "img", qContent: "assets/images/05_aldehyde/05_aldehyde_butanal.svg", aKey: "CAT_ALDEHYDE" },
    { qType: "img", qContent: "assets/images/13_confused/13_confused_benzaldehyde.svg", aKey: "CAT_ALDEHYDE" },
    // 酮
    { qType: "img", qContent: "assets/images/06_ketone/06_ketone_acetone.svg", aKey: "CAT_KETONE" },
    { qType: "img", qContent: "assets/images/06_ketone/06_ketone_2-pentanone.svg", aKey: "CAT_KETONE" },
    { qType: "img", qContent: "assets/images/06_ketone/06_ketone_cyclohexanone.svg", aKey: "CAT_KETONE" },
    // 酸
    { qType: "img", qContent: "assets/images/07_carboxylic/07_carboxylic_acetic_acid.svg", aKey: "CAT_CARBOXYLIC" },
    { qType: "img", qContent: "assets/images/07_carboxylic/07_carboxylic_butyric_acid.svg", aKey: "CAT_CARBOXYLIC" },
    { qType: "img", qContent: "assets/images/07_carboxylic/07_carboxylic_oxalic_acid.svg", aKey: "CAT_CARBOXYLIC" },
    // 酯
    { qType: "img", qContent: "assets/images/08_ester/08_ester_ethyl_acetate.svg", aKey: "CAT_ESTER" },
    { qType: "img", qContent: "assets/images/08_ester/08_ester_isoamyl_acetate.svg", aKey: "CAT_ESTER" },
    { qType: "img", qContent: "assets/images/08_ester/08_ester_ethyl_butyrate.svg", aKey: "CAT_ESTER" },
    // 醚
    { qType: "img", qContent: "assets/images/09_ether/09_ether_diethyl_ether.svg", aKey: "CAT_ETHER" },
    { qType: "img", qContent: "assets/images/09_ether/09_ether_ethyl_methyl_ether.svg", aKey: "CAT_ETHER" },
    { qType: "img", qContent: "assets/images/09_ether/09_ether_anisole.svg", aKey: "CAT_ETHER" },
    // 胺
    { qType: "img", qContent: "assets/images/10_amine/10_amine_ethylamine.svg", aKey: "CAT_AMINE" },
    { qType: "img", qContent: "assets/images/10_amine/10_amine_trimethylamine.svg", aKey: "CAT_AMINE" },
    { qType: "img", qContent: "assets/images/10_amine/10_amine_ethylenediamine.svg", aKey: "CAT_AMINE" },
    // 芳香
    { qType: "img", qContent: "assets/images/11_aromatic/11_aromatic_benzene.svg", aKey: "CAT_AROMATIC" },
    { qType: "img", qContent: "assets/images/11_aromatic/11_aromatic_o-xylene.svg", aKey: "CAT_AROMATIC" },
    { qType: "img", qContent: "assets/images/11_aromatic/11_aromatic_naphthalene.svg", aKey: "CAT_AROMATIC" },
    // 鹵代
    { qType: "img", qContent: "assets/images/12_halide/12_halide_chloromethane.svg", aKey: "CAT_HALIDE" },
    { qType: "img", qContent: "assets/images/12_halide/12_halide_dichloromethane.svg", aKey: "CAT_HALIDE" },
    { qType: "img", qContent: "assets/images/12_halide/12_halide_iodomethane.svg", aKey: "CAT_HALIDE" },
    // 酚 (取苯酚為例)
    { qType: "img", qContent: "assets/images/13_confused/13_confused_phenol.svg", aKey: "CAT_PHENOL" },
    { qType: "img", qContent: "assets/images/14_phenol/14_phenol_o-cresol.svg", aKey: "CAT_PHENOL" },
    { qType: "img", qContent: "assets/images/14_phenol/14_phenol_catechol.svg", aKey: "CAT_PHENOL" }
];

const QuestionSets = {
    "level1": Level1_List,
    "level2": Level2_List,
    "level3": Level3_List,
    "level4": Level4_List,
    "level5": Level5_List,
    "level6": Level6_List,
    "levelShell": LevelShell_List,
    "level99": Level99_List
};

// 3. 對照表 (Reference Table) - 可留空或放一張通用的官能基總表
const ReferenceTable = [];

// ============================================================================
// 新版 data-driven schema (Wave 1)：QuestionImages × Families × Difficulties
// 舊版 LevelN_List / QuestionSets 仍在上面保留，待 game.js 重寫後在 Wave 2 移除。
// ============================================================================

// QuestionImages：題圖庫；同一張圖只列一次（category 由 AnswerBank[compoundKey] 推導）
const QuestionImages = [
    // 烷
    { src: "assets/images/01_alkane/01_alkane_methane.svg",        compoundKey: "methane" },
    { src: "assets/images/01_alkane/01_alkane_ethane.svg",         compoundKey: "ethane" },
    { src: "assets/images/01_alkane/01_alkane_propane.svg",        compoundKey: "propane" },
    { src: "assets/images/01_alkane/01_alkane_butane.svg",         compoundKey: "butane" },
    { src: "assets/images/01_alkane/01_alkane_isobutane.svg",      compoundKey: "isobutane" },
    { src: "assets/images/01_alkane/01_alkane_cyclohexane.svg",    compoundKey: "cyclohexane" },
    { src: "assets/images/01_alkane/01_alkane_cyclopropane.svg",   compoundKey: "cyclopropane" },
    // 烯
    { src: "assets/images/02_alkene/02_alkene_ethene.svg",         compoundKey: "ethene" },
    { src: "assets/images/02_alkene/02_alkene_propene.svg",        compoundKey: "propene" },
    { src: "assets/images/02_alkene/02_alkene_1-butene.svg",       compoundKey: "1-butene" },
    { src: "assets/images/02_alkene/02_alkene_2-butene.svg",       compoundKey: "2-butene" },
    { src: "assets/images/02_alkene/02_alkene_1,3-butadiene.svg",  compoundKey: "1,3-butadiene" },
    { src: "assets/images/02_alkene/02_alkene_cyclohexene.svg",    compoundKey: "cyclohexene" },
    // 炔
    { src: "assets/images/03_alkyne/03_alkyne_ethyne.svg",         compoundKey: "ethyne" },
    { src: "assets/images/03_alkyne/03_alkyne_propyne.svg",        compoundKey: "propyne" },
    { src: "assets/images/03_alkyne/03_alkyne_1-butyne.svg",       compoundKey: "1-butyne" },
    { src: "assets/images/03_alkyne/03_alkyne_2-butyne.svg",       compoundKey: "2-butyne" },
    // 芳香烴
    { src: "assets/images/11_aromatic/11_aromatic_benzene.svg",      compoundKey: "benzene" },
    { src: "assets/images/11_aromatic/11_aromatic_toluene.svg",      compoundKey: "toluene" },
    { src: "assets/images/11_aromatic/11_aromatic_styrene.svg",      compoundKey: "styrene" },
    { src: "assets/images/11_aromatic/11_aromatic_o-xylene.svg",     compoundKey: "o-xylene" },
    { src: "assets/images/11_aromatic/11_aromatic_m-xylene.svg",     compoundKey: "m-xylene" },
    { src: "assets/images/11_aromatic/11_aromatic_p-xylene.svg",     compoundKey: "p-xylene" },
    { src: "assets/images/11_aromatic/11_aromatic_ethylbenzene.svg", compoundKey: "ethylbenzene" },
    { src: "assets/images/11_aromatic/11_aromatic_naphthalene.svg",  compoundKey: "naphthalene" },
    // 醇
    { src: "assets/images/04_alcohol/04_alcohol_methanol.svg",         compoundKey: "methanol" },
    { src: "assets/images/04_alcohol/04_alcohol_ethanol.svg",          compoundKey: "ethanol" },
    { src: "assets/images/04_alcohol/04_alcohol_propanol.svg",         compoundKey: "propanol" },
    { src: "assets/images/04_alcohol/04_alcohol_isopropanol.svg",      compoundKey: "isopropanol" },
    { src: "assets/images/04_alcohol/04_alcohol_tert-butanol.svg",     compoundKey: "tert-butanol" },
    { src: "assets/images/04_alcohol/04_alcohol_ethylene_glycol.svg",  compoundKey: "ethylene_glycol" },
    { src: "assets/images/04_alcohol/04_alcohol_glycerol.svg",         compoundKey: "glycerol" },
    { src: "assets/images/04_alcohol/04_alcohol_cyclohexanol.svg",     compoundKey: "cyclohexanol" },
    { src: "assets/images/13_confused/13_confused_benzyl_alcohol.svg", compoundKey: "benzyl_alcohol" },
    // 醚
    { src: "assets/images/09_ether/09_ether_dimethyl_ether.svg",     compoundKey: "dimethyl_ether" },
    { src: "assets/images/09_ether/09_ether_diethyl_ether.svg",      compoundKey: "diethyl_ether" },
    { src: "assets/images/09_ether/09_ether_ethyl_methyl_ether.svg", compoundKey: "ethyl_methyl_ether" },
    { src: "assets/images/09_ether/09_ether_ethylene_oxide.svg",     compoundKey: "ethylene_oxide" },
    { src: "assets/images/09_ether/09_ether_anisole.svg",            compoundKey: "anisole" },
    // 醛
    { src: "assets/images/05_aldehyde/05_aldehyde_formaldehyde.svg", compoundKey: "formaldehyde" },
    { src: "assets/images/05_aldehyde/05_aldehyde_acetaldehyde.svg", compoundKey: "acetaldehyde" },
    { src: "assets/images/05_aldehyde/05_aldehyde_propanal.svg",     compoundKey: "propanal" },
    { src: "assets/images/05_aldehyde/05_aldehyde_butanal.svg",      compoundKey: "butanal" },
    { src: "assets/images/13_confused/13_confused_benzaldehyde.svg", compoundKey: "benzaldehyde" },
    // 酮
    { src: "assets/images/06_ketone/06_ketone_acetone.svg",       compoundKey: "acetone" },
    { src: "assets/images/06_ketone/06_ketone_butanone.svg",      compoundKey: "butanone" },
    { src: "assets/images/06_ketone/06_ketone_2-pentanone.svg",   compoundKey: "2-pentanone" },
    { src: "assets/images/06_ketone/06_ketone_3-pentanone.svg",   compoundKey: "3-pentanone" },
    { src: "assets/images/06_ketone/06_ketone_cyclohexanone.svg", compoundKey: "cyclohexanone" },
    { src: "assets/images/06_ketone/06_ketone_acetophenone.svg",  compoundKey: "acetophenone" },
    // 羧酸
    { src: "assets/images/07_carboxylic/07_carboxylic_formic_acid.svg",    compoundKey: "formic_acid" },
    { src: "assets/images/07_carboxylic/07_carboxylic_acetic_acid.svg",    compoundKey: "acetic_acid" },
    { src: "assets/images/07_carboxylic/07_carboxylic_propionic_acid.svg", compoundKey: "propionic_acid" },
    { src: "assets/images/07_carboxylic/07_carboxylic_butyric_acid.svg",   compoundKey: "butyric_acid" },
    { src: "assets/images/07_carboxylic/07_carboxylic_oxalic_acid.svg",    compoundKey: "oxalic_acid" },
    { src: "assets/images/13_confused/13_confused_benzoic_acid.svg",       compoundKey: "benzoic_acid" },
    // 酯
    { src: "assets/images/08_ester/08_ester_methyl_formate.svg",   compoundKey: "methyl_formate" },
    { src: "assets/images/08_ester/08_ester_ethyl_acetate.svg",    compoundKey: "ethyl_acetate" },
    { src: "assets/images/08_ester/08_ester_methyl_acetate.svg",   compoundKey: "methyl_acetate" },
    { src: "assets/images/08_ester/08_ester_isoamyl_acetate.svg",  compoundKey: "isoamyl_acetate" },
    { src: "assets/images/08_ester/08_ester_ethyl_butyrate.svg",   compoundKey: "ethyl_butyrate" },
    { src: "assets/images/08_ester/08_ester_methyl_benzoate.svg",  compoundKey: "methyl_benzoate" },
    // 胺
    { src: "assets/images/10_amine/10_amine_methylamine.svg",     compoundKey: "methylamine" },
    { src: "assets/images/10_amine/10_amine_ethylamine.svg",      compoundKey: "ethylamine" },
    { src: "assets/images/10_amine/10_amine_dimethylamine.svg",   compoundKey: "dimethylamine" },
    { src: "assets/images/10_amine/10_amine_trimethylamine.svg",  compoundKey: "trimethylamine" },
    { src: "assets/images/10_amine/10_amine_ethylenediamine.svg", compoundKey: "ethylenediamine" },
    { src: "assets/images/13_confused/13_confused_aniline.svg",   compoundKey: "aniline" },
    // 鹵化物
    { src: "assets/images/12_halide/12_halide_chloromethane.svg",   compoundKey: "chloromethane" },
    { src: "assets/images/12_halide/12_halide_bromoethane.svg",     compoundKey: "bromoethane" },
    { src: "assets/images/12_halide/12_halide_chlorobenzene.svg",   compoundKey: "chlorobenzene" },
    { src: "assets/images/12_halide/12_halide_dichloromethane.svg", compoundKey: "dichloromethane" },
    { src: "assets/images/12_halide/12_halide_chloroform.svg",      compoundKey: "chloroform" },
    { src: "assets/images/12_halide/12_halide_iodomethane.svg",     compoundKey: "iodomethane" },
    { src: "assets/images/12_halide/12_halide_vinyl_chloride.svg",  compoundKey: "vinyl_chloride" },
    // 酚
    { src: "assets/images/13_confused/13_confused_phenol.svg", compoundKey: "phenol" },
    { src: "assets/images/14_phenol/14_phenol_o-cresol.svg",   compoundKey: "o-cresol" },
    { src: "assets/images/14_phenol/14_phenol_m-cresol.svg",   compoundKey: "m-cresol" },
    { src: "assets/images/14_phenol/14_phenol_p-cresol.svg",   compoundKey: "p-cresol" },
    { src: "assets/images/14_phenol/14_phenol_catechol.svg",   compoundKey: "catechol" },
    { src: "assets/images/14_phenol/14_phenol_resorcinol.svg", compoundKey: "resorcinol" }
];

// Families：主題子關定義；用 imageFilter 從 QuestionImages 篩出本家族題圖
const Families = {
    hydrocarbon: {
        nameZh: "碳氫骨架",
        imageFilter: { type: "byCategory", categories: ["alkane", "alkene", "alkyne", "aromatic"] },
        difficulties: ["beginner", "intermediate"],
        storyKey: "hydrocarbon"
    },
    oxygen: {
        nameZh: "含氧家族",
        imageFilter: { type: "byCategory",
                       categories: ["alcohol", "ether", "aldehyde", "ketone", "carboxylic", "ester", "phenol"] },
        difficulties: ["beginner", "intermediate"],
        storyKey: "oxygen"
    },
    nitrogenHalide: {
        nameZh: "含氮鹵化物",
        imageFilter: { type: "byCategory", categories: ["amine", "halide"] },
        difficulties: ["beginner", "intermediate"],
        storyKey: "nitrogenHalide"
    },
    mixed: {
        nameZh: "綜合",
        imageFilter: { type: "all" },
        difficulties: ["beginner", "intermediate"],
        storyKey: "mixed"
    },
    shell: {
        nameZh: "龜殼之地",
        imageFilter: { type: "byCompoundKeys", keys: [
            "phenol", "o-cresol", "m-cresol", "p-cresol", "catechol", "resorcinol",
            "benzyl_alcohol", "benzaldehyde", "benzoic_acid", "aniline",
            "acetophenone", "methyl_benzoate", "anisole", "chlorobenzene",
            "benzene", "toluene", "styrene", "o-xylene", "naphthalene"
        ]},
        difficulties: ["intermediate"],
        storyKey: "shell"
    },
    englishChallenge: {
        nameZh: "全題庫英文挑戰",
        imageFilter: { type: "all" },
        difficulties: ["advanced"],
        storyKey: null
    }
};

// Difficulties：難度設定（決定答案池與 aKey 前綴）
const Difficulties = {
    beginner:     { answerType: "categoryZh", aKeyPrefix: "CAT_ZH_" },
    intermediate: { answerType: "compound",   aKeyPrefix: null      },
    advanced:     { answerType: "categoryEn", aKeyPrefix: "CAT_EN_" }
};

// 4. 化合物小知識（圖鑑用，1~2 句，淺顯不複雜）
const CompoundFacts = {
    // 烷
    methane:        "天然氣的主成分，最簡單的烷類；完全燃燒生成 CO₂ 和水，本身也是溫室氣體。",
    ethane:         "天然氣的次要成分；裂解（cracking）後可製乙烯，是重要的石化原料。",
    propane:        "液化石油氣（LPG）的主成分之一，常作瓦斯爐、烤肉爐燃料，加壓即可液化。",
    butane:         "打火機裡的燃料；也是 LPG 成分，常溫加壓就能變液體。",
    isobutane:      "丁烷的同分異構物，常用作環保冷媒（R-600a）與噴霧罐推進劑。",
    cyclohexane:    "無色溶劑；工業上氧化後製成己二酸，是尼龍-6,6 的原料。",
    cyclopropane:   "三元環張力很大、反應活潑；以前曾當吸入式麻醉劑（太易燃，已少用）。",
    // 烯
    ethene:         "產量最大的有機化工原料；聚合成聚乙烯（PE），也是讓水果催熟的植物激素。",
    propene:        "聚合成聚丙烯（PP）；也是製造丙酮、異丙醇的原料。",
    "1-butene":     "與乙烯共聚可調整聚乙烯的柔軟度（LLDPE）。",
    "2-butene":     "有順式/反式兩種異構物；用於製造丁二烯與合成橡膠原料。",
    "1,3-butadiene":"共軛二烯，是合成橡膠（SBR、丁腈橡膠）最主要的單體。",
    cyclohexene:    "課本示範「溴水褪色」「過錳酸鉀加成」常用的環狀烯烴。",
    // 炔
    ethyne:         "俗稱電石氣；氧炔焰可達 3000°C 以上，用來切割、焊接金屬。",
    propyne:        "與丙二烯混合（MAPP 氣）當焊接燃料氣。",
    "1-butyne":     "末端炔——能與銀氨/銅氨試劑反應生成沉澱，可用來和 2-丁炔區分。",
    "2-butyne":     "三鍵在中間、沒有末端氫，不會與銀氨試劑反應。",
    // 醇
    methanol:       "工業溶劑、生質柴油原料；有毒，誤飲會失明甚至致命。",
    ethanol:        "酒的主成分；也是消毒酒精、汽油醇（燃料添加劑）。",
    propanol:       "溶劑與印刷油墨成分；1-丙醇也用於化妝品。",
    isopropanol:    "就是「消毒酒精」常見成分（異丙醇），也用來擦拭電子產品。",
    "tert-butanol": "第三級醇，不易被一般氧化劑氧化；可作汽油辛烷值添加劑的原料。",
    ethylene_glycol:"汽車水箱的「防凍液」；也是製造寶特瓶（PET）的原料之一，有甜味但有毒。",
    glycerol:       "甘油——保濕劑，常見於化妝品、藥膏、牙膏；製肥皂的副產物，也可製硝化甘油。",
    cyclohexanol:   "氧化後得環己酮，是製造尼龍的中間體。",
    benzyl_alcohol: "注意 -OH 接在 -CH₂- 上、不是直接接苯環，所以算「醇」不是「酚」；用作香料溶劑與防腐劑。",
    // 醛
    formaldehyde:   "它的水溶液就是「福馬林」，用於防腐和標本保存；也是酚醛樹脂原料，已知致癌物。",
    acetaldehyde:   "乙醇在肝臟代謝的中間產物，是宿醉頭痛的元兇之一。",
    propanal:       "用於合成樹脂、增塑劑與香料的中間體。",
    butanal:        "製造橡膠促進劑、溶劑與香料的中間體。",
    benzaldehyde:   "「苦杏仁味」的來源；人工杏仁、櫻桃香精的主成分。",
    // 酮
    acetone:        "去光水（指甲油去除劑）的主成分；萬用有機溶劑，也是身體燃燒脂肪時的產物。",
    butanone:       "又稱 MEK，常見的工業溶劑（油漆、膠水、塑膠）。",
    "2-pentanone":  "溶劑與香料中間體；羰基在第 2 個碳上。",
    "3-pentanone":  "兩邊對稱的酮，溶劑和合成中間體。",
    cyclohexanone:  "製造尼龍（己內醯胺、己二酸）的關鍵中間體。",
    acetophenone:   "有甜美的山楂花香，用於香水；也是常見的有機合成試劑。",
    // 羧酸
    formic_acid:    "螞蟻、蜂類叮咬的酸（最簡單的羧酸）；也用於皮革鞣製和清潔劑。",
    acetic_acid:    "醋的酸味來源（食醋約含 5%）；純的叫「冰醋酸」，是重要工業原料。",
    propionic_acid: "它的鈣鹽（丙酸鈣）是常見的麵包防黴劑。",
    butyric_acid:   "「酸敗奶油」和臭腳的味道來源；也存在於人體腸道（短鏈脂肪酸）。",
    oxalic_acid:    "存在於菠菜、大黃等植物；可當除鏽劑，過量會和鈣結合形成腎結石。",
    benzoic_acid:   "它的鈉鹽（苯甲酸鈉）是常見的食品防腐劑。",
    // 酯
    methyl_formate: "揮發性溶劑，也用作發泡劑。",
    ethyl_acetate:  "膠水、去光水的氣味來源；低毒性溶劑，連咖啡因脫除都會用到。",
    methyl_acetate: "類似乙酸乙酯的溶劑，常見於油漆和黏著劑。",
    isoamyl_acetate:"「香蕉水」的香味；也是蜜蜂的警報費洛蒙成分。",
    ethyl_butyrate: "鳳梨、橘子般的果香，常用於食品香精。",
    methyl_benzoate:"有類似依蘭花的香氣，用於香水。",
    // 醚
    dimethyl_ether: "噴霧罐推進劑；也被研究當作柴油的替代燃料（DME）。",
    diethyl_ether:  "史上第一種廣泛使用的吸入式麻醉劑（「乙醚」）；極易揮發、極易燃。",
    ethyl_methyl_ether:"結構介於二甲醚和二乙醚之間的不對稱醚。",
    ethylene_oxide: "三元環醚、反應活潑；醫療器材的氣體消毒劑，也是製造乙二醇的原料，有毒致癌。",
    anisole:        "有茴香般的氣味，用於香料和有機合成。",
    // 胺
    methylamine:    "有腐魚／氨的氣味；製造農藥、藥物（如腎上腺素）的原料。",
    ethylamine:     "製造染料、橡膠和農藥的中間體。",
    dimethylamine:  "製藥（如某些抗組織胺）與橡膠促進劑的原料；有魚腥味。",
    trimethylamine: "「魚腥味」的主要來源——魚不新鮮時味道更明顯。",
    ethylenediamine:"雙牙配位基（螯合劑 EDTA 的骨架之一）；也用作環氧樹脂的硬化劑。",
    aniline:        "最簡單的芳香胺；合成染料（苯胺紫）、藥物和橡膠添加劑的重要原料，有毒。",
    // 芳香烴
    benzene:        "芳香烴的代表，重要石化原料（製苯乙烯、酚、苯胺等）；但是已知的致癌物。",
    toluene:        "常見溶劑（油漆、膠水、指甲油）；也是製造 TNT（三硝基甲苯）的原料。",
    styrene:        "聚合成保麗龍／聚苯乙烯（PS）的單體。",
    "o-xylene":     "二甲苯三異構物之一；混合二甲苯常作溶劑，鄰位的可製鄰苯二甲酸酐（增塑劑原料）。",
    "m-xylene":     "二甲苯三異構物之一；常用作溶劑與化工原料。",
    "p-xylene":     "對位二甲苯——製造寶特瓶（PET）的關鍵原料。",
    ethylbenzene:   "主要用途是脫氫做成苯乙烯。",
    naphthalene:    "傳統「樟腦丸」的成分（防蟲）；由兩個苯環稠合的多環芳香烴。",
    // 鹵化物
    chloromethane:  "過去當冷媒和麻醉劑；現在主要用於製造矽聚合物（矽利康）。",
    bromoethane:    "有機合成中常見的烷基化試劑（提供乙基）。",
    chlorobenzene:  "製造農藥、染料和苯酚的中間體。",
    dichloromethane:"強效溶劑（脫漆劑、咖啡因萃取）；揮發快、不易燃。",
    chloroform:     "早期的吸入式麻醉劑（「氯仿」，電影裡迷昏人的那瓶）；現在主要當溶劑，有肝毒性。",
    iodomethane:    "強的甲基化試劑（提供甲基），有機合成常用；有毒。",
    vinyl_chloride: "聚合成 PVC（聚氯乙烯）的單體；單體本身是致癌物。",
    // 酚類
    phenol:         "第一種外科消毒劑（「石碳酸」）；製造酚醛樹脂、阿斯匹靈、雙酚 A 的原料，腐蝕性強。",
    "o-cresol":     "煤餾油酚之一；曾用作消毒劑、木材防腐劑。",
    "m-cresol":     "煤餾油酚之一；用於製造抗氧化劑與染料。",
    "p-cresol":     "煤餾油酚之一；也用於製造抗氧化劑 BHT。",
    catechol:       "鄰苯二酚；存在於茶、洋蔥，用作攝影顯影劑與抗氧化劑。",
    resorcinol:     "間苯二酚；治療痘痘、頭皮屑的外用藥膏成分，也是黏著劑與染料原料。"
};
