import { CardWrapper } from "@/components/auth/card-wrapper"
import { TriangleAlert } from "lucide-react"

export const ErrorCard = () => {
  return (
    <CardWrapper
      headerLabel="Oops! Something went wrong!"
      backButtonHref={"/auth/login"}
      backButtonLabel="Back to login"
      title="Error"
    >
      <div className="w-full flex justify-center items-center py-8">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <TriangleAlert className="text-destructive w-8 h-8" />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Please try again or contact support if the problem persists.
          </p>
        </div>
      </div>
    </CardWrapper>
  )
}
