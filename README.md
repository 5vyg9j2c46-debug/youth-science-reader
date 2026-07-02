# 青少年全科视野科普阅读网页

面向小升初学生的全科科普阅读平台，每日自动推送5-20篇AI改写的科普文章。

## 技术架构

- **前端**：纯HTML/CSS/JS，托管于GitHub Pages
- **后端**：GitHub Actions云端执行，Node.js脚本
- **AI**：小米MIMO 2.5 API（OpenAI兼容格式）
- **存储**：文章归档在仓库JSON文件，阅读进度保存在浏览器LocalStorage

## 快速开始

### 1. 创建GitHub仓库

将本项目推送到GitHub仓库。

### 2. 配置Secrets

在仓库 Settings → Secrets and variables → Actions 中添加：

| Secret | 说明 |
|--------|------|
| `MIMO_API_KEY` | 小米MIMO API密钥 |
| `MIMO_BASE_URL` | MIMO API端点（如 `https://api.mimo.xiaomi.com/v1`） |

### 3. 启用GitHub Pages

Settings → Pages → Source 选 `main` 分支。

### 4. 首次使用

打开页面后，在右下角设置中输入：
- GitHub Personal Access Token（需 `repo` + `workflow` 权限）
- 仓库地址（格式：`username/repo-name`）

点击「获取今日文摘」即可生成文章。

## 九大栏目

1. 航天深空·天文新知
2. 考古文博·古文明发掘
3. 大国工程·前沿科技突破
4. 地球自然·气象地质博物探索
5. 生物世界·生命科学科普
6. 地理探索·环球人文地貌
7. 青少年健康医学科普
8. 生态环境·地球保护科考
9. 环球人文与跨国科考见闻

## 功能说明

- **每日自动推送**：凌晨0点自动生成当日文稿
- **手动刷新**：点击按钮触发重新生成
- **微信收录**：粘贴微信文章链接，自动收录为补充阅读
- **阅读进度**：滚动到底部自动标记已读，支持手动标记
- **日历看板**：右上角悬浮月度进度，三色可视化
- **历史浏览**：支持翻看任意日期的文章
