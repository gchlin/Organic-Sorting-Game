#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
有機化合物SVG生成器 - 可配置版 v1.0
支援自訂顯示樣式、顏色、背景等參數
"""

from rdkit import Chem
from rdkit.Chem import Draw
from rdkit.Chem.Draw import rdMolDraw2D
import os
import json
from datetime import datetime

# ========================================
# 🎨 樣式配置區 - 在這裡調整生成參數
# ========================================

SHOW_ALL_CARBONS = True          # 是否顯示所有碳原子標籤
SHOW_ALL_HYDROGENS = True        # 是否顯示所有氫原子
USE_ELEMENT_COLORS = True        # 是否使用元素顏色 (O紅、N藍等)
TRANSPARENT_BACKGROUND = False   # 是否使用透明背景

IMAGE_WIDTH = 400                # 圖片寬度
IMAGE_HEIGHT = 300               # 圖片高度
BOND_LINE_WIDTH = 2.0            # 鍵的粗細 (1.0-3.0)

OUTPUT_DIR_NAME = "organic_svgs_configurable"  # 輸出資料夾名稱

# ========================================

# 定義所有化合物資料
compounds = [
    # 1. 烷烴 (Alkane)
    {"name": "甲烷", "en_name": "methane", "smiles": "C", "category": "01_alkane", "cat_zh": "烷烴"},
    {"name": "乙烷", "en_name": "ethane", "smiles": "CC", "category": "01_alkane", "cat_zh": "烷烴"},
    {"name": "丙烷", "en_name": "propane", "smiles": "CCC", "category": "01_alkane", "cat_zh": "烷烴"},
    
    # 2. 烯烴 (Alkene)
    {"name": "乙烯", "en_name": "ethene", "smiles": "C=C", "category": "02_alkene", "cat_zh": "烯烴"},
    {"name": "丙烯", "en_name": "propene", "smiles": "C=CC", "category": "02_alkene", "cat_zh": "烯烴"},
    {"name": "1-丁烯", "en_name": "1-butene", "smiles": "C=CCC", "category": "02_alkene", "cat_zh": "烯烴"},
    
    # 3. 炔烴 (Alkyne)
    {"name": "乙炔", "en_name": "ethyne", "smiles": "C#C", "category": "03_alkyne", "cat_zh": "炔烴"},
    {"name": "丙炔", "en_name": "propyne", "smiles": "C#CC", "category": "03_alkyne", "cat_zh": "炔烴"},
    
    # 4. 醇 (Alcohol)
    {"name": "甲醇", "en_name": "methanol", "smiles": "CO", "category": "04_alcohol", "cat_zh": "醇"},
    {"name": "乙醇", "en_name": "ethanol", "smiles": "CCO", "category": "04_alcohol", "cat_zh": "醇"},
    {"name": "丙醇", "en_name": "propanol", "smiles": "CCCO", "category": "04_alcohol", "cat_zh": "醇"},
    
    # 5. 醛 (Aldehyde)
    {"name": "甲醛", "en_name": "formaldehyde", "smiles": "C=O", "category": "05_aldehyde", "cat_zh": "醛"},
    {"name": "乙醛", "en_name": "acetaldehyde", "smiles": "CC=O", "category": "05_aldehyde", "cat_zh": "醛"},
    {"name": "丙醛", "en_name": "propanal", "smiles": "CCC=O", "category": "05_aldehyde", "cat_zh": "醛"},
    
    # 6. 酮 (Ketone)
    {"name": "丙酮", "en_name": "acetone", "smiles": "CC(C)=O", "category": "06_ketone", "cat_zh": "酮"},
    {"name": "丁酮", "en_name": "butanone", "smiles": "CCC(C)=O", "category": "06_ketone", "cat_zh": "酮"},
    
    # 7. 羧酸 (Carboxylic Acid)
    {"name": "甲酸", "en_name": "formic_acid", "smiles": "C(=O)O", "category": "07_carboxylic", "cat_zh": "羧酸"},
    {"name": "乙酸", "en_name": "acetic_acid", "smiles": "CC(=O)O", "category": "07_carboxylic", "cat_zh": "羧酸"},
    {"name": "丙酸", "en_name": "propionic_acid", "smiles": "CCC(=O)O", "category": "07_carboxylic", "cat_zh": "羧酸"},
    
    # 8. 酯 (Ester)
    {"name": "甲酸甲酯", "en_name": "methyl_formate", "smiles": "COC=O", "category": "08_ester", "cat_zh": "酯"},
    {"name": "乙酸乙酯", "en_name": "ethyl_acetate", "smiles": "CCOC(C)=O", "category": "08_ester", "cat_zh": "酯"},
    {"name": "乙酸甲酯", "en_name": "methyl_acetate", "smiles": "COC(C)=O", "category": "08_ester", "cat_zh": "酯"},
    
    # 9. 醚 (Ether)
    {"name": "二甲醚", "en_name": "dimethyl_ether", "smiles": "COC", "category": "09_ether", "cat_zh": "醚"},
    {"name": "二乙醚", "en_name": "diethyl_ether", "smiles": "CCOCC", "category": "09_ether", "cat_zh": "醚"},
    
    # 10. 胺 (Amine)
    {"name": "甲胺", "en_name": "methylamine", "smiles": "CN", "category": "10_amine", "cat_zh": "胺"},
    {"name": "乙胺", "en_name": "ethylamine", "smiles": "CCN", "category": "10_amine", "cat_zh": "胺"},
    {"name": "二甲胺", "en_name": "dimethylamine", "smiles": "CNC", "category": "10_amine", "cat_zh": "胺"},
    
    # 11. 芳香烴 (Aromatic)
    {"name": "苯", "en_name": "benzene", "smiles": "c1ccccc1", "category": "11_aromatic", "cat_zh": "芳香烴"},
    {"name": "甲苯", "en_name": "toluene", "smiles": "Cc1ccccc1", "category": "11_aromatic", "cat_zh": "芳香烴"},
    {"name": "苯乙烯", "en_name": "styrene", "smiles": "C=Cc1ccccc1", "category": "11_aromatic", "cat_zh": "芳香烴"},
    
    # 12. 鹵化物 (Halide)
    {"name": "氯甲烷", "en_name": "chloromethane", "smiles": "CCl", "category": "12_halide", "cat_zh": "鹵化物"},
    {"name": "溴乙烷", "en_name": "bromoethane", "smiles": "CCBr", "category": "12_halide", "cat_zh": "鹵化物"},
    {"name": "氯苯", "en_name": "chlorobenzene", "smiles": "Clc1ccccc1", "category": "12_halide", "cat_zh": "鹵化物"},
    
    # 13. 易混淆化合物 (Confusing)
    {"name": "苯酚", "en_name": "phenol", "smiles": "Oc1ccccc1", "category": "13_confused", "cat_zh": "易混淆"},
    {"name": "苯甲醇", "en_name": "benzyl_alcohol", "smiles": "OCc1ccccc1", "category": "13_confused", "cat_zh": "易混淆"},
    {"name": "苯甲醛", "en_name": "benzaldehyde", "smiles": "O=Cc1ccccc1", "category": "13_confused", "cat_zh": "易混淆"},
    {"name": "苯甲酸", "en_name": "benzoic_acid", "smiles": "O=C(O)c1ccccc1", "category": "13_confused", "cat_zh": "易混淆"},
    {"name": "苯胺", "en_name": "aniline", "smiles": "Nc1ccccc1", "category": "13_confused", "cat_zh": "易混淆"},
]

def get_config_summary():
    """生成當前配置摘要"""
    return f"""
