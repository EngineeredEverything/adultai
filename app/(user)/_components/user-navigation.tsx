import { cn } from "@/lib/utils";
import { LucideProps } from "lucide-react";
import Link from "next/link";
import { ForwardRefExoticComponent, RefAttributes } from "react";

export default function SideBarUserNavigation({
  expanded,
  userNavItems,
}: {
  expanded?: boolean;
  userNavItems: {
    title: string;
    icon: ForwardRefExoticComponent<
      Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>
    >;
    href: string;
  }[];
}) {
  return (
    <div className="mt-4">
      <div
        className={cn(
          "mb-2 px-4 text-xs font-medium text-muted-foreground",
          !expanded && "sr-only"
        )}
      >
        User
      </div>
      <nav className="flex flex-col gap-1 px-2">
        {userNavItems.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="group flex h-10 items-center rounded-md px-2 py-2 hover:bg-accent hover:text-accent-foreground"
          >
            <item.icon className="h-5 w-5" />
            {expanded ? (
              <span className="ml-3">{item.title}</span>
            ) : (
              <div className="absolute left-full ml-2 hidden rounded-md bg-popover px-2 py-1 text-sm text-popover-foreground shadow-md group-hover:block">
                {item.title}
              </div>
            )}
          </Link>
        ))}
      </nav>
    </div>
  );
}
