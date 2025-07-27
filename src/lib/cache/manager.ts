/**
 * 高性能LRU缓存实现
 * 使用开放寻址哈希表和双向链表，提供真正的O(1)操作
 * 基于内存预算的精确容量计算
 */

/** 全局常量，方便统一调整 */
const TOTAL_MEMORY_BYTES = 128 * 2 ** 20;       // 128 MiB
const ENTRY_PAYLOAD_BYTES = 258;               // 每条 KV 原始负载
const POINTER_OVERHEAD_BYTES = 8 + 8;          // keys/vals 引用各 8 B
const LINK_OVERHEAD_BYTES = 4 + 4;             // prev/next 各 4 B
const SLOT_OVERHEAD_BYTES = 12;                // 哈希槽位均摊开销（估算）
const DEFAULT_LOAD_FACTOR = 1.5625;            // ≈2^21 / capacity

/** 根据内存和开销反算安全 capacity */
const BYTES_PER_ENTRY = ENTRY_PAYLOAD_BYTES
    + POINTER_OVERHEAD_BYTES
    + LINK_OVERHEAD_BYTES
    + SLOT_OVERHEAD_BYTES;                       // ≈258 + 16 + 8 + 12 = 294 B

const SAFE_CAPACITY = Math.floor(TOTAL_MEMORY_BYTES / BYTES_PER_ENTRY);

/** 取不小于 n 的最小 2 的幂 */
function nextPowerOfTwo(n: number): number {
    if (n < 1) return 1;
    return 1 << (32 - Math.clz32(n - 1));
}

class FixedLRU {
    private static readonly LOAD_FACTOR = DEFAULT_LOAD_FACTOR;
    private static readonly FNV_OFFSET = 2166136261;
    private static readonly FNV_PRIME = 16777619;

    private readonly capacity = SAFE_CAPACITY;
    private readonly M = nextPowerOfTwo(
        Math.ceil(this.capacity * FixedLRU.LOAD_FACTOR)
    );
    private readonly mask = this.M - 1;

    private keys: (string | null)[];
    private vals: (string | null)[];
    private prev: Int32Array;
    private next: Int32Array;

    private hashKeys: (string | null)[];
    private hashIdx: Int32Array;

    private freeHead: number;      // 空闲节点链头
    private headIdx = -1;          // LRU 链表头
    private tailIdx = -1;          // LRU 链表尾
    private size_ = 0;

    constructor() {
        // 节点数组（下标 0 .. capacity-1）
        this.keys = Array(this.capacity).fill(null);
        this.vals = Array(this.capacity).fill(null);
        this.prev = new Int32Array(this.capacity).fill(-1);
        this.next = new Int32Array(this.capacity).fill(-1);

        // 哈希表并行数组（下标 0 .. M-1）
        this.hashKeys = Array(this.M).fill(null);
        this.hashIdx = new Int32Array(this.M).fill(-1);

        // 初始化空闲链：0 → 1 → … → capacity-1 → -1
        this.freeHead = 0;
        for (let i = 0; i < this.capacity - 1; i++) {
            this.next[i] = i + 1;
        }
        this.next[this.capacity - 1] = -1;
    }

    /** FNV-1a 哈希，最后 & mask */
    private hash(key: string): number {
        let h = FixedLRU.FNV_OFFSET;
        const prime = FixedLRU.FNV_PRIME;
        const mask = this.mask;
        for (let i = 0, len = key.length; i < len; i++) {
            h ^= key.charCodeAt(i);
            h = Math.imul(h, prime);
        }
        return h & mask;
    }

    /** 找到 key 在哈希表中的槽位（空或已有） */
    private findSlot(key: string): number {
        let i = this.hash(key);
        const mask = this.mask;
        while (true) {
            const k = this.hashKeys[i];
            if (k === null || k === key) return i;
            i = (i + 1) & mask;  // 探测也用 & mask
        }
    }

    get(key: string): string | undefined {
        const slot = this.findSlot(key);
        const idx = this.hashIdx[slot];
        if (idx < 0) return undefined;

        // 更新 LRU：摘出 → 插入头
        this.unlink(idx);
        this.linkHead(idx);
        return this.vals[idx]!;
    }

