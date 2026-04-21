import https from "https";
import http from "http";
import fs from "fs";
import { URL } from "url";
import type { Credentials } from "./auth.js";

export interface C3sResponse<T = any> {
  code: number;
  msg?: string;
  message?: string;
  data: T;
}

const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

// Two API hosts used by C3S platform
const API_HOST_1 = "https://webapi-customer.intsig.net";  // case/tag/common APIs
const API_HOST_2 = "https://web-customerapi.intsig.net";   // hr/customer/auth APIs

export class C3sClient {
  private credentials: Credentials | null = null;

  setCredentials(creds: Credentials | null): void {
    this.credentials = creds;
  }

  isAuthenticated(): boolean {
    return !!(this.credentials && Date.now() < this.credentials.expiresAt);
  }

  getToken(): string {
    return this.credentials?.token || "";
  }

  private request<T>(baseUrl: string, method: string, path: string, params?: Record<string, string>, body?: Record<string, any>): Promise<C3sResponse<T>> {
    return new Promise((resolve, reject) => {
      if (!this.credentials) {
        reject(new Error("Not authenticated. Please call 'c3s-auth' first."));
        return;
      }

      const url = new URL(baseUrl + path);
      if (params) {
        for (const [key, value] of Object.entries(params)) {
          url.searchParams.set(key, value);
        }
      }

      const headers: Record<string, string> = {
        "x-token": this.credentials.token,
        "User-Agent": BROWSER_UA,
        Accept: "application/json, text/plain, */*",
        Referer: "https://web-c3s-v3.intsig.net/",
        Origin: "https://web-c3s-v3.intsig.net",
      };

      let data: string | undefined;
      if (body) {
        data = JSON.stringify(body);
        headers["Content-Type"] = "application/json";
        headers["Content-Length"] = String(Buffer.byteLength(data));
      }

      const options: https.RequestOptions = {
        method,
        timeout: 30000,
        headers,
      };

      const protocol = url.protocol === "https:" ? https : http;
      const req = protocol.request(url.toString(), options, (res) => {
        let respBody = "";
        res.on("data", (chunk) => (respBody += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(respBody));
          } catch {
            reject(new Error(`Invalid JSON response from ${path}: ${respBody.substring(0, 200)}`));
          }
        });
      });
      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error(`Request timeout: ${path}`));
      });
      if (data) req.write(data);
      req.end();
    });
  }

  private get<T>(baseUrl: string, path: string, params?: Record<string, string>): Promise<C3sResponse<T>> {
    return this.request<T>(baseUrl, "GET", path, params);
  }

  private post<T>(baseUrl: string, path: string, body: Record<string, any>): Promise<C3sResponse<T>> {
    return this.request<T>(baseUrl, "POST", path, undefined, body);
  }

  /** Get current user info */
  async getUserInfo(): Promise<C3sResponse> {
    return this.post(API_HOST_2, "/common/auth/get-user-info", {});
  }

  /** Get common config (products, platforms, statuses, etc.) */
  async getConfig(): Promise<C3sResponse> {
    return this.post(API_HOST_1, "/common/config", {});
  }

  /** Search/list tickets */
  async searchCases(params: {
    case_id?: string;
    email?: string;
    subject?: string;
    keyword?: string;
    from_time?: string;
    to_time?: string;
    page_num?: number;
    page_size?: number;
    is_except_qimo?: boolean;
    is_exist_attachment?: boolean;
    is_engineer_deal?: boolean;
    is_robot_deal?: boolean;
  }): Promise<C3sResponse> {
    const queryParams: Record<string, string> = {
      is_except_qimo: String(params.is_except_qimo ?? false),
      is_exist_attachment: String(params.is_exist_attachment ?? false),
      is_engineer_deal: String(params.is_engineer_deal ?? false),
      is_robot_deal: String(params.is_robot_deal ?? false),
      case_id: params.case_id || "",
      email: params.email || "",
      subject: params.subject || "",
      keyword: params.keyword || "",
      from_time: params.from_time || "",
      to_time: params.to_time || "",
      page_num: String(params.page_num || 1),
      page_size: String(params.page_size || 20),
    };
    return this.get(API_HOST_1, "/case/case-search-list", queryParams);
  }

  /** Open/get ticket detail */
  async getCaseDetail(caseId: string): Promise<C3sResponse> {
    return this.get(API_HOST_1, "/case/open", { case_id: caseId });
  }

  /** Get ticket lifecycle */
  async getCaseLifecycle(caseId: string): Promise<C3sResponse> {
    return this.get(API_HOST_1, "/case/life", { case_id: caseId });
  }

  /** Get ticket history for a customer */
  async getCaseHistory(customerId: string, caseId: string): Promise<C3sResponse> {
    return this.get(API_HOST_1, "/case/history-list", {
      customer_id: customerId,
      case_id: caseId,
    });
  }

  /** Get customer info for a case */
  async getCaseUser(caseId: string): Promise<C3sResponse> {
    return this.get(API_HOST_2, "/customer/customer/case-user", { case_id: caseId });
  }

  /** Pre-process mail images */
  async getMailImages(mailIds: number[]): Promise<C3sResponse> {
    return this.post(API_HOST_1, "/mail/img-pre", { mail_ids: mailIds });
  }

  /** Download a file (attachment) to local path, following redirects */
  downloadFile(fileUrl: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.credentials) {
        reject(new Error("Not authenticated. Please call 'c3s-auth' first."));
        return;
      }

      const doRequest = (url: string, redirectCount = 0): void => {
        if (redirectCount > 5) {
          reject(new Error("Too many redirects"));
          return;
        }

        const parsedUrl = new URL(url);
        const protocol = parsedUrl.protocol === "https:" ? https : http;
        const options: https.RequestOptions = {
          timeout: 120000,
          headers: {
            "x-token": this.credentials!.token,
            "User-Agent": BROWSER_UA,
            Accept: "*/*",
            Referer: "https://web-c3s-v3.intsig.net/",
          },
        };

        const req = protocol.get(url, options, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            doRequest(res.headers.location, redirectCount + 1);
            return;
          }
          if (res.statusCode !== 200 && res.statusCode !== 206) {
            reject(new Error(`Download failed with status ${res.statusCode}`));
            return;
          }
          const file = fs.createWriteStream(destPath);
          res.pipe(file);
          file.on("finish", () => {
            file.close();
            resolve();
          });
          file.on("error", (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
          });
        });
        req.on("error", reject);
        req.on("timeout", () => {
          req.destroy();
          reject(new Error("Download timeout"));
        });
      };

      doRequest(fileUrl);
    });
  }
}
