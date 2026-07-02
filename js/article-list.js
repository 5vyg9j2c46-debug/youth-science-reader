const ArticleList = (() => {
  const CATEGORIES = [
    '航天深空·天文新知',
    '考古文博·古文明发掘',
    '大国工程·前沿科技突破',
    '地球自然·气象地质博物探索',
    '生物世界·生命科学科普',
    '地理探索·环球人文地貌',
    '青少年健康医学科普',
    '生态环境·地球保护科考',
    '环球人文与跨国科考见闻'
  ];

  function render(articles, onSelect) {
    const list = document.getElementById('article-list');
    const empty = document.getElementById('empty-state');

    list.innerHTML = '';

    if (!articles || articles.length === 0) {
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');

    articles.forEach((article, index) => {
      const card = document.createElement('div');
      card.className = 'article-card';
      card.dataset.id = article.id;

      const isRead = Progress.getReadStatus(article.id);
      if (isRead) card.classList.add('read');

      const catClass = article.isWechat ? 'wechat' : '';

      card.innerHTML = `
        <span class="card-category ${catClass}">${_esc(article.category || '推荐阅读')}${article.isWechat ? ' · 微信收录' : ''}</span>
        <h3 class="card-title">${_esc(article.title)}</h3>
        <div class="card-meta">
          <span>约${article.readTime || 3}分钟</span>
          <span>${_esc(article.source || '')}</span>
          <span>${article.wordCount || 0}字</span>
        </div>
        <div class="card-status ${isRead ? 'read' : 'unread'}">
          <span class="dot"></span>
          <span class="label">${isRead ? '已读完' : '未读'}</span>
        </div>
      `;

      card.addEventListener('click', () => onSelect(article, index));
      list.appendChild(card);
    });
  }

  function updateCardStatus(articleId, isRead) {
    const card = document.querySelector(`.article-card[data-id="${articleId}"]`);
    if (!card) return;
    if (isRead) {
      card.classList.add('read');
    } else {
      card.classList.remove('read');
    }
    const status = card.querySelector('.card-status');
    if (status) {
      status.className = `card-status ${isRead ? 'read' : 'unread'}`;
      status.querySelector('.label').textContent = isRead ? '已读完' : '未读';
    }
  }

  function _esc(str) {
    const el = document.createElement('span');
    el.textContent = str || '';
    return el.innerHTML;
  }

  return { render, updateCardStatus, CATEGORIES };
})();
