import type { GalleryItem } from "@/types/gallery";

export function preloadPair(item: GalleryItem | undefined) {
  if (!item || typeof window === "undefined") return;
  [item.originalImage, item.remasteredImage].forEach((source) => {
    const image = new window.Image();
    image.decoding = "async";
    image.src = source;
  });
}
