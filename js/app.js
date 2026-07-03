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
    document.getElementById('btn-back').addEventListener('click', () => ArticleReader.hide());
    document.getElementById('btn-generate').addEventListener('click', handleGenerate);
    document.getElementById('btn-mark-read').addEventListener('click', () => ArticleReader.markCurrentRead());

    document.getElementById('btn-prev-day').addEventListener('click', () => {
      currentDate = _shiftDate(currentDate, -1);
      _updateDateDisplay();
      loadDate(currentDate);
    });

    document.getElementById('btn-next-day').addEventListener('click', () => {
      const next = _shiftDate(currentDate, 1);
      if (next <= _getTodayStr()) {
        currentDate = next;
        _updateDateDisplay();
        loadDate(currentDate);
      }
    });

    document.getElementById('btn-load-more').addEventListener('click', handleLoadMore);
  }

  async function loadDate(dateStr) {
    currentDate = dateStr;
    _updateDateDisplay();

    let data = null;
    try {
      const resp = await fetch(`data/articles/${dateStr}.json`);
      if (resp.ok) data = await resp.json();
    } catch {}

    if (!data) {
      try { data = await PlatformAPI.getArticles(dateStr); } catch {}
    }

    articles = data?.articles || [];
    window.__currentArticles = articles;
    displayedCount = 0;
    _renderPage();
  }

  function _renderPage() {
    const pageArticles = articles.slice(0, displayedCount + PAGE_SIZE);
    displayedCount = pageArticles.length;
    ArticleList.render(pageArticles, handleArticleSelect);

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
    const countInfo = document.getElementById('load-more-count');
    btn.classList.remove('hidden');
    countInfo.classList.remove('hidden');

    const remaining = articles.length - displayedCount;
    if (remaining > 0) {
      countInfo.textContent = `已显示 ${displayedCount}/${articles.length} 篇，下方还有 ${remaining} 篇`;
      btn.textContent = '展开更多文章';
    } else {
      countInfo.textContent = `全部 ${articles.length} 篇已显示`;
      btn.textContent = '拉取更多文章';
    }
  }

  async function handleLoadMore() {
    const remaining = articles.length - displayedCount;
    if (remaining > 0) { _renderPage(); return; }

    const btn = document.getElementById('btn-load-more');
    btn.disabled = true;
    btn.textContent = '正在拉取更多文章...';

    try {
      await PlatformAPI.triggerGenerate(currentDate, true);
      await new Promise(r => setTimeout(r, 3000));
      await loadDate(currentDate);
    } catch (err) {
      console.warn('Load more failed:', err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '拉取更多文章';
    }
  }

  function handleArticleSelect(article) {
    ArticleReader.show(article, (articleId, isRead) => {
      ArticleList.updateCardStatus(articleId, isRead);
      Progress.recalcDailyStats(currentDate, articles);
      Calendar.refresh();
    });
  }

  async function handleGenerate() {
    const btn = document.getElementById('btn-generate');
    const status = document.getElementById('generate-status');
    const statusText = document.getElementById('generate-status-text');
    const progressContainer = document.getElementById('generate-progress');
    const progressBar = document.getElementById('progress-bar-fill');
    const progressPct = document.getElementById('progress-pct');

    btn.disabled = true;
    status.classList.remove('hidden');
    progressContainer.classList.remove('hidden');
    _setProgress(10, '正在抓取科普资讯...', progressBar, progressPct, statusText);

    try {
      _setProgress(30, 'AI审核筛选内容...', progressBar, progressPct, statusText);
      const result = await PlatformAPI.triggerGenerate(currentDate, false);

      _setProgress(60, 'AI整理图文...', progressBar, progressPct, statusText);
      await new Promise(r => setTimeout(r, 2000));

      _setProgress(80, '生成配套习题...', progressBar, progressPct, statusText);
      await new Promise(r => setTimeout(r, 2000));

      _setProgress(90, '正在加载...', progressBar, progressPct, statusText);
      await loadDate(currentDate);

      _setProgress(100, `加载完成！${result?.articleCount || articles.length} 篇文章`, progressBar, progressPct, statusText);
      setTimeout(() => {
        status.classList.add('hidden');
        progressContainer.classList.add('hidden');
      }, 3000);
    } catch (err) {
      _setProgress(0, '⚠ ' + err.message, progressBar, progressPct, statusText);
      setTimeout(() => {
        status.classList.add('hidden');
        progressContainer.classList.add('hidden');
      }, 8000);
    } finally {
      btn.disabled = false;
    }
  }

  function _setProgress(pct, text, bar, pctEl, textEl) {
    if (bar) bar.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
    if (textEl) textEl.textContent = text;
  }

  function _updateDateDisplay() {
    const d = new Date(currentDate + 'T00:00:00');
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    document.getElementById('current-date-display').textContent = `${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`;
  }

  function _getTodayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function _shiftDate(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  return { init, loadDate };
})();

document.addEventListener('DOMContentLoaded', App.init);
