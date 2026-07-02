import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchWechatArticle } from './wechat-parse.mjs';
import { callMIMO } from './ai-review.mjs';
import { calcReadTime, todayStr } from './utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data', 'articles');

function getArg(name) {
  const arg = process.argv.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=').slice(1).join('=') : null;
}

async function verifyAndCleanWithAI(article) {
  const systemPrompt = `你是一位青少年科普内容审核编辑。请检查以下微信公众号文章内容：

1. 是否适合11-12岁小升初学生阅读
2. 移除任何广告、推广、引导关注的内容
3. 如果文章超过800字，精简到300-600字，保留核心科普内容
4. 确保文风客观平实，适合青少年

输出格式：
- 返回处理后的正文HTML（使用<p>等标签）
- 只输出正文，不要标题和元信息`;

  try {
    const { content } = await callMIMO([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `标题：${article.title}\n\n原文：${article.plainText || article.content}` }
    ], { temperature: 0.5, maxTokens: 2048 });

    return content;
  } catch (err) {
    console.warn('AI verification failed, using original content:', err.message);
    return article.content;
  }
}

async function main() {
  const url = getArg('url');
  const dateArg = getArg('date') || todayStr();

  if (!url) {
    console.error('Error: --url is required');
    process.exit(1);
  }

  console.log(`=== Collecting WeChat article ===`);
  console.log(`URL: ${url}`);
  console.log(`Date: ${dateArg}`);

  console.log('\n[1/3] Fetching article...');
  const article = await fetchWechatArticle(url);
  console.log(`Title: ${article.title}`);
  console.log(`Word count: ${article.wordCount}`);

  console.log('\n[2/3] AI verification and cleanup...');
  const cleanedContent = await verifyAndCleanWithAI(article);

  const { wordCount, readTime } = calcReadTime(cleanedContent);

  const newArticle = {
    id: `${dateArg}-wx-${Date.now()}`,
    category: '推荐阅读',
    title: article.title,
    content: cleanedContent,
    wordCount,
    readTime,
    source: article.source,
    sourceUrl: article.sourceUrl,
    isWechat: true
  };

  console.log('\n[3/3] Saving...');
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const filePath = path.join(DATA_DIR, `${dateArg}.json`);
  let data;

  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    data = {
      date: dateArg,
      isWeekend: false,
      generatedAt: new Date().toISOString(),
      generatedBy: 'wechat',
      articles: [],
      totalArticles: 0
    };
  }

  data.articles.push(newArticle);
  data.totalArticles = data.articles.length;

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`\nDone! Article saved to ${filePath}`);
  console.log(`Total articles for ${dateArg}: ${data.totalArticles}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
