#!/usr/bin/env python3
from rdkit import Chem
from rdkit.Chem import Draw, AllChem

COLORS = {
    "crimson":   (0.753, 0.224, 0.169),  # #c0392b - 醇、羧基
    "gold":      (0.831, 0.686, 0.216),  # #d4af37 - 醚、酯基、烷烯炔
    "emerald":   (0.153, 0.682, 0.376),  # #27ae60 - 苯環
    "ravenclaw": (0.290, 0.561, 0.820),  # #4a8fd1 - 醛、胺
    "amethyst":  (0.608, 0.427, 0.780),  # #9b6dc7 - 酮
}

# ========== Bonds Highlighting Example ==========
mol = Chem.MolFromSmiles("CCO")  # 乙醇
mol = Chem.AddHs(mol)
AllChem.Compute2DCoords(mol)

for atom in mol.GetAtoms():
    if atom.GetAtomicNum() == 6:
        atom.SetAtomMapNum(0)
        atom.SetProp("atomLabel", "C")
    elif atom.GetAtomicNum() == 8:
        atom.SetAtomMapNum(0)
        atom.SetProp("atomLabel", "O")

# 找 C-O-H 中的 O 原子
oxygen_matches = mol.GetSubstructMatches(Chem.MolFromSmarts('[O]'))
oxygen_atoms = set()
for match in oxygen_matches:
    oxygen_atoms.update(match)

# 著色連接到 O 的化學鍵（C-O 和 O-H）
highlightBonds = []
for bond in mol.GetBonds():
    begin_idx = bond.GetBeginAtomIdx()
    end_idx = bond.GetEndAtomIdx()
    if begin_idx in oxygen_atoms or end_idx in oxygen_atoms:
        highlightBonds.append(bond.GetIdx())

highlightBondColors = {idx: COLORS["crimson"] for idx in highlightBonds}

d2d = Draw.MolDraw2DSVG(400, 300)
dopts = d2d.drawOptions()
dopts.addAtomIndices = False
dopts.fillHighlights = True
dopts.highlightBondWidthMultiplier = 8

d2d.DrawMolecule(mol, highlightAtoms=[], highlightBonds=highlightBonds,
                 highlightBondColors=highlightBondColors)
d2d.FinishDrawing()

with open("hightlight_example_output.svg", "w") as f:
    f.write(d2d.GetDrawingText())

print("saved: hightlight_example_output.svg (乙醇 - C-O-H著色)")