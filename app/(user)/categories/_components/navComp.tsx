"use client";
import { useRouter } from "next/navigation";
import MobileBottomNav from "../../gallery/components/mobile-bottom-nav";
import { Role } from "@prisma/client";
import { GetCurrentUserInfoSuccessType } from "@/types/user";

export default function NavComp({
  user,
}: {
  user: GetCurrentUserInfoSuccessType | null;
}) {
  const router = useRouter();

  return (
    <div className="md:hidden">
      <MobileBottomNav
        user={
          user
            ? {
                name: user?.user.name || "",
                image:
                  (user?.images?.images[0] &&
                    user?.images?.images[0].cdnLink) ||
                  "",
                role: user?.user.role || null,
                email: user?.user.email || "",
              }
            : null
        }
        onPlusClick={() => router.push("/gallery?create=true")}
      />
    </div>
  );
}
