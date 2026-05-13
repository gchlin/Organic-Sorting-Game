#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
官能基SVG生成器 - 模仿 generate_svg_configurable.py 格式
14種官能基，圖全放在 00_functional_groups/ 下
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from rdkit import Chem
from rdkit.Chem import Draw, AllChem
import os, json, re, math
from datetime import datetime
import xml.etree.ElementTree as ET

# ========== 樣式配置 ==========
SHOW_ALL_CARBONS     = True    # 顯示所有碳原子標籤
SHOW_ALL_HYDROGENS   = False   # 官能基圖不展開H，保持整潔
USE_ELEMENT_COLORS   = True    # 元素顏色 (O紅、N藍、Cl綠...)
TRANSPARENT_BG       = False   # 透明背景
KEKULIZE_STRUCTURE   = False   # False=圓圈形式苯環, True=Kekule形式(帶雙鍵六邊形)

IMAGE_WIDTH  = 400
IMAGE_HEIGHT = 300
BOND_WIDTH   = 2.0

OUTPUT_DIR = "00_functional_groups"
# ==============================

# 14種官能基：name用於檔名，smiles盡量只保留官能基的最小代表結構
functional_groups = [
    # 01 烷烴   - C-C 單鍵 (乙烷)
    {"id": "01", "en": "alkane",         "zh": "烷烴",  "smiles": "CC"},
    # 02 烯烴   - C=C 雙鍵 (乙烯)
    {"id": "02", "en": "alkene",         "zh": "烯烴",  "smiles": "C=C"},
    # 03 炔烴   - C≡C 三鍵 (乙炔)
    {"id": "03", "en": "alkyne",         "zh": "炔烴",  "smiles": "C#C"},
    # 04 醇     - -OH (甲醇)
    {"id": "04", "en": "alcohol",        "zh": "醇",    "smiles": "CO"},
    # 05 醛     - -CHO (乙醛，比甲醛更能區分醛基)
    {"id": "05", "en": "aldehyde",       "zh": "醛",    "smiles": "CC=O"},
    # 06 酮     - C(=O)C (丙酮)
    {"id": "06", "en": "ketone",         "zh": "酮",    "smiles": "CC(C)=O"},
    # 07 羧酸   - -COOH (乙酸)
    {"id": "07", "en": "carboxylic_acid","zh": "羧酸",  "smiles": "CC(=O)O"},
    # 08 酯     - -COO- (乙酸甲酯)
    {"id": "08", "en": "ester",          "zh": "酯",    "smiles": "COC(C)=O"},
    # 09 醚     - -O- (二甲醚)
    {"id": "09", "en": "ether",          "zh": "醚",    "smiles": "COC"},
    # 10 胺     - -NH2 (甲胺)
    {"id": "10", "en": "amine",          "zh": "胺",    "smiles": "CN"},
    # 11 芳香烴 - 苯環 (苯)
    {"id": "11", "en": "aromatic",       "zh": "芳香烴","smiles": "c1ccccc1"},
    # 12 鹵化物 - -Cl (氯乙烷)
    {"id": "12", "en": "halide",         "zh": "鹵化物","smiles": "CCl"},
    # 13 酚     - Ar-OH (苯酚)
    {"id": "13", "en": "phenol",         "zh": "酚",    "smiles": "Oc1ccccc1"},
    # 14 芳香胺 - Ar-NH2 (苯胺)
    {"id": "14", "en": "aromatic_amine", "zh": "芳香胺","smiles": "Nc1ccccc1"},
]

def add_aromatic_circle(svg):
    """在苯環中心添加圓圈以表示芳香性"""
    try:
        # 提取所有坐標來找到中心
        coordinates = re.findall(r'M\s+([\d.]+),([\d.]+)\s+L', svg)
        if len(coordinates) >= 6:
            # 計算六邊形中心
            x_vals = [float(c[0]) for c in coordinates[:6]]
            y_vals = [float(c[1]) for c in coordinates[:6]]
            center_x = sum(x_vals) / len(x_vals)
            center_y = sum(y_vals) / len(y_vals)

            # 計算半徑
            radius = math.sqrt((x_vals[0] - center_x)**2 + (y_vals[0] - center_y)**2) * 0.5

            # 在 SVG 中插入圓圈（在 </svg> 前）
            circle = f'<circle cx="{center_x:.1f}" cy="{center_y:.1f}" r="{radius:.1f}" style="fill:none;stroke:#000000;stroke-width:2.0px" />'
            svg = svg.replace('</svg>', f'{circle}</svg>')
    except:
        pass
    return svg

