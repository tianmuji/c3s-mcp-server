#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v3";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegPath: string = require("@ffmpeg-installer/ffmpeg").path;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffprobePath: string = require("@ffprobe-installer/ffprobe").path;
import { C3sClient } from "./c3s-client.js";
import { loadCredentials, saveCredentials, startBrowserLogin, clearCredentials } from "./auth.js";
import {
  formatCaseList,
  formatCaseDetail,
  formatCaseLifecycle,
  formatCaseHistory,
  formatCustomerInfo,
  stripHtml,
} from "./formatters.js";

const client = new C3sClient();

async function requireAuth(): Promise<string | null> {
  if (!client.isAuthenticated()) {
    const savedCreds = await loadCredentials();
    if (savedCreds) {
      client.setCredentials(savedCreds);
      console.error("Restored saved credentials (valid until " + new Date(savedCreds.expiresAt).toLocaleString() + ")");
    }
  }
  if (!client.isAuthenticated()) {
    return "未认证。请先调用 'c3s-auth' 工具通过浏览器登录。";
  }
  return null;
}

const server = new McpServer({
  name: "c3s",
  version: "1.0.0",
}, {
  instructions: `# C3S 客服平台助手

帮助用户通过 C3S MCP 查询客服工单（ticket）信息，分析客户投诉内容，包括文本、图片和视频附件。

## 可用 MCP 工具

1. **c3s-auth** — 通过浏览器 SSO 登录客服平台
2. **c3s-logout** — 退出登录
3. **search_tickets** — 搜索工单列表（支持按工单ID、邮箱、关键词搜索）
4. **get_ticket_detail** — 获取工单完整详情（投诉内容、附件、设备信息等）
5. **get_ticket_lifecycle** — 获取工单生命周期（状态变更记录）
6. **get_customer_history** — 获取客户历史工单记录
7. **get_customer_info** — 获取客户信息
8. **analyze_ticket_media** — 下载工单中的图片/视频附件，进行视觉分析

## 工作流程

### 第 1 步：获取工单信息

1. 如果未认证，先调用 c3s-auth 登录
2. 根据用户提供的工单 ID，使用 get_ticket_detail 获取工单详情
3. 提取关键信息：**投诉内容、客户信息、产品/平台、设备信息**

### 第 2 步：分析附件（自动执行）

获取到工单详情后，**检查是否存在图片或视频附件**：

1. 检查邮件中的 attachments 列表
2. 如果有图片（.jpg, .png 等）或视频（.mp4, .mov 等），调用 analyze_ticket_media 下载并分析
3. 图片/视频可以帮助更准确地理解客户的问题

### 第 3 步：查看客户历史

1. 使用 get_customer_history 查看该客户是否有其他相关工单
2. 结合历史记录，全面理解问题上下文

### 第 4 步：总结报告

1. 整理投诉内容、设备信息、附件分析结果
2. 给出清晰的问题描述和可能的解决方案建议`,
});

// Tool: c3s-auth
server.tool(
  "c3s-auth",
  "Login to C3S customer service platform via SSO. Opens a browser window for authentication.",
  {},
  async () => {
    if (client.isAuthenticated()) {
      return { content: [{ type: "text", text: "已认证。使用 'c3s-logout' 可重新认证。" }] };
    }
    try {
      const creds = await startBrowserLogin();
      client.setCredentials(creds);
      await saveCredentials(creds);
      return { content: [{ type: "text", text: "认证成功！现在可以使用所有 C3S 工具。" }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `认证失败: ${err.message}` }] };
    }
  }
);

// Tool: c3s-logout
server.tool(
  "c3s-logout",
  "Clear saved C3S credentials and logout.",
  {},
  async () => {
    await clearCredentials();
    client.setCredentials(null);
    return { content: [{ type: "text", text: "已退出登录。使用 'c3s-auth' 重新登录。" }] };
  }
);

// Tool: search_tickets
server.tool(
  "search_tickets",
  "Search C3S customer service tickets. Can search by case_id, email, subject keyword, or general keyword.",
  {
    case_id: z.string().optional().describe("工单 ID（精确匹配）"),
    email: z.string().optional().describe("客户邮箱"),
    keyword: z.string().optional().describe("关键词搜索"),
    subject: z.string().optional().describe("主题关键词"),
    from_time: z.string().optional().describe("开始时间 (YYYY-MM-DD)"),
    to_time: z.string().optional().describe("结束时间 (YYYY-MM-DD)"),
    page_num: z.number().optional().describe("页码 (默认 1)"),
    page_size: z.number().optional().describe("每页数量 (默认 20)"),
    is_engineer_deal: z.boolean().optional().describe("仅显示工程师处理的工单"),
  },
  async (params) => {
    const authErr = await requireAuth();
    if (authErr) return { content: [{ type: "text", text: authErr }] };

    try {
      const res = await client.searchCases(params);
      if (res.code !== 0) {
        return { content: [{ type: "text", text: `查询失败: ${res.msg || res.message}` }] };
      }
      return { content: [{ type: "text", text: formatCaseList(res.data) }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `错误: ${err.message}` }] };
    }
  }
);

