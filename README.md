# C3S MCP Server

用于在 Claude Code 中查询 C3S 客服平台工单信息的 MCP Server，支持搜索工单、查看投诉详情、分析图片/视频附件。

## 功能

| 工具 | 说明 |
|------|------|
| `c3s-auth` | 浏览器 SSO 登录客服平台 |
| `c3s-logout` | 退出登录 |
| `search_tickets` | 搜索工单列表（支持工单ID、邮箱、关键词） |
| `get_ticket_detail` | 获取工单完整详情（投诉内容、附件、设备信息） |
| `get_ticket_lifecycle` | 获取工单生命周期（状态变更记录） |
| `get_customer_history` | 获取客户历史工单记录 |
| `get_customer_info` | 获取客户信息 |
| `analyze_ticket_media` | 下载工单图片/视频附件，进行视觉分析 |

## 安装

```bash
# 1. 添加插件市场（仅首次）
claude plugins marketplace add https://gitlab.intsig.net/cs-templates/skills/cs-web-agent-plugins.git

# 2. 安装插件
claude plugins install c3s@cs-web-agent-plugins
```

安装后重启 Claude Code 即可使用。插件会自动注册 MCP Server 和 `/c3s` Skill。

### 前提条件

- Node.js >= 18
- Playwright Chromium（用于浏览器登录）：`npx playwright install chromium`

## 认证

首次使用时调用 `c3s-auth` 工具，会打开浏览器进行 SSO 登录。

- 浏览器数据持久化在 `~/.c3s-mcp/browser-data/`，保存的密码下次自动填充
- 认证信息保存在 `~/.c3s-mcp/credentials.json`，有效期 7 天

## 使用示例

```
> 搜索最近的客诉工单
> 查看工单 5535810 的详情
> 搜索邮箱 xxx@gmail.com 的所有工单
```

## 附件分析

`analyze_ticket_media` 工具可自动下载工单邮件中的图片和视频附件：

- 图片直接返回供 AI 视觉分析
- 视频通过 ffmpeg 提取关键帧后返回
- 支持 jpg、png、mp4、mov 等常见格式

## 开发者指南

### 发布新版本

1. 修改代码并推送到 GitLab
2. 在 Jenkins 中触发构建：[public_npm](https://jenkins.intsig.net/job/public_npm/)，参考已有 mcp 相关包配置
3. 更新 marketplace.json 中的 sha

用户下次启动 Claude Code 时，`npx -y @camscanner/c3s-mcp-server@latest` 会自动拉取新版本。
