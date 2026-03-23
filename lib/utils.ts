import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const appName = "Easy ISP Billing";

export const imageUrl = `${process.env.NEXT_PUBLIC_API_URL}`.replaceAll("/v1","")
