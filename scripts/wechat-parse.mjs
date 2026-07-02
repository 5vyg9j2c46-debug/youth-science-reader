import * as cheerio from 'cheerio';

const WECHAT_SELECTORS = [
  '#js_content',
  '.rich_media_content',
  '#page-content'
];

const REMOVE_SELECTORS = [
  '.reward_area',
  '.rich_media_tool',
  '#js_pc_qr_code',
  '.qr_code_pc',
  '.rich_media_extra',
  '.function_mod',
  '#js_toobar3',
  '#js_share_source',
  '.weui-footer',
  'script',
  'style',
  '.ad',
  '[class*="advert"]',
  '[id*="advert"]'
];

async function fetchWechatArticle(url) {
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const html = await resp.text();
    return parseWechatHTML(html, url);
  } catch (err) {
    throw new Error(`Failed to fetch WeChat article: ${err.message}`);
  }
}

function parseWechatHTML(html, baseUrl) {
  const $ = cheerio.load(html);

  const title = $('#activity-name').text().trim()
    || $('h1').first().text().trim()
    || '';

  const author = $('#js_name').text().trim()
    || $('.rich_media_meta_nickname a').text().trim()
    || '';

  REMOVE_SELECTORS.forEach(sel => {
    $(sel).remove();
  });

  let contentEl = null;
  for (const sel of WECHAT_SELECTORS) {
    if ($(sel).length > 0) {
      contentEl = $(sel);
      break;
    }
  }

  if (!contentEl) {
    contentEl = $('body');
  }

  contentEl.find('img').each((_, el) => {
    const $img = $(el);
    const src = $img.attr('data-src') || $img.attr('src') || '';
    if (src) {
      const fullUrl = src.startsWith('http') ? src : `https://mp.weixin.qq.com${src}`;
      $img.attr('src', fullUrl);
      $img.removeAttr('data-src');
    }
  });

  let contentHTML = contentEl.html() || '';
  contentHTML = contentHTML
    .replace(/<br\s*\/?>/gi, '</p><p>')
    .replace(/&nbsp;/gi, ' ');

  const text = contentEl.text().trim();
  const wordCount = text.replace(/\s/g, '').length;

  return {
    title,
    author,
    content: contentHTML,
    plainText: text,
    wordCount,
    source: author || '微信公众号',
    sourceUrl: baseUrl
  };
}

export { fetchWechatArticle };
