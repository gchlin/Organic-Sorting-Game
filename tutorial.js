// tutorial(organic).js — 每關「分類帽新手教學」
//
// ★ 怎麼改內容：只要動引號 "" 裡面的字（title / text）。★
//   img 是這一頁要配的官能基示意圖（純結構圖，放在 assets/images/00_functional_groups/）。
//   img 可以是一張圖的路徑字串、也可以是路徑陣列（多張並排），或不寫（那一頁就沒有圖、改顯示分類帽）。
// ★ 不需要懂程式——只要不破壞引號、逗號、方括號的配對即可。★
//
// 每頁格式：{ img: "圖片路徑或陣列或不寫", title: "標題（短）", text: "內文（白話、給沒學過有機的人看）" }
//
// 觸發時機：玩家「第一次」進入某一關時，自動跳出這幾頁；看過之後不再強制，
//           可在結算畫面按「📖 看本關教學」重看。
//
// 文案原則：寫給「從沒學過有機化學」的學生看——不假設先備知識、從「結構圖上看得到的特徵」講起、
//           每個專有名詞第一次出現就解釋一句、多用生活例子、不堆術語。
//
// 註：這批文案是開發團隊先寫的版本；之後若有更貼近課本的版本（NotebookLM / 老師），直接換掉引號裡的字即可。

const _FG = "assets/images/00_functional_groups/";
const _HL = {
  alkane:   "assets/images/01_alkane/",
  alkene:   "assets/images/02_alkene/",
  alkyne:   "assets/images/03_alkyne/",
  alcohol:  "assets/images/04_alcohol/",
  ether:    "assets/images/09_ether/",
  aromatic: "assets/images/11_aromatic/"
};

