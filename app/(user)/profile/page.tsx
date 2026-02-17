import { Suspense } from "react";
import { ProfileForm } from "./profile-form";
import { Loader2 } from "lucide-react";
import { db } from "@/lib/db";
import { currentUser } from "@/utils/auth";
import { getCurrentUserInfo } from "@/actions/user/info";
import { isGetCurrentUserInfoSuccess } from "@/types/user";

export default async function ProfilePage() {
  const session = await currentUser(); // Assuming you have a function to get the current user session

  if (!session)
    return (
      <>
        <div className="container px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Profile Settings</h1>
            <p className="text-muted-foreground mt-2">
              Manage your account settings and preferences
            </p>
          </div>
          <div className="bg-card rounded-lg border shadow-sm p-6">
            <p>Please log in to view your profile settings.</p>
          </div>
        </div>
      </>
    );
  const user = await getCurrentUserInfo({
    role: {},
    images: {
      count: true,
      limit: {
        start: 0,
        end: 1,
      }
    },
  });
  if (!isGetCurrentUserInfoSuccess(user))
    return (
      <div className="container px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Profile Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your account settings and preferences
          </p>
        </div>
        <div className="bg-card rounded-lg border shadow-sm p-6">
          <p>User not found.</p>
        </div>
      </div>
    );
  return (
    <div className="container px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Profile Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="bg-card rounded-lg border shadow-sm p-6">
        <Suspense
          fallback={
            <div className="flex justify-center items-center min-h-[300px]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }
        >
          <ProfileForm user={user} />
        </Suspense>
      </div>
    </div>
  );
}
