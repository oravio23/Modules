import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes, resolving conflicts the way shadcn/ui expects. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
