import { clsx, type ClassValue } from 'clsx'
import { format } from 'date-fns';
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const appName = process.env.NEXT_PUBLIC_APP_NAME;

export const capitalizeFirstLetter = (str: string): string => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export const formatDate = (date: any) => format(date, "MMM d, yyyy h:mma")

export const formatDuration = (value: number, unit: string, lan: string) => {
  return lan === "en" ? `${value} ${unit}`: `${unit} ${value} `;
}

export const formatData = (mb: number, unit: string, unlimited: string) => {
  if (mb === 0) return unlimited;
  if (unit === "GB") return `${mb}${unit}`
  if (mb >= 1024 && unit === "MB") return `${(mb / 1024).toFixed(0)}GB`;
  return `${mb}MB`;
}

export const formatSpeed = (mb: number, unlimited: string) => {
  if (mb === 0) return unlimited;
  return `${mb}Mbps`;
}