// Tool: get_ticket_detail
server.tool(
  "get_ticket_detail",
  "Get full detail of a specific ticket including complaint content, emails, attachments, device info, and extended parameters.",
  {
    case_id: z.string().describe("工单 ID"),
  },
  async ({ case_id }) => {
    const authErr = await requireAuth();
    if (authErr) return { content: [{ type: "text", text: authErr }] };

    try {
      const res = await client.getCaseDetail(case_id);
      if (res.code !== 0) {
        return { content: [{ type: "text", text: `查询失败: ${res.msg || res.message}` }] };
      }
      if (!res.data?.case_info) {
        return { content: [{ type: "text", text: `工单 "${case_id}" 不存在。` }] };
      }
      return { content: [{ type: "text", text: formatCaseDetail(res.data) }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `错误: ${err.message}` }] };
    }
  }
);

// Tool: get_ticket_lifecycle
server.tool(
  "get_ticket_lifecycle",
  "Get ticket lifecycle (status changes and events) for a specific case.",
  {
    case_id: z.string().describe("工单 ID"),
  },
  async ({ case_id }) => {
    const authErr = await requireAuth();
    if (authErr) return { content: [{ type: "text", text: authErr }] };

    try {
      const res = await client.getCaseLifecycle(case_id);
      if (res.code !== 0) {
        return { content: [{ type: "text", text: `查询失败: ${res.msg || res.message}` }] };
      }
      return { content: [{ type: "text", text: formatCaseLifecycle(res.data) }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `错误: ${err.message}` }] };
    }
  }
);

// Tool: get_customer_history
server.tool(
  "get_customer_history",
  "Get historical tickets for a customer. Requires customer_id and case_id (from ticket detail).",
  {
    customer_id: z.string().describe("客户 ID (从工单详情获取)"),
    case_id: z.string().describe("当前工单 ID"),
  },
  async ({ customer_id, case_id }) => {
    const authErr = await requireAuth();
    if (authErr) return { content: [{ type: "text", text: authErr }] };

    try {
      const res = await client.getCaseHistory(customer_id, case_id);
      if (res.code !== 0) {
        return { content: [{ type: "text", text: `查询失败: ${res.msg || res.message}` }] };
      }
      return { content: [{ type: "text", text: formatCaseHistory(res.data) }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `错误: ${err.message}` }] };
    }
  }
);

// Tool: get_customer_info
server.tool(
  "get_customer_info",
  "Get customer information associated with a ticket.",
  {
    case_id: z.string().describe("工单 ID"),
  },
  async ({ case_id }) => {
    const authErr = await requireAuth();
    if (authErr) return { content: [{ type: "text", text: authErr }] };

    try {
      const res = await client.getCaseUser(case_id);
      if (res.code !== 0) {
        return { content: [{ type: "text", text: `查询失败: ${res.msg || res.message}` }] };
      }
      return { content: [{ type: "text", text: formatCustomerInfo(res.data) }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `错误: ${err.message}` }] };
    }
  }
);

