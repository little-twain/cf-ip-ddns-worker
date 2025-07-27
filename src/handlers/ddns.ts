/**
 * DDNS处理逻辑模块
 */

import { getIPType } from '../lib/utils/ip';
import { validateDDNSParams, type DDNSParams } from '../lib/validation/params';
import { getDNSRecord, updateDNSRecord } from '../lib/dns/operations';
import { CacheManager } from '../lib/cache/manager';
import {
    createErrorResponse,
    createSimpleSuccessResponse,
    createStatsResponse,
    createDomainInfoResponse
} from '../lib/utils/response';

/**
 * DDNS处理器类
 */
export class DDNSHandler {
    private cacheManager: CacheManager;

    constructor() {
        this.cacheManager = new CacheManager();
    }

    /**
     * 处理DDNS更新请求
     */
    async handleDDNSUpdate(
        params: URLSearchParams,
        clientIP: string,
        cacheAPI?: Cache
    ): Promise<Response> {
        // 验证参数
        const validation = validateDDNSParams(params);
        if (!validation.success) {
            return createErrorResponse(
                "missing_parameters",
                validation.error!,
                400
            );
        }

        const ddnsParams = validation.params!;

        // 检测当前 IP 类型
        const ipType = getIPType(clientIP);
        if (!ipType) {
            return createErrorResponse(
                "invalid_ip",
                `Invalid IP address format: ${clientIP}`,
                400
            );
        }

        // 缓存策略：
        // 1. 首先检查LRU内存缓存
        const cachedIP = this.cacheManager.checkLRUCache(ddnsParams.name, ipType);

        if (cachedIP === clientIP) {
            // 缓存命中且IP相同，直接返回成功
            return createSimpleSuccessResponse();
        }

        // 2. 如果LRU未命中或IP不同，需要获取DNS记录
        let zoneId = ddnsParams.zone;
        let recordId: string;

        if (cachedIP && cachedIP !== clientIP && cacheAPI) {
            // LRU缓存命中但IP不同，从Cache API获取zone+record信息
            const cacheData = await this.cacheManager.getCacheAPIRecord(
                ddnsParams.name,
                ipType,
                cacheAPI
            );

            if (cacheData) {
                const [cachedZoneId, cachedRecordId] = cacheData.split('+');
                zoneId = cachedZoneId;
                recordId = cachedRecordId;
            } else {
                // Cache API也未命中，需要从Cloudflare获取
                const dnsResult = await this.fetchDNSRecord(ddnsParams, ipType);
                if ('error' in dnsResult) {
                    return dnsResult.error;
                }
                recordId = dnsResult.recordId;

                // 缓存到Cache API
                if (cacheAPI) {
                    await this.cacheManager.setCacheAPIRecord(
                        ddnsParams.name,
                        ipType,
                        zoneId,
                        recordId,
                        cacheAPI
                    );
                }
            }
        } else {
            // 首次请求或其他情况，从Cloudflare获取DNS记录
            const dnsResult = await this.fetchDNSRecord(ddnsParams, ipType);
            if ('error' in dnsResult) {
                return dnsResult.error;
            }

            recordId = dnsResult.recordId;
            const currentIP = dnsResult.currentIP;

            // 如果IP没有变化，更新缓存后直接返回
            if (currentIP === clientIP) {
                this.cacheManager.updateLRUCache(ddnsParams.name, ipType, clientIP);

                // 缓存到Cache API
                if (cacheAPI) {
                    await this.cacheManager.setCacheAPIRecord(
                        ddnsParams.name,
                        ipType,
                        zoneId,
                        recordId,
                        cacheAPI
                    );
                }

                return createSimpleSuccessResponse();
            }
        }

        // 3. 更新DNS记录
        const updateResult = await updateDNSRecord(
            zoneId,
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

        // 4. 更新成功后，异步更新缓存
        this.updateCacheAfterSuccess(ddnsParams.name, ipType, clientIP, zoneId, recordId, cacheAPI);

        return createSimpleSuccessResponse();
    }

    /**
     * 从Cloudflare获取DNS记录
     */
    private async fetchDNSRecord(
        ddnsParams: DDNSParams,
        ipType: "A" | "AAAA"
    ): Promise<{ recordId: string; currentIP: string } | { error: Response }> {
        const dnsResult = await getDNSRecord(
            ddnsParams.zone,
            ddnsParams.name,
            ipType,
            ddnsParams.email,
            ddnsParams.key
        );

        if ('error' in dnsResult) {
            return { error: dnsResult.error };
        }

        return {
            recordId: dnsResult.record.id,
            currentIP: dnsResult.record.content
        };
    }

    /**
     * 成功更新后异步更新缓存
     */
    private async updateCacheAfterSuccess(
        domain: string,
        recordType: "A" | "AAAA",
        ip: string,
        zoneId: string,
        recordId: string,
        cacheAPI?: Cache
    ): Promise<void> {
        // 更新LRU缓存
        this.cacheManager.updateLRUCache(domain, recordType, ip);

        // 更新Cache API
        if (cacheAPI) {
            await this.cacheManager.setCacheAPIRecord(
                domain,
                recordType,
                zoneId,
                recordId,
                cacheAPI
            );
        }
    }

    /**
     * 处理统计信息请求
     */
    handleStatsRequest(clientIP: string): Response {
        const stats = this.cacheManager.getStats();
        return createStatsResponse(clientIP, stats);
    }

    /**
     * 处理域名信息请求
     */
    handleDomainInfoRequest(domain: string, clientIP: string): Response {
        const domainInfo = this.cacheManager.getDomainInfo(domain);
        return createDomainInfoResponse(clientIP, domainInfo);
    }
}
