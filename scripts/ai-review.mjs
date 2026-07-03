import { sleep } from './utils.mjs';

async function callMIMO(messages, options = {}) {
  const baseURL = process.env.AI_BASE_URL || 'https://api.deepseek.com';
  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    throw new Error('AI_API_KEY not configured');
  }

  const model = options.model || 'deepseek-v4-flash';
  const maxRetries = 2;
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeout || 45000);

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
          max_tokens: options.maxTokens || 4096,
          thinking: { type: 'disabled' }
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

function classifyArticle(htmlContent) {
  const charCount = getPlainTextLength(htmlContent);
  if (charCount > 5000) return 'compress';
  return 'keep';
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

async function rewriteArticle(article, keepPrompt, compressPrompt, expandPrompt, buildKeep, buildCompress, buildExpand) {
  const rawContent = article.content || article.summary || '';
  const action = classifyArticle(rawContent);
  const charCount = getPlainTextLength(rawContent);

  let systemPrompt, userPrompt;
  if (action === 'expand') {
    systemPrompt = expandPrompt;
    userPrompt = buildExpand(article);
    console.log(`    [expand] "${article.title}" (${charCount} chars < 1500, 扩写到1500+)`);
  } else if (action === 'compress') {
    systemPrompt = compressPrompt;
    userPrompt = buildCompress(article);
    console.log(`    [compress] "${article.title}" (${charCount} chars > 5000)`);
  } else {
    systemPrompt = keepPrompt;
    userPrompt = buildKeep(article);
    console.log(`    [keep] "${article.title}" (${charCount} chars, 保留原文)`);
  }

  try {
    const maxTokens = action === 'expand' ? 4096 : (action === 'compress' ? 8192 : 16384);
    const { content, usage } = await callMIMO([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { temperature: 0.5, maxTokens });

    return { content, usage, action };
  } catch (err) {
    console.warn(`Rewrite failed for "${article.title}":`, err.message);
    return null;
  }
}

async function batchRewrite(articles, keepPrompt, compressPrompt, expandPrompt, buildKeep, buildCompress, buildExpand) {
  const results = [];

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const result = await rewriteArticle(article, keepPrompt, compressPrompt, expandPrompt, buildKeep, buildCompress, buildExpand);
    if (result) {
      results.push({
        ...article,
        rewrittenContent: result.content,
        wasCompressed: result.action === 'compress',
        wasExpanded: result.action === 'expand'
      });
    } else {
      results.push(article);
    }
    if (i < articles.length - 1) await sleep(500);
  }

  return results;
}

async function generateQuiz(article, quizPromptBuilder, quizResponseParser) {
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { prompt } = quizPromptBuilder(article);
      console.log(`    [quiz] Generating quiz for "${article.title}" (attempt ${attempt})...`);

      const { content } = await callMIMO([
        { role: 'system', content: '你是一位专业的青少年科普测验出题专家。只输出JSON格式的题目，不要输出其他任何内容。' },
        { role: 'user', content: prompt }
      ], { temperature: 0.4, maxTokens: 2048 });

      const quiz = quizResponseParser(content);
      if (quiz && quiz.single && quiz.single.length > 0 && quiz.judge && quiz.judge.length > 0) {
        console.log(`    [quiz] OK: ${quiz.single.length} single + ${quiz.judge.length} judge`);
        return quiz;
      }
      console.warn(`    [quiz] Parse failed (attempt ${attempt}), retrying...`);
    } catch (err) {
      console.warn(`    [quiz] Error (attempt ${attempt}): ${err.message}`);
    }
    if (attempt < maxAttempts) await sleep(2000);
  }

  console.warn(`    [quiz] All attempts failed, generating fallback quiz for "${article.title}"`);
  return _buildFallbackQuiz(article);
}

function _buildFallbackQuiz(article) {
  const plainText = (article.content || '').replace(/<[^>]*>/g, '');
  const sentences = plainText.split(/[。！？；\n]+/).filter(s => s.trim().length > 10);

  const single = [];
  const judge = [];

  if (sentences.length >= 3) {
    single.push({
      question: `关于「${article.title}」，以下哪项描述是正确的？`,
      options: [
        sentences[0].trim().substring(0, 40),
        '以上说法都不正确',
        '本文未提及此内容',
        '以上说法都正确'
      ],
      correctOption: sentences[0].trim().substring(0, 40),
      sourceParagraph: 1,
      sourceText: sentences[0].trim().substring(0, 80)
    });
  }

  if (sentences.length >= 2) {
    const midIdx = Math.floor(sentences.length / 2);
    judge.push({
      statement: sentences[midIdx].trim().substring(0, 60),
      correctAnswer: true,
      sourceParagraph: midIdx + 1,
      sourceText: sentences[midIdx].trim().substring(0, 80)
    });
  }

  while (single.length < 3 && sentences.length > single.length + 1) {
    const idx = single.length + 1;
    if (idx < sentences.length) {
      single.push({
        question: `根据文章内容，以下关于第${idx + 1}段的描述正确的是？`,
        options: [
          sentences[idx].trim().substring(0, 40),
          '本文未提及此内容',
          '以上说法都不正确',
          '以上说法都正确'
        ],
        correctOption: sentences[idx].trim().substring(0, 40),
        sourceParagraph: idx + 1,
        sourceText: sentences[idx].trim().substring(0, 80)
      });
    } else break;
  }

  while (judge.length < 3 && sentences.length > judge.length + 2) {
    const idx = judge.length + 2;
    if (idx < sentences.length) {
      judge.push({
        statement: sentences[idx].trim().substring(0, 60),
        correctAnswer: true,
        sourceParagraph: idx + 1,
        sourceText: sentences[idx].trim().substring(0, 80)
      });
    } else break;
  }

  if (single.length === 0) {
    single.push({
      question: '本文的主题是什么？',
      options: [article.title, '与本文无关的主题', '本文未说明', '以上都不对'],
      correctOption: article.title,
      sourceParagraph: 1,
      sourceText: plainText.substring(0, 80)
    });
  }
  if (judge.length === 0) {
    judge.push({
      statement: `本文的标题是「${article.title}」`,
      correctAnswer: true,
      sourceParagraph: 1,
      sourceText: article.title
    });
  }

  return { single, judge };
}

async function batchGenerateQuiz(articles, quizPromptBuilder, quizResponseParser) {
  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const quiz = await generateQuiz(article, quizPromptBuilder, quizResponseParser);
    if (quiz) article.quiz = quiz;
    if (i < articles.length - 1) await sleep(1000);
  }
  return articles;
}

export { callMIMO, filterArticles, rewriteArticle, batchRewrite, generateQuiz, batchGenerateQuiz, getPlainTextLength };
