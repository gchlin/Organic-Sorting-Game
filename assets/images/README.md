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

### Q: 為什麼有些碳沒顯示？
A: 設定 `SHOW_ALL_CARBONS = True`

### Q: 如何去除氧的紅色？
A: 設定 `USE_ELEMENT_COLORS = False`

### Q: 如何改變背景？
A: 設定 `TRANSPARENT_BACKGROUND = True` 或修改後處理邏輯

### Q: 圖片太小怎麼辦？
A: 增加 `IMAGE_WIDTH` 和 `IMAGE_HEIGHT`，建議保持4:3比例

---

生成時間: 未記錄
生成腳本版本: 可配置版 v1.0
