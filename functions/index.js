const CACHED_ARTICLES = [
  {
    id: "2026-07-10-001",
    category: "航天·天文",
    title: "天问二号即将启程：小行星取样返回任务全解读",
    content: "<p>中国航天又将迎来一个重要时刻。天问二号探测器目前已完成各项测试，计划于今年下半年发射，前往近地小行星2016 HO3执行取样返回任务。</p><p>这颗小行星距离地球约4000万公里，直径仅约40到100米，比一座足球场还小。天问二号将飞抵这颗小行星附近，通过悬停采样的方式，收集地表物质样本，然后携带样本返回地球。</p><p>为什么要研究这么小的天体？因为小行星是太阳系形成初期遗留下来的\"化石\"，它们保存着46亿年前太阳系诞生时的原始物质。通过分析这些样本，科学家可以了解太阳系早期的化学组成和演化过程。</p>",
    wordCount: 220,
    readTime: 3,
    quiz: {
      single: [
        { question: "天问二号计划前往哪颗小行星执行取样返回任务？", options: ["2016 HO3", "贝努", "丝川", "龙宫"], correctOption: "2016 HO3", sourceParagraph: 1, sourceText: "前往近地小行星2016 HO3执行取样返回任务" },
        { question: "为什么研究小行星有重要意义？", options: ["开采稀有金属资源", "了解太阳系早期化学组成和演化过程", "建立太空基地", "测试火箭发动机"], correctOption: "了解太阳系早期化学组成和演化过程", sourceParagraph: 3, sourceText: "通过分析这些样本，科学家可以了解太阳系早期的化学组成和演化过程" }
      ],
      judge: [
        { statement: "天问二号将飞抵小行星2016 HO3执行取样返回任务。", correctAnswer: true, sourceParagraph: 1, sourceText: "前往近地小行星2016 HO3执行取样返回任务" },
        { statement: "小行星距离地球约4000万公里，直径超过10公里。", correctAnswer: false, sourceParagraph: 2, sourceText: "这颗小行星距离地球约4000万公里，直径仅约40到100米" }
      ]
    }
  },
  {
    id: "2026-07-10-002",
    category: "考古·文物",
    title: "三星堆新一轮发掘：青铜神树残件又有新发现",
    content: "<p>三星堆遗址的考古发掘工作持续推进。近日，考古团队在8号祭祀坑中又发现了青铜神树的残件碎片，经过精心拼对后，专家确认这些碎片属于此前出土的Ⅰ号大型青铜神树。</p><p>三星堆青铜神树是目前全世界已知最大的单体青铜器之一，通高近4米，分三层，每层三根树枝，枝头站着一只神鸟。整棵树造型奇特，被认为可能与古蜀人\"十日神话\"有关——传说天上曾有十个太阳，由神鸟驮着轮流值班。</p><p>更有趣的是，考古人员在这些残件上还保留着精美的纹饰，包括云雷纹和羽翅纹。考古人员正在对这些纹饰进行三维扫描和数字化复原。</p>",
    wordCount: 210,
    readTime: 3,
    quiz: {
      single: [
        { question: "三星堆青铜神树通高约多少？", options: ["近2米", "近4米", "近6米", "近8米"], correctOption: "近4米", sourceParagraph: 2, sourceText: "通高近4米" },
        { question: "青铜神树可能与古蜀人的什么传说有关？", options: ["大禹治水", "十日神话", "女娲补天", "后羿射日"], correctOption: "十日神话", sourceParagraph: 2, sourceText: "被认为可能与古蜀人十日神话有关" }
      ],
      judge: [
        { statement: "三星堆青铜神树每层有四根树枝。", correctAnswer: false, sourceParagraph: 2, sourceText: "每层三根树枝" },
        { statement: "考古人员在残件上发现了云雷纹和羽翅纹。", correctAnswer: true, sourceParagraph: 3, sourceText: "包括云雷纹和羽翅纹" }
      ]
    }
  },
  {
    id: "2026-07-10-003",
    category: "生物·生命",
    title: "章鱼有三颗心脏：海洋中最聪明的无脊椎动物",
    content: "<p>章鱼是海洋中最令人惊叹的生物之一。它们不仅拥有8条灵活的腕足和惊人的伪装能力，身体内部的构造同样令人称奇——章鱼竟然有三颗心脏。</p><p>其中两颗叫\"鳃心\"，专门负责将血液泵送到鳃部进行气体交换；第三颗是\"体心\"，负责将含氧血液输送到全身。这种三心脏系统效率极高，能保证章鱼活跃的代谢需求。</p><p>章鱼的血液是蓝色的，因为其中含有铜基的血蓝蛋白，而非人类血液中铁基的血红蛋白。</p>",
    wordCount: 195,
    readTime: 3,
    quiz: {
      single: [
        { question: "章鱼有几颗心脏？", options: ["1颗", "2颗", "3颗", "4颗"], correctOption: "3颗", sourceParagraph: 1, sourceText: "章鱼竟然有三颗心脏" },
        { question: "章鱼的血液是什么颜色？", options: ["红色", "蓝色", "绿色", "无色"], correctOption: "蓝色", sourceParagraph: 3, sourceText: "章鱼的血液是蓝色的" }
      ],
      judge: [
        { statement: "章鱼的鳃心负责将血液泵送到全身。", correctAnswer: false, sourceParagraph: 2, sourceText: "第三颗是体心，负责将含氧血液输送到全身" },
        { statement: "章鱼血液中含有铜基的血蓝蛋白。", correctAnswer: true, sourceParagraph: 3, sourceText: "含有铜基的血蓝蛋白" }
      ]
    }
  }
];

exports.main = async (event, context) => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ articleCount: CACHED_ARTICLES.length, articles: CACHED_ARTICLES })
  };
};