當前配置:
-----------
顯示碳標籤: {'✓ 是' if SHOW_ALL_CARBONS else '✗ 否'}
顯示氫原子: {'✓ 是' if SHOW_ALL_HYDROGENS else '✗ 否'}
元素顏色: {'✓ 啟用 (O紅、N藍等)' if USE_ELEMENT_COLORS else '✗ 全黑色'}
背景: {'✓ 透明' if TRANSPARENT_BACKGROUND else '✗ 白色'}
圖片尺寸: {IMAGE_WIDTH} × {IMAGE_HEIGHT} 像素
鍵粗細: {BOND_LINE_WIDTH}
輸出目錄: {OUTPUT_DIR_NAME}
"""

def apply_black_color(svg_text):
    """將SVG中的所有顏色替換為黑色"""
    import re
    # 替換常見的顏色值
    color_patterns = [
        (r'stroke:#[0-9A-Fa-f]{6}', 'stroke:#000000'),
        (r'fill:#[0-9A-Fa-f]{6}', 'fill:#000000'),
        (r'stroke:rgb\([^)]+\)', 'stroke:#000000'),
        (r'fill:rgb\([^)]+\)', 'fill:#000000'),
    ]
    
    result = svg_text
    for pattern, replacement in color_patterns:
        result = re.sub(pattern, replacement, result)
    
    return result

def make_background_transparent(svg_text):
    """將SVG背景改為透明"""
    import re
    # 移除背景的rect元素（匹配任何顏色的背景）
    svg_text = re.sub(
        r'<rect[^>]*width=[\'"]400\.0[\'"][^>]*height=[\'"]300\.0[\'"][^>]*>\s*</rect>',
        '',
        svg_text,
        flags=re.MULTILINE
    )
    return svg_text

def generate_svgs():
    """批次生成SVG檔案 - 可配置版"""
    
    # 準備輸出目錄
    output_dir = f"/mnt/user-data/outputs/{OUTPUT_DIR_NAME}"
    os.makedirs(output_dir, exist_ok=True)
    
    print("🎨 開始批次生成有機化合物SVG (可配置版)...\n")
    print(f"📂 輸出目錄: {output_dir}")
    print(get_config_summary())
    
    # 創建子目錄
    categories = set(c['category'] for c in compounds)
    for category in categories:
        cat_dir = os.path.join(output_dir, category)
        os.makedirs(cat_dir, exist_ok=True)
    
    # 生成SVG
    success_count = 0
    error_count = 0
    filename_map = []
    
    for i, compound in enumerate(compounds, 1):
        try:
            # 解析SMILES
            mol = Chem.MolFromSmiles(compound['smiles'])
            
            if mol is None:
                print(f"✗ {i}/{len(compounds)} {compound['name']} - SMILES解析失敗")
                error_count += 1
                continue
            
            # 生成檔名
            filename = f"{compound['category']}_{compound['en_name']}.svg"
            
            # 配置繪圖選項
            drawer = Draw.MolDraw2DSVG(IMAGE_WIDTH, IMAGE_HEIGHT)
            draw_options = drawer.drawOptions()
            
            # 應用配置
            if SHOW_ALL_CARBONS:
                # 顯示所有碳原子標籤
                for atom in mol.GetAtoms():
                    if atom.GetSymbol() == 'C':
                        atom.SetProp('atomLabel', 'C')
            
            if SHOW_ALL_HYDROGENS:
                # 添加顯式氫原子
                mol = Chem.AddHs(mol)
            
            # 設定鍵粗細
            draw_options.bondLineWidth = BOND_LINE_WIDTH
            
            # 繪製分子
            drawer.DrawMolecule(mol)
            drawer.FinishDrawing()
            svg = drawer.GetDrawingText()
            
            # 後處理SVG
            if not USE_ELEMENT_COLORS:
                svg = apply_black_color(svg)
            
            if TRANSPARENT_BACKGROUND:
                svg = make_background_transparent(svg)
            
            # 儲存檔案
            filepath = os.path.join(output_dir, compound['category'], filename)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(svg)
            
            print(f"✓ {i:02d}/{len(compounds)} {filename:40s} ({compound['name']})")
            success_count += 1
            
            # 記錄映射
            filename_map.append({
                'filename': filename,
                'zh_name': compound['name'],
                'en_name': compound['en_name'],
                'category': compound['category'],
                'cat_zh': compound['cat_zh'],
                'smiles': compound['smiles']
            })
            
        except Exception as e:
            print(f"✗ {i}/{len(compounds)} {compound['name']} - 錯誤: {str(e)}")
            error_count += 1
    
    print(f"\n✨ 生成完成！")
    print(f"✓ 成功: {success_count} 個")
    print(f"✗ 失敗: {error_count} 個")
    
    # 生成配置文件
    save_config_file(output_dir)
    
    # 生成索引文件
    print(f"\n📋 生成索引文件...")
    generate_index(output_dir, compounds)
    
    # 生成JSON映射檔
    print(f"📋 生成JSON映射檔...")
    generate_json_map(output_dir, filename_map)
    
    print(f"\n📂 所有檔案位於: {output_dir}")
    
    return output_dir

def save_config_file(output_dir):
    """儲存當前配置到CONFIG.txt"""
    config_text = f"""有機化合物SVG生成器 - 配置記錄
