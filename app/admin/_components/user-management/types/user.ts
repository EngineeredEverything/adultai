import { SearchUsersSuccessType } from "@/types/user"
import type { Role } from "@prisma/client"


export interface UserManagementProps {
    users: SearchUsersSuccessType["users"]
    totalCount?: number
    currentPage?: number
    itemsPerPage?: number
    searchParams: {
        search: string
        page: number
        limit: number
        role: string[]
        status: string
        subscription: string
    }
}
