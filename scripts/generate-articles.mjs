import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrapeAllNews } from './scrape-news.mjs';
import { filterArticles, batchRewrite } from './ai-review.mjs';
import {
  FILTER_SYSTEM_PROMPT,
  buildFilterPrompt,
  parseFilterResponse,
  REWRITE_SYSTEM_PROMPT,
  buildRewritePrompt
} from './content-filter.mjs';
import {
  getTargetCount,
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

async function loadExistingArticles(dateStr) {
  const filePath = path.join(DATA_DIR, `${dateStr}.json`);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return data;
  } catch {
    return null;
  }
}

async function loadHistoricalArticles(dateStr, count) {
  const archive = [];
  const dir = DATA_DIR;

  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.json') && f !== `${dateStr}.json`)
    .sort()
    .reverse()
    .slice(0, 30);

  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
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

function buildArticle(raw, dateStr, index) {
  const { wordCount, readTime } = calcReadTime(raw.rewrittenContent || raw.content || '');

  return {
    id: generateId(dateStr, index),
    category: raw.category || '推荐阅读',
    title: raw.title || '无标题',
    content: raw.rewrittenContent || `<p>${raw.summary || raw.content || ''}</p>`,
    wordCount,
    readTime,
    source: raw.source || '',
    sourceUrl: raw.link || raw.sourceUrl || '',
    coverImage: raw.coverImage || '',
    isWechat: raw.isWechat || false
  };
}

async function main() {
  const dateStr = getDateArg();
  const generatedBy = getGeneratedBy();
  const isWeekend = isWeekendDate(dateStr);
  const targetCount = getTargetCount(isWeekend);

  console.log(`=== Generating articles for ${dateStr} ===`);
  console.log(`Type: ${isWeekend ? 'Weekend' : 'Weekday'}, Target: ${targetCount} articles`);
  console.log(`Trigger: ${generatedBy}`);

  const existing = await loadExistingArticles(dateStr);
  const existingWechat = existing
    ? existing.articles.filter(a => a.isWechat)
    : [];

  console.log('\n[1/4] Scraping news sources...');
  const newsByCategory = await scrapeAllNews();

  let allRawItems = [];
  for (const [cat, items] of Object.entries(newsByCategory)) {
    allRawItems.push(...items);
  }
  console.log(`Total raw items: ${allRawItems.length}`);

  if (allRawItems.length === 0) {
    console.log('\nNo news fetched. Using historical archive...');
    const archived = await loadHistoricalArticles(dateStr, targetCount);
    if (archived.length > 0) {
      const output = {
        date: dateStr,
        isWeekend,
        generatedAt: new Date().toISOString(),
        generatedBy: `${generatedBy}-archive`,
        articles: [...archived, ...existingWechat],
        totalArticles: archived.length + existingWechat.length
      };
      await saveArticles(dateStr, output);
      console.log(`\nDone! ${archived.length} archived articles saved.`);
      return;
    }
    console.error('No articles available. Exiting.');
    process.exit(1);
  }

  console.log('\n[2/4] Filtering content with MIMO...');
  const filtered = await filterArticles(allRawItems, FILTER_SYSTEM_PROMPT, buildFilterPrompt);
  console.log(`Passed filter: ${filtered.length}/${allRawItems.length}`);

  const categories = distributeCategories(targetCount);
  const selected = [];

  for (const cat of categories) {
    const candidates = filtered.filter(item =>
      item.category === cat && !selected.find(s => s.title === item.title)
    );
    if (candidates.length > 0) {
      selected.push(candidates[0]);
    }
  }

  if (selected.length < targetCount) {
    const remaining = filtered.filter(item =>
      !selected.find(s => s.title === item.title)
    );
    const shortfall = targetCount - selected.length;
    selected.push(...remaining.slice(0, shortfall));
  }

  if (selected.length < targetCount) {
    const shortfall = targetCount - selected.length;
    console.log(`Only ${selected.length} articles, fetching ${shortfall} from archive...`);
    const archived = await loadHistoricalArticles(dateStr, shortfall);
    selected.push(...archived);
  }

  const toRewrite = selected.filter(a => !a.sourceNote);
  const alreadyProcessed = selected.filter(a => a.sourceNote);

  console.log(`\n[3/4] Rewriting ${toRewrite.length} articles with MIMO...`);
  const rewritten = await batchRewrite(toRewrite, REWRITE_SYSTEM_PROMPT, buildRewritePrompt);
  console.log(`Successfully rewritten: ${rewritten.length}`);

  console.log('\n[4/4] Building final output...');
  const finalArticles = [];

  rewritten.forEach((item, i) => {
    finalArticles.push(buildArticle(item, dateStr, finalArticles.length));
  });

  alreadyProcessed.forEach(item => {
    finalArticles.push(buildArticle(item, dateStr, finalArticles.length));
  });

  const categoryCounts = {};
  for (const cat of ArticleList.CATEGORIES || []) {
    categoryCounts[cat] = 0;
  }
  finalArticles.forEach(a => {
    categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1;
  });

  const output = {
    date: dateStr,
    isWeekend,
    generatedAt: new Date().toISOString(),
    generatedBy,
    articles: [...finalArticles, ...existingWechat],
    totalArticles: finalArticles.length + existingWechat.length,
    categories: categoryCounts
  };

  await saveArticles(dateStr, output);
  console.log(`\nDone! ${finalArticles.length} articles generated for ${dateStr}.`);
}

const ArticleList = { CATEGORIES: [
  '航天深空·天文新知',
  '考古文博·古文明发掘',
  '大国工程·前沿科技突破',
  '地球自然·气象地质博物探索',
  '生物世界·生命科学科普',
  '地理探索·环球人文地貌',
  '青少年健康医学科普',
  '生态环境·地球保护科考',
  '环球人文与跨国科考见闻'
]};

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
