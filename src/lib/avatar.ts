import { people } from "@/components/arc/lib/media";

/** Members store an Arc sample portrait id or a URL. */
export function avatarSrc(value?: string) {
  if (!value) return undefined;
  if (value.startsWith("/") || value.startsWith("http")) return value;
  return people.find(person => person.id === value)?.src;
}
