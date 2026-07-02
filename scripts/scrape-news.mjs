import Parser from 'rss-parser';

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
  },
  customFields: {
    item: ['media:content', 'media:thumbnail', 'enclosure', 'description', 'content:encoded']
  }
});

const RSS_SOURCES = [
  {
    category: '航天深空·天文新知',
    feeds: [
      { name: '科学网-航天', url: 'https://news.sciencenet.cn/rss.aspx?tid=3' },
      { name: '中科院之声', url: 'http://www.cas.cn/rss/rss.xml' }
    ],
    htmlFallbacks: [
      { name: '科学网-航天', url: 'https://news.sciencenet.cn/news.aspx?type=3' }
    ],
    keywords: ['航天', '火箭', '卫星', '天文', '深空', '火星', '月球', '空间站', '宇宙', '望远镜', '探测', '星座', '银河', '太阳', '黑洞', '彗星', '小行星']
  },
  {
    category: '考古文博·古文明发掘',
    feeds: [
      { name: '科学网-考古', url: 'https://news.sciencenet.cn/rss.aspx?tid=7' }
    ],
    htmlFallbacks: [
      { name: '科学网-考古', url: 'https://news.sciencenet.cn/news.aspx?type=7' }
    ],
    keywords: ['考古', '文物', '古墓', '遗址', '博物馆', '发掘', '古文明', '青铜', '化石', '古城', '陵墓', '壁画', '陶器', '甲骨']
  },
  {
    category: '大国工程·前沿科技突破',
    feeds: [
      { name: '科学网-信息技术', url: 'https://news.sciencenet.cn/rss.aspx?tid=1' },
      { name: '36氪', url: 'https://36kr.com/feed' },
      { name: 'IT之家', url: 'https://www.ithome.com/rss/' }
    ],
    htmlFallbacks: [
      { name: '科学网-信息', url: 'https://news.sciencenet.cn/news.aspx?type=1' },
      { name: 'IT之家', url: 'https://www.ithome.com/' }
    ],
    keywords: ['高铁', '大桥', '工程', '芯片', '量子', '人工智能', '机器人', '5G', '新能源', '核电', '超级计算机', '北斗', '电池', '光伏', '半导体', '算力', '大模型']
  },
  {
    category: '地球自然·气象地质博物探索',
    feeds: [
      { name: '科学网-地球', url: 'https://news.sciencenet.cn/rss.aspx?tid=6' }
    ],
    htmlFallbacks: [
      { name: '科学网-地球', url: 'https://news.sciencenet.cn/news.aspx?type=6' }
    ],
    keywords: ['气象', '地质', '地震', '火山', '台风', '气候', '冰川', '海洋', '矿石', '化石', '降雨', '寒潮', '暴雨', '雷电', '泥石流', '滑坡']
  },
  {
    category: '生物世界·生命科学科普',
    feeds: [
      { name: '科学网-生命', url: 'https://news.sciencenet.cn/rss.aspx?tid=4' },
      { name: '果壳网', url: 'https://www.guokr.com/rss/' }
    ],
    htmlFallbacks: [
      { name: '科学网-生命', url: 'https://news.sciencenet.cn/news.aspx?type=4' },
      { name: '果壳科学', url: 'https://www.guokr.com/scientific/' }
    ],
    keywords: ['生物', '动物', '植物', '基因', '细胞', '物种', '恐龙', '进化', '病毒', '细菌', '疫苗', '蛋白质', '神经', '免疫', '遗传', '生态']
  },
  {
    category: '地理探索·环球人文地貌',
    feeds: [
      { name: '科学网-综合', url: 'https://news.sciencenet.cn/rss.aspx?tid=8' }
    ],
    htmlFallbacks: [
      { name: '科学网-综合', url: 'https://news.sciencenet.cn/news.aspx?type=8' }
    ],
    keywords: ['地理', '地形', '河流', '山脉', '沙漠', '极地', '海洋', '湖泊', '峡谷', '高原', '盆地', '冰原', '热带雨林', '珊瑚礁']
  },
  {
    category: '青少年健康医学科普',
    feeds: [
      { name: '科学网-医药', url: 'https://news.sciencenet.cn/rss.aspx?tid=5' }
    ],
    htmlFallbacks: [
      { name: '科学网-医药', url: 'https://news.sciencenet.cn/news.aspx?type=5' }
    ],
    keywords: ['健康', '营养', '运动', '睡眠', '近视', '卫生', '疫苗', '防疫', '生长', '发育', '饮食', '锻炼', '心理', '护眼', '身高', '体重']
  },
  {
    category: '生态环境·地球保护科考',
    feeds: [
      { name: '科学网-环境', url: 'https://news.sciencenet.cn/rss.aspx?tid=2' }
    ],
    htmlFallbacks: [
      { name: '科学网-环境', url: 'https://news.sciencenet.cn/news.aspx?type=2' }
    ],
    keywords: ['环保', '生态', '碳中和', '新能源', '保护', '森林', '湿地', '濒危', '污染', '减排', '垃圾分类', '可持续', '绿色', '碳达峰']
  },
  {
    category: '环球人文与跨国科考见闻',
    feeds: [
      { name: '科学网-综合', url: 'https://news.sciencenet.cn/rss.aspx?tid=8' }
    ],
    htmlFallbacks: [
      { name: '爱范儿', url: 'https://www.ifanr.com/' }
    ],
    keywords: ['科考', '探险', '人文', '民俗', '文化', '世界遗产', '丝路', '极地', '南极', '北极', '深海', '登山', '考古', '文明']
  }
];

