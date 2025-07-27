// 缓存相关
export { CircularLRU, CacheManager } from './cache/manager';

// DNS操作
export { getDNSRecord, updateDNSRecord } from './dns/operations';
export type { DNSRecord } from './dns/operations';

// 工具函数
export { getIPType, isValidIP } from './utils/ip';
export {
    createErrorResponse,
    createSuccessResponse,
    createStatsResponse,
    createDomainInfoResponse,
    createSimpleSuccessResponse,
    createIPResponse
} from './utils/response';

// 验证
export { validateDDNSParams } from './validation/params';
export type { DDNSParams, ValidationResult } from './validation/params';
