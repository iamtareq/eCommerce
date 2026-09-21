import { normalizeBdPhone } from "./phone";

/** wa.me link for a BD number, or null if the number is invalid. */
export function whatsappUrl(number: string, text?: string): string | null {
  const local = normalizeBdPhone(number);
  if (!local) return null;
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/88${local}${q}`;
}

export function telUrl(number: string): string | null {
  const local = normalizeBdPhone(number);
  if (local) return `tel:+88${local}`;
  const digits = number.replace(/[^\d+]/g, "");
  return digits.length >= 5 ? `tel:${digits}` : null;
}
