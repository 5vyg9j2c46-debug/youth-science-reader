const App = (() => {
  let currentDate = '';
  let articles = [];
  let displayedCount = 0;
  const PAGE_SIZE = 20;

  const DEFAULT_REPO = 'teenyteeny/youth-reading';
  const DEFAULT_PAT = '';
  const DEFAULT_PLATFORM = 'gitee';

  function init() {
    _ensureDefaults();
    currentDate = _getTodayStr();
    _updateDateDisplay();

    Calendar.init();
    WechatCollect.init();
    _bindEvents();
    loadDate(currentDate);
  }

  function _ensureDefaults() {
    if (!Progress.getSetting('platform')) {
      Progress.setSetting('platform', DEFAULT_PLATFORM);
    }
    if (!Progress.getSetting('repo')) {
      Progress.setSetting('repo', DEFAULT_REPO);
    }
  }

  function _bindEvents() {
    document.getElementById('btn-back').addEventListener('click', () => {
      ArticleReader.hide();
    });

    document.getElementById('btn-generate').addEventListener('click', handleGenerate);

    document.getElementById('btn-mark-read').addEventListener('click', () => {
      ArticleReader.markCurrentRead();
    });

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

    document.getElementById('btn-settings').addEventListener('click', () => {
      document.getElementById('settings-modal').classList.remove('hidden');
      document.getElementById('platform-select').value = Progress.getSetting('platform') || 'gitee';
      document.getElementById('pat-input').value = Progress.getSetting('pat');
      document.getElementById('repo-input').value = Progress.getSetting('repo');
    });

    document.getElementById('btn-settings-save').addEventListener('click', () => {
      const platform = document.getElementById('platform-select').value;
      const pat = document.getElementById('pat-input').value.trim();
      const repo = document.getElementById('repo-input').value.trim();
      if (platform) Progress.setSetting('platform', platform);
      if (pat) Progress.setSetting('pat', pat);
      if (repo) Progress.setSetting('repo', repo);
      document.getElementById('settings-modal').classList.add('hidden');
    });

    document.getElementById('btn-settings-cancel').addEventListener('click', () => {
      document.getElementById('settings-modal').classList.add('hidden');
    });

    document.querySelector('.modal-overlay').addEventListener('click', () => {
      document.getElementById('settings-modal').classList.add('hidden');
    });

    document.getElementById('btn-load-more').addEventListener('click', handleLoadMore);
  }

  async function loadDate(dateStr) {
    currentDate = dateStr;
    _updateDateDisplay();

    const path = `data/articles/${dateStr}.json`;
    let data = null;

    try {
      const resp = await fetch(path);
      if (resp.ok) data = await resp.json();
    } catch {
      data = null;
    }

    if (!data && GitHubAPI.isConfigured()) {
      try {
        data = await GitHubAPI.getRawFile(path);
      } catch {
        data = null;
      }
    }

    if (data && data.articles) {
      articles = data.articles;
    } else {
      articles = [];
    }

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
    const btn = document.getElementById('btn-load-more');
    const remaining = articles.length - displayedCount;

    if (remaining > 0) {
      _renderPage();
      return;
    }

    if (!GitHubAPI.isConfigured()) {
      alert('请先在右下角设置中配置 GitHub Token 和仓库地址');
      return;
    }

    btn.disabled = true;
    btn.textContent = '正在拉取更多文章...';

    try {
      await GitHubAPI.triggerWorkflow('manual-generate.yml', {
        date: currentDate,
        extra: 'true'
      });

      const run = await GitHubAPI.getLatestRun('manual-generate.yml');
      if (run) {
        await GitHubAPI.pollRunStatus(run.id, (s) => {
          if (s === 'in_progress') {
            btn.textContent = 'AI正在生成更多文章...';
          }
        });
      } else {
        await new Promise(r => setTimeout(r, 25000));
      }

      await new Promise(r => setTimeout(r, 2000));
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
    if (!GitHubAPI.isConfigured()) {
      alert('请先在右下角设置中配置 GitHub Token 和仓库地址');
      return;
    }

    const btn = document.getElementById('btn-generate');
    const status = document.getElementById('generate-status');
    const statusText = document.getElementById('generate-status-text');
    const progressContainer = document.getElementById('generate-progress');
    const progressBar = document.getElementById('progress-bar-fill');
    const progressPct = document.getElementById('progress-pct');

    btn.disabled = true;
    status.classList.remove('hidden');
    progressContainer.classList.remove('hidden');
    _setProgress(5, '正在触发云端生成...', progressBar, progressPct, statusText);

    try {
      await GitHubAPI.triggerWorkflow('manual-generate.yml', {
        date: currentDate
      });

      _setProgress(10, '正在抓取科普资讯...', progressBar, progressPct, statusText);

      const run = await GitHubAPI.getLatestRun('manual-generate.yml');
      if (run) {
        let pct = 10;
        const steps = ['正在抓取科普资讯...', 'AI审核筛选内容...', 'AI整理图文...', '生成配套习题...', '保存归档...'];
        let stepIdx = 0;
        const completedRun = await GitHubAPI.pollRunStatus(run.id, (s, conclusion) => {
          if (s === 'in_progress') {
            pct = Math.min(pct + 10, 85);
            stepIdx = Math.min(stepIdx + 1, steps.length - 1);
            _setProgress(pct, steps[stepIdx], progressBar, progressPct, statusText);
          } else if (s === 'completed' && conclusion === 'failure') {
            _setProgress(0, '云端生成失败，请稍后重试', progressBar, progressPct, statusText);
          }
        });
        if (!completedRun) return;
      } else {
        _setProgress(30, '云端处理中，请耐心等待...', progressBar, progressPct, statusText);
        await new Promise(r => setTimeout(r, 25000));
      }

      _setProgress(90, '生成完成，正在加载...', progressBar, progressPct, statusText);
      await new Promise(r => setTimeout(r, 2000));
      await loadDate(currentDate);
      _setProgress(100, '加载完成!', progressBar, progressPct, statusText);
      setTimeout(() => {
        status.classList.add('hidden');
        progressContainer.classList.add('hidden');
      }, 2000);
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
    const display = `${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`;
    document.getElementById('current-date-display').textContent = display;
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
