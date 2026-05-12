# 美術素材生成規格指南（PROMPT_GUIDE）

> 給 Midjourney / DALL·E / Recraft / Stable Diffusion 用的 prompt 模板。  
> 目的：產出的所有圖像看起來像**同一個畫家的同一套作品**。

---

## 一、通用「主題鎖」（每次都貼這 3 段，不要改）

```
STYLE LOCK:
Painted illustration in the style of an illustrated edition of a 
fantasy novel (Jim Kay / Brian Selznick influence) — soft watercolor 
washes, fine ink linework, painterly textures, warm candlelight 
atmosphere, subtle parchment grain. Hand-painted, NOT digital art, 
NOT anime, NOT 3D render, NOT photoreal.

PALETTE LOCK:
Strictly limited palette:
  - parchment cream  #f0e6d2
  - deep wood brown  #3b2e2a
  - magical gold     #d4af37
  - crimson red      #7f0909
  - emerald green    #0f4d0f
  - ink black        #1a1a1d
No neon, no pastel, no oversaturation. Gold used sparingly as accent.

COMPOSITION LOCK:
Centered single subject, 1:1 square (1024×1024).
Subject occupies center 65–70% of frame, generous negative space.
Background: solid dark parchment / aged paper texture, slight vignette.
No text, no logos, no signatures, no UI elements, no borders.
```

---

## 二、需要生成的素材清單（依優先級）

### Tier 1 — 角色立繪（6 張）

用於：**巫師選擇彈窗、對決畫面**

| ID | Prompt 主體段 | 用途 |
|---|---|---|
| `wizard-fire.png` | A determined young wizard apprentice in crimson robes, holding a glowing erlenmeyer flask with red fluid, confident half-smile, short dark hair, freckles | 火系巫師 |
| `wizard-water.png` | A calm young wizard apprentice in deep blue robes, holding a beaker with swirling blue potion, thoughtful expression, long braided hair | 水系巫師 |
| `wizard-earth.png` | A grounded young wizard apprentice in olive-green robes with leather satchel, holding a wooden mortar and pestle, gentle warm smile | 土系巫師 |
| `wizard-wind.png` | A clever young wizard apprentice in pale yellow robes, holding a feathered quill mid-air, mischievous grin, messy windswept hair | 風系巫師 |
| `wizard-shadow.png` | A mysterious young wizard apprentice in charcoal robes with silver trim, hood half-up, holding a vial of swirling black ink, sly smile | 影系巫師 |
| `wizard-light.png` | A radiant young wizard apprentice in cream robes with gold embroidery, holding a glowing crystal phial, kind serene smile | 光系巫師 |

**共用尾段**：
```
Half-body portrait, facing slightly to the right.
Robe details visible. Magical sparkles drifting around the flask.
Single subject only, no other characters.
```

---

### Tier 2 — 關卡 Boss 場景圖（6 張）

用於：**關卡開場、結算 modal 背景、圖鑑解鎖頁**

| ID | 主體段 |
|---|---|
| `level1-hydrocarbon.png` | An ancient stone laboratory with an enormous chalkboard covered in interlocking carbon-hydrogen molecular diagrams, candles flickering, an open chemistry tome on a wooden desk in the foreground |
| `level2-alcohol.png` | A medieval distillery cellar with copper alembics, glass flasks bubbling with clear liquid, oak barrels stacked along the walls, golden afternoon light through stained glass |
| `level3-aldehyde.png` | A perfumer's workshop deep in a wizard tower, dozens of small crystal vials on tiered shelves, drying herbs hanging from rafters, the scent visualized as faint golden mist |
| `level4-acid.png` | A potions master's lab with bubbling cauldrons producing vinegar-yellow fumes, etched copper pipes overhead, drops of acidic liquid eating through a wooden table |
| `level5-halogen.png` | A forbidden chamber of dangerous elements, locked glass cabinets glowing with chlorine-green and bromine-red vapors, brass warning plaques, deep purple shadows |
| `level6-final.png` | The Sorting Hat's grand chamber: enormous floating Sorting Hat at center, surrounded by orbiting molecular models made of glowing wire, dramatic shafts of golden light |

**共用尾段**：
```
Atmospheric scene, no people visible.
Wide composition, depth and atmosphere over detail clarity.
Painterly, slight motion blur in the magical elements.
```

---

### Tier 3 — Icon / Spot Illustration（按需要）

用於：**勳章、徽章、解鎖獎勵**

| ID | 主體段 |
|---|---|
| `badge-first-clear.png` | A single golden laurel-framed medal showing a small flask icon at center, embossed metal, ribbon trailing below |
| `badge-perfect-score.png` | A golden sorting hat embossed on a circular medallion, surrounded by tiny stars, ribbon below |
| `badge-speedrun.png` | A bronze medallion showing an hourglass with sand mid-fall, lightning bolts on either side |
| `badge-duel-master.png` | A silver medallion with two crossed wands, small flame and ice motifs at the cross point |

**共用尾段**：
```
Single icon, centered, transparent background (if supported) 
or solid parchment color. Studio lighting, metallic specular highlights.
```

---

## 三、生成後處理規範

1. **檔名規格**：`<id>.webp`，全部小寫、用連字號、不含中文
2. **尺寸**：
   - 角色立繪：512×512 (WEBP, quality 85)
   - 場景圖：1024×768 (WEBP, quality 80)
   - 勳章：256×256 (WEBP, quality 90)
3. **背景處理**：角色立繪請用 `remove.bg` 去背成透明，方便疊在不同底色上
4. **存放路徑**：
   ```
   assets/
   ├── characters/    ← 角色立繪
   ├── scenes/        ← 場景圖
   └── badges/        ← 勳章
   ```

---

## 四、推薦工具與成本估算

| 工具 | 月費 | 適合 | 風格控制 |
|---|---|---|---|
| **Midjourney** | $10 / 月起 | 插畫風、Jim Kay 風格最強 | ⭐⭐⭐⭐⭐ |
| **Recraft.ai** | 免費額度 / $12 | 風格一致性最好（可訓練 style） | ⭐⭐⭐⭐⭐ |
| **DALL·E 3** (ChatGPT) | 已含 | 中文 prompt 友善、構圖穩定 | ⭐⭐⭐⭐ |
| **Stable Diffusion XL** | 免費（本機） | 完全可控，需 GPU | ⭐⭐⭐⭐⭐ |
| **NovelAI** | $10 / 月 | 動漫風（**不適合**這個主題） | ⭐⭐ |

**建議流程**：
1. 用 Midjourney `--style raw --v 6.1 --ar 1:1` 生 6 張角色，挑 1 張當「種子」
2. 用 Recraft 上傳種子訓練成 style，後續所有圖都用這個 style 跑
3. 場景圖用 `--ar 4:3 --style raw` 生

**全套素材總成本**：約 **$10–15** 一個月、產出 16 張即可全部交付。

---

## 五、品質檢查清單

每張圖產出後，逐項打勾才算過關：

- [ ] 沒有出現現代物件（電腦、手機、汽車）
- [ ] 沒有出現文字、簽名、浮水印
- [ ] 顏色都在色票內（沒有亮藍、亮紫、霓虹綠）
- [ ] 風格一致（跟前一張像同一個畫家）
- [ ] 主體清晰、邊緣銳利
- [ ] 背景簡單、不搶主體
- [ ] 1:1 或 4:3，沒有變形
