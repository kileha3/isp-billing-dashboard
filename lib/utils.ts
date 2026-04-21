import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const appName = process.env.NEXT_PUBLIC_APP_NAME;

export const imageUrl = `${process.env.NEXT_PUBLIC_API_URL}`.replaceAll("/v1","")
