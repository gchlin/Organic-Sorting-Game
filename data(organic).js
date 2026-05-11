// data.js - 有機分類帽版

// 1. 選項資料庫 (AnswerBank)
// 包含具體的化合物名稱(中文) 以及 Level 99 需要的英文類別名稱
const AnswerBank = {
    // --- Level 1~6: 化合物中文名稱 ---
    "methane": { type: "text", content: "甲烷", category: "alkane" },
    "ethane": { type: "text", content: "乙烷", category: "alkane" },
    "propane": { type: "text", content: "丙烷", category: "alkane" },
    "butane": { type: "text", content: "丁烷", category: "alkane" },
    "isobutane": { type: "text", content: "異丁烷", category: "alkane" },
    "cyclohexane": { type: "text", content: "環己烷", category: "alkane" },
    "cyclopropane": { type: "text", content: "環丙烷", category: "alkane" },
    "ethene": { type: "text", content: "乙烯", category: "alkene" },
    "propene": { type: "text", content: "丙烯", category: "alkene" },
    "1-butene": { type: "text", content: "1-丁烯", category: "alkene" },
    "2-butene": { type: "text", content: "2-丁烯", category: "alkene" },
    "1,3-butadiene": { type: "text", content: "1,3-丁二烯", category: "alkene" },
    "cyclohexene": { type: "text", content: "環己烯", category: "alkene" },
    "ethyne": { type: "text", content: "乙炔", category: "alkyne" },
    "propyne": { type: "text", content: "丙炔", category: "alkyne" },
    "1-butyne": { type: "text", content: "1-丁炔", category: "alkyne" },
    "2-butyne": { type: "text", content: "2-丁炔", category: "alkyne" },
    "methanol": { type: "text", content: "甲醇", category: "alcohol" },
    "ethanol": { type: "text", content: "乙醇", category: "alcohol" },
    "propanol": { type: "text", content: "丙醇", category: "alcohol" },
    "isopropanol": { type: "text", content: "2-丙醇", category: "alcohol" },
    "tert-butanol": { type: "text", content: "第三丁醇", category: "alcohol" },
    "ethylene_glycol": { type: "text", content: "乙二醇", category: "alcohol" },
    "glycerol": { type: "text", content: "丙三醇（甘油）", category: "alcohol" },
    "cyclohexanol": { type: "text", content: "環己醇", category: "alcohol" },
    "formaldehyde": { type: "text", content: "甲醛", category: "aldehyde" },
    "acetaldehyde": { type: "text", content: "乙醛", category: "aldehyde" },
    "propanal": { type: "text", content: "丙醛", category: "aldehyde" },
    "butanal": { type: "text", content: "丁醛", category: "aldehyde" },
    "acetone": { type: "text", content: "丙酮", category: "ketone" },
    "butanone": { type: "text", content: "丁酮", category: "ketone" },
    "2-pentanone": { type: "text", content: "2-戊酮", category: "ketone" },
    "3-pentanone": { type: "text", content: "3-戊酮", category: "ketone" },
    "cyclohexanone": { type: "text", content: "環己酮", category: "ketone" },
    "acetophenone": { type: "text", content: "苯乙酮", category: "ketone" },
    "formic_acid": { type: "text", content: "甲酸", category: "carboxylic" },
    "acetic_acid": { type: "text", content: "乙酸", category: "carboxylic" },
    "propionic_acid": { type: "text", content: "丙酸", category: "carboxylic" },
    "butyric_acid": { type: "text", content: "丁酸", category: "carboxylic" },
    "oxalic_acid": { type: "text", content: "草酸", category: "carboxylic" },
    "methyl_formate": { type: "text", content: "甲酸甲酯", category: "ester" },
    "ethyl_acetate": { type: "text", content: "乙酸乙酯", category: "ester" },
    "methyl_acetate": { type: "text", content: "乙酸甲酯", category: "ester" },
    "isoamyl_acetate": { type: "text", content: "乙酸異戊酯", category: "ester" },
    "ethyl_butyrate": { type: "text", content: "丁酸乙酯", category: "ester" },
    "methyl_benzoate": { type: "text", content: "苯甲酸甲酯", category: "ester" },
    "dimethyl_ether": { type: "text", content: "二甲醚", category: "ether" },
    "diethyl_ether": { type: "text", content: "二乙醚", category: "ether" },
    "ethyl_methyl_ether": { type: "text", content: "甲乙醚", category: "ether" },
    "ethylene_oxide": { type: "text", content: "環氧乙烷", category: "ether" },
    "anisole": { type: "text", content: "苯甲醚", category: "ether" },
    "methylamine": { type: "text", content: "甲胺", category: "amine" },
    "ethylamine": { type: "text", content: "乙胺", category: "amine" },
    "dimethylamine": { type: "text", content: "二甲胺", category: "amine" },
    "trimethylamine": { type: "text", content: "三甲胺", category: "amine" },
    "ethylenediamine": { type: "text", content: "乙二胺", category: "amine" },
    "benzene": { type: "text", content: "苯", category: "aromatic" },
    "toluene": { type: "text", content: "甲苯", category: "aromatic" },
    "styrene": { type: "text", content: "苯乙烯", category: "aromatic" },
    "o-xylene": { type: "text", content: "鄰-二甲苯", category: "aromatic" },
    "m-xylene": { type: "text", content: "間-二甲苯", category: "aromatic" },
    "p-xylene": { type: "text", content: "對-二甲苯", category: "aromatic" },
    "ethylbenzene": { type: "text", content: "乙苯", category: "aromatic" },
    "naphthalene": { type: "text", content: "萘", category: "aromatic" },
    "chloromethane": { type: "text", content: "氯甲烷", category: "halide" },
    "bromoethane": { type: "text", content: "溴乙烷", category: "halide" },
    "chlorobenzene": { type: "text", content: "氯苯", category: "halide" },
    "dichloromethane": { type: "text", content: "二氯甲烷", category: "halide" },
    "chloroform": { type: "text", content: "三氯甲烷（氯仿）", category: "halide" },
    "iodomethane": { type: "text", content: "碘甲烷", category: "halide" },
    "vinyl_chloride": { type: "text", content: "氯乙烯", category: "halide" },
    // 以下原本被歸成 "confused"（易混淆）—— 已改回各自真正的官能基分類
    // phenol 自成一類（與 Level 99 的 CAT_PHENOL 一致）；其餘歸正統官能基
    "phenol": { type: "text", content: "苯酚", category: "phenol" },
    "o-cresol": { type: "text", content: "鄰-甲酚", category: "phenol" },
    "m-cresol": { type: "text", content: "間-甲酚", category: "phenol" },
    "p-cresol": { type: "text", content: "對-甲酚", category: "phenol" },
    "catechol": { type: "text", content: "兒茶酚", category: "phenol" },
    "resorcinol": { type: "text", content: "間苯二酚", category: "phenol" },
    "benzyl_alcohol": { type: "text", content: "苯甲醇", category: "alcohol" },
    "benzaldehyde": { type: "text", content: "苯甲醛", category: "aldehyde" },
    "benzoic_acid": { type: "text", content: "苯甲酸", category: "carboxylic" },
    "aniline": { type: "text", content: "苯胺", category: "amine" },

    // --- Level 99: 英文類別名稱 (English Categories) ---
    "CAT_ALKANE": { type: "text", content: "Alkane", category: "cat" },
    "CAT_ALKENE": { type: "text", content: "Alkene", category: "cat" },
    "CAT_ALKYNE": { type: "text", content: "Alkyne", category: "cat" },
    "CAT_ALCOHOL": { type: "text", content: "Alcohol", category: "cat" },
    "CAT_ALDEHYDE": { type: "text", content: "Aldehyde", category: "cat" },
    "CAT_KETONE": { type: "text", content: "Ketone", category: "cat" },
    "CAT_CARBOXYLIC": { type: "text", content: "Carboxylic Acid", category: "cat" },
    "CAT_ESTER": { type: "text", content: "Ester", category: "cat" },
    "CAT_ETHER": { type: "text", content: "Ether", category: "cat" },
    "CAT_AMINE": { type: "text", content: "Amine", category: "cat" },
    "CAT_AROMATIC": { type: "text", content: "Aromatic", category: "cat" },
    "CAT_HALIDE": { type: "text", content: "Halide", category: "cat" },
    "CAT_PHENOL": { type: "text", content: "Phenol / Derivative", category: "cat" }
};

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
    "level99": Level99_List
};

// 3. 對照表 (Reference Table) - 可留空或放一張通用的官能基總表
const ReferenceTable = [];
