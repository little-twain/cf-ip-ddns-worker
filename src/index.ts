import type { ExecutionContext } from '@cloudflare/workers-types';
import { getIPType } from './utils/ip.js';
import { validateDDNSParams } from './utils/validation.js';
import { createErrorResponse } from './utils/response.js';
import { getCacheKey, getCacheKeyByName, getCachedIP, setCachedIP, getCacheStats, hasCachedKey } from './services/cache.js';
import { getDNSRecord, updateDNSRecord } from './services/cloudflare.js';

/**
 * Cloudflare Worker for IP detection and DDNS updates
 *
 * Usage:
 * 1. GET /<any-path> - Returns visitor's IP address (IPv4 or IPv6)
 * 2. GET /?zone=ZONE_ID&email=EMAIL&key=API_KEY&name=RECORD_NAME - Updates DNS record
 *    - Automatically detects IP type and updates A record (IPv4) or AAAA record (IPv6)
 * 3. GET /?stats - Returns cache statistics and monitoring data
 * 4. GET /?info=ZONE_ID+DNS_RECORD_ID - Returns DNS record info and cache status
 */

export default {
    async fetch(
        request: Request,
        env: any,
        ctx: ExecutionContext
    ): Promise<Response> {
        const url = new URL(request.url);
        const params = url.searchParams;
        const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";

        // 统计端点
        if (params.has("stats")) {
            const stats = getCacheStats();
            const response = {
                timestamp: new Date().toISOString(),
                clientIP: clientIP,
                statistics: {
                    sets: stats.sets,
                    ratio: stats.ratio
                }
            };
            return new Response(JSON.stringify(response, null, 2), {
                headers: { "Content-Type": "application/json" },
            });
        }

        // 信息查询端点
        if (params.has("info")) {
            const info = params.get("info");
            if (!info) {
                return createErrorResponse(
                    "missing_info",
                    "Info parameter is required",
                    400
                );
            }

            // 解析 zoneID+dnsRecordID 格式
            // 注意：URL中的+会被解码为空格，所以我们需要同时支持+和空格
            let parts = info.split('+');
            if (parts.length !== 2) {
                // 如果+分割失败，尝试空格分割（因为URL解码会将+转为空格）
                parts = info.split(' ');
            }
            if (parts.length !== 2) {
                return createErrorResponse(
                    "invalid_info_format",
                    "Info parameter must be in format: zoneID+dnsRecordID (use %2B if URL encoding required)",
                    400
                );
            }

            const [zoneId, recordId] = parts;
            const response: any = {
                timestamp: new Date().toISOString(),
                clientIP: clientIP
            };

            // 检查 A 记录缓存状态
            const aKey = getCacheKey(zoneId, recordId, "A");
            const aCached = await getCachedIP(aKey);
            if (aCached !== null) {
                response.A = {
                    content: aCached,
                    cached: true
                };
            }

            // 检查 AAAA 记录缓存状态  
            const aaaaKey = getCacheKey(zoneId, recordId, "AAAA");
            const aaaaCached = await getCachedIP(aaaaKey);
            if (aaaaCached !== null) {
                response.AAAA = {
                    content: aaaaCached,
                    cached: true
                };
            }

            // 如果没有任何缓存记录，返回提示信息
            if (!response.A && !response.AAAA) {
                response.message = "No cached records found for this domain";
            }

            return new Response(JSON.stringify(response, null, 2), {
                headers: { "Content-Type": "application/json" },
            });
        }

        // 如果 URL 上带齐四个参数，就走 DDNS 更新流程
        if (
            params.has("zone") &&
            params.has("email") &&
            params.has("key") &&
            params.has("name")
        ) {
            const validationResult = validateDDNSParams(params);

            if ('error' in validationResult) {
                return validationResult.error;
            }

            const ddnsParams = validationResult.params;

            // 检测当前 IP 类型
            const ipType = getIPType(clientIP);
            if (!ipType) {
                return createErrorResponse(
                    "invalid_ip",
                    `Invalid IP address format: ${clientIP}`,
                    400
                );
            }

            // 2) 首先获取当前 DNS 记录，以获取记录ID
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
            const recordId = record.id;
            const currentIP = record.content;

            // 1) 生成基于记录ID的缓存键
            const cacheKey = getCacheKey(ddnsParams.zone, recordId, ipType);

            // 检查缓存
            const cachedIP = await getCachedIP(cacheKey);
            if (cachedIP === clientIP) {
                // IP 没有变化，直接返回
                return new Response("", {
                    status: 200,
                    headers: { "Content-Type": "text/plain" }
                });
            }

            // 如果 DNS 记录中的 IP 和客户端 IP 一致，只需更新缓存
            if (currentIP === clientIP) {
                // 异步更新缓存，不阻塞响应
                ctx.waitUntil(setCachedIP(cacheKey, clientIP));

                return new Response("", {
                    status: 200,
                    headers: { "Content-Type": "text/plain" }
                });
            }

            // 3) 更新 DNS 记录
            const updateResult = await updateDNSRecord(
                ddnsParams.zone,
                recordId,
                ddnsParams.name,
                ipType,
                clientIP,
                ddnsParams.email,
                ddnsParams.key
            );

            if (!updateResult.success && updateResult.error) {
                return updateResult.error;
            }

            // 4) 成功更新，异步更新缓存
            ctx.waitUntil(setCachedIP(cacheKey, clientIP));

            // 返回成功响应
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
