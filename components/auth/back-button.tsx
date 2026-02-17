"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import type { Dispatch, SetStateAction } from "react"
import Link from "next/link"

interface BackButtonProps {
  href: string
  label: string
  onClose?: Dispatch<SetStateAction<boolean>>
}



export const BackButton = ({ href, label, onClose }: BackButtonProps) => {
  const router = useRouter()

  if (onClose) {
   const handleProcessing = (e: React.MouseEvent<HTMLButtonElement>) => {
     console.log("Processing back button click...");
     if (onClose) {
       console.log("Closing modal or dialog...");
       onClose(false);
     }
     console.log(onClose);
     router.replace(href);
   };

   return (
     <Button
       onClick={handleProcessing}
       variant="link"
       className="font-normal w-full cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors"
       size="sm"
     >
       {label}
     </Button>
   );
  } else {
    return (
      <Button
        variant="link"
        className="font-normal w-full cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors"
        size="sm"
      >
        <Link href={href}>{label}</Link>
      </Button>
    );

  }
 
}
