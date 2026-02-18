import { authOptions } from "@/auth";
import { getServerSession } from "next-auth";

export const authCheck = async (
    type: "private" | "auth" | "public",
    callback?: string,
) => {
    try {
        const session = await getServerSession(authOptions);;

        if (type === "private") {
            if (!session || !session.user) {
                return {
                    error: "Unauthorized access"
                };
            }
            return {
                session,
                isAuthenticated: true
            };
        }

        if (type === "auth") {
            if (session && session.user) {
                return {
                    session,
                    isAuthenticated: true
                };
            }
        }

        return {
            session,
            isAuthenticated: !!session?.user
        };
    } catch (error) {
        return {
            error: "Authentication check failed"
        };
    }
};