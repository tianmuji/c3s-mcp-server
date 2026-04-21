import type { Credentials } from "./auth.js";
export interface C3sResponse<T = any> {
    code: number;
    msg?: string;
    message?: string;
    data: T;
}
export declare class C3sClient {
    private credentials;
    setCredentials(creds: Credentials | null): void;
    isAuthenticated(): boolean;
    getToken(): string;
    private request;
    private get;
    private post;
    /** Get current user info */
    getUserInfo(): Promise<C3sResponse>;
    /** Get common config (products, platforms, statuses, etc.) */
    getConfig(): Promise<C3sResponse>;
    /** Search/list tickets */
    searchCases(params: {
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
    }): Promise<C3sResponse>;
    /** Open/get ticket detail */
    getCaseDetail(caseId: string): Promise<C3sResponse>;
    /** Get ticket lifecycle */
    getCaseLifecycle(caseId: string): Promise<C3sResponse>;
    /** Get ticket history for a customer */
    getCaseHistory(customerId: string, caseId: string): Promise<C3sResponse>;
    /** Get customer info for a case */
    getCaseUser(caseId: string): Promise<C3sResponse>;
    /** Pre-process mail images */
    getMailImages(mailIds: number[]): Promise<C3sResponse>;
    /** Download a file (attachment) to local path, following redirects */
    downloadFile(fileUrl: string, destPath: string): Promise<void>;
}
//# sourceMappingURL=c3s-client.d.ts.map