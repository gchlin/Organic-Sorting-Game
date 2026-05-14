from rdkit import Chem
from rdkit.Chem import Draw
from rdkit.Chem.Draw import MolDrawOptions

# 建立分子
molecules = {
    'alkene': 'C=CC(C)C',  # 烯類
    'alkyne': 'C#CC(C)C',  # 炔類
    'benzene': 'c1ccccc1'  # 苯環
}

for name, smiles in molecules.items():
    mol = Chem.MolFromSmiles(smiles)

    # 建立繪圖選項
    draw = Draw.MolDraw2DCairo(300, 300)
    opts = draw.drawOptions()

    # 設置透明背景 (R, G, B, Alpha) -> (1, 1, 1, 0) 表示白色透明
    opts.backgroundColour = (1, 1, 1, 0)

    # 繪製分子
    draw.DrawMolecule(mol)
    draw.FinishDrawing()
    png_data = draw.GetDrawingText()

    # 保存圖像
    output_path = f'assets/images/molecules/{name}.png'
    with open(output_path, 'wb') as f:
        f.write(png_data)

    print(f'Generated: {output_path}')

print('\nAll molecule images created successfully!')
