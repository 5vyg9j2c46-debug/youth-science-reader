import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrapeAllNews } from './scrape-news.mjs';
import { filterArticles, batchRewrite, batchGenerateQuiz } from './ai-review.mjs';
import {
  FILTER_SYSTEM_PROMPT,
  buildFilterPrompt,
  KEEP_VERBATIM_PROMPT,
  EXPAND_PROMPT,
  COMPRESS_PROMPT,
  buildExpandPrompt,
  buildKeepPrompt,
  buildCompressPrompt,
  buildQuizPrompt,
  parseQuizResponse
} from './content-filter.mjs';
import {
  CATEGORIES,
  getTargetCount,
  getExtraCount,
  calcReadTime,
  generateId,
  todayStr,
  isWeekendDate,
  distributeCategories,
  sleep
} from './utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data', 'articles');

const PRESET_ARTICLES = [
  {
    category: '航天深空·天文新知',
    title: '国际空间站上的植物实验：太空种菜不是梦',
    content: '<p>在国际空间站的\"蔬菜生产系统\"中，宇航员已经成功种植了生菜、萝卜和辣椒。这些太空蔬菜不仅为宇航员提供了新鲜食物来源，还帮助科学家了解微重力环境对植物生长的影响。</p><p>太空种植面临诸多挑战：没有重力，植物不知道\"上下\"；缺乏自然光照，需要LED灯补光；水分不会自然下沉，容易在根部积水导致腐烂。科学家通过旋转装置模拟重力、精确控制光照周期和营养液循环，逐步解决了这些难题。</p><p>未来的月球基地和火星探险中，太空农业将成为生存的关键技术。目前NASA正在研究如何在封闭环境中实现食物的可持续生产。</p>',
    source: 'NASA科普'
  },
  {
    category: '考古文博·古文明发掘',
    title: '秦始皇陵的水银之谜：地质检测证实史书记载',
    content: '<p>《史记》记载秦始皇陵中\"以水银为百川江河大海\"。现代地质学家通过土壤汞含量检测，发现陵墓封土区域的汞含量确实异常偏高，是周围区域的数倍。</p><p>这些汞蒸气从何而来？科学家推测，秦代工匠可能将大量液态汞注入陵墓内部，模拟江河湖海的流动。汞在常温下呈液态且不易挥发，能在密闭空间中长期保存。</p><p>这一发现不仅验证了司马迁的记载，也说明秦代工匠对汞的物理性质已有深入了解。不过出于文物保护考虑，目前尚未开挖主墓室。</p>',
    source: '国家文物局'
  },
  {
    category: '大国工程·前沿科技突破',
    title: '中国高铁为什么能跑350公里时速还这么稳？',
    content: '<p>乘坐中国高铁时，即使以350公里时速行驶，硬币也能立在窗台上不倒。这背后是一系列精密工程的支撑。</p><p>首先是无砟轨道技术。传统铁路用碎石铺轨，容易变形；高铁采用整体浇筑的混凝土轨道板，平整度误差控制在0.3毫米以内。其次是列车的悬挂系统，采用空气弹簧和主动减振技术，能实时感知并抵消振动。</p><p>另一个关键是中国自主研发的\"北斗+5G\"列控系统，每秒对列车位置和速度进行精确计算，确保相邻列车之间保持安全距离。这些技术的综合运用，让中国高铁成为世界上运营时速最高的铁路网络。</p>',
    source: '中国铁路'
  },
  {
    category: '地球自然·气象地质博物探索',
    title: '地球最深的地方：马里亚纳海沟到底有多深？',
    content: '<p>马里亚纳海沟位于太平洋西部，最深处叫\"挑战者深渊\"，深度约10994米。如果把珠穆朗玛峰放进去，峰顶距海面还有2000多米。</p><p>海沟底部的压力是海面的1100倍，相当于一个指甲盖大小的面积承受1吨重的压力。温度只有1-4℃，常年漆黑一片。但即便如此极端的环境，科学家仍发现了多种微生物和深海生物。</p><p>2020年，中国\"奋斗者号\"载人潜水器成功坐底马里亚纳海沟，创造了10909米的中国载人深潜纪录。潜水器的钛合金球壳能承受巨大水压，保障了三位科学家的安全。</p>',
    source: '中国科学院'
  },
  {
    category: '生物世界·生命科学科普',
    title: '为什么猫总是能四脚着地？',
    content: '<p>猫从高处落下时总能四脚着地，这个能力叫做\"翻正反射\"。猫的脊柱非常柔软，有30块椎骨（人类只有24块），能在空中快速扭转身体。</p><p>当猫开始下落时，内耳中的前庭系统感知到身体方向变化，大脑立刻发出指令：先转动前半身朝下，再扭转后半身跟上，整个过程只需0.3秒。</p><p>不过\"猫有九条命\"是夸张说法。猫从不同高度摔落的存活率并不相同：低处（2-6层）反而比高处更危险，因为猫来不及完成翻转。高处坠落时猫会张开四肢增加空气阻力，起到\"降落伞\"效果，降低着地速度。</p>',
    source: '动物科学'
  },
  {
    category: '地理探索·环球人文地貌',
    title: '撒哈拉沙漠曾经是绿色的：万年前的非洲大草原',
    content: '<p>今天的撒哈拉沙漠是世界上最大的热带沙漠，面积约等于整个中国国土面积。但大约6000年前，这里曾是一片水草丰美的大草原，有湖泊、河流和成群的野生动物。</p><p>科学家通过卫星遥感发现沙漠下方的古河床遗迹，以及大量鳄鱼和河马的化石。这些证据表明，地球轨道的微小变化导致季风北移，给撒哈拉带来了充沛降雨。</p><p>后来地球轨道再次变化，季风南退，草原逐渐沙化。这个过程持续了数千年。撒哈拉的变迁提醒我们：地球的气候从来不是一成不变的。</p>',
    source: '中国国家地理'
  },
  {
    category: '青少年健康医学科普',
    title: '为什么青少年需要睡够9小时？',
    content: '<p>美国国家睡眠基金会建议11-13岁的青少年每天睡9-11小时。但现实中很多同学只睡7-8小时，上课打瞌睡成了常态。</p><p>睡眠不足不只是困倦那么简单。在深度睡眠阶段，大脑会分泌生长激素，这对青少年的身高发育至关重要。同时，睡眠也是大脑整理记忆的过程——白天学到的知识在睡眠中被\"巩固\"，从短期记忆转为长期记忆。</p><p>长期睡眠不足还会影响情绪调节能力，容易焦虑、烦躁。建议固定作息时间，睡前一小时远离电子屏幕，保持卧室安静黑暗。</p>',
    source: '健康科普'
  },
  {
    category: '生态环境·地球保护科考',
    title: '大熊猫从\"濒危\"降为\"易危\"：保护行动的胜利',
    content: '<p>2021年，中国宣布大熊猫野外种群数量增至1864只，受威胁等级从\"濒危\"降为\"易危\"。这是几十年持续保护的成果。</p><p>大熊猫保护的核心策略是建立自然保护区。目前中国已建立67个大熊猫保护区，覆盖了54%的野生栖息地。同时，人工繁殖技术也取得突破，圈养数量超过600只。</p><p>但\"易危\"并不意味着安全。栖息地碎片化仍然是最大威胁——公路和村庄把完整的森林切割成小块，阻碍了大熊猫的基因交流。科学家正在建设\"大熊猫国家公园\"，用生态廊道连接孤立的栖息地。</p>',
    source: 'WWF中国'
  },
  {
    category: '环球人文与跨国科考见闻',
    title: '南极科考站的生活：科学家如何在极地过冬？',
    content: '<p>南极冬季气温可降至零下60℃，连续数月不见阳光。在这样的极端环境中，中国南极科考队员需要驻守半年以上。</p><p>科考站的建筑采用架空设计，避免积雪掩埋；墙体有厚厚的保温层，室内保持20℃左右。食物以冷冻和罐头为主，近年通过温室种植部分蔬菜改善了饮食。</p><p>最考验人的是心理状态。极夜期间，外面一片漆黑，暴风雪持续数周，队员只能在站内活动。科考站会安排丰富的文娱活动，并定期与家人视频通话，帮助队员保持心理健康。</p>',
    source: '中国极地研究中心'
  }
];

