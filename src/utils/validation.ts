import type { DDNSParams } from '../types/index.js';
import { createErrorResponse } from './response.js';

export function validateDDNSParams(params: URLSearchParams): { params: DDNSParams } | { error: Response } {
    const zone = params.get("zone");
    const email = params.get("email");
    const key = params.get("key");
    const name = params.get("name");

    const missing: string[] = [];
    if (!zone) missing.push("zone");
    if (!email) missing.push("email");
    if (!key) missing.push("key");
    if (!name) missing.push("name");

    if (missing.length > 0) {
        return {
            error: createErrorResponse(
                "missing_parameters",
                `Missing required parameters: ${missing.join(", ")}`,
                400
            )
        };
    }

    return { params: { zone: zone!, email: email!, key: key!, name: name! } };
}
