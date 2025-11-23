// data.js - 有機分類帽版

// 1. 選項資料庫 (AnswerBank)
// 包含具體的化合物名稱(中文) 以及 Level 99 需要的英文類別名稱
const AnswerBank = {
    // --- Level 1~6: 化合物中文名稱 ---
    "methane": { type: "text", content: "甲烷", category: "alkane" },
    "ethane": { type: "text", content: "乙烷", category: "alkane" },
    "propane": { type: "text", content: "丙烷", category: "alkane" },
    "ethene": { type: "text", content: "乙烯", category: "alkene" },
    "propene": { type: "text", content: "丙烯", category: "alkene" },
    "1-butene": { type: "text", content: "1-丁烯", category: "alkene" },
    "ethyne": { type: "text", content: "乙炔", category: "alkyne" },
    "propyne": { type: "text", content: "丙炔", category: "alkyne" },
    "methanol": { type: "text", content: "甲醇", category: "alcohol" },
    "ethanol": { type: "text", content: "乙醇", category: "alcohol" },
    "propanol": { type: "text", content: "丙醇", category: "alcohol" },
    "formaldehyde": { type: "text", content: "甲醛", category: "aldehyde" },
    "acetaldehyde": { type: "text", content: "乙醛", category: "aldehyde" },
    "propanal": { type: "text", content: "丙醛", category: "aldehyde" },
    "acetone": { type: "text", content: "丙酮", category: "ketone" },
    "butanone": { type: "text", content: "丁酮", category: "ketone" },
    "formic_acid": { type: "text", content: "甲酸", category: "carboxylic" },
    "acetic_acid": { type: "text", content: "乙酸", category: "carboxylic" },
    "propionic_acid": { type: "text", content: "丙酸", category: "carboxylic" },
    "methyl_formate": { type: "text", content: "甲酸甲酯", category: "ester" },
    "ethyl_acetate": { type: "text", content: "乙酸乙酯", category: "ester" },
    "methyl_acetate": { type: "text", content: "乙酸甲酯", category: "ester" },
    "dimethyl_ether": { type: "text", content: "二甲醚", category: "ether" },
    "diethyl_ether": { type: "text", content: "二乙醚", category: "ether" },
    "methylamine": { type: "text", content: "甲胺", category: "amine" },
    "ethylamine": { type: "text", content: "乙胺", category: "amine" },
    "dimethylamine": { type: "text", content: "二甲胺", category: "amine" },
    "benzene": { type: "text", content: "苯", category: "aromatic" },
    "toluene": { type: "text", content: "甲苯", category: "aromatic" },
    "styrene": { type: "text", content: "苯乙烯", category: "aromatic" },
    "chloromethane": { type: "text", content: "氯甲烷", category: "halide" },
    "bromoethane": { type: "text", content: "溴乙烷", category: "halide" },
    "chlorobenzene": { type: "text", content: "氯苯", category: "halide" },
    "phenol": { type: "text", content: "苯酚", category: "confused" },
    "benzyl_alcohol": { type: "text", content: "苯甲醇", category: "confused" },
    "benzaldehyde": { type: "text", content: "苯甲醛", category: "confused" },
    "benzoic_acid": { type: "text", content: "苯甲酸", category: "confused" },
    "aniline": { type: "text", content: "苯胺", category: "confused" },

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
    { qType: "img", qContent: "assets/images/02_alkene/02_alkene_ethene.svg", aKey: "ethene" },
    { qType: "img", qContent: "assets/images/02_alkene/02_alkene_propene.svg", aKey: "propene" },
    { qType: "img", qContent: "assets/images/02_alkene/02_alkene_1-butene.svg", aKey: "1-butene" },
    { qType: "img", qContent: "assets/images/03_alkyne/03_alkyne_ethyne.svg", aKey: "ethyne" },
    { qType: "img", qContent: "assets/images/03_alkyne/03_alkyne_propyne.svg", aKey: "propyne" },
    { qType: "img", qContent: "assets/images/11_aromatic/11_aromatic_benzene.svg", aKey: "benzene" },
    { qType: "img", qContent: "assets/images/11_aromatic/11_aromatic_toluene.svg", aKey: "toluene" },
    { qType: "img", qContent: "assets/images/11_aromatic/11_aromatic_styrene.svg", aKey: "styrene" }
];

// Level 2: 單鍵氧 (醇、醚)
const Level2_List = [
    { qType: "img", qContent: "assets/images/04_alcohol/04_alcohol_methanol.svg", aKey: "methanol" },
    { qType: "img", qContent: "assets/images/04_alcohol/04_alcohol_ethanol.svg", aKey: "ethanol" },
    { qType: "img", qContent: "assets/images/04_alcohol/04_alcohol_propanol.svg", aKey: "propanol" },
    { qType: "img", qContent: "assets/images/09_ether/09_ether_dimethyl_ether.svg", aKey: "dimethyl_ether" },
    { qType: "img", qContent: "assets/images/09_ether/09_ether_diethyl_ether.svg", aKey: "diethyl_ether" }
];

