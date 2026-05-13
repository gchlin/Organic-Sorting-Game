# 著色分子圖生成工具

官能基分子著色 SVG 圖片自動生成工具。

---

## 📋 顏色對應表

| 顏色名稱 | Hex代碼 | RGB | 用途 |
|---------|--------|-----|------|
| **Crimson** | #c0392b | (192, 57, 43) | 醇羥基 (-OH)、羧基 (-COOH) |
| **Gold** | #d4af37 | (212, 175, 55) | C-C/C=C/C#C 化學鍵、醚 (-O-)、酯基 (-COOR) |
| **Emerald** | #27ae60 | (39, 174, 96) | 苯環、芳香環 |
| **Ravenclaw** | #4a8fd1 | (74, 143, 209) | 醛 (-CHO)、胺 (-NH₂) |
| **Amethyst** | #9b6dc7 | (155, 109, 199) | 酮 (C=O) |

---

## 🎯 著色規則

### Bonds Highlighting（化學鍵著色）

| 官能基/結構 | SMARTS | 著色方式 | 顏色 |
|----------|--------|---------|------|
| 烷烴 (01) | `[C][C]` | C-C 單鍵 | 金色 |
| 烯烴 (02) | `[C]=[C]` | C=C 雙鍵 | 金色 |
| 炔烴 (03) | `[C]#[C]` | C#C 三鍵 | 金色 |
| 醇 (04) | `[O]` | C-O-H 化學鍵 | 紅色，O字體黑色 |

### Atoms Highlighting（原子著色）

| 官能基/結構 | SMARTS | 著色方式 | 顏色 |
|----------|--------|---------|------|
| 醚 (09) | `[C,N,S][O;D2][C,N,S]` | O 原子 | 金色 |
| 芳香烴 (11) | `a1aaaaa1` | 苯環原子 | 翠綠色 |

---

## 🖼️ 圖片規格

- **大小**：400 × 300 px
- **背景**：白色
- **元素符號**：黑色（醇的 O 特別標記為黑色）
- **著色**：官能基/化學鍵用指定顏色著色
- **格式**：SVG（向量圖格式）
- **命名**：`{original_name}_highlight.svg`

---

## 📁 檔案位置

```
assets/images/
├── 01_alkane/
│   ├── 01_alkane_ethane_highlight.svg
│   └── 01_alkane_propane_highlight.svg
├── 02_alkene/
│   └── 02_alkene_ethene_highlight.svg
├── 03_alkyne/
│   └── 03_alkyne_ethyne_highlight.svg
├── 04_alcohol/
│   ├── 04_alcohol_ethanol_highlight.svg
│   ├── 04_alcohol_propanol_highlight.svg
│   ├── 04_alcohol_isopropanol_highlight.svg
│   └── 04_alcohol_ethylene_glycol_highlight.svg
├── 09_ether/
│   ├── 09_ether_dimethyl_ether_highlight.svg
│   ├── 09_ether_ethyl_methyl_ether_highlight.svg
│   └── 09_ether_ethylene_oxide_highlight.svg
├── 11_aromatic/
│   ├── 11_aromatic_benzene_highlight.svg
│   └── 11_aromatic_toluene_highlight.svg
└── generate_highlighted_molecules.py
```

---

## 🚀 快速執行

```bash
cd assets/images
python generate_highlighted_molecules.py
```

會生成 13 個著色分子 SVG 圖：
- **01_alkane** (2 個)：烷烴的 C-C 單鍵著色
- **02_alkene** (1 個)：烯烴的 C=C 雙鍵著色
- **03_alkyne** (1 個)：炔烴的 C#C 三鍵著色
- **04_alcohol** (4 個)：醇的 C-O-H 化學鍵著色，O 字體黑色
- **09_ether** (3 個)：醚的 O 原子著色
- **11_aromatic** (2 個)：苯環著色

---

## 💻 使用範例

見 `hightlight_example.py` 檔案中的乙醇著色範例。

---

## 📚 參考資源

- [SMARTS 語法](https://www.daylight.com/dayhtml/doc/theory/theory.smarts.html)
- [RDKit 文檔](https://www.rdkit.org/docs/)

