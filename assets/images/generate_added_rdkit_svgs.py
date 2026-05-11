#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate first-batch expansion SVGs in the same RDKit style as the existing
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
    {"name": "丁烷", "en_name": "butane", "smiles": "CCCC", "category": "01_alkane", "cat_zh": "烷烴"},
    {"name": "異丁烷", "en_name": "isobutane", "smiles": "CC(C)C", "category": "01_alkane", "cat_zh": "烷烴"},
    {"name": "環己烷", "en_name": "cyclohexane", "smiles": "C1CCCCC1", "category": "01_alkane", "cat_zh": "烷烴"},
    {"name": "環丙烷", "en_name": "cyclopropane", "smiles": "C1CC1", "category": "01_alkane", "cat_zh": "烷烴"},
    {"name": "2-丁烯", "en_name": "2-butene", "smiles": "CC=CC", "category": "02_alkene", "cat_zh": "烯烴"},
    {"name": "1,3-丁二烯", "en_name": "1,3-butadiene", "smiles": "C=CC=C", "category": "02_alkene", "cat_zh": "烯烴"},
    {"name": "環己烯", "en_name": "cyclohexene", "smiles": "C1=CCCCC1", "category": "02_alkene", "cat_zh": "烯烴"},
    {"name": "1-丁炔", "en_name": "1-butyne", "smiles": "C#CCC", "category": "03_alkyne", "cat_zh": "炔烴"},
    {"name": "2-丁炔", "en_name": "2-butyne", "smiles": "CC#CC", "category": "03_alkyne", "cat_zh": "炔烴"},
    {"name": "2-丙醇", "en_name": "isopropanol", "smiles": "CC(O)C", "category": "04_alcohol", "cat_zh": "醇"},
    {"name": "第三丁醇", "en_name": "tert-butanol", "smiles": "CC(C)(C)O", "category": "04_alcohol", "cat_zh": "醇"},
    {"name": "乙二醇", "en_name": "ethylene_glycol", "smiles": "OCCO", "category": "04_alcohol", "cat_zh": "醇"},
    {"name": "丙三醇（甘油）", "en_name": "glycerol", "smiles": "OCC(O)CO", "category": "04_alcohol", "cat_zh": "醇"},
    {"name": "環己醇", "en_name": "cyclohexanol", "smiles": "OC1CCCCC1", "category": "04_alcohol", "cat_zh": "醇"},
    {"name": "丁醛", "en_name": "butanal", "smiles": "CCCC=O", "category": "05_aldehyde", "cat_zh": "醛"},
    {"name": "2-戊酮", "en_name": "2-pentanone", "smiles": "CC(=O)CCC", "category": "06_ketone", "cat_zh": "酮"},
    {"name": "3-戊酮", "en_name": "3-pentanone", "smiles": "CCC(=O)CC", "category": "06_ketone", "cat_zh": "酮"},
    {"name": "環己酮", "en_name": "cyclohexanone", "smiles": "O=C1CCCCC1", "category": "06_ketone", "cat_zh": "酮"},
    {"name": "苯乙酮", "en_name": "acetophenone", "smiles": "CC(=O)c1ccccc1", "category": "06_ketone", "cat_zh": "酮"},
    {"name": "丁酸", "en_name": "butyric_acid", "smiles": "CCCC(=O)O", "category": "07_carboxylic", "cat_zh": "羧酸"},
    {"name": "草酸", "en_name": "oxalic_acid", "smiles": "O=C(O)C(=O)O", "category": "07_carboxylic", "cat_zh": "羧酸"},
    {"name": "乙酸異戊酯", "en_name": "isoamyl_acetate", "smiles": "CC(=O)OCCC(C)C", "category": "08_ester", "cat_zh": "酯"},
    {"name": "丁酸乙酯", "en_name": "ethyl_butyrate", "smiles": "CCCC(=O)OCC", "category": "08_ester", "cat_zh": "酯"},
    {"name": "苯甲酸甲酯", "en_name": "methyl_benzoate", "smiles": "COC(=O)c1ccccc1", "category": "08_ester", "cat_zh": "酯"},
    {"name": "甲乙醚", "en_name": "ethyl_methyl_ether", "smiles": "COCC", "category": "09_ether", "cat_zh": "醚"},
    {"name": "環氧乙烷", "en_name": "ethylene_oxide", "smiles": "C1CO1", "category": "09_ether", "cat_zh": "醚"},
    {"name": "苯甲醚", "en_name": "anisole", "smiles": "COc1ccccc1", "category": "09_ether", "cat_zh": "醚"},
    {"name": "三甲胺", "en_name": "trimethylamine", "smiles": "CN(C)C", "category": "10_amine", "cat_zh": "胺"},
    {"name": "乙二胺", "en_name": "ethylenediamine", "smiles": "NCCN", "category": "10_amine", "cat_zh": "胺"},
    {"name": "鄰-二甲苯", "en_name": "o-xylene", "smiles": "Cc1ccccc1C", "category": "11_aromatic", "cat_zh": "芳香烴"},
    {"name": "間-二甲苯", "en_name": "m-xylene", "smiles": "Cc1cccc(C)c1", "category": "11_aromatic", "cat_zh": "芳香烴"},
    {"name": "對-二甲苯", "en_name": "p-xylene", "smiles": "Cc1ccc(C)cc1", "category": "11_aromatic", "cat_zh": "芳香烴"},
    {"name": "乙苯", "en_name": "ethylbenzene", "smiles": "CCc1ccccc1", "category": "11_aromatic", "cat_zh": "芳香烴"},
    {"name": "萘", "en_name": "naphthalene", "smiles": "c1ccc2ccccc2c1", "category": "11_aromatic", "cat_zh": "芳香烴"},
    {"name": "二氯甲烷", "en_name": "dichloromethane", "smiles": "ClCCl", "category": "12_halide", "cat_zh": "鹵化物"},
    {"name": "三氯甲烷（氯仿）", "en_name": "chloroform", "smiles": "ClC(Cl)Cl", "category": "12_halide", "cat_zh": "鹵化物"},
    {"name": "碘甲烷", "en_name": "iodomethane", "smiles": "CI", "category": "12_halide", "cat_zh": "鹵化物"},
    {"name": "氯乙烯", "en_name": "vinyl_chloride", "smiles": "C=CCl", "category": "12_halide", "cat_zh": "鹵化物"},
    {"name": "鄰-甲酚", "en_name": "o-cresol", "smiles": "Cc1ccccc1O", "category": "14_phenol", "cat_zh": "酚"},
    {"name": "間-甲酚", "en_name": "m-cresol", "smiles": "Cc1cccc(O)c1", "category": "14_phenol", "cat_zh": "酚"},
    {"name": "對-甲酚", "en_name": "p-cresol", "smiles": "Cc1ccc(O)cc1", "category": "14_phenol", "cat_zh": "酚"},
    {"name": "兒茶酚", "en_name": "catechol", "smiles": "Oc1ccccc1O", "category": "14_phenol", "cat_zh": "酚"},
    {"name": "間苯二酚", "en_name": "resorcinol", "smiles": "Oc1cccc(O)c1", "category": "14_phenol", "cat_zh": "酚"},
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
