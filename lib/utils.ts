import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const appName = process.env.NEXT_PUBLIC_APP_NAME;

export const imageUrl = `${process.env.NEXT_PUBLIC_API_URL}`.replaceAll("/v1","")

export const capitalizeFirstLetter = (str: string): string => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export const generateVoucher = (length = 8) => {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 chars

  if (length > charset.length) {
    throw new Error("Length cannot exceed unique charset size");
  }
  const chars = charset.split("");
  let voucher = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    voucher += chars[randomIndex];
    chars.splice(randomIndex, 1);
  }

  return voucher;
};
