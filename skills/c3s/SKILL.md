---
name: c3s
description: "C3S客服平台助手。当用户提到客服、工单、ticket、投诉、C3S 等关键词时触发，或用户要求查询客服工单信息时触发。"
argument-hint: <工单ID 或关键词>
disable-model-invocation: false
---

# C3S 客服平台助手

帮助用户通过 C3S MCP 查询客服工单（ticket）信息，分析客户投诉内容，包括文本、图片和视频附件。

## 可用 MCP 工具

来自 c3s MCP server：

1. **c3s-auth** — 通过浏览器 SSO 登录客服平台
2. **c3s-logout** — 退出登录
3. **search_tickets** — 搜索工单列表（支持按工单ID、邮箱、关键词搜索）
4. **get_ticket_detail** — 获取工单完整详情（投诉内容、附件、设备信息等）
5. **get_ticket_lifecycle** — 获取工单生命周期
6. **get_customer_history** — 获取客户历史工单记录
7. **get_customer_info** — 获取客户信息
8. **analyze_ticket_media** — 下载工单中的图片/视频附件，进行视觉分析

## 工作流程

### 第 1 步：获取工单信息

1. 如果未认证，先调用 `c3s-auth` 登录
2. 根据用户提供的工单 ID，使用 `get_ticket_detail` 获取工单详情
3. 提取关键信息：**投诉内容、客户信息、产品/平台、设备信息**

### 第 2 步：分析附件（自动执行）

获取到工单详情后，**检查是否存在图片或视频附件**：

1. 检查邮件中的 attachments 列表
2. 如果有图片（.jpg, .png 等）或视频（.mp4, .mov 等），调用 `analyze_ticket_media` 下载并分析
3. 图片/视频可以帮助更准确地理解客户的问题

### 第 3 步：查看客户历史

1. 使用 `get_customer_history` 查看该客户是否有其他相关工单
2. 结合历史记录，全面理解问题上下文

### 第 4 步：总结报告

1. 整理投诉内容、设备信息、附件分析结果
2. 给出清晰的问题描述和可能的解决方案建议