const LevelTutorials = {

  // ── Level 1：碳氫骨架（烷 / 烯 / 炔 / 芳香） ──
  level1: [
    {
      expr: 'thinking',
      img: _FG + "fg_01_alkane.svg",
      title: "先看碳和碳之間怎麼牽手",
      text: "這一關的分子只有碳（C）和氫（H）。第一招：盯著「碳和碳之間」的線。如果每一條都是「一橫」（單鍵），那就是「烷」——最安定、最不愛反應的一群；家裡的瓦斯（甲烷、丙烷）就是它。"
    },
    {
      expr: 'neutral',
      img: _HL.alkane + "01_alkane_propane.svg",
      title: "你找得到官能基嗎？",
      text: "這是丙烷（propane）。分類帽把它丟給魔法師了——你能看出「烷的特徵」藏在哪裡嗎？先想想看，再翻下一頁。"
    },
    {
      expr: 'happy',
      img: _HL.alkane + "01_alkane_propane_highlight.svg",
      title: "答案：塗色的地方就是官能基",
      text: "有塗色（標色）的就是「烷」的官能基——碳與碳之間的**單鍵（C–C）骨架**。每一段都是一橫，沒有雙鍵、沒有其他原子，這就是烷的記號。"
    },
    {
      expr: 'neutral',
      img: _FG + "fg_02_alkene.svg",
      title: "兩橫是烯、三橫是炔",
      text: "碳碳之間如果出現「兩橫」（雙鍵），那是「烯」；出現「三橫」（參鍵），那是「炔」。它們比烷活潑很多。看到雙鍵想烯、看到參鍵想炔——別把線的數量數錯就好。"
    },
    {
      expr: 'neutral',
      img: [_HL.alkene + "02_alkene_ethene.svg", _HL.alkyne + "03_alkyne_ethyne.svg"],
      title: "你找得到嗎？（烯 / 炔）",
      text: "左邊是乙烯（ethene）、右邊是乙炔（ethyne）。你能分別指出「官能基在哪裡」嗎？碳碳之間的連線數量是關鍵。想好了再翻下一頁。"
    },
    {
      expr: 'happy',
      img: [_HL.alkene + "02_alkene_ethene_highlight.svg", _HL.alkyne + "03_alkyne_ethyne_highlight.svg"],
      title: "答案：塗色的地方就是官能基",
      text: "有塗色的就是官能基。左邊乙烯的**C=C 雙鍵**是烯的記號；右邊乙炔的**C≡C 參鍵**是炔的記號。看線的數量就能分辨。"
    },
    {
      expr: 'surprised',
      img: _FG + "fg_11_aromatic.svg",
      title: "六角形裡有個圈圈：苯環",
      text: "如果看到一個畫成「六角形、裡面還有一個圈圈」的東西，那是「苯環」，屬於「芳香烴」。它是這款遊戲後面到處會冒出來的角色，先把這個徽章記起來：六角形 ＋ 圈圈 ＝ 苯環。"
    },
    {
      expr: 'surprised',
      img: _HL.aromatic + "11_aromatic_benzene.svg",
      title: "你找得到嗎？（芳香）",
      text: "這是苯（benzene）。整個分子就是一個苯環——但你知道「官能基」的邊界在哪嗎？想好了再翻下一頁。"
    },
    {
      expr: 'happy',
      img: _HL.aromatic + "11_aromatic_benzene_highlight.svg",
      title: "答案：塗色的地方就是官能基",
      text: "有塗色的就是**苯環**本身。芳香烴的官能基就是那個六角形帶圈圈的結構。只要分子裡有這個，就歸「芳香烴」。"
    }
  ],

  // ── Level 2：單鍵氧家族（醇 / 醚） ──
  level2: [
    {
      expr: 'thinking',
      img: _FG + "fg_04_alcohol.svg",
      title: "氧一手牽碳、一手抓氫：醇",
      text: "這一關開始有「氧（O）」登場。第一種接法：氧的一邊接碳、另一邊接一個氫（寫成 –O–H，叫「羥基」）。只要這個 –OH 接在普通的碳鏈上，就是「醇」。你們喝的酒、消毒用的酒精，主角都是乙醇。"
    },
    {
      expr: 'thinking',
      img: _HL.alcohol + "04_alcohol_ethanol.svg",
      title: "你找得到官能基嗎？",
      text: "這是乙醇（ethanol）——就是酒裡面的那個酒精。分類帽把它丟給魔法師了，你能找出「醇的官能基」在哪裡嗎？先想想看，再翻下一頁。"
    },
    {
      expr: 'happy',
      img: _HL.alcohol + "04_alcohol_ethanol_highlight.svg",
      title: "答案：塗色的地方就是官能基",
      text: "有塗色的就是「醇」的官能基——**–OH（羥基）**。氧的一頭接碳、另一頭抓著一個氫，這個組合只要出現在碳鏈上就是醇。"
    },
    {
      expr: 'wink',
      img: _FG + "fg_09_ether.svg",
      title: "氧被兩個碳夾在中間：醚",
      text: "第二種接法：氧的兩邊「都」接碳（C–O–C），中間沒有那個 H。這叫「醚」。醚跟醇看起來只差一個 H，性質卻差很多——所以辨識重點就是：氧上面「有沒有掛 H」。有 H 是醇、夾在兩碳中間沒 H 是醚。"
    },
    {
      expr: 'wink',
      img: _HL.ether + "09_ether_dimethyl_ether.svg",
      title: "你找得到官能基嗎？",
      text: "這是二甲醚（dimethyl ether）。分類帽把它丟給魔法師了——你能找出氧在哪、它兩邊接的是什麼嗎？是醚還是醇？先判斷看看，再翻下一頁。"
    },
    {
      expr: 'happy',
      img: _HL.ether + "09_ether_dimethyl_ether_highlight.svg",
      title: "答案：塗色的地方就是官能基",
      text: "有塗色的就是「醚」的官能基——**C–O–C（醚鍵）**。氧被兩個碳夾在中間、上面沒有 H，這就是醚的記號。跟乙醇比一比，差那個 H，類別就整個換了。"
    }
  ],

  // ── Level 3：雙鍵氧家族（醛 / 酮） ──
  level3: [
    {
      expr: 'thinking',
      img: _FG + "fg_05_aldehyde.svg",
      title: "氧用雙鍵接碳叫「羰基」，先看它在哪",
      text: "這一關的氧跟碳之間是「雙鍵」（C=O），這個組合叫「羰基」。羰基如果長在碳鏈的「末端」、旁邊還黏著一個 H（寫成 –CHO），那就是「醛」。"
    },
    {
      expr: 'happy',
      img: _FG + "fg_06_ketone.svg",
      title: "羰基夾在中間：酮",
      text: "同樣是 C=O，但如果它被「夾在兩個碳之間」、旁邊沒有那個 H，那就是「酮」。最有名的酮是丙酮——卸指甲油的「去光水」主成分。辨識重點：C=O 在末端接 H 是醛、夾在中間是酮。"
    }
  ],

  // ── Level 4：雙氧複合（羧酸 / 酯） ──
  level4: [
    {
      expr: 'thinking',
      img: _FG + "fg_07_carboxylic_acid.svg",
      title: "同一個碳上掛兩種氧：羧酸",
      text: "這一關難一點：同一個碳上「同時」有 C=O（雙鍵氧）和 –OH（羥基），合起來寫成 –COOH，這叫「羧酸」。它會讓水溶液變酸——醋的酸味來源（乙酸）就是它。"
    },
    {
      expr: 'wink',
      img: _FG + "fg_08_ester.svg",
      title: "把羧酸的 H 換成碳：酯",
      text: "如果把羧酸 –COOH 裡那個 H 換成一段碳鏈（變成 C(=O)–O–C），那就是「酯」。很多水果香、香蕉油都是酯。辨識重點：尾巴是 –O–H（接氫）的是羧酸、是 –O–碳（接碳）的是酯。"
    }
  ],

  // ── Level 5：雜原子與鹵素（胺 / 鹵化物） ──
  level5: [
    {
      expr: 'thinking',
      img: _FG + "fg_10_amine.svg",
      title: "看到氮（N）：胺",
      text: "前面都在玩碳、氫、氧。這一關換氮上場。碳上接著氮、氮上還可能有氫（–NH₂、–NHR、–NR₂），而且氮旁邊「沒有」那個 C=O 羰基——這就是「胺」。小提醒：–NH₂ 跟 –OH 長得有點像，看清楚到底是 N 還是 O。"
    },
    {
      expr: 'happy',
      img: _FG + "fg_12_halide.svg",
      title: "看到 F / Cl / Br / I：鹵化物",
      text: "碳上接了氟、氯、溴、碘其中一個（C–X），就是「有機鹵化物」。這個不難，就是認那幾個鹵素符號。一句話：看到 N 想胺、看到 F/Cl/Br/I 想鹵化物。"
    }
  ],

  // ── Level 6：綜合題（前面全混在一起） ──
  level6: [
    {
      expr: 'annoyed',
      img: _FG + "fg_11_aromatic.svg",
      title: "前面學過的，這一關全混在一起",
      text: "烷烯炔芳香、醇醚、醛酮、羧酸酯、胺鹵化物——這一關通通會出現。沒有捷徑，就是一個一個看：先找苯環，再看有沒有 C=O（羰基），再看 –OH 接在哪，最後看有沒有氮、鹵素、雙參鍵。"
    },
    {
      expr: 'surprised',
      img: _FG + "fg_13_phenol.svg",
      title: "新角色：酚（別跟醇搞混）",
      text: "「酚」自成一類：–OH「直接」接在苯環的碳上，才叫酚（苯酚就是它）。如果 –OH 接在苯環「外面」伸出來的碳上（像苯甲醇的 –CH₂–OH），那它只是普通的「醇」、不是酚。差這一小截，類別就不同。"
    }
  ],

  // ── 「龜殼」與它的產地（苯環陷阱關） ──
  levelShell: [
    {
      expr: 'neutral',
      img: _FG + "fg_11_aromatic.svg",
      title: "這一關全是「龜殼」",
      text: "這一關每個分子都帶著那個六角形帶圈圈的「苯環」（我叫它龜殼）。新手最常犯的錯：看到龜殼就喊「酚」。先深呼吸——苯環只是背景，不是答案。"
    },
    {
      expr: 'thinking',
      img: _FG + "fg_13_phenol.svg",
      title: "看 –OH 的「落腳點」",
      text: "如果分子上有 –OH：它「直接」黏在龜殼的碳上 → 那才是「酚」；它接在龜殼伸出來的尾巴（像苯甲醇的 –CH₂–OH）上 → 只是普通的「醇」。同樣有苯環、同樣有 –OH，落腳點不同，答案就不同。"
    },
    {
      expr: 'annoyed',
      img: _FG + "fg_14_aromatic_amine.svg",
      title: "苯環只是配角，主角是官能基",
      text: "苯甲醛是「醛」、苯甲酸是「羧酸」、苯乙酮是「酮」、苯甲醚是「醚」、氯苯是「鹵化物」、苯胺是「胺」——都是先把苯環當背景，再看它身上掛的那一小塊官能基。只有「整顆就只是苯環＋烷基」（像甲苯、二甲苯）才選「芳香烴」。"
    }
  ],

  // ── Level 99：資優全英挑戰 ──
  level99: [
    {
      expr: 'neutral',
      title: "這一關，答案是英文",
      text: "玩法跟前面一樣（看結構式選分類），只是選項全部換成英文官能基名稱。結構怎麼看、判斷流程都沒變——你只要把腦中的中文名換成英文名。"
    },
    {
      expr: 'thinking',
      title: "13 類的中英對照",
      text: "烷 Alkane／烯 Alkene／炔 Alkyne／醇 Alcohol／醚 Ether／醛 Aldehyde／酮 Ketone／羧酸 Carboxylic Acid／酯 Ester／胺 Amine／芳香烴 Aromatic Hydrocarbon／鹵化物 Halide／酚 Phenol。最容易看錯的：Alkane / Alkene / Alkyne 三個只差一個字母；Carboxylic Acid 和 Ester 差在那個 H 被換成 carbon chain。"
    }
  ]

};

