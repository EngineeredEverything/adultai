import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export function groupBy<T extends Record<string, any>>(arr: T[], keyFn: (item: T) => string) {
  return arr.reduce((acc: Record<string, T[]>, item) => {
    const key = keyFn(item)
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})
}

export default function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(word => word[0].toUpperCase())
    .join('');
}

export const getUserImageByEmail = (email?: string, name?: string | null) => {
  return email ? `https://avatar.vercel.sh/${email}.svg${name && `?text=${getInitials(name)}`}` : "";
};