// Tool: analyze_ticket_media
server.tool(
  "analyze_ticket_media",
  "Download and analyze images/videos from a ticket's email attachments. For images, returns them directly for visual analysis. For videos, extracts key frames using ffmpeg.",
  {
    case_id: z.string().describe("工单 ID"),
    max_frames: z.number().optional().describe("视频最大提取帧数 (默认 8, 最大 15)"),
  },
  async ({ case_id, max_frames }) => {
    const authErr = await requireAuth();
    if (authErr) return { content: [{ type: "text" as const, text: authErr }] };

    const targetFrames = Math.min(max_frames || 8, 15);

    // 1. Get ticket detail to find attachments
    let caseInfo: any;
    try {
      const res = await client.getCaseDetail(case_id);
      caseInfo = res.data?.case_info;
      if (!caseInfo) {
        return { content: [{ type: "text" as const, text: `工单 "${case_id}" 不存在。` }] };
      }
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `获取工单失败: ${err.message}` }] };
    }

    // 2. Collect all attachments from emails
    const allAttachments: Array<{ name: string; url: string; isVideo: boolean; isImage: boolean }> = [];

    if (caseInfo.email) {
      for (const em of caseInfo.email) {
        if (em.attachments && em.attachments.length > 0) {
          for (const att of em.attachments) {
            const name = att.attachment_show_name || att.attachment_real_name || "unknown";
            const url = att.attachment_download_url || att.attachment_view_url;
            const lower = name.toLowerCase();
            const isVideo = [".mp4", ".mov", ".avi", ".webm", ".mkv", ".flv"].some(ext => lower.endsWith(ext));
            const isImage = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"].some(ext => lower.endsWith(ext));
            if (url) {
              allAttachments.push({ name, url, isVideo, isImage });
            }
          }
        }
      }
    }

    // 2b. Also check for embedded images in email HTML body
    if (caseInfo.email) {
      for (const em of caseInfo.email) {
        if (em.html_body) {
          const imgRegex = /<img[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
          let match;
          const seenUrls = new Set(allAttachments.map(a => a.url));
          while ((match = imgRegex.exec(em.html_body)) !== null) {
            const imgUrl = match[1];
            if (!seenUrls.has(imgUrl) && imgUrl.startsWith("http")) {
              seenUrls.add(imgUrl);
              const urlPath = new URL(imgUrl).pathname;
              const segments = urlPath.split("/").filter(Boolean);
              const filename = segments[segments.length - 1] || "embedded_image.jpg";
              allAttachments.push({ name: filename, url: imgUrl, isVideo: false, isImage: true });
            }
          }
        }
      }
    }

    if (allAttachments.length === 0) {
      return {
        content: [{
          type: "text" as const,
          text: `工单 ${case_id} 没有找到图片或视频附件。`,
        }],
      };
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "c3s-media-"));
    const contents: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> = [];

    contents.push({
      type: "text" as const,
      text: `工单 ${case_id}: 发现 ${allAttachments.length} 个附件\n${allAttachments.map(a => `  - ${a.name} (${a.isVideo ? "视频" : a.isImage ? "图片" : "其他"})`).join("\n")}\n`,
    });

    try {
      for (const att of allAttachments) {
        const filePath = path.join(tmpDir, att.name.replace(/[^a-zA-Z0-9._-]/g, "_"));

        try {
          await client.downloadFile(att.url, filePath);
          const stats = fs.statSync(filePath);

          if (stats.size < 100) {
            contents.push({
              type: "text" as const,
              text: `\n附件 "${att.name}": 文件太小 (${stats.size} bytes)，可能下载失败。`,
            });
            continue;
          }

          if (att.isImage) {
            // Return image directly for visual analysis
            const imageData = fs.readFileSync(filePath).toString("base64");
            const ext = path.extname(att.name).toLowerCase();
            const mimeMap: Record<string, string> = {
              ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
              ".png": "image/png", ".gif": "image/gif",
              ".bmp": "image/bmp", ".webp": "image/webp",
            };
            contents.push({
              type: "text" as const,
              text: `\n--- 图片: ${att.name} (${Math.round(stats.size / 1024)}KB) ---`,
            });
            contents.push({
              type: "image" as const,
              data: imageData,
              mimeType: mimeMap[ext] || "image/jpeg",
            });
          } else if (att.isVideo) {
            // Extract frames from video
            if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
              contents.push({
                type: "text" as const,
                text: `\n视频 "${att.name}": ffmpeg 未找到，无法提取帧。`,
              });
              continue;
            }

            const framesDir = path.join(tmpDir, `frames_${att.name.replace(/[^a-zA-Z0-9]/g, "_")}`);
            fs.mkdirSync(framesDir);

            let duration = 0;
            try {
              const probeResult = execSync(
                `"${ffprobePath}" -v error -show_entries format=duration -of csv=p=0 "${filePath}"`,
                { encoding: "utf-8" }
              ).trim();
              duration = parseFloat(probeResult) || 0;
            } catch { /* duration unknown */ }

            let interval: number;
            let frameCount: number;
            if (duration > 0) {
              interval = Math.max(2, Math.ceil(duration / targetFrames));
              frameCount = Math.min(targetFrames, Math.floor(duration / interval) + 1);
            } else {
              interval = 3;
              frameCount = targetFrames;
            }

            const framePattern = path.join(framesDir, "frame_%04d.png");
            execSync(
              `"${ffmpegPath}" -i "${filePath}" -vf "fps=1/${interval}" -frames:v ${frameCount} -q:v 2 "${framePattern}"`,
              { stdio: "pipe", timeout: 60000 }
            );

            const frameFiles = fs.readdirSync(framesDir).filter(f => f.endsWith(".png")).sort();

            contents.push({
              type: "text" as const,
              text: `\n--- 视频: ${att.name} (${Math.round(stats.size / 1024)}KB, ${duration ? duration.toFixed(1) + "s" : "时长未知"}, ${frameFiles.length} 帧) ---`,
            });

            for (let i = 0; i < frameFiles.length; i++) {
              const framePath = path.join(framesDir, frameFiles[i]);
              const frameData = fs.readFileSync(framePath).toString("base64");
              contents.push({
                type: "text" as const,
                text: `帧 ${i + 1}/${frameFiles.length} (t=${i * interval}s)`,
              });
              contents.push({
                type: "image" as const,
                data: frameData,
                mimeType: "image/png",
              });
            }
          }
        } catch (err: any) {
          contents.push({
            type: "text" as const,
            text: `\n附件 "${att.name}" 处理失败: ${err.message}`,
          });
        }
      }

      return { content: contents };
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch { /* ignore cleanup errors */ }
    }
  }
);

// --- Start ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("C3S MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
