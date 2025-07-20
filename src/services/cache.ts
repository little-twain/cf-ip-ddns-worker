import { CACHE_PREFIX, MAX_CACHE_ENTRIES, CACHE_TTL } from '../constants/index.js';

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
}

// 全局 LRU Set 实例
const cacheTracker = new LRUSetSimple(MAX_CACHE_ENTRIES);

/**
 * 生成缓存键
 */
export function getCacheKey(zone: string, recordName: string, recordType: "A" | "AAAA"): string {
    return `${CACHE_PREFIX}${zone}:${recordName}:${recordType}`;
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
            return cachedData;
        }
    } catch (error) {
        console.warn('Cache read error:', error);
    }
    return null;
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
