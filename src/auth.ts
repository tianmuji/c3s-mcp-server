import { createCredentialsManager, startSsoLogin as ssoLogin } from "@camscanner/mcp-sso-auth";

export interface Credentials {
  token: string;
  expiresAt: number;
}

// Environment configuration
const SSO_LOGIN_URL = process.env.SSO_LOGIN_URL || "https://web-sso.intsig.net/login";
const SSO_PLATFORM_ID = process.env.SSO_PLATFORM_ID || "aDu7xeirPLEA3XLnzxD2Jq2F30XYoyT9";
const SSO_CALLBACK_DOMAIN = process.env.SSO_CALLBACK_DOMAIN || "https://www-sandbox.camscanner.com/activity/mcp-auth-callback";
const SSO_CALLBACK_PORT = parseInt(process.env.SSO_CALLBACK_PORT || "9884", 10);

const credentialsManager = createCredentialsManager("c3s-mcp");

export async function loadCredentials(): Promise<Credentials | null> {
  const data = credentialsManager.load();
  if (data && data.token) return data as Credentials;
  return null;
}

export async function saveCredentials(creds: Credentials): Promise<void> {
  credentialsManager.save(creds);
}

export async function clearCredentials(): Promise<void> {
  credentialsManager.clear();
}

export async function startBrowserLogin(): Promise<Credentials> {
  const creds = await ssoLogin({
    ssoLoginUrl: SSO_LOGIN_URL,
    platformId: SSO_PLATFORM_ID,
    callbackDomain: SSO_CALLBACK_DOMAIN,
    callbackPort: SSO_CALLBACK_PORT,
    serverName: "C3S MCP Server",
    async exchangeToken(ssoToken: string) {
      const result: Credentials = {
        token: ssoToken,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      };
      credentialsManager.save(result);
      return result;
    },
  });

  return creds as Credentials;
}
