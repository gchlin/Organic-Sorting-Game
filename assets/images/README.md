# 有機化合物SVG生成器 - 完整說明文件

## 📋 當前配置

```
顯示碳標籤: ✓ 是
顯示氫原子: ✓ 是
元素顏色: ✓ 啟用 (O紅、N藍等)
背景: ✗ 白色
圖片尺寸: 400 × 300 像素
鍵粗細: 2.0
```

## 🎨 如何更改樣式

### 方法1: 修改配置參數（推薦）

打開生成腳本，找到頂部的配置區：

```python
# ========================================
# 🎨 樣式配置區 - 在這裡調整生成參數
# ========================================

SHOW_ALL_CARBONS = True   # 改這裡！
SHOW_ALL_HYDROGENS = True  # 改這裡！
USE_ELEMENT_COLORS = True  # 改這裡！
TRANSPARENT_BACKGROUND = False  # 改這裡！
```

### 常用配置組合

#### 配置A: 專業簡潔版（推薦進階學習者）
```python
SHOW_ALL_CARBONS = False
SHOW_ALL_HYDROGENS = False
USE_ELEMENT_COLORS = True
TRANSPARENT_BACKGROUND = False
```
效果：像化學教科書的結構式

#### 配置B: 完整教學版（推薦初學者）⭐
```python
SHOW_ALL_CARBONS = True
SHOW_ALL_HYDROGENS = True
USE_ELEMENT_COLORS = True
TRANSPARENT_BACKGROUND = False
```
效果：顯示所有C、H標籤，清楚易懂

#### 配置C: 遊戲簡約版
```python
SHOW_ALL_CARBONS = True
SHOW_ALL_HYDROGENS = True
USE_ELEMENT_COLORS = False  # 全黑色
TRANSPARENT_BACKGROUND = True  # 透明背景
```
效果：適合嵌入遊戲UI，背景可自訂

#### 配置D: 黑白列印版
```python
SHOW_ALL_CARBONS = True
SHOW_ALL_HYDROGENS = False
USE_ELEMENT_COLORS = False
TRANSPARENT_BACKGROUND = False
```
效果：適合列印成講義

## 🎨 原子著色與高亮效果 (Atom Highlighting)

### 概述

使用 RDKit 的 `MolDraw2D` 和 `highlightAtoms` 功能，可以對分子中的特定原子進行著色高亮，用於：
- ✓ 區分不同類型的原子（如吡咯型N vs 吡啶型N）
- ✓ 標示官能基
- ✓ 強調反應活性部位
- ✓ 教學用途

### 基本用法

```python
from rdkit import Chem
from rdkit.Chem.Draw import rdMolDraw2D

# 1. 建立分子
mol = Chem.MolFromSmiles('c1c[nH]nc1')  # 吡唑
mol_with_h = Chem.AddHs(mol)

# 2. 建立繪圖器
drawer = rdMolDraw2D.MolDraw2DCairo(400, 300)
opts = drawer.drawOptions()
opts.fillHighlights = True      # 實心填充高亮區域
opts.minFontSize = 20           # 字體大小

# 3. 定義著色方案 (RGB, 0-1 範圍)
atom_colors = {
    2: (0.6, 0.8, 0.9),  # 原子索引2 → 淺藍色
    3: (0.9, 0.6, 0.6)   # 原子索引3 → 粉紅色
}

# 4. 繪圖並著色
drawer.DrawMolecule(
    mol_with_h,
    highlightAtoms=list(atom_colors.keys()),
    highlightAtomColors=atom_colors,
    highlightBonds=[]  # 空列表表示不高亮鍵
)
drawer.FinishDrawing()

# 5. 儲存圖片
with open('colored_molecule.png', 'wb') as f:
    f.write(drawer.GetDrawingText())
```

### 實用例子：區分氮原子類型

