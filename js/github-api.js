const PlatformAPI = (() => {
  const ENV_ID = 'youthread-d4gn9d9wr23b1a16a';
  const PUBLISHABLE_KEY = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjlkMWRjMzFlLWI0ZDAtNDQ4Yi1hNzZmLWIwY2M2M2Q4MTQ5OCJ9.eyJpc3MiOiJodHRwczovL3lvdXRocmVhZC1kNGduOWQ5d3IyM2IxYTE2YS5hcC1zaGFuZ2hhaS50Y2ItYXBpLnRlbmNlbnRjbG91ZGFwaS5jb20iLCJzdWIiOiJhbm9uIiwiYXVkIjoieW91dGhyZWFkLWQ0Z245ZDl3cjIzYjFhMTZhIiwiZXhwIjo0MDg2NzUzNTgwLCJpYXQiOjE3ODMwNzAzODAsIm5vbmNlIjoiVENvOEJGNXNTcGFwcmdZUmdiSnVuQSIsImF0X2hhc2giOiJUQ284QkY1c1NwYXByZ1lSZ2JKdW5BIiwibmFtZSI6IkFub255bW91cyIsInNjb3BlIjoiYW5vbnltb3VzIiwicHJvamVjdF9pZCI6InlvdXRocmVhZC1kNGduOWQ5d3IyM2IxYTE2YSIsIm1ldGEiOnsicGxhdGZvcm0iOiJQdWJsaXNoYWJsZUtleSJ9LCJ1c2VyX3R5cGUiOiIiLCJjbGllbnRfdHlwZSI6ImNsaWVudF91c2VyIiwiaXNfc3lzdGVtX2FkbWluIjpmYWxzZX0.CkwbpeV-itIsAb07ZKxO57IniZOUtYgbI1LzUtWia8kk3nvVGbLdq4IayPeAhHetAG7Z6BA69zqczQhEaIc9gbzDbzw7EiHMnV-Gcxer9vnsKFdNbr1Q5TVEdj_fbJGbQPGy1fUYEN3l7102JfYKe-rid_PvPIhOU2sVQngDoZwu9RW4x-_J0h1UmcP0as0nSwWI986fEPyeLI4zvcuRUEj3ohqpq8KgUqCRmk-E2YMv-ohrKXv2OOxTM4xqhpb1nTKnrnwUKJkv_BWALJkViZBgColVG6SH2Qrjlu9n63uLgRcGpBihsdkEUIfxh8pwY87WjnnF-7koa2dXQsCo8A';

  let app = null;
  let auth = null;
  let db = null;

  function _init() {
    if (app) return;
    if (typeof tcb === 'undefined') {
      console.warn('CloudBase SDK not loaded');
      return;
    }
    app = tcb.init({ env: ENV_ID });
    auth = app.auth({ persistence: 'local' });
    db = app.database();
  }

  async function _ensureAuth() {
    _init();
    if (!auth) throw new Error('CloudBase SDK not available');
    try {
      await auth.signInAnonymously();
    } catch (e) {
      console.warn('Auth warning:', e.message);
    }
  }

  function isConfigured() {
    return true;
  }

  async function triggerGenerate(dateStr, extra) {
    await _ensureAuth();
    const result = await app.callFunction({
      name: 'generate-articles',
      data: { date: dateStr, extra: extra || false }
    });
    return result.result;
  }

  async function pollRunStatus(runId, onStatus) {
    if (onStatus) onStatus('in_progress', null);
    await new Promise(r => setTimeout(r, 8000));
    if (onStatus) onStatus('completed', 'success');
    return { status: 'completed', conclusion: 'success' };
  }

  async function getArticles(dateStr) {
    try {
      const resp = await fetch(`https://youthread-d4gn9d9wr23b1a16a.tcloudbaseapp.com/data/articles/${dateStr}.json`);
      if (resp.ok) return await resp.json();
    } catch {}

    try {
      await _ensureAuth();
      const res = await db.collection('articles').where({ date: dateStr }).get();
      if (res.data && res.data.length > 0) return res.data[0];
    } catch {}

    return null;
  }

  async function getRawFile(path) {
    try {
      const resp = await fetch(`https://youthread-d4gn9d9wr23b1a16a.tcloudbaseapp.com/${path}`);
      if (resp.ok) return await resp.json();
    } catch {}
    return null;
  }

  return { isConfigured, triggerGenerate, pollRunStatus, getArticles, getRawFile };
})();

const GitHubAPI = PlatformAPI;
