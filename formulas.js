// formulas.js - 示性式（condensed structural formula）
// 題面用：示性式挑戰關卡不看結構圖，改看這裡的文字式子。
// 內容來源：docs/示性式審核表.md（AI 草擬，待化學老師校訂）。
// 注意：環狀分子與萘刻意不收（示性式表達不出環，見審核表的收錄原則），
//       所以本表 74 個分子 < AnswerBank 的 81 個化合物。
const Formulas = {
    // 1. 烷 Alkane
    methane: "CH₄",
    ethane: "CH₃CH₃",
    propane: "CH₃CH₂CH₃",
    butane: "CH₃CH₂CH₂CH₃",
    isobutane: "(CH₃)₃CH",

    // 2. 烯 Alkene
    ethene: "CH₂=CH₂",
    propene: "CH₂=CHCH₃",
    "1-butene": "CH₂=CHCH₂CH₃",
    "2-butene": "CH₃CH=CHCH₃",
    "1,3-butadiene": "CH₂=CHCH=CH₂",

    // 3. 炔 Alkyne
    ethyne: "CH≡CH",
    propyne: "CH≡CCH₃",
    "1-butyne": "CH≡CCH₂CH₃",
    "2-butyne": "CH₃C≡CCH₃",

    // 4. 芳香烴 Aromatic
    benzene: "C₆H₆",
    toluene: "C₆H₅CH₃",
    styrene: "C₆H₅CH=CH₂",
    "o-xylene": "o-C₆H₄(CH₃)₂",
    "m-xylene": "m-C₆H₄(CH₃)₂",
    "p-xylene": "p-C₆H₄(CH₃)₂",
    ethylbenzene: "C₆H₅CH₂CH₃",

    // 5. 醇 Alcohol
    methanol: "CH₃OH",
    ethanol: "CH₃CH₂OH",
    propanol: "CH₃CH₂CH₂OH",
    isopropanol: "CH₃CH(OH)CH₃",
    "tert-butanol": "(CH₃)₃COH",
    ethylene_glycol: "HOCH₂CH₂OH",
    glycerol: "HOCH₂CH(OH)CH₂OH",
    benzyl_alcohol: "C₆H₅CH₂OH",

    // 6. 酚 Phenol
    phenol: "C₆H₅OH",
    "o-cresol": "o-CH₃C₆H₄OH",
    "m-cresol": "m-CH₃C₆H₄OH",
    "p-cresol": "p-CH₃C₆H₄OH",
    catechol: "o-C₆H₄(OH)₂",
    resorcinol: "m-C₆H₄(OH)₂",

    // 7. 醚 Ether
    dimethyl_ether: "CH₃OCH₃",
    diethyl_ether: "CH₃CH₂OCH₂CH₃",
    ethyl_methyl_ether: "CH₃OCH₂CH₃",
    anisole: "C₆H₅OCH₃",

    // 8. 醛 Aldehyde
    formaldehyde: "HCHO",
    acetaldehyde: "CH₃CHO",
    propanal: "CH₃CH₂CHO",
    butanal: "CH₃CH₂CH₂CHO",
    benzaldehyde: "C₆H₅CHO",

    // 9. 酮 Ketone
    acetone: "CH₃COCH₃",
    butanone: "CH₃COCH₂CH₃",
    "2-pentanone": "CH₃COCH₂CH₂CH₃",
    "3-pentanone": "CH₃CH₂COCH₂CH₃",
    acetophenone: "C₆H₅COCH₃",

    // 10. 羧酸 Carboxylic acid
    formic_acid: "HCOOH",
    acetic_acid: "CH₃COOH",
    propionic_acid: "CH₃CH₂COOH",
    butyric_acid: "CH₃CH₂CH₂COOH",
    oxalic_acid: "HOOCCOOH",
    benzoic_acid: "C₆H₅COOH",

    // 11. 酯 Ester
    methyl_formate: "HCOOCH₃",
    ethyl_acetate: "CH₃COOCH₂CH₃",
    methyl_acetate: "CH₃COOCH₃",
    isoamyl_acetate: "CH₃COOCH₂CH₂CH(CH₃)₂",
    ethyl_butyrate: "CH₃CH₂CH₂COOCH₂CH₃",
    methyl_benzoate: "C₆H₅COOCH₃",

    // 12. 胺 Amine
    methylamine: "CH₃NH₂",
    ethylamine: "CH₃CH₂NH₂",
    dimethylamine: "(CH₃)₂NH",
    trimethylamine: "(CH₃)₃N",
    ethylenediamine: "H₂NCH₂CH₂NH₂",
    aniline: "C₆H₅NH₂",

    // 13. 鹵化物 Halide
    chloromethane: "CH₃Cl",
    bromoethane: "CH₃CH₂Br",
    chlorobenzene: "C₆H₅Cl",
    dichloromethane: "CH₂Cl₂",
    chloroform: "CHCl₃",
    iodomethane: "CH₃I",
    vinyl_chloride: "CH₂=CHCl"
};
