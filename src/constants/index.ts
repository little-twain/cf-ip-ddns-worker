/**
 * 应用常量定义
 */

// 预编译正则，用于快速区分 IPv4 和 IPv6
export const IPV4_PATTERN = /^\d+\.\d+\.\d+\.\d+$/;
export const IPV6_PATTERN = /^[0-9a-fA-F]*:[0-9a-fA-F:]*$/;

// 缓存相关常量
export const CACHE_PREFIX = 'ddns:';
export const MAX_CACHE_ENTRIES = 700000;
export const CACHE_TTL = 86400; // 1天缓存 (24小时 = 86400秒)