    set(key: string, val: string): string | undefined {
        const slot = this.findSlot(key);
        let idx = this.hashIdx[slot];
        let evictedKey: string | undefined;

        if (idx >= 0) {
            // 已存在：更新并搬到头
            this.vals[idx] = val;
            this.unlink(idx);
            this.linkHead(idx);
            return undefined;
        }

        // 新插入：如果无空闲，则驱逐 tailIdx
        if (this.freeHead === -1) {
            idx = this.tailIdx;
            evictedKey = this.keys[idx]!;
            // 删除旧键
            const oldSlot = this.findSlot(evictedKey);
            this.hashKeys[oldSlot] = null;
            this.hashIdx[oldSlot] = -1;
            this.unlink(idx);
        } else {
            // 拿空闲节点
            idx = this.freeHead;
            this.freeHead = this.next[idx];
            this.size_++;
        }

        // 写入新条目
        this.keys[idx] = key;
        this.vals[idx] = val;
        this.hashKeys[slot] = key;
        this.hashIdx[slot] = idx;
        this.linkHead(idx);

        return evictedKey;
    }

    private linkHead(idx: number): void {
        this.prev[idx] = -1;
        this.next[idx] = this.headIdx;
        if (this.headIdx >= 0) this.prev[this.headIdx] = idx;
        this.headIdx = idx;
        if (this.tailIdx < 0) this.tailIdx = idx;
    }

    private unlink(idx: number): void {
        const p = this.prev[idx], n = this.next[idx];
        if (p >= 0) this.next[p] = n; else this.headIdx = n;
        if (n >= 0) this.prev[n] = p; else this.tailIdx = p;
        // 重置指针
        this.prev[idx] = this.next[idx] = -1;
    }

    has(key: string): boolean {
        const slot = this.findSlot(key);
        return this.hashIdx[slot] >= 0;
    }

    delete(key: string): boolean {
        const slot = this.findSlot(key);
        const idx = this.hashIdx[slot];
        if (idx < 0) return false;
        this.unlink(idx);
        this.hashKeys[slot] = null;
        this.hashIdx[slot] = -1;
        // 回收节点到空闲链
        this.next[idx] = this.freeHead;
        this.freeHead = idx;
        this.size_--;
        return true;
    }

    size(): number {
        return this.size_;
    }

    clear(): void {
        // 恢复初始状态
        for (let i = 0; i < this.M; i++) {
            this.hashKeys[i] = null;
            this.hashIdx[i] = -1;
        }
        this.keys.fill(null);
        this.vals.fill(null);
        this.prev.fill(-1);
        this.next.fill(-1);
        // 重建空闲链
        this.freeHead = 0;
        for (let i = 0; i < this.capacity - 1; i++) {
            this.next[i] = i + 1;
        }
        this.next[this.capacity - 1] = -1;
        this.headIdx = this.tailIdx = -1;
        this.size_ = 0;
    }

    // 获取统计信息，保持与原接口兼容
    getStats() {
        return {
            size: this.size_,
            capacity: this.capacity,
            utilization: this.size_ / this.capacity,
            loadFactor: this.M / this.capacity,
            hashSlots: this.M,
            memoryBudget: TOTAL_MEMORY_BYTES,
            bytesPerEntry: BYTES_PER_ENTRY,
            estimatedMemoryUsage: this.size_ * BYTES_PER_ENTRY
        };
    }

    // 添加驱逐最旧条目的方法，保持接口兼容
    evictOldest(): string | undefined {
        if (this.size_ === 0) return undefined;

        const evictedKey = this.keys[this.tailIdx]!;
        this.delete(evictedKey);
        return evictedKey;
    }
}

// 为了保持向后兼容，创建一个别名
export const CircularLRU = FixedLRU;
export type CircularLRU = FixedLRU;

/**
 * 缓存管理器，集成LRU内存缓存和Cloudflare Cache API
 */
export class CacheManager {
    private lruCache: CircularLRU;
    private lruHits = 0;        // LRU缓存命中次数
    private cacheApiHits = 0;   // Cache API命中次数

    constructor() {
        this.lruCache = new CircularLRU();
    }

    /**
     * 计算最大公约数
     */
    private gcd(a: number, b: number): number {
        while (b !== 0) {
            const temp = b;
            b = a % b;
            a = temp;
        }
        return a;
    }

