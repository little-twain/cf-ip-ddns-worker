import { IPV4_PATTERN, IPV6_PATTERN } from '../constants/index.js';

export function getIPType(ip: string): "A" | "AAAA" | null {
    // 使用预编译的简单正则进行快速判断
    if (IPV4_PATTERN.test(ip)) {
        return "A";
    } else if (IPV6_PATTERN.test(ip)) {
        return "AAAA";
    }
    return null;
}