const TutorialModules = {
  aromatic: {
    title: "芳香烴教學關卡",
    tag: "AR",
    pages: [
      {
        expr: 'surprised',
        img: _FG + "fg_11_aromatic.svg",
        title: "六角形帶圈圈",
        text: "看到六角形裡有圈圈，就是苯環。分子如果只有苯環或苯環加上碳氫尾巴，通常先判成芳香烴。"
      },
      {
        expr: 'thinking',
        img: _FG + "fg_13_phenol.svg",
        title: "先別急著選酚",
        text: "苯環只是背景。只有 –OH 直接接在苯環上才是酚；如果苯環旁邊掛的是醛、酸、醚、胺或鹵素，就要看那個官能基。"
      },
      {
        expr: 'happy',
        img: [_HL.aromatic + "11_aromatic_benzene.svg", _HL.aromatic + "11_aromatic_toluene.svg"],
        title: "練習判斷順序",
        text: "先找苯環，再找苯環外面有沒有更明顯的官能基。沒有其他官能基時，才把它放進芳香烴。"
      }
    ]
  },
  oxygen: {
    title: "涵氧家族教學關卡",
    tag: "O",
    pages: [].concat(LevelTutorials.level2 || [], LevelTutorials.level3 || [], LevelTutorials.level4 || [])
  },
  nitrogenHalide: {
    title: "含氮鹵化物教學關卡",
    tag: "N/X",
    pages: LevelTutorials.level5 || []
  },
  practiceControls: {
    title: "練習模式操作教學關卡",
    tag: "P",
    pages: [
      {
        expr: 'neutral',
        title: "先看圖，再選答案",
        text: "練習模式沒有搶答。看清楚結構式上的官能基後，直接點選答案，或使用選項旁邊顯示的快捷鍵。"
      },
      {
        expr: 'thinking',
        title: "答錯不是結束",
        text: "練習模式答錯會把錯誤選項劃掉，這題還可以繼續觀察。錯過的分子會進錯題本，之後可以集中訂正。"
      },
      {
        expr: 'happy',
        title: "正式關卡的提示",
        text: "正式關卡中的教學按鈕只會顯示快速提示，不會中斷遊戲流程。完整教學從主選單的新手導覽進入。"
      }
    ]
  },
  duelControls: {
    title: "對決模式操作教學關卡",
    tag: "D",
    pages: [
      {
        expr: 'neutral',
        title: "先搶答，後作答",
        text: "對決模式要先按搶答。誰先搶到，誰才會看到自己的答案按鈕並進入限時作答。"
      },
      {
        expr: 'thinking',
        title: "倒數會影響分數",
        text: "越快答對分數越高；逾時、放棄或答錯都會扣分。搶答前先確定自己看到了關鍵官能基。"
      },
      {
        expr: 'happy',
        title: "鍵盤也能操作",
        text: "搶答與答案選項都有快捷鍵，實際按鍵會顯示在畫面上。你可以到設定頁調整主要操作鍵。"
      }
    ]
  },
  wizardDuel: {
    title: "巫師對決導覽關卡",
    tag: "AI",
    pages: [
      {
        expr: 'surprised',
        title: "選擇你的對手",
        text: "巫師對決可以雙人對戰，也可以挑戰 AI。設定中的對手模式會被記住，下次進入對決會沿用。"
      },
      {
        expr: 'thinking',
        title: "動態題圖規則",
        text: "中高級對決可能會遇到模糊或旋轉縮放的題圖。搶答後題圖會快速揭示，讓作答階段能看清楚結構。"
      },
      {
        expr: 'happy',
        title: "勝利條件",
        text: "對決目標是先達到勝利門檻分數。穩定辨識比亂搶更重要，因為錯誤、放棄和逾時都會讓分差拉開。"
      }
    ]
  }
};

