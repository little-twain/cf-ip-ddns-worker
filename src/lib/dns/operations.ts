/**
 * Cloudflare DNS API 操作模块 - 使用官方SDK
 * 
 * 迁移说明：
 * - 从手动fetch调用迁移到官方Cloudflare Node.js SDK
 * - 提供更好的类型安全和错误处理
 * - 遵循官方API最佳实践
 * 
 * SDK文档：
 * - https://developers.cloudflare.com/api/node/resources/dns/subresources/records/methods/get/
 * - https://developers.cloudflare.com/api/node/resources/dns/subresources/records/methods/edit/
 */

import Cloudflare from 'cloudflare';

export interface DNSRecord {
    id: string;
    type: string;
    name: string;
    content: string;
    ttl: number;
    proxied: boolean;
}

/**
 * 创建Cloudflare客户端实例
 */
function createCloudflareClient(email: string, apiKey: string): Cloudflare {
    return new Cloudflare({
        apiEmail: email,
        apiKey: apiKey
    });
}

/**
 * 获取DNS记录 - 使用官方SDK
 */
export async function getDNSRecord(
    zoneId: string,
    recordName: string,
    recordType: "A" | "AAAA",
    authEmail: string,
    authKey: string
): Promise<{ record: DNSRecord; response?: any } | { error: Response }> {
    try {
        const cf = createCloudflareClient(authEmail, authKey);

        // 使用官方SDK获取DNS记录
        const records = await cf.dns.records.list({
            zone_id: zoneId,
            type: recordType as any,
            name: recordName as any
        });

        // 检查是否找到记录
        if (!records.result || records.result.length === 0) {
            return {
                error: createErrorResponse(
                    "record_not_found",
                    `DNS ${recordType} record '${recordName}' not found in zone`,
                    404,
                    { type: recordType, name: recordName, zone_id: zoneId }
                ),
            };
        }

        const record = records.result[0];
        return {
            record: {
                id: record.id,
                type: record.type,
                name: record.name,
                content: record.content || '',
                ttl: record.ttl,
                proxied: record.proxied || false
            },
            response: records
        };
    } catch (error) {
        return {
            error: createErrorResponse(
                "internal_error",
                error instanceof Error ? error.message : "Unknown error occurred",
                502,
                { type: recordType, name: recordName, zone_id: zoneId }
            ),
        };
    }
}

/**
 * 更新DNS记录 - 使用官方SDK
 */
export async function updateDNSRecord(
    zoneId: string,
    recordId: string,
    recordName: string,
    recordType: "A" | "AAAA",
    newIP: string,
    authEmail: string,
    authKey: string
): Promise<{ success: boolean; response?: any; error?: Response }> {
    try {
        const cf = createCloudflareClient(authEmail, authKey);

        // 使用官方SDK更新DNS记录
        const updateResult = await cf.dns.records.edit(recordId, {
            zone_id: zoneId,
            type: recordType as any,
            name: recordName as any,
            content: newIP,
            ttl: 1  // 使用 1 (自动) 而不是 120，与 Cloudflare 默认行为一致
        });

        // 检查结果是否成功
        if (updateResult && updateResult.id) {
            return { success: true, response: updateResult };
        } else {
            return {
                success: false,
                error: createErrorResponse(
                    "update_failed",
                    "Failed to update DNS record",
                    500,
                    updateResult
                ),
            };
        }
    } catch (error) {
        return {
            success: false,
            error: createErrorResponse(
                "internal_error",
                error instanceof Error ? error.message : "Unknown error occurred",
                502,
                { type: recordType, name: recordName, zone_id: zoneId, record_id: recordId }
            ),
        };
    }
}

// 辅助函数
function createErrorResponse(
    error: string,
    message: string,
    status: number,
    details?: any
): Response {
    const response = {
        success: false,
        error,
        message,
        ...(details && { details })
    };

    return new Response(JSON.stringify(response), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}
