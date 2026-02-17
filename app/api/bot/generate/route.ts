import { handleBotImageGeneration } from "@/actions/images/bot-generation";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const API_TOKEN = process.env.BOT_API_TOKEN;

export async function POST(req: Request) {
    try {
        // Try to get token from headers
        const headerToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        // Or from body
        const body = await req.json();
        const bodyToken = body.token;
        const token = headerToken || bodyToken;
        
        if (!token || token !== API_TOKEN) {
            logger.info("Header Token:", token);
            logger.info("API_TOKEN Token:", API_TOKEN);
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { imageIds, taskId, eta, status } = await handleBotImageGeneration(body);

        return NextResponse.json({
            success: true,
            imageIds,
            taskId,
            eta,
            status,
        });
    } catch (error: any) {
        return NextResponse.json(
            {
                success: false,
                error: error.message || "Unknown error",
            },
            { status: 400 }
        );
    }
}
