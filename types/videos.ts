export type SearchVideosResponseSuccessType = {
  videos: {
    video: {
      id: string
      userId: string
      prompt: string
      negativePrompt: string | null
      videoUrl: string | null
      cdnUrl?: string
      seed: number | null
      modelId: string | null
      steps: number | null
      cfg: number | null
      fps: number | null
      numFrames: number | null
      costNuts: number
      createdAt: Date
      updatedAt: Date
      isPublic: boolean
      verified: Date | null
      width: number | null
      height: number | null
      path: string | null
      status: string
      taskId: string | null
      eta: number | null
      progress: number | null
      duration: number | null
      upvotes: number
      downvotes: number
      voteScore: number
      futureLinks: string[]
      categoryIds: string[]
      user?: {
        name: string | null
        id: string
      }
    }
    comments?: {
      comments: {
        id: string
        comment: string
        user: { name: string | null }
        userId: string
        videoId: string
        createdAt: Date
      }[]
      count: number
    }
    votes?: {
      votes: any[]
      upvotes: number
      downvotes: number
      count: number
      upvoteCount: number
      downvoteCount: number
      voteScore: number
    }
    categories?: {
      id: string
      name: string
      keywords: string[]
    }[]
  }[]
  count?: number
}
