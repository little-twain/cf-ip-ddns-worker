import { CACHE_PREFIX, MAX_CACHE_ENTRIES, CACHE_TTL } from '../constants/index.js';

/**
 * 缓存统计数据
 */
class CacheStats {
    private hits = 0;
    private misses = 0;

    recordHit() {
        this.hits++;
    }

    recordMiss() {
        this.misses++;
    }

    getStats() {
        if (this.hits === 0 && this.misses === 0) {
            return { hits: 0, misses: 0, ratio: "0:0" };
        }

        // 计算最简比例
        const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
        const divisor = gcd(this.hits, this.misses);
        
        const hitRatio = this.hits / divisor;
        const missRatio = this.misses / divisor;

        return {
            hits: this.hits,
            misses: this.misses,
            ratio: `${hitRatio}:${missRatio}`
        };
    }

    reset() {
        this.hits = 0;
        this.misses = 0;
    }
}

/**
 * 简化的 LRU Set 实现，用于管理缓存键的生命周期
 */
class LRUSetSimple {
    private set = new Set<string>();

    constructor(private capacity: number) { }

    access(key: string) {
        if (this.set.has(key)) {
            this.set.delete(key);
            this.set.add(key);
        } else {
            this.set.add(key);
            if (this.set.size > this.capacity) {
                const oldest = this.set.values().next().value;
                if (oldest) {
                    this.set.delete(oldest);
                    return oldest; // 返回被删除的最旧键，用于清理缓存
                }
            }
        }
        return null;
    }

    has(key: string) {
        return this.set.has(key);
    }

    delete(key: string) {
        return this.set.delete(key);
    }

    size() {
        return this.set.size;
    }
}

// 全局实例
const cacheTracker = new LRUSetSimple(MAX_CACHE_ENTRIES);
const cacheStats = new CacheStats();

/**
 * 生成缓存键 - 基于哈希值而不是实际域名
 */
export function getCacheKey(zoneId: string, recordId: string, recordType: "A" | "AAAA"): string {
    return `${CACHE_PREFIX}${zoneId}:${recordId}:${recordType}`;
}

/**
 * 生成基于域名的缓存键（仅用于DDNS查询时的临时转换）
 */
export function getCacheKeyByName(zoneId: string, recordName: string, recordType: "A" | "AAAA"): string {
    return `${CACHE_PREFIX}${zoneId}:${recordName}:${recordType}`;
}

/**
 * 从缓存中获取IP地址
 */
export async function getCachedIP(cacheKey: string): Promise<string | null> {
    try {
        const cache = caches.default;
        const cachedResponse = await cache.match(new Request(`https://dummy.com/${cacheKey}`));
        if (cachedResponse) {
            const cachedData = await cachedResponse.text();
            cacheStats.recordHit();
            return cachedData;
        } else {
            cacheStats.recordMiss();
        }
    } catch (error) {
        console.warn('Cache read error:', error);
        cacheStats.recordMiss();
    }
    return null;
}

/**
 * 检查缓存中是否存在指定键（用于监控）
 */
export async function hasCachedKey(cacheKey: string): Promise<boolean> {
    try {
        const cache = caches.default;
        const cachedResponse = await cache.match(new Request(`https://dummy.com/${cacheKey}`));
        return cachedResponse !== undefined;
    } catch (error) {
        console.warn('Cache check error:', error);
        return false;
    }
}

/**
 * 将IP地址存储到缓存中
 */
export async function setCachedIP(cacheKey: string, ip: string): Promise<void> {
    try {
        const cache = caches.default;

        // 检查LRU容量，如果超出容量则删除最旧的条目
        const oldestKey = cacheTracker.access(cacheKey);
        if (oldestKey) {
            await cache.delete(new Request(`https://dummy.com/${oldestKey}`));
        }

        // 创建带有TTL的响应
        const response = new Response(ip, {
            headers: {
                'Cache-Control': `max-age=${CACHE_TTL}`,
                'Content-Type': 'text/plain'
            }
        });

        await cache.put(new Request(`https://dummy.com/${cacheKey}`), response);
    } catch (error) {
        console.warn('Cache write error:', error);
    }
}

/**
 * 获取缓存统计信息
 */
export function getCacheStats() {
    const stats = cacheStats.getStats();
    return {
        sets: cacheTracker.size(),
        ratio: stats.ratio,
        totalHits: stats.hits,
        totalMisses: stats.misses
    };
}

/**
 * 重置缓存统计信息
 */
export function resetCacheStats() {
    cacheStats.reset();
}
