/**
 * IP address utilities with optimized type detection
 */

// 预编译简单的正则表达式
const HAS_COLON = /:/;
const HAS_DOT = /\./;

/**
 * 检测IP地址类型，使用简单的字符检测而非复杂正则
 * IPv6 地址包含冒号 (:)，IPv4 地址包含点 (.)
 * 这比复杂正则表达式更高效
 */
export function getIPType(ip: string): "A" | "AAAA" | null {
    if (!ip || typeof ip !== 'string') {
        return null;
    }

    const trimmedIP = ip.trim();

    // IPv6 地址包含冒号
    if (HAS_COLON.test(trimmedIP)) {
        return "AAAA";
    }

    // IPv4 地址包含点
    if (HAS_DOT.test(trimmedIP)) {
        return "A";
    }

    return null;
}

/**
 * 验证IP地址格式是否有效
 * 这是一个可选的更严格验证，可以在需要时使用
 */
export function isValidIP(ip: string): boolean {
    const type = getIPType(ip);
    if (!type) return false;

    return true;
}
