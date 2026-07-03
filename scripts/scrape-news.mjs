import Parser from 'rss-parser';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
  },
  customFields: {
    item: ['media:content', 'media:thumbnail', 'enclosure', 'description', 'content:encoded']
  }
});

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
  '航天深空·天文新知': ['航天', '火箭', '卫星', '天文', '深空', '火星', '月球', '空间站', '宇宙', '望远镜', '探测', '太阳', '黑洞', 'NASA', 'SpaceX', '长征', '天问', '嫦娥', '北斗', '行星', '银河', '星座', '火箭发射', '太空'],
  '考古文博·古文明发掘': ['考古', '文物', '古墓', '遗址', '博物馆', '发掘', '古文明', '青铜', '化石', '古城', '陵墓', '壁画', '三星堆', '敦煌', '兵马俑', '遗产', '古籍', '文物保护', '历史'],
  '大国工程·前沿科技突破': ['芯片', '量子', '人工智能', '机器人', '5G', '6G', '新能源', '核电', '超级计算机', '电池', '光伏', '半导体', '大模型', 'AI', '自动驾驶', '无人机', '深海', '国产', '突破', '研发', '高铁', '大桥', '工程', '科技'],
  '地球自然·气象地质博物探索': ['气象', '地质', '地震', '火山', '台风', '气候', '冰川', '海洋', '降雨', '寒潮', '暴雨', '天气', '自然', '极端天气', '海平面', '极地', '冻土', '矿石'],
  '生物世界·生命科学科普': ['生物', '动物', '植物', '基因', '细胞', '物种', '恐龙', '进化', '病毒', '细菌', '疫苗', '蛋白质', '神经', '免疫', '遗传', '熊猫', 'DNA', '新物种', '濒危', '生态保护'],
  '地理探索·环球人文地貌': ['地理', '地形', '河流', '山脉', '沙漠', '极地', '海洋', '湖泊', '峡谷', '高原', '盆地', '热带雨林', '珊瑚礁', '探险', '地貌', '世界遗产', '国家公园', '自然景观'],
  '青少年健康医学科普': ['健康', '营养', '运动', '睡眠', '近视', '卫生', '疫苗', '青少年', '学生', '体质', '心理', '发育', '饮食', '锻炼', '护眼', '肥胖', '生长'],
  '生态环境·地球保护科考': ['环保', '生态', '碳中和', '保护', '森林', '湿地', '濒危', '污染', '减排', '垃圾分类', '可持续', '绿色', '碳达峰', '太阳能', '风电', '清洁能源', '塑料', '水资源'],
  '环球人文与跨国科考见闻': ['科考', '探险', '人文', '民俗', '文化', '世界遗产', '丝路', '极地', '南极', '北极', '深海', '登山', '国际', '全球', '跨国', '海外', '交流', '外国']
};

const BLACKLIST_KEYWORDS = ['融资', '投资', '股价', '上市', 'IPO', '估值', '基金', '炒股', '理财', '借贷', '金融', '期货', '牛市', '熊市', '涨停', '跌停', '分红', '减持', '增持', '营收', '财报', '净利润', '市值'];

const feedCache = new Map();

function extractImages(html) {
  if (!html) return [];
  const imgs = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    if (src && !src.includes('data:image') && !src.includes('icon') && !src.includes('logo') && !src.includes('avatar') && !src.includes('ad')) {
      imgs.push(src);
    }
  }
  return imgs;
}

function isBlacklisted(title, summary) {
  const text = (title + ' ' + summary);
  return BLACKLIST_KEYWORDS.some(kw => text.includes(kw));
}

async function fetchFeed(feedConfig) {
  if (feedCache.has(feedConfig.url)) {
    return feedCache.get(feedConfig.url);
  }

  try {
    const feed = await parser.parseURL(feedConfig.url);
    const items = (feed.items || []).slice(0, 60).map(item => {
      const rawHtml = item['content:encoded'] || item.content || item.description || '';
      const desc = item.contentSnippet || rawHtml.replace(/<[^>]*>/g, '');
      const images = extractImages(rawHtml);

      return {
        title: (item.title || '').trim(),
        summary: desc.substring(0, 500),
        content: rawHtml,
        link: item.link || item.guid || '',
        source: feedConfig.name,
        pubDate: item.pubDate || item.isoDate || '',
        images: images.slice(0, 3),
        priority: feedConfig.priority
      };
    }).filter(item => item.title.length > 4 && !isBlacklisted(item.title, item.summary));

    feedCache.set(feedConfig.url, items);
    console.log(`  [RSS] ${feedConfig.name}: ${items.length} items`);
    return items;
  } catch (err) {
    console.warn(`  [RSS] ${feedConfig.name} failed: ${err.message}`);
    feedCache.set(feedConfig.url, []);
    return [];
  }
}

function matchCategory(item, keywords) {
  const text = (item.title + ' ' + item.summary).toLowerCase();
  return keywords.some(kw => text.includes(kw.toLowerCase()));
}

async function scrapeAllNews() {
  console.log('Fetching all RSS feeds...');
  const allFeedItems = [];

  for (const feed of FEEDS) {
    const items = await fetchFeed(feed);
    allFeedItems.push(...items);
  }

  console.log(`Total raw items: ${allFeedItems.length}`);

  const results = {};
  const usedTitles = new Set();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const matched = allFeedItems
      .filter(item => matchCategory(item, keywords))
      .filter(item => !usedTitles.has(item.title));

    matched.sort((a, b) => (a.priority || 3) - (b.priority || 3));

    const sourceCount = {};
    const selected = [];
    const MAX_PER_SOURCE = 4;

    for (const item of matched) {
      const count = sourceCount[item.source] || 0;
      if (count >= MAX_PER_SOURCE) continue;
      sourceCount[item.source] = count + 1;
      selected.push({ ...item, category });
      usedTitles.add(item.title);
      if (selected.length >= 8) break;
    }

    results[category] = selected;
    console.log(`  [${category}] => ${selected.length} items`);
  }

  const total = Object.values(results).reduce((s, arr) => s + arr.length, 0);
  console.log(`Total distributed: ${total}`);
  return results;
}

export { scrapeAllNews };