const LevelTutorialMap = {
  'hydrocarbon-beginner': 'hydrocarbon-beginner',
  'hydrocarbon-intermediate': 'hydrocarbon-intermediate',
  'oxygen-beginner': 'oxygen-beginner',
  'oxygen-intermediate': 'oxygen-intermediate',
  'nitrogenHalide-beginner': 'nitrogenHalide-beginner',
  'nitrogenHalide-intermediate': 'nitrogenHalide-intermediate',
  'mixed-beginner': 'mixed-beginner',
  'mixed-intermediate': 'mixed-intermediate',
  'shell-intermediate': 'shell-intermediate',
  'englishChallenge-advanced': 'englishChallenge-advanced'
};

// === Family-difficulty-keyed aliases (v2 migration) ===
// Beginner and intermediate share the same slides initially; can fork later.
LevelTutorials['hydrocarbon-beginner']        = LevelTutorials.level1 || [];
LevelTutorials['hydrocarbon-intermediate']    = LevelTutorials.level1 || [];
LevelTutorials['oxygen-beginner']             = TutorialModules.oxygen.pages || [];
LevelTutorials['oxygen-intermediate']         = TutorialModules.oxygen.pages || [];
LevelTutorials['nitrogenHalide-beginner']     = LevelTutorials.level5 || [];
LevelTutorials['nitrogenHalide-intermediate'] = LevelTutorials.level5 || [];
LevelTutorials['mixed-beginner']              = LevelTutorials.level6 || [];
LevelTutorials['mixed-intermediate']          = LevelTutorials.level6 || [];
LevelTutorials['shell-intermediate']          = LevelTutorials.levelShell || [];
LevelTutorials['englishChallenge-advanced']   = LevelTutorials.level99 || [];