    /**
     * 简化比率为最小整数比
     */
    private simplifyRatio(a: number, b: number): [number, number] {
        if (!Number.isInteger(a) || !Number.isInteger(b)) {
            throw new Error("Inputs must be integers");
        }
        if (a === 0 && b === 0) {
            throw new Error("Both numbers cannot be zero");
        }
        if (a === 0) return [0, 1];
        if (b === 0) return [1, 0];

        const d = this.gcd(Math.abs(a), Math.abs(b));
        return [a / d, b / d];
    }

    /**
     * 更新比率统计并简化
     */
    private updateRatio(isLruHit: boolean): void {
        if (isLruHit) {
            this.lruHits++;
        } else {
            this.cacheApiHits++;
        }

        // 异步简化比率，避免阻塞
        setTimeout(() => {
            if (this.lruHits > 0 || this.cacheApiHits > 0) {
                const [simplifiedLru, simplifiedApi] = this.simplifyRatio(this.lruHits, this.cacheApiHits);
                this.lruHits = simplifiedLru;
                this.cacheApiHits = simplifiedApi;
            }
        }, 0);
    }

    /**
     * 生成缓存键
     */
    private generateCacheKey(domain: string, recordType: 'A' | 'AAAA'): string {
        return `${domain}+${recordType}`;
    }

    /**
     * 生成Cache API键
     * 使用完全限定的URL，符合Cloudflare Cache API规范
     */
    private generateCacheAPIKey(domain: string, recordType: 'A' | 'AAAA'): string {
        return `https://worker-internal-cache.local/dns/${encodeURIComponent(domain)}/${recordType}`;
    }

    /**
     * 检查LRU缓存中的IP
     */
    checkLRUCache(domain: string, recordType: 'A' | 'AAAA'): string | undefined {
        const key = this.generateCacheKey(domain, recordType);
        const result = this.lruCache.get(key);

        if (result) {
            this.updateRatio(true); // LRU命中
        }

        return result;
    }

    /**
     * 更新LRU缓存
     */
    updateLRUCache(domain: string, recordType: 'A' | 'AAAA', ip: string): void {
        const key = this.generateCacheKey(domain, recordType);
        this.lruCache.set(key, ip);
    }

    /**
     * 从Cache API获取zone+record信息
     */
    async getCacheAPIRecord(
        domain: string,
        recordType: 'A' | 'AAAA',
        cacheAPI: Cache
    ): Promise<string | undefined> {
        try {
            const cacheKey = this.generateCacheAPIKey(domain, recordType);
            const cached = await cacheAPI.match(cacheKey);

            if (cached) {
                this.updateRatio(false); // Cache API命中
                const data = await cached.text();
                return data;
            }
        } catch (error) {
            console.error('Cache API error:', error);
        }

        return undefined;
    }

    /**
     * 存储到Cache API
     */
    async setCacheAPIRecord(
        domain: string,
        recordType: 'A' | 'AAAA',
        zoneId: string,
        recordId: string,
        cacheAPI: Cache,
        ttl: number = 3600
    ): Promise<void> {
        try {
            const cacheKey = this.generateCacheAPIKey(domain, recordType);
            const value = `${zoneId}+${recordId}`;

            const response = new Response(value, {
                headers: {
                    'Cache-Control': `max-age=${ttl}`,
                    'Content-Type': 'text/plain'
                }
            });

            await cacheAPI.put(cacheKey, response);
        } catch (error) {
            console.error('Cache API set error:', error);
        }
    }

    /**
     * 获取统计信息
     */
    getStats() {
        const lruStats = this.lruCache.getStats();

        return {
            cached_num: lruStats.size,
            ratio: `${this.lruHits}:${this.cacheApiHits}`
        };
    }

    /**
     * 获取域名的缓存信息
     */
    getDomainInfo(domain: string): any {
        const aRecord = this.lruCache.get(this.generateCacheKey(domain, 'A'));
        const aaaaRecord = this.lruCache.get(this.generateCacheKey(domain, 'AAAA'));

        const result: any = {};

        if (aRecord) {
            result.A = {
                content: aRecord,
                cached: true
            };
        }

        if (aaaaRecord) {
            result.AAAA = {
                content: aaaaRecord,
                cached: true
            };
        }

        if (!aRecord && !aaaaRecord) {
            result.message = "No cached records found for this domain";
        }

        return result;
    }
}
