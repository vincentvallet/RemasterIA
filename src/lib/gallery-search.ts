import type { GalleryItem } from "@/types/gallery";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR").trim();

export function searchGallery(items: readonly GalleryItem[], query: string): GalleryItem[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return items.filter((item) => {
    const haystack = normalize(item.searchText);
    return terms.every((term) => haystack.includes(term));
  });
}