// Level 3: 雙鍵氧 (醛、酮)
const Level3_List = [
    { qType: "img", qContent: "assets/images/05_aldehyde/05_aldehyde_formaldehyde.svg", aKey: "formaldehyde" },
    { qType: "img", qContent: "assets/images/05_aldehyde/05_aldehyde_acetaldehyde.svg", aKey: "acetaldehyde" },
    { qType: "img", qContent: "assets/images/05_aldehyde/05_aldehyde_propanal.svg", aKey: "propanal" },
    { qType: "img", qContent: "assets/images/06_ketone/06_ketone_acetone.svg", aKey: "acetone" },
    { qType: "img", qContent: "assets/images/06_ketone/06_ketone_butanone.svg", aKey: "butanone" }
];

// Level 4: 雙氧複合 (酸、酯)
const Level4_List = [
    { qType: "img", qContent: "assets/images/07_carboxylic/07_carboxylic_formic_acid.svg", aKey: "formic_acid" },
    { qType: "img", qContent: "assets/images/07_carboxylic/07_carboxylic_acetic_acid.svg", aKey: "acetic_acid" },
    { qType: "img", qContent: "assets/images/07_carboxylic/07_carboxylic_propionic_acid.svg", aKey: "propionic_acid" },
    { qType: "img", qContent: "assets/images/08_ester/08_ester_methyl_formate.svg", aKey: "methyl_formate" },
    { qType: "img", qContent: "assets/images/08_ester/08_ester_ethyl_acetate.svg", aKey: "ethyl_acetate" },
    { qType: "img", qContent: "assets/images/08_ester/08_ester_methyl_acetate.svg", aKey: "methyl_acetate" }
];

// Level 5: 雜原子與鹵素 (胺、鹵化物) + 複習前面
const Level5_List = [
    { qType: "img", qContent: "assets/images/10_amine/10_amine_methylamine.svg", aKey: "methylamine" },
    { qType: "img", qContent: "assets/images/10_amine/10_amine_ethylamine.svg", aKey: "ethylamine" },
    { qType: "img", qContent: "assets/images/10_amine/10_amine_dimethylamine.svg", aKey: "dimethylamine" },
    { qType: "img", qContent: "assets/images/12_halide/12_halide_chloromethane.svg", aKey: "chloromethane" },
    { qType: "img", qContent: "assets/images/12_halide/12_halide_bromoethane.svg", aKey: "bromoethane" },
    { qType: "img", qContent: "assets/images/12_halide/12_halide_chlorobenzene.svg", aKey: "chlorobenzene" }
];

// Level 6: 終極分類帽 (包含易混淆 + 所有題目)
const Level6_List = [
    { qType: "img", qContent: "assets/images/13_confused/13_confused_phenol.svg", aKey: "phenol" },
    { qType: "img", qContent: "assets/images/13_confused/13_confused_benzyl_alcohol.svg", aKey: "benzyl_alcohol" },
    { qType: "img", qContent: "assets/images/13_confused/13_confused_benzaldehyde.svg", aKey: "benzaldehyde" },
    { qType: "img", qContent: "assets/images/13_confused/13_confused_benzoic_acid.svg", aKey: "benzoic_acid" },
    { qType: "img", qContent: "assets/images/13_confused/13_confused_aniline.svg", aKey: "aniline" },
    // 混合前面的部分難題 (隨機取樣概念，這裡為了簡單全列入或部分列入)
    ...Level2_List, 
    ...Level3_List, 
    ...Level4_List
];

// Level 99: 資優挑戰 (看圖 -> 選英文類別)
const Level99_List = [
    // 烷
    { qType: "img", qContent: "assets/images/01_alkane/01_alkane_ethane.svg", aKey: "CAT_ALKANE" },
    { qType: "img", qContent: "assets/images/01_alkane/01_alkane_propane.svg", aKey: "CAT_ALKANE" },
    // 烯
    { qType: "img", qContent: "assets/images/02_alkene/02_alkene_ethene.svg", aKey: "CAT_ALKENE" },
    // 炔
    { qType: "img", qContent: "assets/images/03_alkyne/03_alkyne_ethyne.svg", aKey: "CAT_ALKYNE" },
    // 醇
    { qType: "img", qContent: "assets/images/04_alcohol/04_alcohol_ethanol.svg", aKey: "CAT_ALCOHOL" },
    // 醛
    { qType: "img", qContent: "assets/images/05_aldehyde/05_aldehyde_acetaldehyde.svg", aKey: "CAT_ALDEHYDE" },
    // 酮
    { qType: "img", qContent: "assets/images/06_ketone/06_ketone_acetone.svg", aKey: "CAT_KETONE" },
    // 酸
    { qType: "img", qContent: "assets/images/07_carboxylic/07_carboxylic_acetic_acid.svg", aKey: "CAT_CARBOXYLIC" },
    // 酯
    { qType: "img", qContent: "assets/images/08_ester/08_ester_ethyl_acetate.svg", aKey: "CAT_ESTER" },
    // 醚
    { qType: "img", qContent: "assets/images/09_ether/09_ether_diethyl_ether.svg", aKey: "CAT_ETHER" },
    // 胺
    { qType: "img", qContent: "assets/images/10_amine/10_amine_ethylamine.svg", aKey: "CAT_AMINE" },
    // 芳香
    { qType: "img", qContent: "assets/images/11_aromatic/11_aromatic_benzene.svg", aKey: "CAT_AROMATIC" },
    // 鹵代
    { qType: "img", qContent: "assets/images/12_halide/12_halide_chloromethane.svg", aKey: "CAT_HALIDE" },
    // 易混淆(取苯酚為例)
    { qType: "img", qContent: "assets/images/13_confused/13_confused_phenol.svg", aKey: "CAT_PHENOL" }
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