function getDateArg() {
  const arg = process.argv.find(a => a.startsWith('--date='));
  if (arg) return arg.split('=')[1];
  return todayStr();
}

function getGeneratedBy() {
  const arg = process.argv.find(a => a.startsWith('--source='));
  if (arg) return arg.split('=')[1];
  return process.env.GITHUB_EVENT_NAME === 'schedule' ? 'auto' : 'manual';
}

function isExtraMode() {
  return process.argv.includes('--extra');
}

async function loadExistingArticles(dateStr) {
  const filePath = path.join(DATA_DIR, `${dateStr}.json`);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

async function loadHistoricalArticles(dateStr, count) {
  const archive = [];
  if (!fs.existsSync(DATA_DIR)) return [];

  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json') && f !== `${dateStr}.json`)
    .sort()
    .reverse()
    .slice(0, 30);

  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'));
      if (data.articles) {
        archive.push(...data.articles.filter(a => !a.isWechat));
      }
    } catch {}
  }

  const shuffled = archive.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(a => ({
    ...a,
    id: generateId(dateStr, Math.floor(Math.random() * 999)),
    sourceNote: '往期回顾'
  }));
}

async function saveArticles(dateStr, data) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const filePath = path.join(DATA_DIR, `${dateStr}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Saved to ${filePath}`);
}

