const PlatformAPI = (() => {
  const ENV_ID = 'youthread-d4gn9d9wr23b1a16a';
  const FN_URL = `https://${ENV_ID}.service.tcloudbase.com/generate`;

  function isConfigured() {
    return true;
  }

  function getFnUrl() { return FN_URL; }

  async function triggerGenerate(dateStr, extra, quick) {
    const resp = await fetch(FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: dateStr, extra: extra || false, quick: !!quick })
    });

    if (!resp.ok) {
      const err = await resp.text().catch(() => '');
      throw new Error(`云函数调用失败: ${resp.status}`);
    }

    const result = await resp.json();

    if (result && result.articles) {
      try {
        localStorage.setItem(`articles_${dateStr}`, JSON.stringify(result));
      } catch {}
    }

    return result;
  }

  async function getArticles(dateStr) {
    try {
      const resp = await fetch(`data/articles/${dateStr}.json`);
      if (resp.ok) return await resp.json();
    } catch {}

    try {
      const local = localStorage.getItem(`articles_${dateStr}`);
      if (local) return JSON.parse(local);
    } catch {}

    return null;
  }

  async function getRawFile(path) {
    try {
      const resp = await fetch(path);
      if (resp.ok) return await resp.json();
    } catch {}
    return null;
  }

  function getFnUrl() {
    return FN_URL;
  }

  return { isConfigured, triggerGenerate, getArticles, getRawFile, getFnUrl };
})();

const GitHubAPI = PlatformAPI;
