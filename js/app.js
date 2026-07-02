const App = (() => {
  let currentDate = '';
  let articles = [];

  const DEFAULT_REPO = '5vyg9j2c46-debug/youth-science-reader';
  const DEFAULT_PAT = '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';

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
    if (!Progress.getSetting('repo')) {
      Progress.setSetting('repo', DEFAULT_REPO);
    }
    if (!Progress.getSetting('pat')) {
      Progress.setSetting('pat', DEFAULT_PAT);
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
      document.getElementById('pat-input').value = Progress.getSetting('pat');
      document.getElementById('repo-input').value = Progress.getSetting('repo');
    });

    document.getElementById('btn-settings-save').addEventListener('click', () => {
      const pat = document.getElementById('pat-input').value.trim();
      const repo = document.getElementById('repo-input').value.trim();
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
  }

  async function loadDate(dateStr) {
    currentDate = dateStr;
    _updateDateDisplay();

    const path = `data/articles/${dateStr}.json`;
    let data = null;

    // Try local file first (works on GitHub Pages and local)
    try {
      const resp = await fetch(path);
      if (resp.ok) data = await resp.json();
    } catch {
      data = null;
    }

    // Fallback: try GitHub raw (for private repos via API)
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

    ArticleList.render(articles, handleArticleSelect);

    if (articles.length > 0) {
      Progress.recalcDailyStats(dateStr, articles);
    } else {
      Progress.setDailyStats(dateStr, 0, 0);
    }

    Calendar.refresh();

    // Auto-generate if today has no articles
    if (dateStr === _getTodayStr() && articles.length === 0) {
      _autoGenerate();
    }
  }

  async function _autoGenerate() {
    if (!GitHubAPI.isConfigured()) return;
    const btn = document.getElementById('btn-generate');
    if (btn.disabled) return;
    await handleGenerate();
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

      _setProgress(10, '已触发，等待云端处理...', progressBar, progressPct, statusText);

      const run = await GitHubAPI.getLatestRun('manual-generate.yml');
      if (run) {
        let pct = 10;
        await GitHubAPI.pollRunStatus(run.id, (s) => {
          if (s === 'in_progress') {
            pct = Math.min(pct + 15, 85);
            _setProgress(pct, 'AI正在生成文稿...', progressBar, progressPct, statusText);
          }
        });
      } else {
        _setProgress(50, '云端处理中，请耐心等待...', progressBar, progressPct, statusText);
        await new Promise(r => setTimeout(r, 20000));
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
      _setProgress(0, '生成失败: ' + err.message, progressBar, progressPct, statusText);
      setTimeout(() => {
        status.classList.add('hidden');
        progressContainer.classList.add('hidden');
      }, 5000);
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
