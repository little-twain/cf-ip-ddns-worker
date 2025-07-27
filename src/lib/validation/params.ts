/**
 * Validation utilities for DDNS parameters
 */

export interface DDNSParams {
    zone: string;
    email: string;
    key: string;
    name: string;
}

export interface ValidationResult {
    success: boolean;
    params?: DDNSParams;
    missingParams?: string[];
    error?: string;
}

/**
 * 验证DDNS参数，返回详细的缺失参数信息
 */
export function validateDDNSParams(params: URLSearchParams): ValidationResult {
    const requiredParams = ['zone', 'email', 'key', 'name'];
    const missingParams: string[] = [];
    const result: Partial<DDNSParams> = {};

    // 检查每个必需参数
    for (const param of requiredParams) {
        const value = params.get(param);
        if (!value || value.trim() === '') {
            missingParams.push(param);
        } else {
            (result as any)[param] = value.trim();
        }
    }

    if (missingParams.length > 0) {
        return {
            success: false,
            missingParams,
            error: `Missing required parameters: ${missingParams.join(', ')}`
        };
    }

    return {
        success: true,
        params: result as DDNSParams
    };
}
