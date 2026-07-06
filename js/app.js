const App = (() => {
  let currentDate = '';
  let articles = [];
  let displayedCount = 0;
  const PAGE_SIZE = 20;

  function init() {
    currentDate = _getTodayStr();
    _updateDateDisplay();
    Calendar.init();
    _bindEvents();
    loadDate(currentDate);
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

    const cached = _getCached(dateStr);
    if (cached && cached.articles && cached.articles.length > 0) {
      articles = cached.articles;
      _renderPage();
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

    if (!cached || !cached.articles || cached.articles.length === 0) {
      _showEmpty();
    }
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
    Progress.recalcDailyStats(currentDate, articles);
    _updateLoadMoreButton();
    Calendar.refresh();
  }

  function _updateLoadMoreButton() {
    const btn = document.getElementById('btn-load-more');
    const info = document.getElementById('load-more-count');
    btn.classList.remove('hidden');
    info.classList.remove('hidden');
    const remaining = articles.length - displayedCount;
    if (remaining > 0) {
      info.textContent = `已显示 ${displayedCount}/${articles.length} 篇`;
      btn.textContent = '展开更多';
    } else {
      info.textContent = `共 ${articles.length} 篇`;
      btn.textContent = '拉取更多文章';
    }
  }

  async function handleLoadMore() {
    const remaining = articles.length - displayedCount;
    if (remaining > 0) { _renderPage(); return; }

    const btn = document.getElementById('btn-load-more');
    btn.disabled = true;
    btn.textContent = '生成中...';

    try {
      const result = await _callGenerate(currentDate, true, articles.map(a => a.title));
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
    { d: 8000, p: 15, t: '抓取科普资讯...' },
    { d: 20000, p: 30, t: 'RSS数据获取完成...' },
    { d: 35000, p: 45, t: 'AI审核+改写中...' },
    { d: 55000, p: 60, t: 'AI改写+出题中...' },
    { d: 80000, p: 75, t: '批量生成进行中...' },
    { d: 110000, p: 85, t: '即将完成...' },
    { d: 140000, p: 92, t: '保存中...' },
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
      const result = await _callGenerate(currentDate, false, []);
      timers.forEach(t => clearTimeout(t));
      if (result && result.articles && result.articles.length > 0) {
        articles = result.articles;
        _saveCache(currentDate, result);
        displayedCount = 0;
        _renderPage();
        _setProgress(100, `${articles.length} 篇已就绪!`);
        _hideProgress();
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

  async function _callGenerate(dateStr, extra, excludeTitles) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 300000);
    const resp = await fetch(PlatformAPI.getFnUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: dateStr, extra: !!extra, excludeTitles: excludeTitles || [], quick: true }),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return resp.json();
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
