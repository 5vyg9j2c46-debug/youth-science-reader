const ArticleReader = (() => {
  let currentArticle = null;
  let scrollObserver = null;
  let onReadCallback = null;

  function show(article, onRead) {
    currentArticle = article;
    onReadCallback = onRead;

    document.getElementById('view-home').classList.add('hidden');
    document.getElementById('view-reader').classList.remove('hidden');
    document.getElementById('btn-back').classList.remove('hidden');

    document.getElementById('reader-category').textContent =
      (article.isWechat ? '微信收录 · ' : '') + (article.category || '推荐阅读');
    document.getElementById('reader-title').textContent = article.title;
    document.getElementById('reader-readtime').textContent = `约${article.readTime || 3}分钟`;
    document.getElementById('reader-source').textContent = article.source || '';
    document.getElementById('reader-wordcount').textContent = `${article.wordCount || 0}字`;

    const trimLabel = document.getElementById('reader-trim-status');
    if (trimLabel) {
      if (article.wasCompressed) {
        trimLabel.textContent = '已精简';
        trimLabel.className = 'trim-badge compressed';
        trimLabel.classList.remove('hidden');
      } else {
        trimLabel.textContent = '完整原文';
        trimLabel.className = 'trim-badge full';
        trimLabel.classList.remove('hidden');
      }
    }

    const sourceLink = document.getElementById('reader-source-link');
    if (sourceLink) {
      if (article.sourceUrl) {
        sourceLink.href = article.sourceUrl;
        sourceLink.classList.remove('hidden');
      } else {
        sourceLink.classList.add('hidden');
      }
    }

    const body = document.getElementById('reader-body');
    let html = article.content || '';

    html = html.replace(/<img([^>]*)>/gi, (match, attrs) => {
      let srcMatch = attrs.match(/src=["']([^"']+)["']/i);
      let src = srcMatch ? srcMatch[1] : '';
      if (!src) return '';

      let altMatch = attrs.match(/alt=["']([^"']*)["']/i);
      let alt = altMatch ? altMatch[1] : '';

      return `<figure class="article-figure"><img src="${_esc(src)}" alt="${_esc(alt)}" loading="lazy" onerror="this.parentElement.style.display='none'" /><figcaption>${_esc(alt)}</figcaption></figure>`;
    });

    body.innerHTML = html;

    _renderQuizEntry(article);

    const btn = document.getElementById('btn-mark-read');
    const isRead = Progress.getReadStatus(article.id);
    _updateMarkButton(btn, isRead);

    window.scrollTo(0, 0);
    _setupScrollDetection();
  }

  function _renderQuizEntry(article) {
    const entry = document.getElementById('quiz-entry');
    if (!entry) return;

    if (!Quiz.hasQuiz(article)) {
      entry.classList.add('hidden');
      return;
    }

    const quizResult = Quiz.getQuizResult(article.id);
    if (quizResult) {
      entry.innerHTML = `
        <div class="quiz-entry-done">
          <div class="quiz-entry-header">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            <span>本篇测验已完成</span>
          </div>
          <p class="quiz-entry-score">得分：${quizResult.correct}/${quizResult.total}（${quizResult.percentage}%）</p>
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
            <button class="btn-secondary btn-quiz-retry" onclick="Quiz.start(window.__readerCurrentArticle, window.__onQuizComplete)">重新测验</button>
            <button class="btn-back-home" onclick="ArticleReader.hide()">返回主页</button>
          </div>
        </div>
      `;
    } else {
      entry.innerHTML = `
        <div class="quiz-entry-start">
          <div class="quiz-entry-divider">
            <span>读后小测</span>
          </div>
          <p class="quiz-entry-desc">完成阅读后，试试你能答对几道题？</p>
          <div class="quiz-entry-actions">
            <button class="btn-primary btn-quiz-start" id="btn-start-quiz">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
              开始本篇知识点小测
            </button>
          </div>
        </div>
      `;

      document.getElementById('btn-start-quiz').addEventListener('click', () => {
        window.__readerCurrentArticle = currentArticle;
        window.__onQuizComplete = (id, correct, total) => {
          _renderQuizEntry(currentArticle);
          if (onReadCallback) onReadCallback(id, true);
        };
        Quiz.start(currentArticle, window.__onQuizComplete);
      });
    }

    entry.classList.remove('hidden');
  }

  function hide() {
    _teardownScrollDetection();
    Quiz.close();
    document.getElementById('view-reader').classList.add('hidden');
    document.getElementById('view-home').classList.remove('hidden');
    document.getElementById('btn-back').classList.add('hidden');
    currentArticle = null;
  }

  function _setupScrollDetection() {
    _teardownScrollDetection();
    const sentinel = document.getElementById('article-end-sentinel');
    if (!sentinel) return;

    scrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && currentArticle) {
          const isRead = Progress.getReadStatus(currentArticle.id);
          if (!isRead) {
            Progress.markRead(currentArticle.id);
            const btn = document.getElementById('btn-mark-read');
            _updateMarkButton(btn, true);
            if (onReadCallback) onReadCallback(currentArticle.id, true);
          }
        }
      });
    }, { threshold: 0.5 });

    scrollObserver.observe(sentinel);
  }

  function _teardownScrollDetection() {
    if (scrollObserver) {
      scrollObserver.disconnect();
      scrollObserver = null;
    }
  }

  function _updateMarkButton(btn, isRead) {
    if (isRead) {
      btn.classList.add('done');
      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        已完成
      `;
    } else {
      btn.classList.remove('done');
      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        已读完
      `;
    }
  }

  function markCurrentRead() {
    if (!currentArticle) return;
    Progress.markRead(currentArticle.id);
    const btn = document.getElementById('btn-mark-read');
    _updateMarkButton(btn, true);
    if (onReadCallback) onReadCallback(currentArticle.id, true);
  }

  function _esc(str) {
    const el = document.createElement('span');
    el.textContent = str || '';
    return el.innerHTML;
  }

  return { show, hide, markCurrentRead };
})();
