import type { CloudflareListResponse, CloudflareUpdateResponse } from '../types/index.js';
import { createErrorResponse } from '../utils/response.js';

export async function getDNSRecord(
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

export async function updateDNSRecord(
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
                    name: recordName,
                    content: newIP,
                    ttl: 1
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
