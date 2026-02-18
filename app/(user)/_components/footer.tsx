"use client";
import Link from "next/link";
import { LogOut, UserCog, UserIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";
import { LoginButton } from "@/components/auth/login-button";
import { Role } from "@prisma/client";

export default function SideBarFooter({
  user,
  expanded = true,
  isLoginOpen,
  setIsLoginOpen,
  handleModelClose,
}: {
  user?: {
    name?: string | null;
    image?: string | null;
    role: Role | null;
  } | null;
  expanded?: boolean;
  isLoginOpen: boolean;
  setIsLoginOpen: (value: boolean) => void;
  handleModelClose: () => void;
}) {
  return (
    <div className="border-t p-2 flex flex-col">
      {user ? (
        <>
          {(user.role === "ADMIN" || user.role === "MODERATOR") && (
            <div className="group flex items-center gap-2 py-2">
              <Link
                key={"Admin"}
                href={"/admin"}
                className="group w-full flex h-10 items-center rounded-md px-2 py-2 hover:bg-accent hover:text-accent-foreground"
              >
                <UserCog className="h-5 w-5" />
                {expanded ? (
                  <span className="ml-3">{"Admin"}</span>
                ) : (
                  <div className="absolute left-full ml-2 hidden rounded-md bg-popover px-2 py-1 text-sm text-popover-foreground shadow-md group-hover:block">
                    {"Admin"}
                  </div>
                )}
              </Link>
            </div>
          )}

          <div className="group flex items-center gap-2 py-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.image || ""} alt={user.name || ""} />
              <AvatarFallback>{user.name?.[0]}</AvatarFallback>
            </Avatar>
            {expanded ? (
              <div className="flex flex-col">
                <span className="text-sm font-medium">{user.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut()}
                  className="h-auto justify-start p-0 text-xs text-muted-foreground"
                >
                  <LogOut className="mr-1 h-3 w-3" />
                  Sign out
                </Button>
              </div>
            ) : (
              <div className="absolute bottom-16 left-full ml-2 hidden rounded-md bg-popover px-2 py-1 text-sm text-popover-foreground shadow-md group-hover:block">
                {user.name}
              </div>
            )}
          </div>
        </>
      ) : (
        <></>
        // <div onClick={() => !isLoginOpen && setIsLoginOpen(true)}>
        //   <LoginButton
        //     isOpen={isLoginOpen}
        //     onClose={handleModelClose}
        //     // mode="modal"
        //   >
        //     <Button className={cn("w-full", !expanded && "px-0")}>
        //       <UserIcon className="h-4 w-4" />
        //       {expanded && <span className="ml-2">Sign In</span>}
        //     </Button>
        //   </LoginButton>
        // </div>
      )}
    </div>
  );
}
