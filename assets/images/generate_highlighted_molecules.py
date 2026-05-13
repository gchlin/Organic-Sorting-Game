#!/usr/bin/env python3
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from rdkit import Chem
from rdkit.Chem import Draw, AllChem
from pathlib import Path

COLORS = {
    "crimson":   (0.753, 0.224, 0.169),  # #c0392b - 醇、羧基
    "gold":      (0.831, 0.686, 0.216),  # #d4af37 - 醚、酯基
    "emerald":   (0.153, 0.682, 0.376),  # #27ae60 - 苯環
    "ravenclaw": (0.290, 0.561, 0.820),  # #4a8fd1 - 醛、胺
    "amethyst":  (0.608, 0.427, 0.780),  # #9b6dc7 - 酮
}

# (smiles, smarts_to_highlight, color_name, highlight_mode, folder, filename)
# highlight_mode: "atoms" or "bonds"
MOLECULES = [
    # 01_alkane  ── C-C single bonds → gold
    ("CC",      "[C][C]", "gold", "bonds", "01_alkane", "01_alkane_ethane"),
    ("CCC",     "[C][C]", "gold", "bonds", "01_alkane", "01_alkane_propane"),

    # 02_alkene  ── C=C double bonds → gold
    ("C=C",     "[C]=[C]", "gold", "bonds", "02_alkene", "02_alkene_ethene"),

    # 03_alkyne  ── C#C triple bonds → gold
    ("C#C",     "[C]#[C]", "gold", "bonds", "03_alkyne", "03_alkyne_ethyne"),

    # 11_aromatic  ── benzene ring → emerald
    ("c1ccccc1",  "a1aaaaa1", "emerald", "atoms", "11_aromatic", "11_aromatic_benzene"),
    ("Cc1ccccc1", "a1aaaaa1", "emerald", "atoms", "11_aromatic", "11_aromatic_toluene"),

    # 04_alcohol  ── C-O-H → crimson (O atom in black)
    ("CCO",    "[O]", "crimson", "bonds_mark_O", "04_alcohol", "04_alcohol_ethanol"),
    ("CCCO",   "[O]", "crimson", "bonds_mark_O", "04_alcohol", "04_alcohol_propanol"),
    ("CC(C)O", "[O]", "crimson", "bonds_mark_O", "04_alcohol", "04_alcohol_isopropanol"),
    ("OCCO",   "[O]", "crimson", "bonds_mark_O", "04_alcohol", "04_alcohol_ethylene_glycol"),

    # 09_ether  ── -O- → gold
    ("COC",    "[C,N,S][O;D2][C,N,S]", "gold", "atoms", "09_ether", "09_ether_dimethyl_ether"),
    ("CCOC",   "[C,N,S][O;D2][C,N,S]", "gold", "atoms", "09_ether", "09_ether_ethyl_methyl_ether"),
    ("C1CO1",  "[C,N,S][O;D2][C,N,S]", "gold", "atoms", "09_ether", "09_ether_ethylene_oxide"),
]

BASE_DIR = Path(__file__).parent

def generate(smiles, smarts, color_name, highlight_mode, folder, filename):
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        print(f"✗ SMILES 解析失敗: {smiles}")
        return

    mol = Chem.AddHs(mol)
    AllChem.Compute2DCoords(mol)

    # 強制顯示所有碳原子標籤，以及醇類中的 O 標籤
    for atom in mol.GetAtoms():
        if atom.GetAtomicNum() == 6:
            atom.SetAtomMapNum(0)
            atom.SetProp("atomLabel", "C")
        elif atom.GetAtomicNum() == 8 and "alcohol" in folder:
            atom.SetAtomMapNum(0)
            atom.SetProp("atomLabel", "O")

    highlightAtoms = []
    highlightBonds = []
    highlightAtomColors = {}
    highlightBondColors = {}

    if smarts:
        matches = mol.GetSubstructMatches(Chem.MolFromSmarts(smarts))
        for match in matches:
            highlightAtoms.extend(match)

        if highlight_mode.startswith("bonds"):
            # 找連接到 highlighted atoms 的 bonds
            atom_set = set(highlightAtoms)
            for bond in mol.GetBonds():
                begin_idx = bond.GetBeginAtomIdx()
                end_idx = bond.GetEndAtomIdx()
                # 對於 C-C/C=C/C#C：兩端都要是 highlighted atoms
                # 對於 C-O-H：只要有一端是 highlighted atom (O)
                if smarts in ["[C][C]", "[C]=[C]", "[C]#[C]"]:
                    if begin_idx in atom_set and end_idx in atom_set:
                        highlightBonds.append(bond.GetIdx())
                else:
                    if begin_idx in atom_set or end_idx in atom_set:
                        highlightBonds.append(bond.GetIdx())

            highlightBondColors = {idx: COLORS[color_name] for idx in highlightBonds}
            print(f"  ✓ 著色 {color_name}: {len(highlightBonds)} 條化學鍵")

            # 如果是 bonds_mark_O，記錄 O 原子索引以便後處理
            if highlight_mode == "bonds_mark_O":
                pass  # 稍後在 SVG 後處理
        else:
            # atoms mode
            highlightAtomColors = {idx: COLORS[color_name] for idx in highlightAtoms}
            print(f"  ✓ 著色 {color_name}: {len(matches)} 個匹配")
    else:
        print(f"  ℹ️  無官能基，純結構")

    d2d = Draw.MolDraw2DSVG(400, 300)
    dopts = d2d.drawOptions()
    dopts.addAtomIndices = False
    dopts.fillHighlights = True
    dopts.highlightBondWidthMultiplier = 8

    if highlight_mode.startswith("bonds"):
        # bonds mode：只著色bonds，atom顏色靠後處理
        d2d.DrawMolecule(mol, highlightAtoms=[], highlightBonds=highlightBonds,
                        highlightBondColors=highlightBondColors)
    else:
        d2d.DrawMolecule(mol, highlightAtoms=highlightAtoms, highlightAtomColors=highlightAtomColors)
    d2d.FinishDrawing()
    svg_text = d2d.GetDrawingText()

    # 如果是 bonds_mark_O，改變 O 字體顏色為黑色
    if highlight_mode == "bonds_mark_O":
        import re
        # 找到所有 O 原子並改其文字顏色為黑色
        for atom_idx in highlightAtoms:
            atom = mol.GetAtomWithIdx(atom_idx)
            if atom.GetAtomicNum() == 8:  # O 原子
                # 替換 <path class='atom-{atom_idx}' ... fill='...' /> 中的顏色
                pattern = rf"(<path class='atom-{atom_idx}'[^>]*fill=')[^']*(')"
                svg_text = re.sub(pattern, r"\1#000000\2", svg_text)

    out_dir = BASE_DIR / folder
    out_dir.mkdir(exist_ok=True)
    out_file = out_dir / f"{filename}_highlight.svg"
    with open(out_file, "w", encoding="iso-8859-1") as f:
        f.write(svg_text)
    print(f"  ✓ {out_file}")


def main():
    print("=" * 70)
    print("著色分子圖生成工具")
    print("=" * 70)
    for smiles, smarts, color_name, highlight_mode, folder, filename in MOLECULES:
        print(f"\n【{filename}】  SMILES: {smiles}")
        generate(smiles, smarts, color_name, highlight_mode, folder, filename)


if __name__ == "__main__":
    main()