const CATEGORY_COVER = {
  '航天深空·天文新知': 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=600&h=300&fit=crop',
  '考古文博·古文明发掘': 'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?w=600&h=300&fit=crop',
  '大国工程·前沿科技突破': 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=300&fit=crop',
  '地球自然·气象地质博物探索': 'https://images.unsplash.com/photo-1440342359743-84fcb8c21f21?w=600&h=300&fit=crop',
  '生物世界·生命科学科普': 'https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=600&h=300&fit=crop',
  '地理探索·环球人文地貌': 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&h=300&fit=crop',
  '青少年健康医学科普': 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=600&h=300&fit=crop',
  '生态环境·地球保护科考': 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&h=300&fit=crop',
  '环球人文与跨国科考见闻': 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&h=300&fit=crop'
};

function injectCoverImage(content, images, category) {
  if (images && images.length > 0) {
    const firstImg = images[0];
    if (!content.includes('<img')) {
      return `<img src="${firstImg}" alt="" style="max-width:100%;height:auto;border-radius:8px;margin-bottom:16px;" />\n${content}`;
    }
    return content;
  }

  const cover = CATEGORY_COVER[category];
  if (cover && !content.includes('<img')) {
    return `<img src="${cover}" alt="" style="max-width:100%;height:auto;border-radius:8px;margin-bottom:16px;" loading="lazy" />\n${content}`;
  }
  return content;
}

function buildArticle(raw, dateStr, index) {
  let content = raw.rewrittenContent || raw.content || `<p>${raw.summary || ''}</p>`;
  content = injectCoverImage(content, raw.images, raw.category);

  const { wordCount, readTime } = calcReadTime(content);

  const article = {
    id: generateId(dateStr, index),
    category: raw.category || '推荐阅读',
    title: raw.title || '无标题',
    content,
    wordCount,
    readTime,
    source: raw.source || '',
    sourceUrl: raw.link || raw.sourceUrl || '',
    coverImage: (raw.images && raw.images[0]) || CATEGORY_COVER[raw.category] || '',
    images: raw.images || [],
    isWechat: raw.isWechat || false,
    wasCompressed: raw.wasCompressed || false
  };

  if (raw.quiz && raw.quiz.single && raw.quiz.judge) {
    article.quiz = raw.quiz;
  }

  return article;
}

function buildPresetArticle(preset, dateStr, index) {
  const { wordCount, readTime } = calcReadTime(preset.content);
  return {
    id: generateId(dateStr, index),
    category: preset.category,
    title: preset.title,
    content: preset.content,
    wordCount,
    readTime,
    source: preset.source || '',
    sourceUrl: '',
    coverImage: '',
    isWechat: false,
    sourceNote: '预置科普'
  };
}

