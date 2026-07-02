const GitHubAPI = (() => {
  const API_BASE = 'https://api.github.com';

  function _getConfig() {
    return {
      token: Progress.getSetting('pat'),
      repo: Progress.getSetting('repo')
    };
  }

  function isConfigured() {
    const { token, repo } = _getConfig();
    return !!(token && repo);
  }

  async function _request(path, options = {}) {
    const { token } = _getConfig();
    const url = `${API_BASE}${path}`;
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      ...options.headers
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const resp = await fetch(url, { ...options, headers });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || `GitHub API error: ${resp.status}`);
    }
    if (resp.status === 204) return null;
    return resp.json();
  }

  async function triggerWorkflow(workflowFile, inputs = {}) {
    const { repo } = _getConfig();
    return _request(`/repos/${repo}/actions/workflows/${workflowFile}/dispatches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: 'main', inputs })
    });
  }

  async function getLatestRun(workflowFile) {
    const { repo } = _getConfig();
    try {
      const data = await _request(`/repos/${repo}/actions/workflows/${workflowFile}/runs?per_page=1`);
      return data.workflow_runs && data.workflow_runs[0] ? data.workflow_runs[0] : null;
    } catch {
      return null;
    }
  }

  async function pollRunStatus(runId, onStatus) {
    const { repo } = _getConfig();
    let attempts = 0;
    const maxAttempts = 120;
    while (attempts < maxAttempts) {
      try {
        const run = await _request(`/repos/${repo}/actions/runs/${runId}`);
        if (onStatus) onStatus(run.status, run.conclusion);
        if (run.status === 'completed') return run;
      } catch (err) {
        console.warn('Poll error:', err.message);
      }
      await new Promise(r => setTimeout(r, 5000));
      attempts++;
    }
    throw new Error('Workflow run timed out');
  }

  async function getRawFile(path) {
    const { repo } = _getConfig();
    const { token } = _getConfig();
    const url = `https://raw.githubusercontent.com/${repo}/main/${path}`;
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const resp = await fetch(url, { headers });
    if (!resp.ok) return null;
    return resp.json();
  }

  return {
    isConfigured,
    triggerWorkflow,
    getLatestRun,
    pollRunStatus,
    getRawFile
  };
})();
