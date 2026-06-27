import * as React from "react"
import { cn } from "../../lib/utils"

export const Avatar: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn("relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full bg-neutral-800", className)} {...props} />
);

export const AvatarImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = ({ className, ...props }) => (
  <img className={cn("aspect-square h-full w-full object-cover", className)} {...props} />
);

export const AvatarFallback: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({ className, ...props }) => (
  <span className={cn("flex h-full w-full items-center justify-center rounded-full bg-neutral-700 text-xs font-semibold text-white", className)} {...props} />
);
