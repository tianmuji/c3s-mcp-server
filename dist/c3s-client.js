"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.C3sClient = void 0;
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const fs_1 = __importDefault(require("fs"));
const url_1 = require("url");
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";
// Two API hosts used by C3S platform
const API_HOST_1 = "https://webapi-customer.intsig.net"; // case/tag/common APIs
const API_HOST_2 = "https://web-customerapi.intsig.net"; // hr/customer/auth APIs
class C3sClient {
    constructor() {
        this.credentials = null;
    }
    setCredentials(creds) {
        this.credentials = creds;
    }
    isAuthenticated() {
        return !!(this.credentials && Date.now() < this.credentials.expiresAt);
    }
    getToken() {
        return this.credentials?.token || "";
    }
    request(baseUrl, method, path, params, body) {
        return new Promise((resolve, reject) => {
            if (!this.credentials) {
                reject(new Error("Not authenticated. Please call 'c3s-auth' first."));
                return;
            }
            const url = new url_1.URL(baseUrl + path);
            if (params) {
                for (const [key, value] of Object.entries(params)) {
                    url.searchParams.set(key, value);
                }
            }
            const headers = {
                "x-token": this.credentials.token,
                "User-Agent": BROWSER_UA,
                Accept: "application/json, text/plain, */*",
                Referer: "https://web-c3s-v3.intsig.net/",
                Origin: "https://web-c3s-v3.intsig.net",
            };
            let data;
            if (body) {
                data = JSON.stringify(body);
                headers["Content-Type"] = "application/json";
                headers["Content-Length"] = String(Buffer.byteLength(data));
            }
            const options = {
                method,
                timeout: 30000,
                headers,
            };
            const protocol = url.protocol === "https:" ? https_1.default : http_1.default;
            const req = protocol.request(url.toString(), options, (res) => {
                let respBody = "";
                res.on("data", (chunk) => (respBody += chunk));
                res.on("end", () => {
                    try {
                        resolve(JSON.parse(respBody));
                    }
                    catch {
                        reject(new Error(`Invalid JSON response from ${path}: ${respBody.substring(0, 200)}`));
                    }
                });
            });
            req.on("error", reject);
            req.on("timeout", () => {
                req.destroy();
                reject(new Error(`Request timeout: ${path}`));
            });
            if (data)
                req.write(data);
            req.end();
        });
    }
    get(baseUrl, path, params) {
        return this.request(baseUrl, "GET", path, params);
    }
    post(baseUrl, path, body) {
        return this.request(baseUrl, "POST", path, undefined, body);
    }
    /** Get current user info */
    async getUserInfo() {
        return this.post(API_HOST_2, "/common/auth/get-user-info", {});
    }
    /** Get common config (products, platforms, statuses, etc.) */
    async getConfig() {
        return this.post(API_HOST_1, "/common/config", {});
    }
    /** Search/list tickets */
    async searchCases(params) {
        const queryParams = {
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
    async getCaseDetail(caseId) {
        return this.get(API_HOST_1, "/case/open", { case_id: caseId });
    }
    /** Get ticket lifecycle */
    async getCaseLifecycle(caseId) {
        return this.get(API_HOST_1, "/case/life", { case_id: caseId });
    }
    /** Get ticket history for a customer */
    async getCaseHistory(customerId, caseId) {
        return this.get(API_HOST_1, "/case/history-list", {
            customer_id: customerId,
            case_id: caseId,
        });
    }
    /** Get customer info for a case */
    async getCaseUser(caseId) {
        return this.get(API_HOST_2, "/customer/customer/case-user", { case_id: caseId });
    }
    /** Pre-process mail images */
    async getMailImages(mailIds) {
        return this.post(API_HOST_1, "/mail/img-pre", { mail_ids: mailIds });
    }
    /** Download a file (attachment) to local path, following redirects */
    downloadFile(fileUrl, destPath) {
        return new Promise((resolve, reject) => {
            if (!this.credentials) {
                reject(new Error("Not authenticated. Please call 'c3s-auth' first."));
                return;
            }
            const doRequest = (url, redirectCount = 0) => {
                if (redirectCount > 5) {
                    reject(new Error("Too many redirects"));
                    return;
                }
                const parsedUrl = new url_1.URL(url);
                const protocol = parsedUrl.protocol === "https:" ? https_1.default : http_1.default;
                const options = {
                    timeout: 120000,
                    headers: {
                        "x-token": this.credentials.token,
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
                    const file = fs_1.default.createWriteStream(destPath);
                    res.pipe(file);
                    file.on("finish", () => {
                        file.close();
                        resolve();
                    });
                    file.on("error", (err) => {
                        fs_1.default.unlink(destPath, () => { });
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
exports.C3sClient = C3sClient;
//# sourceMappingURL=c3s-client.js.map