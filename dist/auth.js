"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadCredentials = loadCredentials;
exports.saveCredentials = saveCredentials;
exports.clearCredentials = clearCredentials;
exports.startBrowserLogin = startBrowserLogin;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const playwright_core_1 = require("playwright-core");
const CREDS_DIR = path_1.default.join(os_1.default.homedir(), ".c3s-mcp");
const CREDS_FILE = path_1.default.join(CREDS_DIR, "credentials.json");
const BROWSER_DATA_DIR = path_1.default.join(CREDS_DIR, "browser-data");
const SSO_LOGIN_URL = "https://web-sso.intsig.net/login?platform_id=aDu7xeirPLEA3XLnzxD2Jq2F30XYoyT9&redirect=https%3A%2F%2Fweb-c3s-v3.intsig.net%2Fworkbench%2FviewEmail&isLoginOut=1";
async function loadCredentials() {
    try {
        if (!fs_1.default.existsSync(CREDS_FILE))
            return null;
        const data = JSON.parse(fs_1.default.readFileSync(CREDS_FILE, "utf-8"));
        if (data && data.expiresAt > Date.now())
            return data;
        return null;
    }
    catch {
        return null;
    }
}
async function saveCredentials(creds) {
    if (!fs_1.default.existsSync(CREDS_DIR))
        fs_1.default.mkdirSync(CREDS_DIR, { recursive: true });
    fs_1.default.writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2));
}
async function clearCredentials() {
    try {
        fs_1.default.unlinkSync(CREDS_FILE);
    }
    catch { /* ignore */ }
}
function findBrowser() {
    const platform = process.platform;
    const systemCandidates = [];
    if (platform === "darwin") {
        systemCandidates.push("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", "/Applications/Chromium.app/Contents/MacOS/Chromium", path_1.default.join(os_1.default.homedir(), "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome"), path_1.default.join(os_1.default.homedir(), "Applications", "Microsoft Edge.app", "Contents", "MacOS", "Microsoft Edge"));
    }
    else if (platform === "linux") {
        systemCandidates.push("/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/microsoft-edge", "/usr/bin/microsoft-edge-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium");
    }
    else if (platform === "win32") {
        const programFiles = process.env.PROGRAMFILES || "C:\\Program Files";
        const programFilesX86 = process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";
        const localAppData = process.env.LOCALAPPDATA || "";
        systemCandidates.push(path_1.default.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"), path_1.default.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"), path_1.default.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"), path_1.default.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"), path_1.default.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"));
    }
    for (const c of systemCandidates) {
        if (fs_1.default.existsSync(c))
            return c;
    }
    const cacheDir = path_1.default.join(os_1.default.homedir(), "Library", "Caches", "ms-playwright");
    if (fs_1.default.existsSync(cacheDir)) {
        const dirs = fs_1.default.readdirSync(cacheDir)
            .filter(d => d.startsWith("chromium-"))
            .sort()
            .reverse();
        for (const dir of dirs) {
            const playwrightCandidates = [
                path_1.default.join(cacheDir, dir, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"),
                path_1.default.join(cacheDir, dir, "chrome-mac", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"),
                path_1.default.join(cacheDir, dir, "chrome-mac-arm64", "Chromium.app", "Contents", "MacOS", "Chromium"),
                path_1.default.join(cacheDir, dir, "chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"),
                path_1.default.join(cacheDir, dir, "chrome-linux", "chrome"),
            ];
            for (const c of playwrightCandidates) {
                if (fs_1.default.existsSync(c))
                    return c;
            }
        }
    }
    return undefined;
}
async function startBrowserLogin() {
    const execPath = findBrowser();
    if (!execPath) {
        throw new Error("Cannot find a Chromium-based browser (Chrome, Edge, or Chromium). " +
            "Please install Google Chrome or run: npx playwright install chromium");
    }
    if (!fs_1.default.existsSync(BROWSER_DATA_DIR))
        fs_1.default.mkdirSync(BROWSER_DATA_DIR, { recursive: true });
    const lockFile = path_1.default.join(BROWSER_DATA_DIR, "SingletonLock");
    try {
        fs_1.default.unlinkSync(lockFile);
    }
    catch { /* ignore */ }
    console.error("[Auth] Launching browser for C3S SSO login...");
    const context = await playwright_core_1.chromium.launchPersistentContext(BROWSER_DATA_DIR, {
        headless: false,
        executablePath: execPath,
        ignoreHTTPSErrors: true,
        viewport: null,
        args: ["--start-maximized"],
    });
    try {
        const page = context.pages()[0] || await context.newPage();
        await page.goto(SSO_LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
        console.error("[Auth] Waiting for user to complete SSO login (up to 180s)...");
        const token = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Login timed out (180s)")), 180000);
            // After SSO login, the redirect URL contains a JWT token
            const check = setInterval(async () => {
                try {
                    const url = page.url();
                    // After SSO, redirected to web-c3s-v3.intsig.net with token param
                    if (url.includes("web-c3s-v3.intsig.net") && url.includes("token=")) {
                        clearInterval(check);
                        clearTimeout(timeout);
                        const urlObj = new URL(url);
                        const t = urlObj.searchParams.get("token");
                        if (t) {
                            resolve(t);
                        }
                        else {
                            reject(new Error("Token not found in redirect URL"));
                        }
                    }
                    // Also check if already on workbench (maybe already logged in)
                    if (url.includes("web-c3s-v3.intsig.net/workbench") && !url.includes("token=")) {
                        // Try to extract token from localStorage or cookies
                        const localStorage = await page.evaluate(() => {
                            return globalThis.localStorage?.getItem("token") || "";
                        });
                        if (localStorage) {
                            clearInterval(check);
                            clearTimeout(timeout);
                            resolve(localStorage);
                        }
                    }
                }
                catch {
                    // page might be navigating, ignore
                }
            }, 1000);
        });
        console.error("[Auth] Login detected, token captured!");
        return {
            token,
            expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        };
    }
    finally {
        await context.close();
    }
}
//# sourceMappingURL=auth.js.map