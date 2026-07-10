import Parser from 'rss-parser';

const DEEPSEEK_KEY = process.env.AI_API_KEY || '';
const DEEPSEEK_URL = process.env.AI_BASE_URL || 'https://api.xiaomimimo.com/v1';

const parser = new Parser({ timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });

const CATS = {
  '航天深空·天文新知': ['航天','火箭','卫星','天文','火星','月球','空间站','宇宙','望远镜','探测','太阳','黑洞','行星','银河'],
  '考古文博·古文明发掘': ['考古','文物','古墓','遗址','博物馆','发掘','化石','三星堆','敦煌','兵马俑','遗产','历史'],
  '大国工程·前沿科技突破': ['芯片','量子','机器人','5G','新能源','核电','电池','半导体','大模型','AI','高铁','桥','科技'],
  '地球自然·气象地质博物探索': ['气象','地质','地震','火山','台风','气候','冰川','海洋','天气','自然'],
  '生物世界·生命科学科普': ['生物','动物','植物','基因','细胞','物种','恐龙','进化','病毒','疫苗','DNA'],
  '地理探索·环球人文地貌': ['地理','地形','河流','山脉','沙漠','极地','海洋','湖泊','地貌','世界遗产'],
  '青少年健康医学科普': ['健康','营养','运动','睡眠','近视','卫生','青少年','发育','生长'],
  '生态环境·地球保护科考': ['环保','生态','保护','森林','湿地','污染','清洁能源','水资源'],
  '环球时讯·国际时政': ['国际','世界','全球','外交','合作','协议','联合国','经济','贸易','政治','领导人','政府','国家','地区','发展','论坛','会议','声明','共识','峰会','会谈','访问','签署'],
  '环球人文与跨国科考见闻': ['科考','探险','人文','民俗','文化','世界遗产','丝路','极地','南极','北极','深海','登山','考古','文明','国际','全球','跨国','海外','交流','外国']
};

const BLACKLIST = ['融资','投资','股价','上市','IPO','估值','基金','炒股','理财','借贷','金融','期货','牛市','熊市','涨停','跌停','分红','减持','增持','营收','财报','净利润','市值','游戏限免','GOG喜加一','Steam折扣','游戏打折','游戏促销','游戏氪金','手游充值','电子竞技','游戏主播','游戏代练','二次元','动漫周边','网络小说'];

function isEn(t) { return t && (t.match(/[一-鿿]/g)||[]).length < 10 && t.length > 20; }
function isBlack(t, s) { return BLACKLIST.some(k => (t+s).includes(k)); }

function matchCat(item) {
  const text = (item.title + ' ' + (item.summary||'')).toLowerCase();
  let best = '推荐阅读';
  let bestN = 0;
  for (const [cat, kws] of Object.entries(CATS)) {
    const n = kws.filter(k => text.includes(k.toLowerCase())).length;
    if (n > bestN) { bestN = n; best = cat; }
  }
  return best;
}

async function fetchFeed(url) {
  try {
    const feed = await parser.parseURL(url);
    return (feed.items||[]).slice(0, 40).map(i => {
      const raw = i['content:encoded'] || i.content || '';
      const desc = (i.contentSnippet || raw.replace(/<[^>]*>/g, '')).substring(0, 400);
      return { title: (i.title||'').trim(), summary: desc, content: raw, link: i.link||'', source: feed.title || '' };
    }).filter(x => x.title.length > 4);
  } catch { return []; }
}

async function fetchHTML(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) return [];
    const html = await r.text();
    const items = [];
    const re = /<a[^>]*href="([^"]+)"[^>]*>([^<]{8,80})<\/a>/gi;
    let m; const seen = new Set();
    while ((m = re.exec(html)) !== null && items.length < 20) {
      const t = m[2].trim();
      if (seen.has(t) || t.length < 8 || isEn(t) || isBlack(t, '')) continue;
      seen.add(t);
      items.push({ title: t, summary: '', content: `<p>${t}</p>`, link: m[1], source: new URL(url).hostname });
    }
    return items;
  } catch { return []; }
}

