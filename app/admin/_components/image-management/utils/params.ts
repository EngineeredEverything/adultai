const DEFAULT_ITEMS_PER_PAGE = 20

// Utility function to safely parse search params with vote filters
function parseSearchParams(searchParams: {
  [key: string]: string | string[] | undefined
}) {
  const getString = (key: string): string => {
    const value = searchParams[key]
    return typeof value === "string" ? value : ""
  }

  const getNumber = (
    key: string,
    defaultValue?: number,
    min = Number.NEGATIVE_INFINITY,
    max = Number.POSITIVE_INFINITY,
  ): number | undefined => {
    const value = searchParams[key]
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number.parseInt(value, 10)
      if (!isNaN(parsed)) {
        return Math.max(min, Math.min(max, parsed))
      }
    }
    return defaultValue
  }

  const getBoolean = (key: string): boolean | undefined => {
    const value = getString(key)
    if (value === "true") return true
    if (value === "false") return false
    return undefined
  }

  return {
    search: getString("search"),
    page: getNumber("page", 1, 1) || 1,
    limit: getNumber("limit", DEFAULT_ITEMS_PER_PAGE, 1, 100) || DEFAULT_ITEMS_PER_PAGE,
    status: getString("status"),
    category_id: getString("category_id"),
    isPublic: getString("isPublic"),
    private: getString("private"),
    userId: getString("userId"),
    // Vote filter params
    minUpvotes: getNumber("minUpvotes", undefined, 0),
    maxUpvotes: getNumber("maxUpvotes", undefined, 0),
    minDownvotes: getNumber("minDownvotes", undefined, 0),
    maxDownvotes: getNumber("maxDownvotes", undefined, 0),
    minVoteScore: getNumber("minVoteScore"),
    maxVoteScore: getNumber("maxVoteScore"),
    hasVotes: getBoolean("hasVotes"),
    voteRatio: getString("voteRatio") as "positive" | "negative" | "neutral" | "",
  }
}

// Build filters object from parsed params with vote filters
function buildFilters(params: ReturnType<typeof parseSearchParams>) {
  const filters: {
    isPublic?: boolean
    private?: boolean
    userId?: string
    category_id?: string
    status?: string
    minUpvotes?: number
    maxUpvotes?: number
    minDownvotes?: number
    maxDownvotes?: number
    minVoteScore?: number
    maxVoteScore?: number
    hasVotes?: boolean
    voteRatio?: "positive" | "negative" | "neutral" | undefined
  } = {}

  // Handle boolean filters properly
  if (params.isPublic === "true") {
    filters.isPublic = true
  } else if (params.isPublic === "false") {
    filters.isPublic = false
  }

  if (params.private === "true") {
    filters.private = true
  } else if (params.private === "false") {
    filters.private = false
  }

  if (params.hasVotes !== undefined) {
    filters.hasVotes = params.hasVotes
  }

  // Handle string filters
  if (params.userId.trim()) {
    filters.userId = params.userId.trim()
  }

  if (params.category_id && params.category_id !== "all") {
    filters.category_id = params.category_id
  }

  if (params.status && params.status !== "all") {
    filters.status = params.status
  }

  if (params.voteRatio && params.voteRatio !== undefined) {
    filters.voteRatio = params.voteRatio
  }

  // Handle numeric vote filters
  if (params.minUpvotes !== undefined) {
    filters.minUpvotes = params.minUpvotes
  }

  if (params.maxUpvotes !== undefined) {
    filters.maxUpvotes = params.maxUpvotes
  }

  if (params.minDownvotes !== undefined) {
    filters.minDownvotes = params.minDownvotes
  }

  if (params.maxDownvotes !== undefined) {
    filters.maxDownvotes = params.maxDownvotes
  }

  if (params.minVoteScore !== undefined) {
    filters.minVoteScore = params.minVoteScore
  }

  if (params.maxVoteScore !== undefined) {
    filters.maxVoteScore = params.maxVoteScore
  }

  return filters
}

// Export utility functions for reuse
export { parseSearchParams, buildFilters }
