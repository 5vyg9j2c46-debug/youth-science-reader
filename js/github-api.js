const PlatformAPI = (() => {
  const GITHUB_BASE = 'https://api.github.com';
  const GITEE_BASE = 'https://gitee.com/api/v5';

  function _getConfig() {
    return {
      platform: Progress.getSetting('platform') || 'gitee',
      token: Progress.getSetting('pat'),
      repo: Progress.getSetting('repo')
    };
  }

  function isConfigured() {
    const { token, repo } = _getConfig();
    return !!(token && repo);
  }

  async function _request(path, options = {}) {
    const { platform, token } = _getConfig();
    const base = platform === 'gitee' ? GITEE_BASE : GITHUB_BASE;
    const sep = platform === 'gitee' ? (path.includes('?') ? '&' : '?') + 'access_token=' + token : '';
    const url = `${base}${path}${sep}`;

    const headers = { ...options.headers };
    if (platform === 'github') {
      headers['Accept'] = 'application/vnd.github.v3+json';
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } else {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    const resp = await fetch(url, { ...options, headers });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || `API error: ${resp.status}`);
    }
    if (resp.status === 204) return null;
    return resp.json();
  }

  async function triggerWorkflow(workflowFile, inputs = {}) {
    const { platform, repo } = _getConfig();

    if (platform === 'gitee') {
      const pipelineFile = workflowFile.replace('.yml', '').replace('manual-generate', 'pipeline-manual').replace('wechat-collect', 'pipeline-manual');
      const pipelines = await _request(`/repos/${repo}/pipelines?per_page=50`);
      const pipeline = pipelines.find(p => p.config_file === `.gitee/${pipelineFile}.yml` || p.config_file === `.gitee/${workflowFile}`);
      if (!pipeline) {
        throw new Error('Gitee流水线未找到，请先在Gitee网页启用流水线功能');
      }
      return _request(`/repos/${repo}/pipelines/${pipeline.id}/run`, {
        method: 'POST',
        body: JSON.stringify({ inputs })
      });
    }

    return _request(`/repos/${repo}/actions/workflows/${workflowFile}/dispatches`, {
      method: 'POST',
      body: JSON.stringify({ ref: 'main', inputs })
    });
  }

  async function getLatestRun(workflowFile) {
    const { platform, repo } = _getConfig();

    if (platform === 'gitee') {
      try {
        const runs = await _request(`/repos/${repo}/pipelines?per_page=5&sort=created_at&direction=desc`);
        return runs && runs[0] ? { id: runs[0].id, status: runs[0].status } : null;
      } catch { return null; }
    }

    try {
      const data = await _request(`/repos/${repo}/actions/workflows/${workflowFile}/runs?per_page=1`);
      return data.workflow_runs && data.workflow_runs[0] ? data.workflow_runs[0] : null;
    } catch { return null; }
  }

  async function pollRunStatus(runId, onStatus) {
    const { platform, repo } = _getConfig();
    let attempts = 0;
    const maxAttempts = 120;

    while (attempts < maxAttempts) {
      try {
        let status, conclusion;
        if (platform === 'gitee') {
          const run = await _request(`/repos/${repo}/pipelines/${runId}`);
          status = run.status === 'success' ? 'completed' : (run.status === 'failed' ? 'completed' : 'in_progress');
          conclusion = run.status === 'success' ? 'success' : (run.status === 'failed' ? 'failure' : null);
        } else {
          const run = await _request(`/repos/${repo}/actions/runs/${runId}`);
          status = run.status;
          conclusion = run.conclusion;
        }

        if (onStatus) onStatus(status, conclusion);
        if (status === 'completed') {
          if (conclusion === 'failure') {
            throw new Error('云端工作流执行失败，请检查日志');
          }
          return { status, conclusion };
        }
      } catch (err) {
        if (err.message.includes('失败')) throw err;
        console.warn('Poll error:', err.message);
      }
      await new Promise(r => setTimeout(r, 5000));
      attempts++;
    }
    throw new Error('等待超时，请稍后刷新页面查看');
  }

  async function getRawFile(path) {
    const { platform, repo, token } = _getConfig();
    let url;
    if (platform === 'gitee') {
      url = `https://gitee.com/${repo}/raw/master/${path}`;
    } else {
      url = `https://raw.githubusercontent.com/${repo}/main/${path}`;
    }
    const headers = {};
    if (platform === 'github' && token) headers['Authorization'] = `Bearer ${token}`;
    const resp = await fetch(url, { headers });
    if (!resp.ok) return null;
    return resp.json();
  }

  return { isConfigured, triggerWorkflow, getLatestRun, pollRunStatus, getRawFile };
})();

const GitHubAPI = PlatformAPI;
