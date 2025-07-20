import type { ApiResponse } from '../types/index.js';

export function createErrorResponse(
    error: string,
    message: string,
    status: number,
    details?: any
): Response {
    const response: ApiResponse = {
        success: false,
        error,
        message,
    };

    if (details) {
        response.details = details;
    }

    return new Response(JSON.stringify(response), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

export function createSuccessResponse(
    message: string,
    ip: string,
    recordName: string,
    previousIp?: string,
    recordId?: string
): Response {
    const response: ApiResponse = {
        success: true,
        message,
        ip,
        record_name: recordName,
    };

    if (previousIp) {
        response.previous_ip = previousIp;
    }

    if (recordId) {
        response.record_id = recordId;
    }

    return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}