async function fetchFromRSS(feedUrl) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const feed = await parser.parseURL(feedUrl);
    clearTimeout(timeout);

    const items = (feed.items || []).slice(0, 20).map(item => {
      const desc = item.contentSnippet || item.content || item.description || item.summary || '';
      const cleanDesc = desc.replace(/<[^>]*>/g, '').substring(0, 500);

      return {
        title: (item.title || '').trim(),
        summary: cleanDesc,
        link: item.link || item.guid || '',
        source: feed.title || '',
        pubDate: item.pubDate || item.isoDate || ''
      };
    }).filter(item => item.title.length > 0);

    return items;
  } catch (err) {
    console.warn(`    RSS failed (${feedUrl}): ${err.message}`);
    return [];
  }
}

async function fetchFromHTML(htmlConfig) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const resp = await fetch(htmlConfig.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      console.warn(`    HTML fetch failed (${htmlConfig.url}): HTTP ${resp.status}`);
      return [];
    }

    const html = await resp.text();
    const items = [];

    const titleRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]{8,80})<\/a>/gi;
    let match;
    const seen = new Set();

    while ((match = titleRegex.exec(html)) !== null && items.length < 15) {
      const title = match[2].trim();
      const link = match[1];

      if (title.length < 8 || title.length > 80) continue;
      if (seen.has(title)) continue;
      if (link.includes('javascript:') || link === '#' || link === '/') continue;
      if (/^\d+$/.test(title)) continue;
      if (title.includes('登录') || title.includes('注册') || title.includes('下载') || title.includes('首页')) continue;

      seen.add(title);
      const fullLink = link.startsWith('http') ? link : new URL(link, htmlConfig.url).href;
      items.push({
        title,
        summary: '',
        link: fullLink,
        source: htmlConfig.name,
        pubDate: ''
      });
    }

    return items;
  } catch (err) {
    console.warn(`    HTML crawl failed (${htmlConfig.url}): ${err.message}`);
    return [];
  }
}

function filterByKeywords(items, keywords) {
  if (!keywords || keywords.length === 0) return items;
  return items.filter(item => {
    const text = (item.title + ' ' + item.summary).toLowerCase();
    return keywords.some(kw => text.includes(kw.toLowerCase()));
  });
}

async function scrapeCategory(categoryConfig) {
  const { category, feeds, htmlFallbacks, keywords } = categoryConfig;
  let allItems = [];

  for (const feed of feeds) {
    const items = await fetchFromRSS(feed.url);
    if (items.length > 0) {
      console.log(`    [RSS] ${feed.name}: ${items.length} items`);
      allItems.push(...items);
    }
  }

  if (allItems.length === 0 && htmlFallbacks && htmlFallbacks.length > 0) {
    console.log(`    [HTML] RSS failed, trying HTML fallback...`);
    for (const hf of htmlFallbacks) {
      const items = await fetchFromHTML(hf);
      if (items.length > 0) {
        console.log(`    [HTML] ${hf.name}: ${items.length} items`);
        allItems.push(...items);
      }
    }
  }

  allItems = allItems.map(item => ({ ...item, category }));

  if (allItems.length > 0 && keywords && keywords.length > 0) {
    const keywordFiltered = filterByKeywords(allItems, keywords);
    if (keywordFiltered.length >= 2) {
      allItems = keywordFiltered;
    }
  }

  const seen = new Set();
  allItems = allItems.filter(item => {
    const key = item.title.substring(0, 15);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return allItems;
}

async function scrapeAllNews() {
  const results = {};
  let totalFetched = 0;

  for (const catConfig of RSS_SOURCES) {
    try {
      const items = await scrapeCategory(catConfig);
      results[catConfig.category] = items;
      totalFetched += items.length;
      console.log(`  [${catConfig.category}] => ${items.length} items`);
    } catch (err) {
      console.warn(`  [${catConfig.category}] scrape error: ${err.message}`);
      results[catConfig.category] = [];
    }
  }

  console.log(`\n  Total fetched: ${totalFetched}`);
  return results;
}

export { scrapeAllNews, RSS_SOURCES };
