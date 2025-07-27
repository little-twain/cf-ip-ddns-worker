import type { ExecutionContext } from '@cloudflare/workers-types';
import { DDNSHandler } from './handlers/ddns';
import { createIPResponse } from './lib/utils/response';

/**
 * Cloudflare Worker for IP detection and DDNS updates
 *
 * Usage:
 * 1. GET /<any-path> - Returns visitor's IP address (IPv4 or IPv6)
 * 2. GET /?zone=ZONE_ID&email=EMAIL&key=API_KEY&name=RECORD_NAME - Updates DNS record
 *    - Automatically detects IP type and updates A record (IPv4) or AAAA record (IPv6)
 * 3. GET /?stats - Returns cache statistics
 * 4. GET /?info=DOMAIN - Returns cached information for a domain
 */

// 全局DDNS处理器实例，用于维持缓存状态
const ddnsHandler = new DDNSHandler(); // 使用基于内存预算的自动容量

export default {
    async fetch(
        request: Request,
        env: any,
        ctx: ExecutionContext
    ): Promise<Response> {
        const url = new URL(request.url);
        const params = url.searchParams;
        const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";

        // 统计信息请求
        if (params.has("stats")) {
            return ddnsHandler.handleStatsRequest(clientIP);
        }

        // 域名信息请求
        const infoDomain = params.get("info");
        if (infoDomain) {
            return ddnsHandler.handleDomainInfoRequest(infoDomain, clientIP);
        }

        // DDNS更新请求 - 检查是否有必需的参数
        if (
            params.has("zone") &&
            params.has("email") &&
            params.has("key") &&
            params.has("name")
        ) {
            // 尝试获取Cache API实例
            let cacheAPI: Cache | undefined;
            try {
                cacheAPI = caches.default;
            } catch (error) {
                // Cache API不可用，继续使用仅LRU缓存
                console.warn('Cache API not available, using LRU cache only');
            }

            return ddnsHandler.handleDDNSUpdate(params, clientIP, cacheAPI);
        }

        // 默认返回访问者IP
        return createIPResponse(clientIP);
    },
};
