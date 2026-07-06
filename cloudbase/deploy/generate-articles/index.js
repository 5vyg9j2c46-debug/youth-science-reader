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

const AI_API_KEY = process.env.AI_API_KEY || '26d876b72ae14cc48c3bcdb6e42375e6.3b3EI8BC0pq2p59F';
const AI_BASE_URL = process.env.AI_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
const AI_MODEL = process.env.AI_MODEL || 'glm-4-flash-250414';

const FEEDS = [
  { name: '环球网', url: 'https://rss.huanqiu.com/xml/world.xml', priority: 1 },
  { name: '环球网科技', url: 'https://rss.huanqiu.com/rss/science', priority: 1 },
  { name: '中国日报', url: 'https://www.chinadaily.com.cn/rss/world_rss.xml', priority: 2 },
  { name: '爱范儿', url: 'https://www.ifanr.com/feed', priority: 2 },
  { name: '少数派', url: 'https://sspai.com/feed', priority: 2 },
  { name: 'IT之家', url: 'https://www.ithome.com/rss/', priority: 3 },
  { name: '36氪', url: 'https://36kr.com/feed', priority: 3 }
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

const HTML_SOURCES = [
  { name: '中国科普网', url: 'https://www.zgkpw.org.cn/news/index.html', baseUrl: 'https://www.zgkpw.org.cn' },
  { name: '科普中国', url: 'https://www.kepuchina.cn/list/listinfo?at_id=AT201604301608271001', baseUrl: 'https://www.kepuchina.cn' },
  { name: '央视网', url: 'https://news.cctv.cn', baseUrl: 'https://news.cctv.cn' }
];

async function fetchHTML(source) {
  try {
    const resp = await fetch(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      },
      signal: AbortSignal.timeout(12000)
    });
    if (!resp.ok) return [];
    const html = await resp.text();

    const items = [];
    const regex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]{8,80})<\/a>/gi;
    let match;
    const seen = new Set();

    while ((match = regex.exec(html)) !== null && items.length < 20) {
      const title = match[2].trim().replace(/[\s\n]+/g, ' ');
      const link = match[1];
      if (title.length < 8 || title.length > 80) continue;
      if (seen.has(title)) continue;
      if (link.includes('javascript:') || link === '#' || link === '/') continue;
      if (/^\d+$/.test(title)) continue;
      if (/登录|注册|下载|首页|更多|返回|导航|菜单/.test(title)) continue;

      seen.add(title);
      const fullLink = link.startsWith('http') ? link : (source.baseUrl + link);
      items.push({
        title,
        summary: '',
        content: '',
        link: fullLink,
        source: source.name,
        pubDate: '',
        priority: 1
      });
    }
    console.log(`  [HTML] ${source.name}: ${items.length} items`);
    return items;
  } catch (e) {
    console.warn(`  [HTML] ${source.name} failed: ${e.message}`);
    return [];
  }
}

function isBlacklisted(title, summary) {
  return BLACKLIST.some(kw => (title + ' ' + summary).includes(kw));
}

async function fetchFeed(feedConfig) {
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
    return items;
  } catch (e) {
    console.warn(`RSS failed ${feedConfig.name}: ${e.message}`);
    return [];
  }
}

