import type { ExecutionContext } from '@cloudflare/workers-types';

/**
 * Cloudflare Worker for IP detection and DDNS updates
 *
 * Usage:
 * 1. GET /<any-path> - Returns visitor's IP address (IPv4 or IPv6)
 * 2. GET /?zone=ZONE_ID&email=EMAIL&key=API_KEY&name=RECORD_NAME - Updates DNS record
 *    - Automatically detects IP type and updates A record (IPv4) or AAAA record (IPv6)
 */

interface DDNSParams {
    zone: string;
    email: string;
    key: string;
    name: string;
}

interface ApiResponse {
    success: boolean;
    error?: string;
    message?: string;
    ip?: string;
    previous_ip?: string;
    record_name?: string;
    record_id?: string;
    details?: any;
}

interface CloudflareListResponse {
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

interface CloudflareUpdateResponse {
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

function createErrorResponse(
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

function createSuccessResponse(
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

function validateDDNSParams(params: URLSearchParams): DDNSParams | null {
    const zone = params.get("zone");
    const email = params.get("email");
    const key = params.get("key");
    const name = params.get("name");

    if (!zone || !email || !key || !name) {
        return null;
    }

    return { zone, email, key, name };
}

function getIPType(ip: string): "A" | "AAAA" | null {
    // IPv4 pattern: xxx.xxx.xxx.xxx
    const ipv4Pattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    
    // IPv6 pattern: simplified check for colon-separated hex groups
    const ipv6Pattern = /^(?:[0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
    
    if (ipv4Pattern.test(ip)) {
        return "A";
    } else if (ipv6Pattern.test(ip)) {
        return "AAAA";
    }
    
    return null;
}

async function getDNSRecord(
    zoneId: string,
    recordName: string,
    recordType: "A" | "AAAA",
    authEmail: string,
    authKey: string
): Promise<{ record: any; response: Response } | { error: Response }> {
    try {
        const listRes = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=${recordType}&name=${encodeURIComponent(recordName)}`,
            {
                method: "GET",
                headers: {
                    "X-Auth-Email": authEmail,
                    "X-Auth-Key": authKey,
                    "Content-Type": "application/json",
                },
            }
        );

        const listJson: CloudflareListResponse = await listRes.json();

        // 检查 API 调用是否成功
        if (!listRes.ok) {
            return {
                error: createErrorResponse(
                    "cloudflare_api_error",
                    "Failed to query DNS records",
                    listRes.status,
                    listJson
                ),
            };
        }

        // 检查是否找到记录
        if (!listJson.success || !listJson.result || listJson.result.length === 0) {
            return {
                error: createErrorResponse(
                    "record_not_found",
                    `DNS ${recordType} record '${recordName}' not found in zone`,
                    404,
                    listJson.errors || listJson
                ),
            };
        }

        return { record: listJson.result[0], response: listRes };
    } catch (error) {
        return {
            error: createErrorResponse(
                "internal_error",
                error instanceof Error ? error.message : "Unknown error occurred",
                502
            ),
        };
    }
}

async function updateDNSRecord(
    zoneId: string,
    recordId: string,
    recordName: string,
    recordType: "A" | "AAAA",
    newIP: string,
    authEmail: string,
    authKey: string
): Promise<{ success: boolean; response?: Response; error?: Response }> {
    try {
        const updateRes = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`,
            {
                method: "PUT",
                headers: {
                    "X-Auth-Email": authEmail,
                    "X-Auth-Key": authKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    type: recordType,
                    name: recordName,  // 使用完整域名，不需要额外处理
                    content: newIP,
                    ttl: 1  // 使用 1 (自动) 而不是 120，与 Cloudflare 默认行为一致
                }),
            }
        );

        const updateJson: CloudflareUpdateResponse = await updateRes.json();

        if (updateRes.ok && updateJson.success) {
            return { success: true, response: updateRes };
        } else {
            return {
                success: false,
                error: createErrorResponse(
                    "update_failed",
                    "Failed to update DNS record",
                    updateRes.status || 500,
                    updateJson.errors || updateJson
                ),
            };
        }
    } catch (error) {
        return {
            success: false,
            error: createErrorResponse(
                "internal_error",
                error instanceof Error ? error.message : "Unknown error occurred",
                502
            ),
        };
    }
}

export default {
    async fetch(
        request: Request,
        env: any,
        ctx: ExecutionContext
    ): Promise<Response> {
        const url = new URL(request.url);
        const params = url.searchParams;
        const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";

        // 如果 URL 上带齐四个参数，就走 DDNS 更新流程
        if (
            params.has("zone") &&
            params.has("email") &&
            params.has("key") &&
            params.has("name")
        ) {
            const ddnsParams = validateDDNSParams(params);

            if (!ddnsParams) {
                return createErrorResponse(
                    "missing_parameters",
                    "All parameters (zone, email, key, name) are required",
                    400
                );
            }

            // 检测当前 IP 类型
            const ipType = getIPType(clientIP);
            if (!ipType) {
                return createErrorResponse(
                    "invalid_ip",
                    `Invalid IP address format: ${clientIP}`,
                    400
                );
            }

            // 1) 先 GET 看看有没有这个记录
            const dnsResult = await getDNSRecord(
                ddnsParams.zone,
                ddnsParams.name,
                ipType,
                ddnsParams.email,
                ddnsParams.key
            );

            if ('error' in dnsResult) {
                return dnsResult.error;
            }

            const record = dnsResult.record;
            const currentIP = record.content;

            // 如果 IP 没有变化，不需要更新
            if (currentIP === clientIP) {
                return new Response("", {
                    status: 200,
                    headers: { "Content-Type": "text/plain" }
                });
            }

            // 2) PUT 更新 IP
            const updateResult = await updateDNSRecord(
                ddnsParams.zone,
                record.id,
                ddnsParams.name,
                ipType,
                clientIP,
                ddnsParams.email,
                ddnsParams.key
            );

            if (!updateResult.success && updateResult.error) {
                return updateResult.error;
            }

            // 成功更新，返回空响应
            return new Response("", {
                status: 200,
                headers: { "Content-Type": "text/plain" }
            });
        }

        // 否则，返回访问者 IP
        return new Response(clientIP, {
            headers: { "Content-Type": "text/plain" },
        });
    },
};
