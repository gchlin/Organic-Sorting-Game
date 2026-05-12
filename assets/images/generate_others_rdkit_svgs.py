#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate other functional groups SVGs in the same RDKit style as the existing
assets/images molecule files.
"""

from pathlib import Path

from rdkit import Chem
from rdkit.Chem import Draw

SHOW_ALL_CARBONS = True
SHOW_ALL_HYDROGENS = True
USE_ELEMENT_COLORS = True
TRANSPARENT_BACKGROUND = False

IMAGE_WIDTH = 400
IMAGE_HEIGHT = 300
BOND_LINE_WIDTH = 2.0

BASE_DIR = Path(__file__).resolve().parent

COMPOUNDS = [
    {"name": "乙醯胺",        "en_name": "acetamide",           "smiles": "CC(N)=O",               "category": "15_amide",         "cat_zh": "醯胺"},
    {"name": "丙醯胺",        "en_name": "propanamide",         "smiles": "CCC(N)=O",              "category": "15_amide",         "cat_zh": "醯胺"},
    {"name": "N-甲基乙醯胺",  "en_name": "n-methylacetamide",   "smiles": "CNC(C)=O",              "category": "15_amide",         "cat_zh": "醯胺"},
    {"name": "尿素",          "en_name": "urea",                "smiles": "NC(N)=O",               "category": "15_amide",         "cat_zh": "醯胺"},
    {"name": "苯甲醯胺",      "en_name": "benzamide",           "smiles": "NC(=O)c1ccccc1",        "category": "15_amide",         "cat_zh": "醯胺"},
    {"name": "硝基甲烷",      "en_name": "nitromethane",        "smiles": "C[N+](=O)[O-]",         "category": "16_nitro",         "cat_zh": "硝基化合物"},
    {"name": "硝基乙烷",      "en_name": "nitroethane",         "smiles": "CC[N+](=O)[O-]",        "category": "16_nitro",         "cat_zh": "硝基化合物"},
    {"name": "硝基苯",        "en_name": "nitrobenzene",        "smiles": "[O-][N+](=O)c1ccccc1",  "category": "16_nitro",         "cat_zh": "硝基化合物"},
    {"name": "乙腈",          "en_name": "acetonitrile",        "smiles": "CC#N",                  "category": "17_nitrile",       "cat_zh": "腈"},
    {"name": "丙腈",          "en_name": "propanenitrile",      "smiles": "CCC#N",                 "category": "17_nitrile",       "cat_zh": "腈"},
    {"name": "苯甲腈",        "en_name": "benzonitrile",        "smiles": "N#Cc1ccccc1",           "category": "17_nitrile",       "cat_zh": "腈"},
    {"name": "乙酸酐",        "en_name": "acetic_anhydride",    "smiles": "CC(=O)OC(C)=O",         "category": "18_anhydride",     "cat_zh": "酸酐"},
    {"name": "丙酸酐",        "en_name": "propanoic_anhydride", "smiles": "CCC(=O)OC(=O)CC",       "category": "18_anhydride",     "cat_zh": "酸酐"},
    {"name": "乙醯氯",        "en_name": "acetyl_chloride",     "smiles": "CC(Cl)=O",              "category": "19_acyl_chloride", "cat_zh": "醯氯"},
    {"name": "苯甲醯氯",      "en_name": "benzoyl_chloride",    "smiles": "O=C(Cl)c1ccccc1",       "category": "19_acyl_chloride", "cat_zh": "醯氯"},
]


def draw_svg(compound):
    mol = Chem.MolFromSmiles(compound["smiles"])
    if mol is None:
        raise ValueError(f"invalid SMILES: {compound['smiles']}")

    if SHOW_ALL_CARBONS:
        for atom in mol.GetAtoms():
            if atom.GetSymbol() == "C":
                atom.SetProp("atomLabel", "C")

    if SHOW_ALL_HYDROGENS:
        mol = Chem.AddHs(mol)

    drawer = Draw.MolDraw2DSVG(IMAGE_WIDTH, IMAGE_HEIGHT)
    options = drawer.drawOptions()
    options.bondLineWidth = BOND_LINE_WIDTH
    drawer.DrawMolecule(mol)
    drawer.FinishDrawing()
    svg = drawer.GetDrawingText()

    if TRANSPARENT_BACKGROUND:
        svg = svg.replace(
            "<rect style='opacity:1.0;fill:#FFFFFF;stroke:none' width='400.0' height='300.0' x='0.0' y='0.0'> </rect>",
            "",
        )

    return svg


def main():
    for compound in COMPOUNDS:
        target_dir = BASE_DIR / compound["category"]
        target_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{compound['category']}_{compound['en_name']}.svg"
        target = target_dir / filename
        target.write_text(draw_svg(compound), encoding="utf-8")
        print(target)


if __name__ == "__main__":
    main()
