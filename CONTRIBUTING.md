# Contributing to Get Icon

感谢你为 Get Icon 做贡献。

## 开始开发

```bash
git clone https://github.com/Newterry/get-icon.git
cd get-icon
npm install
npm run dev
```

提交修改前请运行：

```bash
npm run lint
npm test
npm run build
```

## Pull Request

- 一个 PR 聚焦一个问题，说明用户可见的变化和验证方式。
- 新增后端行为时请补充测试。
- 修改界面时请检查桌面端和 390px 移动端。
- 不要降低 URL、DNS、重定向或图标代理的 SSRF 防护。
- 不要提交密钥、真实用户数据、构建产物或本地环境文件。

安全漏洞请按 [SECURITY.md](SECURITY.md) 私下报告，不要公开披露。
