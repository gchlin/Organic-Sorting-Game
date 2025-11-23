# 🎨 SVG樣式快速參考卡

## 📝 配置位置
打開 `generate_svg_configurable.py`，修改第14-27行的配置參數

## ⚡ 快速配置表

### 1️⃣ 顯示C和H標籤

| 配置 | 效果 | 適合對象 |
|------|------|---------|
| `SHOW_ALL_CARBONS = True` | 顯示所有C標籤 | ✅ 初學者、遊戲 |
| `SHOW_ALL_CARBONS = False` | 隱藏C標籤 | 進階學習者 |
| `SHOW_ALL_HYDROGENS = True` | 顯示所有H | ✅ 教學用 |
| `SHOW_ALL_HYDROGENS = False` | 隱藏H | 簡潔版 |

### 2️⃣ 元素顏色

| 配置 | 效果 | 顏色方案 |
|------|------|---------|
| `USE_ELEMENT_COLORS = True` | 彩色 | O紅、N藍、Cl綠 |
| `USE_ELEMENT_COLORS = False` | 全黑 | ✅ 適合遊戲/列印 |

### 3️⃣ 背景

| 配置 | 效果 | 用途 |
|------|------|------|
| `TRANSPARENT_BACKGROUND = True` | 透明 | ✅ 嵌入遊戲UI |
| `TRANSPARENT_BACKGROUND = False` | 白色 | 獨立使用 |

## 🎯 推薦配置組合

### 🎮 遊戲版（推薦）
```python
SHOW_ALL_CARBONS = True
SHOW_ALL_HYDROGENS = True
USE_ELEMENT_COLORS = False      # 全黑
TRANSPARENT_BACKGROUND = True   # 透明
```

### 📚 教學版
```python
SHOW_ALL_CARBONS = True
SHOW_ALL_HYDROGENS = True
USE_ELEMENT_COLORS = True       # 彩色
TRANSPARENT_BACKGROUND = False  # 白色
```

### 📖 專業版
```python
SHOW_ALL_CARBONS = False
SHOW_ALL_HYDROGENS = False
USE_ELEMENT_COLORS = True
TRANSPARENT_BACKGROUND = False
```

### 🖨️ 列印版
```python
SHOW_ALL_CARBONS = True
SHOW_ALL_HYDROGENS = False
USE_ELEMENT_COLORS = False      # 全黑
TRANSPARENT_BACKGROUND = False
```

## 🔧 其他參數

```python
IMAGE_WIDTH = 400        # 寬度（建議保持4:3比例）
IMAGE_HEIGHT = 300       # 高度
BOND_LINE_WIDTH = 2.0    # 鍵粗細（1.0-3.0）
OUTPUT_DIR_NAME = "..."  # 輸出資料夾名稱
```

## 📋 元素顏色對照

| 元素 | 顏色（彩色模式） | 顏色（黑白模式） |
|------|----------------|----------------|
| C 碳 | 黑色 #000000 | 黑色 #000000 |
| H 氫 | 黑色 #000000 | 黑色 #000000 |
| O 氧 | 紅色 #FF0000 | 黑色 #000000 |
| N 氮 | 藍色 #0000FF | 黑色 #000000 |
| Cl 氯 | 綠色 #00FF00 | 黑色 #000000 |
| Br 溴 | 棕色 #A52A2A | 黑色 #000000 |

## 💡 使用流程

1. 打開 `generate_svg_configurable.py`
2. 修改頂部配置參數
3. 執行: `python3 generate_svg_configurable.py`
4. 查看生成的 `index.html`
5. 如果不滿意，重複步驟1-4

## ⚠️ 注意事項

- 修改參數後需重新執行腳本
- 建議一次只改一個參數測試效果
- 透明背景在瀏覽器中看起來是白色（正常）
- 所有SVG長寬比固定為 4:3

---

更多詳細說明請看 `README.md`
