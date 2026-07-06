const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
  }
});

const DEEPSEEK_KEY = process.env.AI_API_KEY || 'sk-B7RdT263fDdbADatxMCgfyvlPb8ExPAURXpIEUTZ58H3N9jA';
const DEEPSEEK_URL = process.env.AI_BASE_URL || 'https://api.deepseek.com';

const FEEDS = [
  { name: '人民网', url: 'http://www.people.com.cn/rss/politics.xml', priority: 1 },
  { name: '中国日报', url: 'https://www.chinadaily.com.cn/rss/world_rss.xml', priority: 1 },
  { name: '爱范儿', url: 'https://www.ifanr.com/feed', priority: 2 },
  { name: '少数派', url: 'https://sspai.com/feed', priority: 2 },
  { name: 'IT之家', url: 'https://www.ithome.com/rss/', priority: 3 },
  { name: '36氪', url: 'https://36kr.com/feed', priority: 3 },
  { name: 'Nature', url: 'https://www.nature.com/nature.rss', priority: 2 }
];

const CATEGORY_KEYWORDS = {
  '航天深空·天文新知': ['航天','火箭','卫星','天文','深空','火星','月球','空间站','宇宙','望远镜','探测','太阳','黑洞','NASA','SpaceX','长征','天问','嫦娥','北斗','行星','银河','太空'],
  '考古文博·古文明发掘': ['考古','文物','古墓','遗址','博物馆','发掘','古文明','青铜','化石','古城','陵墓','壁画','三星堆','敦煌','兵马俑','遗产','古籍','历史'],
  '大国工程·前沿科技突破': ['芯片','量子','人工智能','机器人','5G','6G','新能源','核电','超级计算机','电池','光伏','半导体','大模型','AI','自动驾驶','无人机','深海','国产','突破','研发','高铁','大桥','工程','科技'],
  '地球自然·气象地质博物探索': ['气象','地质','地震','火山','台风','气候','冰川','海洋','降雨','寒潮','暴雨','天气','自然','极端天气','海平面','极地','冻土','矿石'],
  '生物世界·生命科学科普': ['生物','动物','植物','基因','细胞','物种','恐龙','进化','病毒','细菌','疫苗','蛋白质','神经','免疫','遗传','熊猫','DNA','新物种','濒危'],
  '地理探索·环球人文地貌': ['地理','地形','河流','山脉','沙漠','极地','海洋','湖泊','峡谷','高原','盆地','热带雨林','珊瑚礁','探险','地貌','世界遗产','国家公园'],
  '青少年健康医学科普': ['健康','营养','运动','睡眠','近视','卫生','疫苗','青少年','学生','体质','心理','发育','饮食','锻炼','护眼','肥胖','生长'],
  '生态环境·地球保护科考': ['环保','生态','碳中和','保护','森林','湿地','濒危','污染','减排','垃圾分类','可持续','绿色','碳达峰','太阳能','风电','清洁能源','塑料','水资源'],
  '环球人文与跨国科考见闻': ['科考','探险','人文','民俗','文化','世界遗产','丝路','极地','南极','北极','深海','登山','国际','全球','跨国','海外','交流','外国']
};

const BLACKLIST = ['融资','投资','股价','上市','IPO','估值','基金','炒股','理财','借贷','金融','期货','牛市','熊市','涨停','跌停','分红','减持','营收','财报','净利润','市值'];
const feedCache = new Map();

function isBlacklisted(title, summary) {
  return BLACKLIST.some(kw => (title + ' ' + summary).includes(kw));
}

async function fetchFeed(feedConfig) {
  if (feedCache.has(feedConfig.url)) return feedCache.get(feedConfig.url);
  try {
    const feed = await parser.parseURL(feedConfig.url);
    const items = (feed.items || []).slice(0, 60).map(item => ({
      title: (item.title || '').trim(),
      summary: (item.contentSnippet || item.content || '').replace(/<[^>]*>/g, '').substring(0, 500),
      content: item['content:encoded'] || item.content || '',
      link: item.link || '',
      source: feedConfig.name,
      pubDate: item.pubDate || '',
      priority: feedConfig.priority
    })).filter(i => i.title.length > 4 && !isBlacklisted(i.title, i.summary));
    feedCache.set(feedConfig.url, items);
    return items;
  } catch (e) {
    console.warn(`RSS failed ${feedConfig.name}: ${e.message}`);
    feedCache.set(feedConfig.url, []);
    return [];
  }
}

