---
name: c3s
description: "C3S 客服工单助手。当用户提到客服、工单、ticket、投诉、C3S、客户反馈、用户反馈、complaint、客诉 等关键词时触发。也适用于用户贴了工单 ID 或链接让你帮忙查看、分析客诉原因、查看客户历史等场景。"
argument-hint: <工单ID 或关键词>
disable-model-invocation: false
allowed-tools: ["mcp__plugin_cs-c3s-mcp-server_c3s__*"]
---

# C3S 客服工单助手

通过 C3S MCP 查询客服工单信息，分析投诉内容（含图片/视频附件）。

## 工作流程

### 1. 获取工单信息

1. 认证：`c3s-auth`
2. `get_ticket_detail` 获取详情（或 `search_tickets` 搜索）
3. 提取：投诉内容、客户信息、产品/平台、设备信息

### 2. 分析附件（自动）

获取详情后检查 attachments 中是否有图片/视频。附件通常是用户截图或录屏，能更准确还原问题场景。

发现图片/视频 → 调用 `analyze_ticket_media` 下载并视觉分析。

### 3. 查看客户历史

`get_customer_history` 查看该客户的其他工单，理解问题上下文（是否反复投诉同一问题）。

### 4. 总结

整理投诉内容 + 设备信息 + 附件分析，给出清晰的问题描述和解决建议。
