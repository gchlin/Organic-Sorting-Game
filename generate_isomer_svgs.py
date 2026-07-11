# generate_isomer_svgs.py — 異構物關卡的「左右並排合成圖」
#
# 題面要同時看到兩個分子才判得出是哪種異構物，所以每一題產一張把兩個分子
# 並排畫在一起的 SVG（沿用既有題圖的設定：400x300/格、白底、AddHs 顯式畫氫、
# 元素配色）。個別分子不進 QuestionImages，只存在於這張合成圖裡。
#
# 立體化學不用猜：順/反的標定由 RDKit 驗證（見 verify_* ），驗不過就中止。
#
# 用法：python generate_isomer_svgs.py

import os
import sys
from rdkit import Chem
from rdkit.Chem import Draw
from rdkit.Chem.Draw import rdMolDraw2D

OUT_DIR = os.path.join("assets", "images", "20_isomer")
PANEL_W, PANEL_H = 400, 300

# (檔名, 異構物種類, 左分子(名, SMILES), 右分子(名, SMILES))
PAIRS = [
    # 鏈異構物：碳骨架排列不同
    ("iso_chain_butane",        "chain",      ("正丁烷", "CCCC"),        ("異丁烷", "CC(C)C")),
    ("iso_chain_pentane",       "chain",      ("正戊烷", "CCCCC"),       ("異戊烷", "CCC(C)C")),
    # 位置異構物：官能基/雙鍵位置不同
    ("iso_position_propanol",   "position",   ("1-丙醇", "CCCO"),        ("2-丙醇", "CC(O)C")),
    ("iso_position_butene",     "position",   ("1-丁烯", "C=CCC"),       ("2-丁烯", "CC=CC")),
    ("iso_position_xylene",     "position",   ("鄰-二甲苯", "Cc1ccccc1C"), ("間-二甲苯", "Cc1cccc(C)c1")),
    ("iso_position_cresol",     "position",   ("鄰-甲酚", "Cc1ccccc1O"),  ("對-甲酚", "Cc1ccc(O)cc1")),
    # 官能基異構物：分子式相同但官能基不同
    ("iso_functional_c2h6o",    "functional", ("乙醇", "CCO"),           ("二甲醚", "COC")),
    ("iso_functional_c3h6o",    "functional", ("丙醛", "CCC=O"),         ("丙酮", "CC(C)=O")),
    ("iso_functional_c2h4o2",   "functional", ("乙酸", "CC(=O)O"),       ("甲酸甲酯", "COC=O")),
    ("iso_functional_c4h8o2",   "functional", ("丁酸", "CCCC(=O)O"),     ("乙酸乙酯", "CCOC(C)=O")),
    # 順反異構物（立體異構物）：雙鍵/環不可繞軸旋轉，取代基同側=順、異側=反
    ("iso_cistrans_dichloroethene", "cistrans",
     ("順-1,2-二氯乙烯", r"Cl/C=C\Cl"), ("反-1,2-二氯乙烯", "Cl/C=C/Cl")),
    # 順式=兩甲基同側=內消旋(meso)；反式=異側=掌性。標定經 verify_ring_cistrans 驗證。
    ("iso_cistrans_dimethylcyclopropane", "cistrans",
     ("順-1,2-二甲基環丙烷", "C[C@H]1C[C@H]1C"), ("反-1,2-二甲基環丙烷", "C[C@H]1C[C@@H]1C")),
]


def verify_alkene_cistrans(cis_smiles, trans_smiles):
    """雙鍵順反：RDKit 直接給 bond stereo（STEREOZ=順、STEREOE=反）。"""
    def bond_stereo(smi):
        m = Chem.MolFromSmiles(smi)
        Chem.AssignStereochemistry(m, cleanIt=True, force=True)
        for b in m.GetBonds():
            if b.GetStereo() != Chem.BondStereo.STEREONONE:
                return str(b.GetStereo())
        return "NONE"
    cis, trans = bond_stereo(cis_smiles), bond_stereo(trans_smiles)
    ok = cis == "STEREOZ" and trans == "STEREOE"
    print(f"    驗證雙鍵順反: 順={cis} 反={trans} -> {'OK' if ok else 'FAIL'}")
    return ok


def verify_ring_cistrans(cis_smiles, trans_smiles):
    """環上順反：cis-1,2-二甲基環丙烷是內消旋(meso)＝與自己的鏡像相同；
    trans 是掌性＝與鏡像不同。用這個性質驗證，不靠人工判讀 @/@@。"""
    def is_meso(smi):
        m = Chem.MolFromSmiles(smi)
        canon = Chem.MolToSmiles(m)
        mirror = Chem.MolFromSmiles(canon.replace("@@", "\x00").replace("@", "@@").replace("\x00", "@"))
        return canon == Chem.MolToSmiles(mirror)
    cis_meso, trans_meso = is_meso(cis_smiles), is_meso(trans_smiles)
    ok = cis_meso and not trans_meso
    print(f"    驗證環上順反: 順=meso({cis_meso}) 反=meso({trans_meso}) -> {'OK' if ok else 'FAIL'}")
    return ok


def draw_pair(left, right, path):
    mols = []
    for name, smi in (left, right):
        m = Chem.MolFromSmiles(smi)
        if m is None:
            raise ValueError(f"SMILES 解析失敗: {name} {smi}")
        m = Chem.AddHs(m)                      # 顯式畫氫，跟既有題圖一致
        Chem.rdDepictor.Compute2DCoords(m)
        Chem.rdDepictor.StraightenDepiction(m)
        mols.append(m)

    d = rdMolDraw2D.MolDraw2DSVG(PANEL_W * 2, PANEL_H, PANEL_W, PANEL_H)
    opts = d.drawOptions()
    # 題面不能寫名字也不能標記號：「順-1,2-二氯乙烯」「(Z)」等於把答案印在題目上。
    # 學生要純粹從結構判斷這兩個分子是哪一種異構物。
    opts.addStereoAnnotation = False
    opts.bondLineWidth = 2
    d.DrawMolecules(mols)                      # 不給 legends
    d.FinishDrawing()
    svg = d.GetDrawingText()

    # 中線：讓「這是兩個分子」一眼看得出來
    divider = (f"<line x1='{PANEL_W}' y1='18' x2='{PANEL_W}' y2='{PANEL_H - 18}' "
               f"style='stroke:#c9c2b0;stroke-width:2;stroke-dasharray:6,5' />")
    svg = svg.replace("</svg>", divider + "</svg>")

    with open(path, "w", encoding="utf-8") as f:
        f.write(svg)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    print("驗證立體化學標定：")
    ok = True
    for fname, kind, left, right in PAIRS:
        if kind != "cistrans":
            continue
        print(f"  {fname}")
        if "cyclopropane" in fname:
            ok &= verify_ring_cistrans(left[1], right[1])
        else:
            ok &= verify_alkene_cistrans(left[1], right[1])
    if not ok:
        print("\n立體化學驗證失敗 — 不產圖。")
        sys.exit(1)

    print("\n產圖：")
    for fname, kind, left, right in PAIRS:
        path = os.path.join(OUT_DIR, f"{fname}.svg")
        draw_pair(left, right, path)
        print(f"  [{kind:10s}] {path}  ({left[0]} | {right[0]})")

    print(f"\n完成，共 {len(PAIRS)} 張合成圖。")


if __name__ == "__main__":
    main()
