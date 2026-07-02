const WechatCollect = (() => {
  let statusEl, statusTextEl;

  function init() {
    statusEl = document.getElementById('wechat-status');
    statusTextEl = document.getElementById('wechat-status-text');

    document.getElementById('btn-wechat-collect').addEventListener('click', handleCollect);
    document.getElementById('wechat-url-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleCollect();
    });
  }

  async function handleCollect() {
    const input = document.getElementById('wechat-url-input');
    const url = input.value.trim();

    if (!url) {
      alert('请粘贴微信文章链接');
      return;
    }

    if (!GitHubAPI.isConfigured()) {
      alert('请先在设置中配置 GitHub Token 和仓库地址');
      return;
    }

    _showStatus('收录中，请稍候...');
    document.getElementById('btn-wechat-collect').disabled = true;

    try {
      const today = _getDateStr();
      await GitHubAPI.triggerWorkflow('wechat-collect.yml', {
        url: url,
        date: today
      });

      _showStatus('已触发收录，等待完成...');

      const run = await GitHubAPI.getLatestRun('wechat-collect.yml');
      if (run) {
        await GitHubAPI.pollRunStatus(run.id, (status) => {
          if (status === 'in_progress') {
            _showStatus('云端处理中...');
          }
        });
      } else {
        await new Promise(r => setTimeout(r, 15000));
      }

      _showStatus('收录完成，正在刷新...');
      input.value = '';

      if (typeof App !== 'undefined') {
        await App.loadDate(today);
      }

      _hideStatus();
    } catch (err) {
      _showStatus('收录失败: ' + err.message);
      setTimeout(_hideStatus, 5000);
    } finally {
      document.getElementById('btn-wechat-collect').disabled = false;
    }
  }

  function _showStatus(text) {
    statusTextEl.textContent = text;
    statusEl.classList.remove('hidden');
  }

  function _hideStatus() {
    statusEl.classList.add('hidden');
  }

  function _getDateStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  return { init };
})();
