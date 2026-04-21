// Product/Platform/Status mappings from common/config API
const PRODUCT_MAP: Record<number, string> = {
  1: "CamCard", 2: "CamScanner", 3: "QXB", 5: "CCB", 6: "Salesforce",
  7: "InNote", 8: "CamCheckout", 9: "Appediet", 10: "蜜蜂试卷",
  11: "OKEN Scanner", 12: "蜜蜂作业", 13: "CS PDF", 14: "LABL",
  15: "QuizAI", 16: "Mathlet", 17: "蜜蜂AI学", 18: "EasySpeak",
};

const PLATFORM_MAP: Record<number, string> = {
  1: "Android", 2: "iOS", 3: "网页", 4: "Support", 5: "VipSupport",
  6: "微信小程序", 7: "手机网页", 8: "电脑程序", 9: "HarmonyOS", 99: "其他",
};

const STATUS_MAP: Record<number, string> = {
  0: "草稿", 1: "系统封存", 2: "待处理", 3: "工程师处理中",
  4: "机器人处理中", 5: "已回复", 6: "主动结束", 7: "垃圾邮件",
  8: "回复待审批", 9: "待分配", 10: "脚本处理中",
};

export function getProductName(id: number): string {
  return PRODUCT_MAP[id] || `Product(${id})`;
}

export function getPlatformName(id: number): string {
  return PLATFORM_MAP[id] || `Platform(${id})`;
}

export function getStatusName(id: number): string {
  return STATUS_MAP[id] || `Status(${id})`;
}

