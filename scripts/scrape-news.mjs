import Parser from 'rss-parser';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; ScienceReader/1.0)'
  }
});

const RSS_SOURCES = [
  {
    category: '航天深空·天文新知',
    feeds: [
      { name: '新华网科技', url: 'http://www.xinhuanet.com/science/news_sci.rss' },
      { name: '环球网科技', url: 'https://rss.huanqiu.com/rss/science' }
    ],
    keywords: ['航天', '火箭', '卫星', '天文', '深空', '火星', '月球', '空间站', '宇宙', '望远镜']
  },
  {
    category: '考古文博·古文明发掘',
    feeds: [
      { name: '新华网文化', url: 'http://www.xinhuanet.com/culture/news_cul.rss' }
    ],
    keywords: ['考古', '文物', '古墓', '遗址', '博物馆', '发掘', '古文明', '青铜', '化石']
  },
  {
    category: '大国工程·前沿科技突破',
    feeds: [
      { name: '新华网科技', url: 'http://www.xinhuanet.com/tech/news_tech.rss' },
      { name: '环球网科技', url: 'https://rss.huanqiu.com/rss/tech' }
    ],
    keywords: ['高铁', '大桥', '工程', '芯片', '量子', '人工智能', '机器人', '5G', '新能源']
  },
  {
    category: '地球自然·气象地质博物探索',
    feeds: [
      { name: '新华网', url: 'http://www.xinhuanet.com/env/news_env.rss' }
    ],
    keywords: ['气象', '地质', '地震', '火山', '台风', '气候', '冰川', '海洋', '矿石']
  },
  {
    category: '生物世界·生命科学科普',
    feeds: [
      { name: '新华网科技', url: 'http://www.xinhuanet.com/science/news_bio.rss' }
    ],
    keywords: ['生物', '动物', '植物', '基因', '细胞', '物种', '生态', '恐龙', '进化']
  },
  {
    category: '地理探索·环球人文地貌',
    feeds: [
      { name: '环球网', url: 'https://rss.huanqiu.com/rss/world' }
    ],
    keywords: ['地理', '地形', '河流', '山脉', '沙漠', '极地', '海洋', '湖泊', '峡谷']
  },
  {
    category: '青少年健康医学科普',
    feeds: [],
    keywords: ['健康', '营养', '运动', '睡眠', '近视', '卫生', '疫苗', '防疫']
  },
  {
    category: '生态环境·地球保护科考',
    feeds: [
      { name: '新华网环境', url: 'http://www.xinhuanet.com/env/news_env.rss' }
    ],
    keywords: ['环保', '生态', '碳中和', '新能源', '保护', '森林', '湿地', '濒危', '污染']
  },
  {
    category: '环球人文与跨国科考见闻',
    feeds: [
      { name: '环球网', url: 'https://rss.huanqiu.com/rss/world' }
    ],
    keywords: ['科考', '探险', '人文', '民俗', '文化', '世界遗产', '丝路', '极地']
  }
];

async function fetchFromRSS(feedUrl) {
  try {
    const feed = await parser.parseURL(feedUrl);
    return (feed.items || []).slice(0, 20).map(item => ({
      title: item.title || '',
      summary: item.contentSnippet || item.content || item.summary || '',
      link: item.link || '',
      source: feed.title || '',
      pubDate: item.pubDate || item.isoDate || ''
    }));
  } catch (err) {
    console.warn(`RSS fetch failed for ${feedUrl}:`, err.message);
    return [];
  }
}

async function fetchFromHTML(url) {
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ScienceReader/1.0)'
      },
      signal: AbortSignal.timeout(10000)
    });
    if (!resp.ok) return [];
    const html = await resp.text();

    const titles = [];
    const titleRegex = /<h[1-3][^>]*>.*?<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
    let match;
    while ((match = titleRegex.exec(html)) !== null && titles.length < 10) {
      titles.push({
        title: match[2].trim(),
        link: match[1].startsWith('http') ? match[1] : new URL(match[1], url).href,
        summary: '',
        source: new URL(url).hostname,
        pubDate: ''
      });
    }
    return titles;
  } catch (err) {
    console.warn(`HTML fetch failed for ${url}:`, err.message);
    return [];
  }
}

function filterByKeywords(items, keywords) {
  return items.filter(item => {
    const text = (item.title + ' ' + item.summary).toLowerCase();
    return keywords.some(kw => text.includes(kw.toLowerCase()));
  });
}

async function scrapeCategory(categoryConfig) {
  const { category, feeds, keywords } = categoryConfig;
  let allItems = [];

  for (const feed of feeds) {
    let items = await fetchFromRSS(feed.url);
    if (items.length === 0 && feed.fallbackUrl) {
      items = await fetchFromHTML(feed.fallbackUrl);
    }
    items = items.map(item => ({ ...item, category }));
    allItems.push(...items);
  }

  if (allItems.length > 0 && keywords.length > 0) {
    const keywordFiltered = filterByKeywords(allItems, keywords);
    if (keywordFiltered.length > 0) {
      allItems = keywordFiltered;
    }
  }

  const seen = new Set();
  allItems = allItems.filter(item => {
    const key = item.title.substring(0, 20);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return allItems;
}

async function scrapeAllNews() {
  const results = {};

  for (const catConfig of RSS_SOURCES) {
    try {
      const items = await scrapeCategory(catConfig);
      results[catConfig.category] = items;
      console.log(`  [${catConfig.category}] fetched ${items.length} items`);
    } catch (err) {
      console.warn(`  [${catConfig.category}] scrape failed:`, err.message);
      results[catConfig.category] = [];
    }
  }

  return results;
}

export { scrapeAllNews, RSS_SOURCES };
