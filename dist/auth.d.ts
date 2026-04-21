export interface Credentials {
    token: string;
    expiresAt: number;
}
export declare function loadCredentials(): Promise<Credentials | null>;
export declare function saveCredentials(creds: Credentials): Promise<void>;
export declare function clearCredentials(): Promise<void>;
export declare function startBrowserLogin(): Promise<Credentials>;
//# sourceMappingURL=auth.d.ts.map