生成時間: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

{get_config_summary()}

如需更改配置，請修改 generate_svg_configurable.py 頂部的參數。
"""
    
    config_path = os.path.join(output_dir, "CONFIG.txt")
    with open(config_path, 'w', encoding='utf-8') as f:
        f.write(config_text)
    
    print(f"✓ 配置文件: CONFIG.txt")

def generate_json_map(output_dir, filename_map):
    """生成JSON檔案映射表"""
    json_data = {
        "total": len(filename_map),
        "config": {
            "show_all_carbons": SHOW_ALL_CARBONS,
            "show_all_hydrogens": SHOW_ALL_HYDROGENS,
            "use_element_colors": USE_ELEMENT_COLORS,
            "transparent_background": TRANSPARENT_BACKGROUND,
            "image_size": f"{IMAGE_WIDTH}x{IMAGE_HEIGHT}",
            "bond_line_width": BOND_LINE_WIDTH
        },
        "compounds": filename_map
    }
    
    json_path = os.path.join(output_dir, "compounds_map.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(json_data, f, ensure_ascii=False, indent=2)
    
    print(f"✓ JSON映射表: compounds_map.json")

def generate_index(output_dir, compounds):
    """生成索引HTML檔案"""
    
    # 配置資訊區塊
    config_html = f"""
        <div class="config-info">
            <h3>🎨 當前配置</h3>
            <div class="config-grid">
                <div class="config-item">
                    <span class="config-label">顯示碳標籤:</span>
                    <span class="config-value {'enabled' if SHOW_ALL_CARBONS else 'disabled'}">
                        {'✓ 是' if SHOW_ALL_CARBONS else '✗ 否'}
                    </span>
                </div>
                <div class="config-item">
                    <span class="config-label">顯示氫原子:</span>
                    <span class="config-value {'enabled' if SHOW_ALL_HYDROGENS else 'disabled'}">
                        {'✓ 是' if SHOW_ALL_HYDROGENS else '✗ 否'}
                    </span>
                </div>
                <div class="config-item">
                    <span class="config-label">元素顏色:</span>
                    <span class="config-value {'enabled' if USE_ELEMENT_COLORS else 'disabled'}">
                        {'✓ 啟用 (O紅、N藍等)' if USE_ELEMENT_COLORS else '✗ 全黑色'}
                    </span>
                </div>
                <div class="config-item">
                    <span class="config-label">背景:</span>
                    <span class="config-value {'enabled' if TRANSPARENT_BACKGROUND else 'disabled'}">
                        {'✓ 透明' if TRANSPARENT_BACKGROUND else '✗ 白色'}
                    </span>
                </div>
                <div class="config-item">
                    <span class="config-label">圖片尺寸:</span>
                    <span class="config-value">{IMAGE_WIDTH} × {IMAGE_HEIGHT} 像素</span>
                </div>
                <div class="config-item">
                    <span class="config-label">鍵粗細:</span>
                    <span class="config-value">{BOND_LINE_WIDTH}</span>
                </div>
            </div>
            <p style="margin-top: 15px; font-size: 0.9em; color: #666;">
                💡 如需更改配置，請修改 <code>generate_svg_configurable.py</code> 頂部的參數並重新執行
            </p>
        </div>
    """
    
    html = f"""<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>有機化合物SVG索引 - 可配置版</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ 
            font-family: "Microsoft JhengHei", "Segoe UI", Arial, sans-serif; 
            padding: 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }}
        .container {{
            max-width: 1600px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }}
        h1 {{ 
            color: #2c3e50; 
            text-align: center;
            margin-bottom: 15px;
            font-size: 2.5em;
        }}
        .subtitle {{
            text-align: center;
            color: #7f8c8d;
            margin-bottom: 30px;
            font-size: 1.1em;
        }}
        .config-info {{
            background: linear-gradient(135deg, #e7f3ff 0%, #f0f8ff 100%);
            border-left: 5px solid #2196F3;
            padding: 25px;
            margin-bottom: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        .config-info h3 {{
            color: #1565c0;
            margin-bottom: 15px;
            font-size: 1.3em;
        }}
        .config-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 12px;
            margin-bottom: 10px;
        }}
        .config-item {{
            background: white;
            padding: 10px 15px;
            border-radius: 6px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }}
        .config-label {{
            font-weight: 600;
            color: #555;
        }}
        .config-value {{
            font-family: "Consolas", "Courier New", monospace;
            padding: 4px 10px;
            border-radius: 4px;
            font-weight: bold;
        }}
        .config-value.enabled {{
            background: #c8e6c9;
            color: #2e7d32;
        }}
        .config-value.disabled {{
            background: #ffccbc;
            color: #d84315;
        }}
        .config-info code {{
            background: #fff3e0;
            padding: 2px 8px;
            border-radius: 3px;
            font-family: "Courier New", monospace;
            color: #e65100;
            font-weight: bold;
        }}
        .stats {{
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
            border-radius: 10px;
            border-left: 5px solid #ff9800;
        }}
        .stats-number {{
            font-size: 2.5em;
            font-weight: bold;
            color: #e65100;
        }}
        .category {{ 
            margin: 40px 0; 
            background: #f8f9fa; 
            padding: 25px; 
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        .category-title {{ 
            font-size: 1.4em; 
            color: #667eea; 
            margin-bottom: 20px; 
            border-bottom: 3px solid #667eea; 
            padding-bottom: 10px;
            font-weight: bold;
        }}
        .compounds {{ 
            display: grid; 
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); 
            gap: 20px; 
        }}
        .compound-item {{ 
            text-align: center; 
            padding: 20px; 
            background: white; 
            border-radius: 10px;
            border: 2px solid #e9ecef;
            transition: all 0.3s ease;
        }}
        .compound-item:hover {{
            transform: translateY(-5px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.15);
            border-color: #667eea;
        }}
        .compound-item img {{ 
            max-width: 100%; 
            height: auto; 
            border: 1px solid #dee2e6; 
            border-radius: 8px; 
            background: {'transparent' if TRANSPARENT_BACKGROUND else 'white'}; 
            padding: 10px; 
        }}
        .compound-name {{ 
            font-weight: bold; 
            margin-top: 12px; 
            color: #2c3e50;
            font-size: 1.2em;
        }}
        .compound-filename {{ 
            font-family: "Courier New", monospace; 
            font-size: 0.8em; 
            color: #667eea; 
            margin-top: 8px;
            background: #e7f3ff;
            padding: 6px 10px;
            border-radius: 5px;
            word-break: break-all;
        }}
        .compound-smiles {{ 
            font-family: "Courier New", monospace; 
            font-size: 0.85em; 
            color: #7f8c8d; 
            margin-top: 8px;
            background: #f8f9fa;
            padding: 6px 10px;
            border-radius: 5px;
        }}
        a {{ 
            color: inherit; 
            text-decoration: none; 
        }}
        .download-btn {{
            display: inline-block;
            margin-top: 10px;
            padding: 8px 16px;
            background: #667eea;
            color: white;
            border-radius: 5px;
            font-size: 0.9em;
            transition: background 0.3s;
            font-weight: 500;
        }}
        .download-btn:hover {{
            background: #5568d3;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🎨 有機化合物SVG索引 - 可配置版</h1>
        <p class="subtitle">RDKit生成 • 支援自訂樣式配置</p>
        
        {config_html}
        
        <div class="stats">
            <div class="stats-number">{len(compounds)}</div>
            <div>個有機化合物結構式</div>
        </div>
"""
    
    # 按類別分組
    categories = {}
    for compound in compounds:
        cat = compound['category']
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(compound)
    
    # 生成每個類別的HTML
    for cat_name, cat_compounds in sorted(categories.items()):
        cat_display = f"{cat_name} ({cat_compounds[0]['cat_zh']})"
        html += f"""
        <div class="category">
            <div class="category-title">{cat_display}</div>
            <div class="compounds">
"""
        for compound in cat_compounds:
            filename = f"{compound['category']}_{compound['en_name']}.svg"
            svg_path = f"{compound['category']}/{filename}"
            compound_name = compound['name']
            compound_smiles = compound['smiles']
            html += f"""
                <div class="compound-item">
                    <a href="{svg_path}" target="_blank">
                        <img src="{svg_path}" alt="{compound_name}">
                    </a>
                    <div class="compound-name">{compound_name}</div>
                    <div class="compound-filename">{filename}</div>
                    <div class="compound-smiles">{compound_smiles}</div>
                    <a href="{svg_path}" download="{filename}" class="download-btn">
                        ⬇️ 下載SVG
                    </a>
                </div>
"""
        html += """
            </div>
        </div>
"""
    
    html += """
    </div>
</body>
</html>
"""
    
    index_path = os.path.join(output_dir, "index.html")
    with open(index_path, 'w', encoding='utf-8') as f:
        f.write(html)
    
    print(f"✓ 索引文件: index.html")

if __name__ == "__main__":
    print("=" * 60)
    print("🎨 有機化合物SVG生成器 - 可配置版 v1.0")
    print("=" * 60)
    generate_svgs()
    print("\n" + "=" * 60)
    print("✅ 全部完成！請開啟 index.html 查看結果")
    print("=" * 60)