```python
def highlight_nitrogen_types(smiles):
    """
    吡咯型N [nH] → 淺藍色
    吡啶型N n    → 粉紅色
    """
    mol = Chem.MolFromSmiles(smiles)
    mol_with_h = Chem.AddHs(mol)
    
    atom_colors = {}
    
    # 識別不同類型的氮原子
    for idx, atom in enumerate(mol.GetAtoms()):
        if atom.GetSymbol() == 'N':
            if atom.GetTotalNumHs() > 0:
                # 吡咯型 [nH]
                atom_colors[idx] = (0.6, 0.8, 0.9)  # 淺藍色
            else:
                # 吡啶型 n
                atom_colors[idx] = (0.9, 0.6, 0.6)  # 粉紅色
    
    # 繪圖
    drawer = rdMolDraw2D.MolDraw2DCairo(400, 300)
    opts = drawer.drawOptions()
    opts.fillHighlights = True
    
    drawer.DrawMolecule(
        mol_with_h,
        highlightAtoms=list(atom_colors.keys()),
        highlightAtomColors=atom_colors
    )
    drawer.FinishDrawing()
    
    return drawer.GetDrawingText()
```

### 常用顏色方案

| 用途 | 顏色 | RGB值 | 說明 |
|------|------|-------|------|
| 吡咯型N | 淺藍 | (0.6, 0.8, 0.9) | 帶H的氮 |
| 吡啶型N | 粉紅 | (0.9, 0.6, 0.6) | sp² 氮 |
| 反應位點 | 黃色 | (1.0, 1.0, 0.0) | 活性部位 |
| 官能基 | 綠色 | (0.0, 1.0, 0.0) | 整個官能基 |
| 取代基 | 橙色 | (1.0, 0.7, 0.0) | 側鏈 |

### 高亮鍵的方法

如果要同時高亮特定的鍵：

```python
# 高亮原子和鍵
bond_indices = [0, 1, 2]  # 要高亮的鍵索引
bond_colors = {
    0: (0.0, 0.0, 0.0),  # 鍵0 → 黑色
    1: (1.0, 0.0, 0.0),  # 鍵1 → 紅色
}

drawer.DrawMolecule(
    mol,
    highlightAtoms=list(atom_colors.keys()),
    highlightAtomColors=atom_colors,
    highlightBonds=bond_indices,
    highlightBondColors=bond_colors
)
```

### 如何找出原子索引？

```python
# 方法1: 列印所有原子
for idx, atom in enumerate(mol.GetAtoms()):
    print(f"索引 {idx}: {atom.GetSymbol()} (原子序數: {atom.GetAtomicNum()})")

# 方法2: 根據特定條件找索引
oxygen_indices = [idx for idx, atom in enumerate(mol.GetAtoms()) 
                  if atom.GetSymbol() == 'O']
nitrogen_indices = [idx for idx, atom in enumerate(mol.GetAtoms()) 
                    if atom.GetSymbol() == 'N']
```

### 繪圖選項 (DrawingOptions)

```python
opts = drawer.drawOptions()

opts.fillHighlights = True           # 實心填充 (推薦)
opts.minFontSize = 20               # 最小字體大小
opts.maxFontSize = 40               # 最大字體大小
opts.bondLineWidth = 2.0            # 鍵寬度
opts.highlightBondWidthMultiplier = 8  # 高亮鍵的寬度倍數
opts.atomHighlightedCellSize = 0.4  # 高亮區域大小
```

### 完整腳本位置

詳細實現請參考：
```
draw_colored_molecules.py
```

包含以下功能：
- ✓ 吡唑 (Pyrazole) 著色示例
- ✓ 咪唑 (Imidazole) 著色示例  
- ✓ 苯並咪唑 (Benzimidazole) 著色示例
- ✓ 自動識別和著色邏輯

---

## 🔧 進階自訂

### 1. 調整圖片尺寸

```python
IMAGE_WIDTH = 600   # 改成更大的寬度
IMAGE_HEIGHT = 450  # 改成更大的高度（建議保持4:3比例）
```

### 2. 調整鍵的粗細

```python
BOND_LINE_WIDTH = 3.0  # 預設2.0，數字越大越粗
```

### 3. 更改輸出資料夾名稱

```python
OUTPUT_DIR_NAME = "my_custom_molecules"  # 自訂名稱
```

## 🎨 元素顏色對照表

RDKit預設的元素顏色：

| 元素 | 顏色 | 十六進位碼 |
|------|------|-----------|
| C (碳) | 黑色 | #000000 |
| H (氫) | 黑色 | #000000 |
| O (氧) | 紅色 | #FF0000 |
| N (氮) | 藍色 | #0000FF |
| Cl (氯) | 綠色 | #00FF00 |
| Br (溴) | 棕色 | #A52A2A |
| F (氟) | 青色 | #00FFFF |

