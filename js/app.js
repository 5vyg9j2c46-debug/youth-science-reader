const App = (() => {
  let currentDate = '';
  let articles = [];
  let displayedCount = 0;
  let bgResult = null;
  let bgLoading = false;
  const PAGE_SIZE = 20;
  let cbApp = null;

  function init() {
    _initCloudbase();
    currentDate = _getTodayStr();
    _updateDateDisplay();
    Calendar.init();
    _bindEvents();
    loadDate(currentDate);
  }

  function _initCloudbase() {
    if (typeof cloudbase !== 'undefined') {
      try {
        cbApp = cloudbase.init({ env: 'youthread-d4gn9d9wr23b1a16a' });
      } catch (e) {
        console.warn('CloudBase init failed:', e.message);
      }
    }
  }

  async function _ensureAuth() {
    if (!cbApp) return false;
    try {
      await cbApp.auth({ persistence: 'local' }).signInAnonymously();
      return true;
    } catch {
      return false;
    }
  }

  function _bindEvents() {
    document.getElementById('btn-back').addEventListener('click', ArticleReader.hide);
    document.getElementById('btn-generate').addEventListener('click', handleGenerate);
    document.getElementById('btn-mark-read').addEventListener('click', ArticleReader.markCurrentRead);
    document.getElementById('btn-prev-day').addEventListener('click', () => { currentDate = _shiftDate(currentDate, -1); _updateDateDisplay(); loadDate(currentDate); });
    document.getElementById('btn-next-day').addEventListener('click', () => { const n = _shiftDate(currentDate, 1); if (n <= _getTodayStr()) { currentDate = n; _updateDateDisplay(); loadDate(currentDate); } });
    document.getElementById('btn-load-more').addEventListener('click', handleLoadMore);
  }

  function _getCached(dateStr) {
    try { const d = localStorage.getItem('articles_' + dateStr); return d ? JSON.parse(d) : null; } catch { return null; }
  }

  function _saveCache(dateStr, data) { try { localStorage.setItem('articles_' + dateStr, JSON.stringify(data)); } catch {} }

  async function loadDate(dateStr) {
    currentDate = dateStr;
    _updateDateDisplay();
    displayedCount = 0;
    bgResult = null;
    bgLoading = false;

    const cached = _getCached(dateStr);
    if (cached && cached.articles && cached.articles.length > 0) {
      articles = cached.articles;
      _renderPage();
      return;
    }

    if (cbApp) {
      try {
        const authed = await _ensureAuth();
        if (authed) {
          const res = await cbApp.callFunction({ name: 'generate-articles', data: { date: dateStr } });
          if (res.result && res.result.articles && res.result.articles.length > 0) {
            articles = res.result.articles;
            _saveCache(dateStr, res.result);
            _renderPage();
            return;
          }
        }
      } catch (e) {
        console.warn('CloudBase call failed:', e.message);
      }
    }

    try {
      const resp = await fetch('data/articles/' + dateStr + '.json');
      if (resp.ok) {
        const data = await resp.json();
        if (data.articles && data.articles.length > 0) {
          articles = data.articles;
          _saveCache(dateStr, data);
          _renderPage();
          return;
        }
      }
    } catch {}

    if (!cached) _showEmpty();
  }

  function _showEmpty() {
    document.getElementById('article-list').innerHTML = '';
    document.getElementById('empty-state').classList.remove('hidden');
  }

  function _renderPage() {
    document.getElementById('empty-state').classList.add('hidden');
    const page = articles.slice(0, displayedCount + PAGE_SIZE);
    displayedCount = page.length;
    ArticleList.render(page, handleArticleSelect);

    if (articles.length > 0) {
      Progress.recalcDailyStats(currentDate, articles);
    } else {
      Progress.setDailyStats(currentDate, 0, 0);
    }
    _updateLoadMoreButton();
    Calendar.refresh();
  }

  function _updateLoadMoreButton() {
    const btn = document.getElementById('btn-load-more');
    const info = document.getElementById('load-more-count');
    btn.classList.remove('hidden');
    info.classList.remove('hidden');
    const remaining = articles.length - displayedCount;
    if (bgLoading) {
      info.textContent = '后台加载中...';
      btn.textContent = '后台加载中...';
      btn.disabled = true;
    } else if (bgResult && bgResult.length > 0) {
      info.textContent = `已显示 ${displayedCount}/${articles.length + bgResult.length} 篇`;
      btn.textContent = `展开下一批 (${bgResult.length} 篇)`;
      btn.disabled = false;
    } else if (remaining > 0) {
      info.textContent = `已显示 ${displayedCount}/${articles.length} 篇`;
      btn.textContent = '展开更多';
      btn.disabled = false;
    } else {
      info.textContent = `共 ${articles.length} 篇`;
      btn.textContent = '拉取更多文章';
      btn.disabled = false;
    }
  }

  async function handleLoadMore() {
    const remaining = articles.length - displayedCount;
    if (remaining > 0) { _renderPage(); return; }

    if (bgResult && bgResult.length > 0) {
      const mainArea = document.getElementById('main-content');
      window.scrollTo({ top: mainArea.scrollHeight, behavior: 'smooth' });
      articles = [...articles, ...bgResult];
      bgResult = null;
      _saveCache(currentDate, { articles });
      _renderPage();
      return;
    }

    const btn = document.getElementById('btn-load-more');
    btn.disabled = true;
    btn.textContent = '生成中...';

    try {
      const result = await _callGenerate(currentDate, true, articles.map(a => a.title), true);
      if (result && result.articles && result.articles.length > 0) {
        const existing = new Set(articles.map(a => a.title));
        const newArts = result.articles.filter(a => !existing.has(a.title));
        articles = [...articles, ...newArts];
        _saveCache(currentDate, { articles });
        _renderPage();
      }
    } catch (e) {
      console.warn('Load more failed:', e);
    } finally {
      btn.disabled = false;
    }
  }

  function _setProgress(pct, text) {
    const bar = document.getElementById('progress-bar-fill');
    const pctEl = document.getElementById('progress-pct');
    const textEl = document.getElementById('generate-status-text');
    if (bar) bar.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
    if (textEl) textEl.textContent = text;
  }

  const PROGRESS_STEPS = [
    { d: 2000, p: 8, t: '连接云端...' },
    { d: 8000, p: 20, t: '抓取科普资讯...' },
    { d: 20000, p: 35, t: 'RSS数据获取...' },
    { d: 35000, p: 50, t: 'AI改写文章中...' },
    { d: 55000, p: 70, t: '生成配套习题...' },
    { d: 75000, p: 85, t: '即将完成...' },
    { d: 95000, p: 95, t: '最后处理...' },
  ];

  function _showProgress() { document.getElementById('generate-progress').classList.remove('hidden'); }
  function _hideProgress() { setTimeout(() => document.getElementById('generate-progress').classList.add('hidden'), 2000); }

  async function handleGenerate() {
    const btn = document.getElementById('btn-generate');
    btn.disabled = true;
    _showProgress();
    _setProgress(3, '准备中...');

    const timers = PROGRESS_STEPS.map(s => setTimeout(() => _setProgress(s.p, s.t), s.d));

    try {
      const result = await _callGenerate(currentDate, false, [], true);
      timers.forEach(t => clearTimeout(t));
      if (result && result.articles && result.articles.length > 0) {
        articles = result.articles;
        _saveCache(currentDate, result);
        displayedCount = 0;
        _renderPage();
        _setProgress(100, `${articles.length} 篇已就绪!`);
        _hideProgress();
        setTimeout(() => _startBackgroundFetch(), 1000);
      } else {
        _setProgress(0, '生成失败，请重试');
      }
    } catch (err) {
      timers.forEach(t => clearTimeout(t));
      _setProgress(0, '错误: ' + err.message);
    } finally {
      btn.disabled = false;
    }
  }

  async function _startBackgroundFetch() {
    if (bgLoading) return;
    bgLoading = true;
    _updateLoadMoreButton();

    try {
      const result = await _callGenerate(currentDate, true, articles.map(a => a.title), true);
      if (result && result.articles && result.articles.length > 0) {
        const existing = new Set(articles.map(a => a.title));
        bgResult = result.articles.filter(a => !existing.has(a.title));
        console.log(`Background fetch: ${bgResult.length} new articles`);
      } else {
        bgResult = null;
      }
    } catch (e) {
      console.warn('Background fetch failed:', e);
      bgResult = null;
    } finally {
      bgLoading = false;
      _updateLoadMoreButton();
    }
  }

  async function _callGenerate(dateStr, extra, excludeTitles, quick) {
    if (cbApp) {
      try {
        const authed = await _ensureAuth();
        if (authed) {
          const res = await cbApp.callFunction({
            name: 'generate-articles',
            data: { date: dateStr, extra: !!extra, excludeTitles: excludeTitles || [], quick: !!quick }
          });
          if (res.result) return res.result;
        }
      } catch (e) {
        console.warn('CloudBase call failed:', e.message);
      }
    }

    throw new Error('CloudBase not configured');
  }

  function handleArticleSelect(article) {
    ArticleReader.show(article, (id, isRead) => {
      ArticleList.updateCardStatus(id, isRead);
      Progress.recalcDailyStats(currentDate, articles);
      Calendar.refresh();
    });
  }

  function _updateDateDisplay() {
    const d = new Date(currentDate + 'T00:00:00');
    const w = ['日', '一', '二', '三', '四', '五', '六'];
    document.getElementById('current-date-display').textContent = `${d.getMonth() + 1}月${d.getDate()}日 周${w[d.getDay()]}`;
  }

  function _getTodayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function _shiftDate(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  return { init, loadDate };
})();

document.addEventListener('DOMContentLoaded', App.init);