async function main() {
  const dateStr = getDateArg();
  const generatedBy = getGeneratedBy();
  const isWeekend = isWeekendDate(dateStr);
  const extraMode = isExtraMode();
  const targetCount = extraMode ? getExtraCount() : getTargetCount(isWeekend);

  console.log(`=== ${extraMode ? 'Extra' : 'Generating'} articles for ${dateStr} ===`);
  console.log(`Target: ${targetCount} ${extraMode ? 'additional' : ''} articles`);
  console.log(`Trigger: ${generatedBy}`);

  const existing = await loadExistingArticles(dateStr);
  const existingArticles = existing ? existing.articles.filter(a => !a.isWechat) : [];
  const existingWechat = existing ? existing.articles.filter(a => a.isWechat) : [];
  const existingTitles = extraMode ? new Set(existingArticles.map(a => a.title)) : new Set();

  if (extraMode) {
    console.log(`Existing articles: ${existingArticles.length} (will deduplicate)`);
  } else {
    console.log(`Replacing all existing articles with fresh batch`);
  }

  console.log('\n[1/4] Scraping news sources...');
  const newsByCategory = await scrapeAllNews();

  let allRawItems = [];
  for (const [cat, items] of Object.entries(newsByCategory)) {
    allRawItems.push(...items);
  }
  console.log(`Total raw items: ${allRawItems.length}`);

  let finalArticles = [];

  if (allRawItems.length === 0) {
    console.log('\n⚠ No news fetched from any source.');

    console.log('Trying historical archive...');
    const archived = await loadHistoricalArticles(dateStr, targetCount);

    if (archived.length >= targetCount) {
      console.log(`Using ${archived.length} archived articles.`);
      archived.forEach((item, i) => {
        finalArticles.push(buildArticle(item, dateStr, finalArticles.length));
      });
    } else {
      console.log(`Archive has ${archived.length} articles. Using preset fallback to fill ${targetCount} slots.`);
      archived.forEach((item, i) => {
        finalArticles.push(buildArticle(item, dateStr, finalArticles.length));
      });

      const shortfall = targetCount - finalArticles.length;
      const shuffledPresets = [...PRESET_ARTICLES].sort(() => Math.random() - 0.5);
      for (let i = 0; i < shortfall && i < shuffledPresets.length; i++) {
        finalArticles.push(buildPresetArticle(shuffledPresets[i], dateStr, finalArticles.length));
      }
    }
  } else {
    console.log('\n[2/4] Filtering content with MIMO...');
    let filtered;
    try {
      filtered = await filterArticles(allRawItems, FILTER_SYSTEM_PROMPT, buildFilterPrompt);
    } catch (err) {
      console.warn('AI filter failed, using all items:', err.message);
      filtered = allRawItems;
    }
    console.log(`Passed filter: ${filtered.length}/${allRawItems.length}`);

    const categories = distributeCategories(targetCount);
    const selected = [];

    for (const cat of categories) {
      const candidates = filtered.filter(item =>
        item.category === cat &&
        !selected.find(s => s.title === item.title) &&
        !existingTitles.has(item.title)
      );
      if (candidates.length > 0) {
        selected.push(candidates[0]);
      }
    }

    if (selected.length < targetCount) {
      const remaining = filtered.filter(item =>
        !selected.find(s => s.title === item.title) &&
        !existingTitles.has(item.title)
      );
      selected.push(...remaining.slice(0, targetCount - selected.length));
    }

    if (selected.length < targetCount) {
      const shortfall = targetCount - selected.length;
      console.log(`Need ${shortfall} more, trying archive...`);
      const archived = await loadHistoricalArticles(dateStr, shortfall);
      selected.push(...archived);
    }

    if (selected.length < targetCount) {
      const shortfall = targetCount - selected.length;
      const shuffledPresets = [...PRESET_ARTICLES].sort(() => Math.random() - 0.5);
      for (let i = 0; i < shortfall && i < shuffledPresets.length; i++) {
        selected.push({ ...shuffledPresets[i], sourceNote: 'preset' });
      }
    }

    const toRewrite = selected.filter(a => !a.sourceNote);
    const alreadyDone = selected.filter(a => a.sourceNote);

    console.log(`\n[3/4] Rewriting ${toRewrite.length} articles with MIMO...`);
    let rewritten = [];
    try {
      rewritten = await batchRewrite(toRewrite, KEEP_VERBATIM_PROMPT, COMPRESS_PROMPT, EXPAND_PROMPT, buildKeepPrompt, buildCompressPrompt, buildExpandPrompt);
    } catch (err) {
      console.warn('AI rewrite failed, using originals:', err.message);
      rewritten = toRewrite;
    }
    console.log(`Successfully rewritten: ${rewritten.length}`);

    console.log('\n[4/5] Generating quiz from FINAL rewritten content...');
    rewritten.forEach(a => {
      if (a.rewrittenContent) {
        a.content = a.rewrittenContent;
      }
    });
    try {
      await batchGenerateQuiz(rewritten, buildQuizPrompt, parseQuizResponse);
      const quizCount = rewritten.filter(a => a.quiz).length;
      console.log(`Quiz generated for ${quizCount}/${rewritten.length} articles`);
    } catch (err) {
      console.warn('Quiz generation failed (non-blocking):', err.message);
    }

    console.log('\n[5/5] Building final output...');
    rewritten.forEach((item) => {
      finalArticles.push(buildArticle(item, dateStr, finalArticles.length));
    });

    alreadyDone.forEach(item => {
      if (item.sourceNote === 'preset') {
        finalArticles.push(buildPresetArticle(item, dateStr, finalArticles.length));
      } else {
        finalArticles.push(buildArticle(item, dateStr, finalArticles.length));
      }
    });
  }

  const categoryCounts = {};
  for (const cat of CATEGORIES) {
    categoryCounts[cat] = 0;
  }

  let mergedArticles;
  if (extraMode) {
    const newArticleIds = new Set(finalArticles.map(a => a.id));
    mergedArticles = [
      ...existingArticles,
      ...finalArticles,
      ...existingWechat
    ];
    mergedArticles.forEach(a => {
      categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1;
    });
  } else {
    mergedArticles = [...finalArticles, ...existingWechat];
    finalArticles.forEach(a => {
      categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1;
    });
  }

  const output = {
    date: dateStr,
    isWeekend,
    generatedAt: new Date().toISOString(),
    generatedBy,
    articles: mergedArticles,
    totalArticles: mergedArticles.length,
    categories: categoryCounts
  };

  await saveArticles(dateStr, output);
  console.log(`\n✓ Done! ${mergedArticles.length} total articles for ${dateStr}.`);
  console.log(`  Category distribution:`);
  for (const [cat, count] of Object.entries(categoryCounts)) {
    if (count > 0) console.log(`    ${cat}: ${count}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
