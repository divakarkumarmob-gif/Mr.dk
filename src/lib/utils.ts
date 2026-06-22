import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function stripLatexForTTS(text: string): string {
  return text
    .replace(/\$/g, '')
    .replace(/\\cdot/g, ' dot ')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 divided by $2')
    .replace(/\{|\}/g, '')
    .replace(/\\/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