### 如何改為全黑色？

設定：
```python
USE_ELEMENT_COLORS = False
```

腳本會自動將所有顏色替換為黑色。

## 📁 檔案結構

```
organic_svgs_configurable/
├── 01_alkane/          烷烴 (7個SVG)
├── 02_alkene/          烯烴 (6個SVG)
├── 03_alkyne/          炔烴 (4個SVG)
├── 04_alcohol/         醇 (8個SVG)
├── 05_aldehyde/        醛 (4個SVG)
├── 06_ketone/          酮 (6個SVG)
├── 07_carboxylic/      羧酸 (5個SVG)
├── 08_ester/           酯 (6個SVG)
├── 09_ether/           醚 (5個SVG)
├── 10_amine/           胺 (5個SVG)
├── 11_aromatic/        芳香烴 (8個SVG)
├── 12_halide/          鹵化物 (7個SVG)
├── 13_confused/        原苯環衍生物圖 (5個SVG)
├── 14_phenol/          酚類新增圖 (5個SVG)
├── index.html          索引頁面
├── compounds_map.json  JSON映射表
├── README.md           本說明文件
└── CONFIG.txt          當前配置摘要
```

## 🔄 重新生成步驟

RDKit 原始圖：

1. 打開生成腳本
2. 修改頂部的配置參數
3. 執行腳本：
   ```bash
   python3 generate_svg_configurable.py
   ```
4. 檢查新生成的檔案

第一批新增 RDKit SVG：

```bash
python3 generate_added_rdkit_svgs.py
```

## 💡 使用建議

### 給AI的資訊
- JSON檔案 (`compounds_map.json`) 包含所有化合物資訊
- 可用於自動生成題目、答案配對
- 檔名格式固定，易於程式處理

### 給人的資訊
- index.html 可直接用瀏覽器查看所有結構式
- SVG格式可直接插入網頁、PPT、Word
- 向量圖放大不失真
- 所有化合物長寬比一致（4:3）

## 🎮 遊戲開發建議

### 難度分級
1. **簡單** - 使用完整標籤版 (SHOW_ALL_CARBONS=True, SHOW_ALL_HYDROGENS=True)
2. **中等** - 只顯示碳 (SHOW_ALL_CARBONS=True, SHOW_ALL_HYDROGENS=False)
3. **困難** - 專業版 (SHOW_ALL_CARBONS=False, SHOW_ALL_HYDROGENS=False)

### UI設計建議
- 統一容器尺寸：400×300 或等比例縮放
- 添加邊框或陰影增加視覺效果
- 透明背景版可疊加任何背景色

## 📊 統計資訊

- 總化合物數: 81
- 原始圖庫: 38
- 第一批新增: 43
- 分類資料夾數: 14
- 檔案格式: SVG (向量圖)
- 長寬比: 4:3

## 📦 原始圖庫項目

以下為本專案原本就有的 38 個化合物：

- 烷烴：甲烷、乙烷、丙烷
- 烯烴：乙烯、丙烯、1-丁烯
- 炔烴：乙炔、丙炔
- 醇：甲醇、乙醇、丙醇
- 醛：甲醛、乙醛、丙醛
- 酮：丙酮、丁酮
- 羧酸：甲酸、乙酸、丙酸
- 酯：甲酸甲酯、乙酸乙酯、乙酸甲酯
- 醚：二甲醚、二乙醚
- 胺：甲胺、乙胺、二甲胺
- 芳香烴：苯、甲苯、苯乙烯
- 鹵化物：氯甲烷、溴乙烷、氯苯
- 原 `13_confused/` 圖庫：苯酚、苯甲醇、苯甲醛、苯甲酸、苯胺

## 🧪 第一批新增項目

依 `題庫擴充建議.md` 的「第一批：補滿現有家族」新增，並已接入專案根目錄的 `data(organic).js`，可在 `test.html` 中檢查：

