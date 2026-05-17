// story(organic).js — 關卡劇情腳本
//
// ★ 怎麼改台詞：只要動引號 "" 裡面的字。★
// ★ 不需要懂程式——只要不破壞引號、逗號、方括號的配對即可。★
//
// 對話格式：{ who: "hat" | "wiz", text: "…" }
//   who: "hat" = 分類帽（吐槽 / 講解）；"wiz" = 魔法師（玩家化身）
//
// {name} 會在遊戲執行時自動替換成玩家輸入的名字。
//
// 觸發時機：玩家在該關「答對率達門檻」後，逐句彈出這段對話；可跳過。
// 角色 emoji 占位：分類帽 🎩 / 魔法師 🧙

const StoryScripts = {

  // Level 1：碳氫骨架（烷 / 烯 / 炔 / 芳香）
  level1: [
    { who: "hat", text: "…又來了一個。{name}，是嗎。坐好，我很忙。" },
    { who: "wiz", text: "呃……分類帽前輩好。這些全是碳和氫，看起來都一樣……" },
    { who: "hat", text: "都一樣？說這話的人通常一題也看不對。仔細看：全是 C–C 單鍵的叫『烷』；躲了一根 C=C 雙鍵的叫『烯』；更硬派、有 C≡C 參鍵的叫『炔』。" },
    { who: "wiz", text: "那那個六角形圈圈？" },
    { who: "hat", text: "哦，你總算注意到了。那是苯環——『芳香烴』的印記。先把它刻進腦子裡，之後到處都是它，你不認識它牠會認識你。" },
    { who: "wiz", text: "所以先找：有沒有雙鍵、參鍵、苯環？" },
    { who: "hat", text: "……還算孺子可教。碳氫骨架是地基，地基看清楚，後面加官能基才不會一腳踩空。" },
    { who: "wiz", text: "我記住了。烷、烯、炔、芳香。" },
    { who: "hat", text: "少廢話。去做題——帽子不是用來聊天的。" }
  ],

  // Level 2：單鍵氧家族（醇 / 醚）
  level2: [
    { who: "hat", text: "骨架過關了。現在加一個氧進來——但氧很挑剔，接法不同、名字就不同。" },
    { who: "wiz", text: "氧怎麼接？" },
    { who: "hat", text: "氧如果一手抓碳、一手抓氫，–O–H，那叫『醇』。乙醇，就是你們喝的那個。" },
    { who: "wiz", text: "那如果兩手都抓碳呢？" },
    { who: "hat", text: "C–O–C，氧夾在兩個碳中間，那叫『醚』。看起來差一個 H，性質差了十萬八千里。" },
    { who: "wiz", text: "所以關鍵就是那個 H 有沒有？" },
    { who: "hat", text: "就那一個 H。{name}，你別看這題簡單，每年都有人把乙醇和乙醚看成同一家人。" },
    { who: "wiz", text: "……我不會的。先找 –OH。" },
    { who: "hat", text: "說得比唱得好聽。去證明吧。" }
  ],

  // Level 3：雙鍵氧家族（醛 / 酮）
  level3: [
    { who: "hat", text: "這一關，氧升級了——它跟碳之間是『雙鍵』，C=O，叫羰基。記住這個名字。" },
    { who: "wiz", text: "羰基……醛跟酮有什麼差？" },
    { who: "hat", text: "差在位置。羰基如果長在碳鏈末端，旁邊還黏著一個 H，那是『醛』，–CHO。" },
    { who: "wiz", text: "那酮？" },
    { who: "hat", text: "羰基被夾在兩個碳中間，沒有那個 H，那是『酮』。丙酮你應該聽過，去光指甲油用的。" },
    { who: "wiz", text: "所以 C=O 在邊邊是醛、在中間是酮。" },
    { who: "hat", text: "正確。雖然是從你嘴裡說出來的，讓我有點不習慣。" },
    { who: "wiz", text: "……謝謝誇獎（吧？）" },
    { who: "hat", text: "別誤會，我只是在核對事實。去做題，{name}。" }
  ],

  // Level 4：雙氧複合（羧酸 / 酯）
  level4: [
    { who: "hat", text: "好，這關開始難了。同一個碳上，同時掛兩種氧。準備好了嗎？" },
    { who: "wiz", text: "……說實話沒有。" },
    { who: "hat", text: "誠實。算你一點。C=O 加 –OH 黏在同一個碳上，那叫『羧酸』，–COOH。乙酸，就是醋。" },
    { who: "wiz", text: "那酯呢？看起來也有兩個氧。" },
    { who: "hat", text: "把羧酸的 –OH 裡那個 H 換成碳，就成了酯：C(=O)–O–C。水果香大多是酯，醋酸是羧酸——聞到不同，結構就差那個位置。" },
    { who: "wiz", text: "差別只在尾巴是 –O–H 還是 –O–碳。" },
    { who: "hat", text: "對。你這關如果還混淆，我建議你去聞一下醋，印象會比較深刻。" },
    { who: "wiz", text: "……我會看清楚的。" },
    { who: "hat", text: "最好是。酸與酯，出發。" }
  ],

  // Level 5：雜原子與鹵素（胺 / 鹵化物）
  level5: [
    { who: "hat", text: "前面都是碳氫氧在玩。這一關，請兩個新角色上場：氮，還有鹵素。" },
    { who: "wiz", text: "胺是 –NH₂ 那個嗎？" },
    { who: "hat", text: "對，氮接著碳還黏著氫，–NH₂，那是『胺』。小心——–NH₂ 跟 –OH 長得有那麼一點點像，別看錯。" },
    { who: "wiz", text: "那鹵素呢？F、Cl、Br、I……" },
    { who: "hat", text: "碳上接了這四個其中一個，C–X，就是『鹵化物』。沒有特別難，就是認符號。" },
    { who: "wiz", text: "看到 N 想胺、看到 X 想鹵化物。" },
    { who: "hat", text: "可以。雖然真正的分子常常一身好幾個官能基，到那時候你要學會看誰是主角。但那是以後的事。" },
    { who: "wiz", text: "一步一步來。先把 N 跟 X 認熟。" },
    { who: "hat", text: "難得你知道不要貪多。去吧，{name}。" }
  ],

  // Level 6：終極分類帽（Level 1~5 綜合題）
  level6: [
    { who: "hat", text: "烷烯炔芳香、醇醚、醛酮、羧酸酯、胺鹵化物——都見過了。這關全混在一起。" },
    { who: "wiz", text: "全混……而且你剛才提到苯酚是單獨一類？" },
    { who: "hat", text: "–OH 直接接在苯環的碳上，那是『酚』，自成一類。別以為接了苯環的 –OH 還算醇，那是偷懶的想法。" },
    { who: "wiz", text: "所以苯甲醇是醇，苯酚才是酚。" },
    { who: "hat", text: "正確。苯甲醇的 –OH 是接在苯環外面的 –CH₂– 上；苯酚的 –OH 直接接在環上。差這一截，類別就不同。" },
    { who: "wiz", text: "那苯甲醛、苯甲酸、苯胺呢？" },
    { who: "hat", text: "醛、羧酸、胺。苯環只是附件，主角還是官能基。{name}，冷靜看、一個一個找，不要被苯環嚇到。" },
    { who: "wiz", text: "好。一個一個找，不要被外型騙了。" },
    { who: "hat", text: "這才像話。終極分類——如果你在這關還搞錯，我會假裝不認識你。去吧。" }
  ],

  // 「龜殼」與它的產地（苯環陷阱關）
  levelShell: [
    { who: "hat", text: "{name}，這一關全是『龜殼』——那個畫成六角形帶圈圈的，叫苯環。新手看到龜殼就喊『酚』，每年都有人這樣丟分。" },
    { who: "wiz", text: "不是嗎？我看它們都有苯環，有些還掛著 –OH……" },
    { who: "hat", text: "看清楚 –OH 的落腳點。直接黏在龜殼的碳上，那才叫『酚』；接在龜殼伸出來的尾巴上——比如苯甲醇的 –CH₂–OH——那只是個普通的『醇』。" },
    { who: "wiz", text: "所以苯酚是酚、苯甲醇是醇。那苯甲醛、苯甲酸呢？" },
    { who: "hat", text: "醛、羧酸。苯環只是背景，主角永遠是它身上掛的官能基。苯甲醛末端一個 –CHO，苯甲酸一個 –COOH，差一個位置，類別就不同。" },
    { who: "wiz", text: "苯乙酮、苯甲醚、氯苯、苯胺……也都是看官能基決定？" },
    { who: "hat", text: "酮、醚、鹵化物、胺。對。把龜殼遮起來，剩下那一小塊才是答案。" },
    { who: "wiz", text: "懂了。先把苯環當背景，再看它身上掛了什麼。" },
    { who: "hat", text: "難得開竅。去吧，{name}——別讓這些龜殼把你搞糊塗了。" }
  ],

  // Level 99：資優全英挑戰（選做；給挑戰玩家）
  level99: [
    { who: "hat", text: "……你又來了。{name}，你知道這關選項全是英文嗎？" },
    { who: "wiz", text: "知道。我準備好了。" },
    { who: "hat", text: "嘴上說準備好，手不一定跟得上。Alkane、Alkene、Alkyne——光這三個就有人傻傻分不清楚。" },
    { who: "wiz", text: "Alcohol、Ether、Aldehyde、Ketone……我背過了。" },
    { who: "hat", text: "『背過』跟『看到結構式就知道』是兩件事。Carboxylic Acid 和 Ester 差在哪？用英文回答我。" },
    { who: "wiz", text: "……Carboxylic Acid 有 –COOH，Ester 有 –COO–C，差在那個 H 換成 carbon chain。" },
    { who: "hat", text: "……還行。Phenol 呢？" },
    { who: "wiz", text: "–OH directly bonded to the aromatic ring carbon. Not –CH₂–OH，那是 benzyl alcohol，是 Alcohol。" },
    { who: "hat", text: "好。你比我預期的強一點點——就一點點，別驕傲。Amine 跟 Halide 別看錯，Go on, {name}." }
  ]

};

// === Family-keyed aliases (v2 migration) ===
// Reference assignments — same array objects, no copy.
// Legacy level-keyed keys above are preserved verbatim for existing game.js.
// New code (post-game.js rewrite) reads from these family keys.
// englishChallenge intentionally absent: Families.englishChallenge.storyKey = null (non-narrative).
StoryScripts.hydrocarbon    = StoryScripts.level1 || [];
StoryScripts.oxygen         = StoryScripts.level2 || StoryScripts.level3 || StoryScripts.level4 || [];
StoryScripts.nitrogenHalide = StoryScripts.level5 || [];
StoryScripts.mixed          = StoryScripts.level6 || [];
StoryScripts.shell          = StoryScripts.levelShell || [];