async function callDeepSeek(messages, maxTokens = 4096) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(`${DEEPSEEK_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${DEEPSEEK_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'deepseek-v4-flash', messages, temperature: 0.7, max_tokens: maxTokens, thinking: { type: 'disabled' } }),
        signal: AbortSignal.timeout(45000)
      });
      const data = await resp.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (e) {
      console.warn(`DeepSeek attempt ${attempt + 1} failed: ${e.message}`);
      if (attempt === 0) await new Promise(r => setTimeout(r, 2000));
    }
  }
  return '';
}

async function filterArticles(items) {
  const prompt = `请审核以下新闻素材是否适合11-12岁学生阅读。禁止：战争、犯罪、娱乐八卦、金融投资、重症医疗。允许：科普、自然、科技、考古、地理、健康。
对每条输出JSON数组：[{"index":1,"pass":true/false,"reason":"简短理由"}]
只输出JSON。

${items.map((it, i) => `[${i+1}] ${it.title} | ${it.summary.substring(0,100)}`).join('\n')}`;

  const content = await callDeepSeek([
    { role: 'system', content: '你是内容审核员。只输出JSON数组。' },
    { role: 'user', content: prompt }
  ], 1024);

  try {
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) return items;
    const results = JSON.parse(match[0]);
    return items.filter((_, i) => results[i]?.pass !== false);
  } catch { return items; }
}

async function rewriteArticle(article) {
  const charCount = (article.content || article.summary || '').replace(/<[^>]*>/g, '').length;
  const prompt = charCount > 5000
    ? `将以下文章精简到1000-1500字，保留核心知识点，只输出正文HTML：\n\n${article.title}\n\n${article.content || article.summary}`
    : `对以下文章做最小化编辑（修正语病、优化分段），完整保留全文，只输出正文HTML：\n\n${article.title}\n\n${article.content || article.summary}`;

  const systemMsg = charCount > 5000
    ? '你是青少年科普作家。精简文章到1000-1500字，保留核心知识。只输出HTML正文。'
    : '你是青少年科普编辑。最小化编辑，保留全文。只输出HTML正文。';

  const content = await callDeepSeek([
    { role: 'system', content: systemMsg },
    { role: 'user', content: prompt }
  ], 4096);

  return content || `<p>${article.summary || article.title}</p>`;
}

async function generateQuiz(article) {
  const plainText = (article.content || '').replace(/<[^>]*>/g, '');
  const minutes = Math.ceil(plainText.length / 300);
  const sc = minutes <= 5 ? 3 : minutes <= 10 ? 4 : 5;
  const jc = sc;

  const paragraphs = plainText.split(/[。！？；\n]+/).filter(s => s.trim().length > 10);
  const numbered = paragraphs.map((s, i) => `[${i+1}] ${s.trim()}`).join('\n');

  const content = await callDeepSeek([
    { role: 'system', content: '你是科普测验出题专家。只输出JSON。' },
    { role: 'user', content: `根据以下文章生成${sc}道单选+${jc}道判断。答案必须来自原文。

${numbered}

输出格式：
{"single":[{"question":"题干","options":["A","B","C","D"],"correctOption":"正确选项","sourceParagraph":1,"sourceText":"原文句子"}],"judge":[{"statement":"陈述句","correctAnswer":true,"sourceParagraph":2,"sourceText":"原文句子"}]}` }
  ], 2048);

  try {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const quiz = JSON.parse(match[0]);
    if (quiz.single?.length > 0 && quiz.judge?.length > 0) return quiz;
  } catch {}
  return null;
}

function calcReadTime(html) {
  const clean = (html || '').replace(/<[^>]*>/g, '').replace(/\s/g, '');
  return { wordCount: clean.length, readTime: Math.max(3, Math.ceil(clean.length / 300)) };
}

exports.main = async (event, context) => {
  let dateStr, isExtra;

  if (event.body) {
    try {
      const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      dateStr = body.date || new Date().toISOString().split('T')[0];
      isExtra = body.extra === true;
    } catch {
      dateStr = new Date().toISOString().split('T')[0];
      isExtra = false;
    }
  } else {
    dateStr = event.date || new Date().toISOString().split('T')[0];
    isExtra = event.extra === true;
  }

  const targetCount = 20;

  console.log(`=== Generating for ${dateStr}, extra=${isExtra}, target=${targetCount} ===`);

  const allItems = [];
  for (const feed of FEEDS) {
    const items = await fetchFeed(feed);
    allItems.push(...items);
  }
  console.log(`Total raw: ${allItems.length}`);

  const usedTitles = new Set();
  const selected = [];
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const matched = allItems.filter(item => {
      const text = (item.title + ' ' + item.summary).toLowerCase();
      return keywords.some(kw => text.includes(kw.toLowerCase())) && !usedTitles.has(item.title);
    }).sort((a, b) => (a.priority || 3) - (b.priority || 3));

    const sourceCount = {};
    for (const item of matched) {
      const count = sourceCount[item.source] || 0;
      if (count >= 4) continue;
      sourceCount[item.source] = count + 1;
      selected.push({ ...item, category: cat });
      usedTitles.add(item.title);
      if (selected.filter(s => s.category === cat).length >= 8) break;
    }
  }
  console.log(`Selected: ${selected.length}`);

  const filtered = await filterArticles(selected);
  console.log(`Filtered: ${filtered.length}`);

  const final = filtered.slice(0, targetCount);
  const articles = [];

  for (let i = 0; i < final.length; i++) {
    const item = final[i];
    console.log(`Processing ${i+1}/${final.length}: ${item.title.substring(0, 30)}...`);
    const content = await rewriteArticle(item);
    const quiz = await generateQuiz({ ...item, content });
    const { wordCount, readTime } = calcReadTime(content);

    articles.push({
      id: `${dateStr}-${String(i + 1).padStart(3, '0')}`,
      category: item.category,
      title: item.title,
      content,
      wordCount,
      readTime,
      source: item.source,
      sourceUrl: item.link || '',
      coverImage: '',
      images: [],
      isWechat: false,
      wasCompressed: false,
      ...(quiz ? { quiz } : {})
    });
  }

  const output = {
    date: dateStr,
    isWeekend: [0, 6].includes(new Date(dateStr + 'T00:00:00').getDay()),
    generatedAt: new Date().toISOString(),
    generatedBy: isExtra ? 'extra' : 'auto',
    articles,
    totalArticles: articles.length
  };

  const result = {
    date: dateStr,
    articleCount: articles.length,
    articles: articles
  };

  fs.writeFileSync(path.join('/tmp', `${dateStr}.json`), JSON.stringify(result, null, 2));

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    },
    body: JSON.stringify(result)
  };
};
