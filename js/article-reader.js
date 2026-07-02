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

    const body = document.getElementById('reader-body');
    body.innerHTML = article.content || '';

    const btn = document.getElementById('btn-mark-read');
    const isRead = Progress.getReadStatus(article.id);
    _updateMarkButton(btn, isRead);

    window.scrollTo(0, 0);
    _setupScrollDetection();
  }

  function hide() {
    _teardownScrollDetection();
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

  return { show, hide, markCurrentRead };
})();