async function ai(msgs, maxT = 2000) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`${DEEPSEEK_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${DEEPSEEK_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'Flash', messages: msgs, max_tokens: maxT }),
        signal: AbortSignal.timeout(45000)
      });
      const d = await r.json();
      return d.choices?.[0]?.message?.content || '';
    } catch (e) {
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
    }
  }
  return '';
}

function wc(h) { const c = (h||'').replace(/<[^>]*>/g,'').replace(/\s/g,''); return { wordCount: c.length, readTime: Math.max(3, Math.ceil(c.length/300)) }; }
function parseQ(text) {
  if (!text) return null;
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const q = JSON.parse(m[0]);
    if (!q.single || !q.judge) return null;
    return q;
  } catch { return null; }
}

export default async function handler(req, res) {
  const authToken = process.env.CRON_SECRET || 'youth-reader-2026';
  const providedToken = req.headers?.get?.('authorization')?.replace('Bearer ', '') || req.query?.secret || req.body?.secret;
  const isVercelCron = req.headers?.get?.('x-vercel-cron') === '1' || req.headers?.get?.('user-agent')?.includes('vercel');

  if (providedToken && providedToken !== authToken) {
    return res.status(401).json({ error: 'Unauthorized: invalid token' });
  }
  if (!providedToken && !isVercelCron && req.method === 'GET') {
    return res.status(401).json({ error: 'Unauthorized: add ?secret=youth-reader-2026 to URL' });
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const allItems = [];

  const rssFeeds = [
    ['人民网', 'http://www.people.com.cn/rss/politics.xml'],
    ['中国日报', 'https://www.chinadaily.com.cn/rss/world_rss.xml'],
    ['爱范儿', 'https://www.ifanr.com/feed'],
    ['IT之家', 'https://www.ithome.com/rss/'],
    ['36氪', 'https://36kr.com/feed']
  ];
  for (const [name, url] of rssFeeds) {
    const items = await fetchFeed(url);
    items.forEach(i => allItems.push({ ...i, source: name }));
  }

  for (const url of ['https://www.huanqiu.com/', 'https://www.guancha.cn/']) {
    const items = await fetchHTML(url);
    items.forEach(i => { if (!isBlack(i.title, '')) allItems.push({ ...i, category: '环球时讯·国际时政' }); });
  }

  const seen = new Set();
  const filtered = allItems.filter(i => {
    if (isEn(i.title) || isBlack(i.title, i.summary)) return false;
    if (seen.has(i.title.substring(0, 15))) return false;
    seen.add(i.title.substring(0, 15));
    return true;
  });

  for (const item of filtered) {
    if (!item.category) item.category = matchCat(item);
  }

  const selected = [];
  const cats = Object.keys(CATS);
  for (const cat of cats) {
    const items = filtered.filter(i => i.category === cat);
    items.sort(() => Math.random() - 0.5);
    selected.push(...items.slice(0, 3));
  }
  selected.sort(() => Math.random() - 0.5);
  if (selected.length > 20) selected.length = 20;

  const articles = [];
  for (const item of selected) {
    const fullContent = item.content && item.content.length > 50 ? item.content : null;
    let content = fullContent || `<p>${item.summary || item.title}</p>`;

    if (content.length < 1000 && !item._htmlOnly) {
      const aiContent = await ai([
        { role: 'system', content: '你是青少年科普作家。根据标题和素材，撰写一篇1000-1500字的完整科普文章，使用HTML格式（p、h2、h3标签），不要输出标题。' },
        { role: 'user', content: `标题：${item.title}\n素材：${item.summary || item.title}` }
      ], 2000);
      if (aiContent && aiContent.length > 500) content = aiContent;
    }

    const { wordCount, readTime } = wc(content);
    const quizText = await ai([
      { role: 'system', content: '你是科普测验出题专家。只输出JSON。' },
      { role: 'user', content: `根据文章生成2道单选+2道判断。只输出JSON格式：{"single":[{"question":"","options":["A","B","C","D"],"correctOption":"","sourceText":"原文句子"}],"judge":[{"statement":"","correctAnswer":true,"sourceText":"原文句子"}]}\n\n标题：${item.title}\n正文摘要：${content.substring(0, 500)}` }
    ], 1000);
    const quiz = parseQ(quizText);

    articles.push({
      id: `${dateStr}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      category: item.category || '推荐阅读',
      title: item.title,
      content, wordCount, readTime,
      source: item.source || '',
      sourceUrl: item.link || '',
      isWechat: false,
      quiz: quiz || null
    });
  }

  const data = { date: dateStr, generatedAt: new Date().toISOString(), generatedBy: 'cron', articles, totalArticles: articles.length };

  let deployOk = false;
  try {
    const contentB64 = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    const sha = await getFileSha(dateStr);
    const body = { message: `auto: articles ${dateStr}`, content: contentB64, branch: 'main' };
    if (sha) body.sha = sha;
    const resp = await fetch(`https://api.github.com/repos/5vyg9j2c46-debug/youth-science-reader/contents/data/articles/${dateStr}.json`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${process.env.GH_PAT}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    deployOk = resp.status === 200 || resp.status === 201;
  } catch (e) {
    console.warn('GitHub deploy failed:', e.message);
  }

  return res.status(200).json({ success: true, date: dateStr, articleCount: articles.length, sources: [...new Set(articles.map(a => a.source))], deployOk });
}

async function getFileSha(dateStr) {
  try {
    const r = await fetch(`https://api.github.com/repos/5vyg9j2c46-debug/youth-science-reader/contents/data/articles/${dateStr}.json`, {
      headers: { 'Authorization': `Bearer ${process.env.GH_PAT}` }
    });
    const d = await r.json();
    return d.sha || null;
  } catch { return null; }
}
