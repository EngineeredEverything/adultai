"use client"

import { useState } from "react"
import {
    suspendUser,
    unsuspendUser,
    banUser,
    unbanUser,
    updateUserProfile,
    sendMessageToUser,
} from "@/actions/user/update"
import type { Role } from "@prisma/client"
import { toast } from "sonner"

export function useUserActions() {
    const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})

    const setLoading = (action: string, userId: string, loading: boolean) => {
        const key = `${action}-${userId}`
        setLoadingStates((prev) => ({ ...prev, [key]: loading }))
    }

    const isLoading = (action: string, userId: string) => {
        const key = `${action}-${userId}`
        return loadingStates[key] || false
    }

    const handleSuspendUser = async (userId: string, reason: string, duration?: string, onSuccess?: () => void) => {
        setLoading("suspend", userId, true)
        try {
            const result = await suspendUser(userId, reason, duration)

            if (result.success) {
                toast.success("Success", {
                    description: "User has been suspended successfully",
                })
                onSuccess?.()
                return { success: true }
            } else {
                toast.error("Error", {
                    description: result.error || "Failed to suspend user",
                })
                return { success: false, error: result.error }
            }
        } catch (error) {
            toast.error("Error", {
                description: "An unexpected error occurred",
            })
            return { success: false, error: "Unexpected error" }
        } finally {
            setLoading("suspend", userId, false)
        }
    }

    const handleUnsuspendUser = async (userId: string, onSuccess?: () => void) => {
        setLoading("unsuspend", userId, true)
        try {
            const result = await unsuspendUser(userId)

            if (result.success) {
                toast.success("Success", {
                    description: "User has been unsuspended successfully",
                })
                onSuccess?.()
                return { success: true }
            } else {
                toast.success("Error", {
                    description: result.error || "Failed to unsuspend user",
                })
                return { success: false, error: result.error }
            }
        } catch (error) {
            toast.error("Error", {
                description: "An unexpected error occurred",
            })
            return { success: false, error: "Unexpected error" }
        } finally {
            setLoading("unsuspend", userId, false)
        }
    }

    const handleBanUser = async (userId: string, reason: string, onSuccess?: () => void) => {
        setLoading("ban", userId, true)
        try {
            const result = await banUser(userId, reason)

            if (result.success) {
                toast.success("Success", {

                    description: "User has been banned successfully",
                })
                onSuccess?.()
                return { success: true }
            } else {
                toast.error("Error", {

                    description: result.error || "Failed to ban user",

                })
                return { success: false, error: result.error }
            }
        } catch (error) {
            toast.error("Error", {

                description: "An unexpected error occurred",

            })
            return { success: false, error: "Unexpected error" }
        } finally {
            setLoading("ban", userId, false)
        }
    }

    const handleUnbanUser = async (userId: string, onSuccess?: () => void) => {
        setLoading("unban", userId, true)
        try {
            const result = await unbanUser(userId)

            if (result.success) {
                toast.success("Success", {

                    description: "User has been unbanned successfully",
                })
                onSuccess?.()
                return { success: true }
            } else {
                toast.error("Error", {

                    description: result.error || "Failed to unban user",

                })
                return { success: false, error: result.error }
            }
        } catch (error) {
            toast.error("Error", {

                description: "An unexpected error occurred",

            })
            return { success: false, error: "Unexpected error" }
        } finally {
            setLoading("unban", userId, false)
        }
    }

    const handleUpdateProfile = async (
        userId: string,
        data: { name?: string; email?: string; role?: Role },
        onSuccess?: () => void,
    ) => {
        setLoading("update", userId, true)
        try {
            const result = await updateUserProfile(userId, data)

            if (result.success) {
                toast.success("Success", {

                    description: "User profile updated successfully",
                })
                onSuccess?.()
                return { success: true }
            } else {
                toast.error("Error", {

                    description: result.error || "Failed to update user profile",

                })
                return { success: false, error: result.error }
            }
        } catch (error) {
            toast.error("Error", {

                description: "An unexpected error occurred",

            })
            return { success: false, error: "Unexpected error" }
        } finally {
            setLoading("update", userId, false)
        }
    }

    const handleSendMessage = async (userId: string, message: string, onSuccess?: () => void) => {
        setLoading("message", userId, true)
        try {
            const result = await sendMessageToUser(userId, message)

            if (result.success) {
                toast.success("Success", {

                    description: "Message sent successfully",
                })
                onSuccess?.()
                return { success: true }
            } else {
                toast.error("Error", {

                    description: result.error || "Failed to send message",

                })
                return { success: false, error: result.error }
            }
        } catch (error) {
            toast.error("Error", {

                description: "An unexpected error occurred",

            })
            return { success: false, error: "Unexpected error" }
        } finally {
            setLoading("message", userId, false)
        }
    }

    return {
        handleSuspendUser,
        handleUnsuspendUser,
        handleBanUser,
        handleUnbanUser,
        handleUpdateProfile,
        handleSendMessage,
        isLoading,
    }
}
