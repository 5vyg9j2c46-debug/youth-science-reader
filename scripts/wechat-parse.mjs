import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

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
  '[id*="advert"]',
  '.mp_profile_iframe_wrp',
  'mpvoice',
  '.js_uneditable'
];

const AD_IMAGE_PATTERNS = [
  /advertisement/i,
  /sponsor/i,
  /qrcode/i,
  /qr_code/i,
  /logo\.png/i,
  /avatar/i,
  /icon_/i,
  /ad[_-]/i,
  /banner_ad/i
];

async function downloadImage(url, saveDir) {
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        'Referer': 'https://mp.weixin.qq.com/'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!resp.ok) {
      console.warn(`  Image download failed (${resp.status}): ${url.substring(0, 80)}`);
      return null;
    }

    const buffer = await resp.arrayBuffer();
    const ext = _guessExt(resp.headers.get('content-type'), url);
    const hash = _simpleHash(url);
    const filename = `${hash}${ext}`;
    const filepath = path.join(saveDir, filename);

    fs.mkdirSync(saveDir, { recursive: true });
    fs.writeFileSync(filepath, Buffer.from(buffer));

    return filename;
  } catch (err) {
    console.warn(`  Image download error: ${err.message}`);
    return null;
  }
}

function _guessExt(contentType, url) {
  if (contentType) {
    if (contentType.includes('png')) return '.png';
    if (contentType.includes('gif')) return '.gif';
    if (contentType.includes('webp')) return '.webp';
    if (contentType.includes('svg')) return '.svg';
  }
  if (url.includes('.png')) return '.png';
  if (url.includes('.gif')) return '.gif';
  if (url.includes('.webp')) return '.webp';
  return '.jpg';
}

function _simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function isAdImage(src) {
  return AD_IMAGE_PATTERNS.some(pattern => pattern.test(src));
}

async function fetchWechatArticle(url, dateStr) {
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      },
      signal: AbortSignal.timeout(20000)
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const html = await resp.text();
    return await parseWechatHTML(html, url, dateStr);
  } catch (err) {
    throw new Error(`Failed to fetch WeChat article: ${err.message}`);
  }
}

async function parseWechatHTML(html, baseUrl, dateStr) {
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

  const imageDir = path.join(ROOT, 'data', 'images', dateStr || 'wechat');
  const imagePromises = [];

  contentEl.find('img').each((_, el) => {
    const $img = $(el);
    const src = $img.attr('data-src') || $img.attr('src') || '';

    if (!src || isAdImage(src)) {
      $img.remove();
      return;
    }

    const fullUrl = src.startsWith('http') ? src : `https://mp.weixin.qq.com${src}`;

    imagePromises.push(
      downloadImage(fullUrl, imageDir).then(filename => {
        if (filename) {
          $img.attr('src', `../data/images/${dateStr || 'wechat'}/${filename}`);
          $img.removeAttr('data-src');
          $img.removeAttr('data-w');
          $img.removeAttr('data-ratio');
          $img.css('max-width', '100%');
          $img.css('height', 'auto');
          return { original: fullUrl, local: filename };
        }
        $img.attr('src', fullUrl);
        $img.removeAttr('data-src');
        return null;
      })
    );
  });

  const downloadedImages = await Promise.all(imagePromises);
  const localImages = downloadedImages.filter(Boolean);

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
    sourceUrl: baseUrl,
    images: localImages
  };
}

export { fetchWechatArticle };
