import { sleep } from './utils.mjs';

async function callMIMO(messages, options = {}) {
  const baseURL = process.env.MIMO_BASE_URL || 'https://api.mimo.xiaomi.com/v1';
  const apiKey = process.env.MIMO_API_KEY;

  if (!apiKey) {
    throw new Error('MIMO_API_KEY not configured');
  }

  const model = options.model || 'mimo-v2.5-pro';
  const maxRetries = 3;
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeout || 90000);

      const response = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens || 4096
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`MIMO API error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const usage = data.usage || {};

      return { content, usage };
    } catch (err) {
      lastError = err;
      if (err.name === 'AbortError') {
        console.warn(`MIMO call timed out (attempt ${attempt + 1}/${maxRetries})`);
      } else {
        console.warn(`MIMO call failed (attempt ${attempt + 1}/${maxRetries}):`, err.message);
      }
      if (attempt < maxRetries - 1) {
        await sleep(2000 * (attempt + 1));
      }
    }
  }

  throw lastError;
}

function getPlainTextLength(html) {
  return (html || '').replace(/<[^>]*>/g, '').replace(/\s/g, '').length;
}

function shouldCompress(htmlContent) {
  const charCount = getPlainTextLength(htmlContent);
  return charCount > 5000;
}

async function filterArticles(items, systemPrompt, buildPrompt) {
  const batchSize = 5;
  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const userPrompt = buildPrompt(batch);

    try {
      const { content } = await callMIMO([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], { temperature: 0.3, maxTokens: 1024 });

      const parsed = parseFilterResponse(content);
      if (parsed && Array.isArray(parsed)) {
        parsed.forEach((r, idx) => {
          if (r.pass) {
            results.push(batch[idx]);
          }
        });
      } else {
        batch.forEach(item => results.push(item));
      }
    } catch (err) {
      console.warn('Filter batch failed, including all items:', err.message);
      batch.forEach(item => results.push(item));
    }

    if (i + batchSize < items.length) {
      await sleep(2000);
    }
  }

  return results;
}

function parseFilterResponse(text) {
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function rewriteArticle(article, keepPrompt, compressPrompt, buildKeep, buildCompress) {
  const rawContent = article.content || article.summary || '';
  const needsCompress = shouldCompress(rawContent);
  const charCount = getPlainTextLength(rawContent);

  let systemPrompt, userPrompt;
  if (needsCompress) {
    systemPrompt = compressPrompt;
    userPrompt = buildCompress(article);
    console.log(`    [compress] "${article.title}" (${charCount} chars > 5000)`);
  } else {
    systemPrompt = keepPrompt;
    userPrompt = buildKeep(article);
    console.log(`    [keep] "${article.title}" (${charCount} chars <= 5000)`);
  }

  try {
    const maxTokens = needsCompress ? 8192 : 16384;
    const { content, usage } = await callMIMO([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { temperature: 0.5, maxTokens });

    return { content, usage, compressed: needsCompress };
  } catch (err) {
    console.warn(`Rewrite failed for "${article.title}":`, err.message);
    return null;
  }
}

async function batchRewrite(articles, keepPrompt, compressPrompt, buildKeep, buildCompress) {
  const results = [];
  const concurrency = 2;

  for (let i = 0; i < articles.length; i += concurrency) {
    const batch = articles.slice(i, i + concurrency);
    const promises = batch.map(article =>
      rewriteArticle(article, keepPrompt, compressPrompt, buildKeep, buildCompress).then(result => ({
        article,
        result
      }))
    );

    const batchResults = await Promise.all(promises);
    batchResults.forEach(({ article, result }) => {
      if (result) {
        results.push({
          ...article,
          rewrittenContent: result.content,
          wasCompressed: result.compressed
        });
      } else {
        results.push(article);
      }
    });

    if (i + concurrency < articles.length) {
      await sleep(2000);
    }
  }

  return results;
}

export { callMIMO, filterArticles, rewriteArticle, batchRewrite, getPlainTextLength };
