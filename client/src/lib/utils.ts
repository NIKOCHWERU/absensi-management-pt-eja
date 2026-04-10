import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"
import { id } from "date-fns/locale"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatLongDate(date: Date | string | number) {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, "EEEE, d MMMM yyyy", { locale: id });
  } catch (e) {
    return String(date);
  }
}