- 烷烴：丁烷、異丁烷、環己烷、環丙烷
- 烯烴：2-丁烯、1,3-丁二烯、環己烯
- 炔烴：1-丁炔、2-丁炔
- 醇：2-丙醇、第三丁醇、乙二醇、丙三醇（甘油）、環己醇
- 醚：甲乙醚、環氧乙烷、苯甲醚
- 醛：丁醛
- 酮：2-戊酮、3-戊酮、環己酮、苯乙酮
- 羧酸：丁酸、草酸
- 酯：乙酸異戊酯、丁酸乙酯、苯甲酸甲酯
- 胺：三甲胺、乙二胺
- 鹵化物：二氯甲烷、三氯甲烷（氯仿）、碘甲烷、氯乙烯
- 芳香烴：鄰-二甲苯、間-二甲苯、對-二甲苯、乙苯、萘
- 酚：鄰-甲酚、間-甲酚、對-甲酚、兒茶酚、間苯二酚

## 🆘 常見問題

### 基本設定相關

#### Q: 為什麼有些碳沒顯示？
A: 設定 `SHOW_ALL_CARBONS = True`

#### Q: 如何去除氧的紅色？
A: 設定 `USE_ELEMENT_COLORS = False`

#### Q: 如何改變背景？
A: 設定 `TRANSPARENT_BACKGROUND = True` 或修改後處理邏輯

#### Q: 圖片太小怎麼辦？
A: 增加 `IMAGE_WIDTH` 和 `IMAGE_HEIGHT`，建議保持4:3比例

### 著色與高亮相關

#### Q: 怎樣知道某個原子的索引？
A: 執行此代碼：
```python
mol = Chem.MolFromSmiles('你的SMILES')
for idx, atom in enumerate(mol.GetAtoms()):
    print(f"索引 {idx}: {atom.GetSymbol()}")
```

#### Q: 如何改變高亮顏色？
A: 修改 RGB 元組，範圍 0-1：
```python
atom_colors = {
    0: (1.0, 0.0, 0.0),  # 紅色
    1: (0.0, 1.0, 0.0),  # 綠色
    2: (0.0, 0.0, 1.0),  # 藍色
}
```

#### Q: 為什麼高亮區域沒有填充？
A: 確保設定了：
```python
opts.fillHighlights = True
```

#### Q: 可以同時高亮原子和鍵嗎？
A: 可以，提供 `highlightBonds` 和 `highlightBondColors` 參數：
```python
drawer.DrawMolecule(
    mol,
    highlightAtoms=[...],
    highlightAtomColors={...},
    highlightBonds=[0, 1, 2],
    highlightBondColors={0: (1,0,0), 1: (0,1,0)}
)
```

#### Q: 如何只高亮特定官能基？
A: 先識別官能基中的原子，再將它們的索引加入 `highlightAtoms`：
```python
# 識別羧基的氧原子和碳原子
carboxylic_acid_atoms = [idx for idx, atom in enumerate(mol.GetAtoms())
                         if atom.GetSymbol() in ['C', 'O'] and 
                         idx in [specific_indices]]
atom_colors = {idx: (1.0, 0.0, 0.0) for idx in carboxylic_acid_atoms}
```

#### Q: 高亮顏色看起來太淡？
A: 增加飽和度，降低 RGB 值中的某些分量：
```python
# 更深的淺藍色
atom_colors[idx] = (0.2, 0.6, 0.9)  # 而不是 (0.6, 0.8, 0.9)
```

#### Q: 如何生成多個著色方案（預設+自訂）？
A: 建立兩個不同配置的繪圖器：
```python
# 預設繪圖
drawer1 = rdMolDraw2D.MolDraw2DCairo(400, 300)
drawer1.DrawMolecule(mol)

# 著色繪圖
drawer2 = rdMolDraw2D.MolDraw2DCairo(400, 300)
drawer2.DrawMolecule(mol, highlightAtoms=[...], ...)
```

### 實際應用範例

#### 應用1: 教學 - 區分官能基類型

```python
# 對吡唑進行著色：區分吡咯型 vs 吡啶型
smiles = 'c1c[nH]nc1'
highlight_nitrogen_types(smiles)
# 結果：吡咯型N(淺藍) + 吡啶型N(粉紅)
```

#### 應用2: 遊戲 - 標示反應部位

```python
# 標示最容易被攻擊的部位（高亮）
highlight_atoms = [reactive_atom_indices]
atom_colors = {idx: (1.0, 1.0, 0.0) for idx in highlight_atoms}  # 黃色
```

#### 應用3: 學習 - 對比構體異構體

```python
# 生成同分異構體的著色對比圖
# 用不同顏色標示相同的官能基位置
```

---

生成時間: 未記錄
生成腳本版本: 可配置版 v1.0