async function callAI(messages, maxTokens = 4096) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(`${AI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${AI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: AI_MODEL, messages, max_tokens: maxTokens }),
        signal: AbortSignal.timeout(45000)
      });
      const data = await resp.json();
      const msg = data.choices?.[0]?.message;
      return msg?.content || '';
    } catch (e) {
      console.warn(`AI attempt ${attempt + 1} failed: ${e.message}`);
      if (attempt === 0) await new Promise(r => setTimeout(r, 2000));
    }
  }
  return '';
}

async function filterArticles(items) {
  if (items.length === 0) return items;

  const prompt = `审核以下新闻是否适合11-12岁学生。只拒绝：战争暴力、犯罪、色情、赌博、金融炒股。
其他全部通过。输出JSON数组：[{"index":1,"pass":true}]
只输出JSON。

${items.map((it, i) => `[${i+1}] ${it.title}`).join('\n')}`;

  const content = await callAI([
    { role: 'system', content: '你是内容审核员。宽松审核，只拒绝明显不适合儿童的内容。只输出JSON数组。' },
    { role: 'user', content: prompt }
  ], 1024);

  try {
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) return items;
    const results = JSON.parse(match[0]);
    const filtered = items.filter((_, i) => results[i]?.pass !== false);
    return filtered.length > 0 ? filtered : items;
  } catch { return items; }
}

async function rewriteArticle(article) {
  let rawContent = article.content || article.summary || '';
  let charCount = rawContent.replace(/<[^>]*>/g, '').length;

  if (charCount < 50 && article.link) {
    try {
      const resp = await fetch(article.link, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(10000)
      });
      if (resp.ok) {
        const html = await resp.text();
        const bodyMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
          || html.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
          || html.match(/<div[^>]*id="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        if (bodyMatch) {
          rawContent = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, '').trim();
          charCount = rawContent.length;
          console.log(`  Fetched ${charCount} chars from ${article.link.substring(0, 50)}`);
        }
      }
    } catch (e) {
      console.warn(`  Fetch failed for ${article.link.substring(0, 50)}: ${e.message}`);
    }
  }

  const title = article.title || '';
  const source = article.source || '';

  let prompt, systemMsg;

  if (charCount > 5000) {
    systemMsg = '你是青少年科普作家。精简文章到1000-1500字，保留核心知识。只输出HTML正文，不要输出标题。';
    prompt = `将以下文章精简到1000-1500字，保留核心知识点，只输出正文HTML：\n\n标题：${title}\n来源：${source}\n\n${rawContent}`;
  } else if (charCount < 800) {
    systemMsg = '你是青少年科普作家。根据标题和素材，撰写一篇1000-1500字的完整科普文章。面向11-12岁学生，通俗易懂，有科学原理和具体案例。只输出HTML正文，不要输出标题。';
    prompt = `请根据以下信息撰写一篇1000-1500字的科普文章。面向11-12岁学生，补充科学原理、背景知识、具体案例。只输出正文HTML。

标题：${title}
来源：${source}
素材内容：${rawContent || '（无详细内容，请根据标题撰写）'}`;
  } else {
    systemMsg = '你是青少年科普编辑。最小化编辑，保留全文。只输出HTML正文，不要输出标题。';
    prompt = `对以下文章做最小化编辑（修正语病、优化分段），完整保留全文内容，只输出正文HTML，不要输出标题：\n\n标题：${title}\n来源：${source}\n\n${rawContent}`;
  }

  const content = await callAI([
    { role: 'system', content: systemMsg },
    { role: 'user', content: prompt }
  ], 4096);

  if (!content || content.length < 20) {
    return null;
  }

  return content;
}

async function generateQuiz(article) {
  const plainText = (article.content || '').replace(/<[^>]*>/g, '');
  if (plainText.length < 50) return null;

  const minutes = Math.ceil(plainText.length / 300);
  const sc = minutes <= 5 ? 3 : minutes <= 10 ? 4 : 5;
  const jc = sc;

  const paragraphs = plainText.split(/[。！？；\n]+/).filter(s => s.trim().length > 10);
  if (paragraphs.length < 2) return null;

  const numbered = paragraphs.map((s, i) => `[${i+1}] ${s.trim()}`).join('\n');

  const content = await callAI([
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
  let dateStr, isExtra, excludeTitles = [];

  if (event.body) {
    try {
      const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      dateStr = body.date || new Date().toISOString().split('T')[0];
      isExtra = body.extra === true;
      excludeTitles = body.excludeTitles || [];
    } catch {
      dateStr = new Date().toISOString().split('T')[0];
    }
  } else {
    dateStr = event.date || new Date().toISOString().split('T')[0];
    isExtra = event.extra === true;
    excludeTitles = event.excludeTitles || [];
  }

  const targetCount = 8;

  console.log(`=== Generating for ${dateStr}, extra=${isExtra}, exclude=${excludeTitles.length} ===`);

  const allItems = [];
  for (const feed of FEEDS) {
    const items = await fetchFeed(feed);
    allItems.push(...items);
  }
  for (const htmlSource of HTML_SOURCES) {
    const items = await fetchHTML(htmlSource);
    allItems.push(...items);
  }
  console.log(`Total raw: ${allItems.length}`);

  const usedTitles = new Set(excludeTitles);
  const selected = [];
  const sourceCount = {};

  const cats = Object.entries(CATEGORY_KEYWORDS);
  for (let round = 0; round < 10 && selected.length < targetCount; round++) {
    for (const [cat, keywords] of cats) {
      if (selected.filter(s => s.category === cat).length >= 4) continue;

      const matched = allItems.filter(item => {
        const text = (item.title + ' ' + item.summary).toLowerCase();
        const sc = sourceCount[item.source] || 0;
        return keywords.some(kw => text.includes(kw.toLowerCase())) && !usedTitles.has(item.title) && sc < 3;
      }).sort(() => Math.random() - 0.5);

      for (const item of matched) {
        if (usedTitles.has(item.title)) continue;
        usedTitles.add(item.title);
        sourceCount[item.source] = (sourceCount[item.source] || 0) + 1;
        selected.push({ ...item, category: cat });
        break;
      }
    }
  }

  console.log(`Selected: ${selected.length}`);

  if (selected.length < targetCount) {
    const remaining = allItems.filter(item => !usedTitles.has(item.title) && !isBlacklisted(item.title, item.summary));
    const shortfall = targetCount - selected.length;
    const fallback = remaining.sort(() => Math.random() - 0.5).slice(0, shortfall);
    for (const item of fallback) {
      const cat = cats[selected.length % cats.length][0];
      selected.push({ ...item, category: cat });
    }
    console.log(`Fallback added: ${fallback.length}, total: ${selected.length}`);
  }

  const filtered = await filterArticles(selected);
  console.log(`Filtered: ${filtered.length}`);

  const final = filtered.slice(0, targetCount);
  const articles = [];

  for (let i = 0; i < final.length && articles.length < targetCount; i++) {
    const item = final[i];
    console.log(`Processing ${i+1}/${final.length}: ${item.title.substring(0, 30)}...`);
    const content = await rewriteArticle(item);

    if (!content) {
      console.warn(`  Rewrite returned null: ${item.title.substring(0, 30)}`);
      continue;
    }

    const { wordCount, readTime } = calcReadTime(content);

    if (wordCount < 500) {
      console.warn(`  Skipping too short (${wordCount} chars): ${item.title.substring(0, 30)}`);
      continue;
    }

    const quiz = await generateQuiz({ ...item, content });

    articles.push({
      id: `${dateStr}-${Date.now()}-${String(i + 1).padStart(3, '0')}`,
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

  const result = {
    date: dateStr,
    articleCount: articles.length,
    articles: articles
  };

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
