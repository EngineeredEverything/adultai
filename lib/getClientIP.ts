import requestIp from "request-ip";
import { type NextApiRequest } from "next";
import { type NextRequest } from "next/server";

// Unified type for both request types
type UniversalRequest = NextApiRequest | NextRequest;

/**
 * Extracts the client's IP address from either a Pages API request (NextApiRequest)
 * or an App Router request (NextRequest).
 */
export function getClientIP(req: UniversalRequest): string {
    // Pages Router (req is Node.js IncomingMessage)
    if ("headers" in req && "socket" in req) {
        const ip = requestIp.getClientIp(req);
        return ip || "Unknown IP";
    }

    // App Router (NextRequest - edge-friendly)
    if ("headers" in req && typeof req.headers.get === "function") {
        const forwardedFor = req.headers.get("x-forwarded-for");
        return forwardedFor?.split(",")[0]?.trim() || "Unknown IP";
    }

    return "Unknown IP";
}
