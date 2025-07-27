/**
 * 响应处理工具模块
 */

export interface ApiResponse {
    success: boolean;
    error?: string;
    message?: string;
    ip?: string;
    previous_ip?: string;
    record_name?: string;
    record_id?: string;
    details?: any;
    timestamp?: string;
    clientIP?: string;
}

export interface StatsResponse {
    timestamp: string;
    clientIP: string;
    statistics: {
        cached_num: number;
        ratio: string;
        total_requests?: number;
        lru_hit_rate?: string;
        cache_api_hits?: number;
        lru_utilization?: string;
    };
}

export interface DomainInfoResponse {
    timestamp: string;
    clientIP: string;
    A?: {
        content: string;
        cached: boolean;
    };
    AAAA?: {
        content: string;
        cached: boolean;
    };
    message?: string;
}

/**
 * 创建错误响应
 */
export function createErrorResponse(
    error: string,
    message: string,
    status: number,
    details?: any
): Response {
    const response: ApiResponse = {
        success: false,
        error,
        message,
    };

    if (details) {
        response.details = details;
    }

    return new Response(JSON.stringify(response), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

/**
 * 创建成功响应
 */
export function createSuccessResponse(
    message: string,
    ip: string,
    recordName: string,
    previousIp?: string,
    recordId?: string
): Response {
    const response: ApiResponse = {
        success: true,
        message,
        ip,
        record_name: recordName,
    };

    if (previousIp) {
        response.previous_ip = previousIp;
    }

    if (recordId) {
        response.record_id = recordId;
    }

    return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}

/**
 * 创建统计信息响应
 */
export function createStatsResponse(
    clientIP: string,
    stats: any
): Response {
    const response: StatsResponse = {
        timestamp: new Date().toISOString(),
        clientIP,
        statistics: {
            cached_num: stats.cached_num || 0,
            ratio: stats.ratio || "0:0",
            total_requests: stats.total_requests,
            lru_hit_rate: stats.lru_hit_rate,
            cache_api_hits: stats.cache_api_hits,
            lru_utilization: stats.lru_utilization
        }
    };

    return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}

/**
 * 创建域名信息响应
 */
export function createDomainInfoResponse(
    clientIP: string,
    domainInfo: any
): Response {
    const response: DomainInfoResponse = {
        timestamp: new Date().toISOString(),
        clientIP,
        ...domainInfo
    };

    return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}

/**
 * 创建简单的200响应（用于无需更新的情况）
 */
export function createSimpleSuccessResponse(): Response {
    return new Response("", {
        status: 200,
        headers: { "Content-Type": "text/plain" }
    });
}

/**
 * 创建IP响应（基本功能）
 */
export function createIPResponse(ip: string): Response {
    return new Response(ip, {
        headers: { "Content-Type": "text/plain" },
    });
}
