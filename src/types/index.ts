/**
 * TypeScript 类型定义
 */

export interface DDNSParams {
    zone: string;
    email: string;
    key: string;
    name: string;
}

export interface ApiResponse {
    success: boolean;
    error?: string;
    message?: string;
    ip?: string;
    previous_ip?: string;
    record_name?: string;
    record_id?: string;
    details?: any;
}

export interface CloudflareListResponse {
    success: boolean;
    result: Array<{
        id: string;
        type: string;
        name: string;
        content: string;
        ttl: number;
        proxied: boolean;
    }>;
    errors?: any[];
}

export interface CloudflareUpdateResponse {
    success: boolean;
    result?: {
        id: string;
        type: string;
        name: string;
        content: string;
        ttl: number;
        proxied: boolean;
    };
    errors?: any[];
}
