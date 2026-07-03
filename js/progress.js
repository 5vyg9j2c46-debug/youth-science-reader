const Progress = (() => {
  const STORAGE_KEY = 'youth_science_reader';
  const READ_KEY = 'readStatus';
  const STATS_KEY = 'dailyStats';

  function _load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function _save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function getReadStatus(articleId) {
    const data = _load();
    return !!(data[READ_KEY] && data[READ_KEY][articleId]);
  }

  function markRead(articleId) {
    const data = _load();
    if (!data[READ_KEY]) data[READ_KEY] = {};
    data[READ_KEY][articleId] = true;
    _save(data);
  }

  function markUnread(articleId) {
    const data = _load();
    if (data[READ_KEY]) {
      delete data[READ_KEY][articleId];
      _save(data);
    }
  }

  function recalcDailyStats(date, articles) {
    const readCount = articles.filter(a => getReadStatus(a.id)).length;
    setDailyStats(date, articles.length, readCount);
  }

  function setDailyStats(date, total, completed) {
    const data = _load();
    if (!data[STATS_KEY]) data[STATS_KEY] = {};
    const GOAL = 10;
    const effectivePct = completed >= GOAL ? 100 : (GOAL > 0 ? Math.round((completed / GOAL) * 100) : 0);
    data[STATS_KEY][date] = {
      totalArticles: total,
      completedCount: completed,
      percentage: effectivePct
    };
    _save(data);
  }

  function getDailyStats(date) {
    const data = _load();
    return (data[STATS_KEY] && data[STATS_KEY][date]) || null;
  }

  function getAllStats() {
    const data = _load();
    return data[STATS_KEY] || {};
  }

  function getMonthStats(year, month) {
    const all = getAllStats();
    const result = {};
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    for (const [key, val] of Object.entries(all)) {
      if (key.startsWith(prefix)) {
        result[key] = val;
      }
    }
    return result;
  }

  function getSetting(key) {
    const data = _load();
    return data[`setting_${key}`] || '';
  }

  function setSetting(key, value) {
    const data = _load();
    data[`setting_${key}`] = value;
    _save(data);
  }

  return {
    getReadStatus,
    markRead,
    markUnread,
    recalcDailyStats,
    setDailyStats,
    getDailyStats,
    getAllStats,
    getMonthStats,
    getSetting,
    setSetting
  };
})();