def apply_black_color(svg):
    svg = re.sub(r'stroke:#[0-9A-Fa-f]{6}', 'stroke:#000000', svg)
    svg = re.sub(r'fill:#[0-9A-Fa-f]{6}(?!;)',  'fill:#000000',  svg)
    return svg

def make_transparent(svg):
    svg = re.sub(
        r'<rect[^>]*width=[\'"]400\.0[\'"][^>]*/?>',
        '', svg, flags=re.MULTILINE
    )
    return svg

def draw_fg(smiles, filepath, kekule=None):
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return False

    # Kekule vs 圓圈形式處理
    use_kekule = KEKULIZE_STRUCTURE if kekule is None else kekule
    is_aromatic = 'c' in smiles.lower()  # 偵測是否含芳香碳

    if use_kekule:
        # 強制 Kekule 形式 - 顯示單雙鍵
        try:
            Chem.Kekulize(mol, clearAromaticFlags=True)
        except:
            pass
    else:
        # 圓圈形式 - 保持芳香標記
        try:
            Chem.SanitizeMol(mol)
            Chem.SetAromaticity(mol)
        except:
            pass

    AllChem.Compute2DCoords(mol)

    if SHOW_ALL_CARBONS:
        for atom in mol.GetAtoms():
            if atom.GetSymbol() == 'C':
                atom.SetProp('atomLabel', 'C')

    if SHOW_ALL_HYDROGENS:
        mol = Chem.AddHs(mol)

    drawer = Draw.MolDraw2DSVG(IMAGE_WIDTH, IMAGE_HEIGHT)
    opts = drawer.drawOptions()
    opts.bondLineWidth = BOND_WIDTH

    drawer.DrawMolecule(mol)
    drawer.FinishDrawing()
    svg = drawer.GetDrawingText()

    if not USE_ELEMENT_COLORS:
        svg = apply_black_color(svg)
    if TRANSPARENT_BG:
        svg = make_transparent(svg)

    # 圓圈形式的芳香烴添加圓圈
    if not use_kekule and is_aromatic:
        svg = add_aromatic_circle(svg)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(svg)
    return True

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("=" * 55)
    print("官能基SVG生成器")
    print("=" * 55)

    success = 0
    records = []

    for fg in functional_groups:
        # 檔名格式: 00_fg_01_alkane.svg
        filename = "fg_%s_%s.svg" % (fg["id"], fg["en"])
        filepath = os.path.join(OUTPUT_DIR, filename)

        ok = draw_fg(fg["smiles"], filepath, kekule=False)
        status = "OK" if ok else "FAIL"
        print("[%s/%s] %-6s %-16s -> %s" % (fg["id"], "14", status, fg["zh"], filename))
        if ok:
            success += 1
            records.append({
                "id": int(fg["id"]),
                "en_name": fg["en"],
                "zh_name": fg["zh"],
                "smiles": fg["smiles"],
                "file": filename
            })

        # 只有苯環(aromatic)生成第二個版本 - Kekule形式
        if fg["en"] == "aromatic":
            filename_kekule = "fg_%s_%s_kekule.svg" % (fg["id"], fg["en"])
            filepath_kekule = os.path.join(OUTPUT_DIR, filename_kekule)
            ok_kekule = draw_fg(fg["smiles"], filepath_kekule, kekule=True)
            status_kekule = "OK" if ok_kekule else "FAIL"
            print("  └─ [Kekule] %-6s %-16s -> %s" % (status_kekule, fg["zh"] + " (單雙鍵形式)", filename_kekule))
            if ok_kekule:
                records.append({
                    "id": int(fg["id"]),
                    "en_name": fg["en"] + "_kekule",
                    "zh_name": fg["zh"] + " (單雙鍵形式)",
                    "smiles": fg["smiles"],
                    "file": filename_kekule
                })

    # JSON 索引
    json_path = os.path.join(OUTPUT_DIR, "functional_groups_map.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump({
            "generated": datetime.now().isoformat(),
            "total": success,
            "groups": records
        }, f, ensure_ascii=False, indent=2)

    print("=" * 55)
    print("完成: %d / 14" % success)
    print("路徑: %s/" % OUTPUT_DIR)
    print("JSON: %s" % json_path)

if __name__ == "__main__":
    main()