function getStatusIcon(status: number): string {
  switch (status) {
    case 2: return "[待处理]";
    case 3: return "[工程师处理中]";
    case 4: return "[机器人处理中]";
    case 5: return "[已回复]";
    case 6: return "[已结束]";
    case 7: return "[垃圾邮件]";
    case 8: return "[待审批]";
    case 9: return "[待分配]";
    default: return `[${getStatusName(status)}]`;
  }
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>[^<]*<\/a>/gi, " $1 ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Format ticket search list */
export function formatCaseList(data: any): string {
  const list = data?.list;
  const total = data?.total;

  if (!Array.isArray(list) || list.length === 0) {
    return "没有找到工单。";
  }

  const lines: string[] = [];
  lines.push(`工单列表 (共 ${total || list.length} 条)\n`);

  for (const item of list) {
    const icon = getStatusIcon(item.status);
    lines.push(`${icon} ${item.subject || "(无标题)"}`);
    lines.push(`  工单ID: ${item.case_id}`);
    lines.push(`  状态: ${getStatusName(item.status)} | 产品: ${getProductName(item.product_id)} | 平台: ${getPlatformName(item.platform_id)}`);
    if (item.product_version) lines.push(`  版本: ${item.product_version}`);
    if (item.hardware_info) lines.push(`  设备: ${item.hardware_info}`);
    if (item.customer_info?.email) lines.push(`  客户邮箱: ${item.customer_info.email}`);
    if (item.user_info?.name) lines.push(`  处理人: ${item.user_info.name}`);
    lines.push(`  创建: ${item.create_time} | 更新: ${item.update_time}`);
    lines.push("");
  }

  return lines.join("\n");
}

/** Format ticket detail */
export function formatCaseDetail(data: any): string {
  const ci = data?.case_info;
  if (!ci) return "工单不存在。";

  const lines: string[] = [];

  lines.push(`${getStatusIcon(ci.status)} ${ci.subject || "(无标题)"}\n`);

  lines.push(`工单ID: ${ci.case_id}`);
  lines.push(`状态: ${getStatusName(ci.status)}`);
  lines.push(`产品: ${getProductName(ci.product_id)}`);
  lines.push(`平台: ${getPlatformName(ci.platform_id)}`);
  if (ci.product_version) lines.push(`版本: ${ci.product_version}`);
  if (ci.hardware_info) lines.push(`设备: ${ci.hardware_info}`);
  if (ci.language) lines.push(`语言: ${ci.language}`);
  if (ci.locale) lines.push(`地区: ${ci.locale}`);
  if (ci.ip) lines.push(`IP: ${ci.ip}`);
  lines.push(`创建: ${formatTimestamp(ci.create_time)}`);
  lines.push(`更新: ${formatTimestamp(ci.update_time)}`);

  // Problem description
  if (ci.problem_str) {
    lines.push(`\n问题分类: ${ci.problem_str}`);
  }

  // Customer info
  if (ci.customer_info) {
    const c = ci.customer_info;
    lines.push("\n--- 客户信息 ---");
    if (c.email) lines.push(`邮箱: ${c.email}`);
    if (c.phone) lines.push(`电话: ${c.phone}`);
    if (c.name) lines.push(`姓名: ${c.name}`);
    if (c.company) lines.push(`公司: ${c.company}`);
    lines.push(`客户ID: ${c.customer_id}`);
  }

  // User/handler info
  if (ci.user_info && ci.user_info.uid) {
    lines.push(`\n处理人: ${ci.user_info.name} (uid: ${ci.user_info.uid})`);
  }
  if (ci.robot_info && ci.robot_info.robot_id) {
    lines.push(`机器人: ${ci.robot_info.name} (id: ${ci.robot_info.robot_id})`);
  }

  // Emails (complaint content)
  if (ci.email && ci.email.length > 0) {
    lines.push("\n--- 邮件内容 ---");
    for (let i = 0; i < ci.email.length; i++) {
      const em = ci.email[i];
      lines.push(`\n[邮件 ${i + 1}] mail_id: ${em.mail_id}`);
      lines.push(`  发件人: ${em.from_address}${em.from_name ? ` (${em.from_name})` : ""}`);
      if (em.to_address) lines.push(`  收件人: ${em.to_address}`);
      if (em.cc_address) lines.push(`  抄送: ${em.cc_address}`);
      lines.push(`  主题: ${em.subject}`);
      lines.push(`  时间: ${em.delivery_time}`);
      lines.push(`  类型: ${getMailTypeName(em.mail_type)}`);

      // Body
      if (em.text_body) {
        lines.push(`  内容: ${em.text_body}`);
      } else if (em.html_body) {
        lines.push(`  内容: ${stripHtml(em.html_body)}`);
      }

      // Attachments
      if (em.attachments && em.attachments.length > 0) {
        lines.push(`  附件 (${em.attachments.length} 个):`);
        for (const att of em.attachments) {
          lines.push(`    - ${att.attachment_show_name}`);
          lines.push(`      下载: ${att.attachment_download_url}`);
        }
      }
    }
  }

  // Extend params (device info, etc.)
  if (ci.extend_params_handle && ci.extend_params_handle.length > 0) {
    lines.push("\n--- 扩展信息 ---");
    for (const p of ci.extend_params_handle) {
      if (p.key && p.value) {
        const val = String(p.value).substring(0, 300);
        lines.push(`  ${p.key} ${val}`);
      }
    }
  }

  // Customer remark
  if (ci.customer_remark) {
    lines.push(`\n客户备注: ${ci.customer_remark}`);
  }
  if (ci.remark) {
    lines.push(`备注: ${ci.remark}`);
  }

  return lines.join("\n");
}

/** Format case lifecycle */
export function formatCaseLifecycle(data: any[]): string {
  if (!Array.isArray(data) || data.length === 0) {
    return "暂无生命周期记录。";
  }

  const lines: string[] = ["工单生命周期:\n"];
  for (const item of data) {
    lines.push(`  ${item.time} - ${item.describe}`);
  }
  return lines.join("\n");
}

/** Format case history */
export function formatCaseHistory(data: any): string {
  const list = data?.list;
  const total = data?.total;

  if (!Array.isArray(list) || list.length === 0) {
    return "该客户暂无历史工单。";
  }

  const lines: string[] = [`客户历史工单 (共 ${total || list.length} 条)\n`];

  for (const entry of list) {
    if (entry.customer_info) {
      lines.push(`客户: ${entry.customer_info.email || entry.customer_info.name || "未知"}`);
    }
    if (entry.case_list) {
      for (const c of entry.case_list) {
        lines.push(`  ${getStatusIcon(c.status)} ${c.subject || "(无标题)"}`);
        lines.push(`    工单ID: ${c.case_id} | ${getProductName(c.product_id)} | ${getPlatformName(c.platform_id)}`);
        lines.push(`    创建: ${c.create_time}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

/** Format customer info */
export function formatCustomerInfo(data: any): string {
  if (!data) return "客户信息不存在。";

  const lines: string[] = ["客户信息:\n"];
  lines.push(`客户ID: ${data.customer_id}`);
  if (data.email) lines.push(`邮箱: ${data.email}`);
  if (data.phone) lines.push(`电话: ${data.phone}`);
  if (data.name) lines.push(`姓名: ${data.name}`);
  if (data.company) lines.push(`公司: ${data.company}`);
  if (data.level) lines.push(`等级: ${data.level}`);
  if (data.remark) lines.push(`备注: ${data.remark}`);

  if (data.product_id && Array.isArray(data.product_id)) {
    lines.push(`产品: ${data.product_id.map((id: number) => getProductName(id)).join(", ")}`);
  }
  if (data.platform_id && Array.isArray(data.platform_id)) {
    lines.push(`平台: ${data.platform_id.map((id: number) => getPlatformName(id)).join(", ")}`);
  }

  lines.push(`创建: ${data.create_time}`);
  lines.push(`更新: ${data.update_time}`);

  if (data.related_customer_info && data.related_customer_info.length > 0) {
    lines.push("\n关联客户:");
    for (const rc of data.related_customer_info) {
      lines.push(`  - ${rc.email || rc.name || rc.customer_id}`);
    }
  }

  return lines.join("\n");
}

function formatTimestamp(ts: number | string): string {
  if (typeof ts === "number" && ts > 1000000000) {
    return new Date(ts * 1000).toLocaleString("zh-CN");
  }
  return String(ts);
}

function getMailTypeName(type: number): string {
  switch (type) {
    case 1: return "客服回复";
    case 2: return "客户回复";
    case 6: return "App反馈";
    case 8: return "系统邮件";
    default: return `类型(${type})`;
  }
}
