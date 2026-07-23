/* eslint-disable @next/next/no-img-element */
"use client";
import type { GalleryItem } from "@/types/gallery";
export function ThumbnailStrip({ items, activeId, open, onSelect, onOpen, onClose }: { items: GalleryItem[]; activeId: string; open: boolean; onSelect: (index: number) => void; onOpen: () => void; onClose: () => void }) {
  return <div className="thumb-zone" onMouseEnter={onOpen} onMouseLeave={onClose}><div className={`thumb-strip ${open ? "open" : ""}`} aria-label="Toutes les créations">{items.map((item, index) => <button type="button" className={`thumbnail ${item.id === activeId ? "active" : ""}`} aria-label={`Ouvrir la création ${index + 1}`} aria-current={item.id === activeId ? "true" : undefined} onClick={() => onSelect(index)} key={item.id}><img src={item.thumbnailImage || item.remasteredImage} alt="" loading="lazy" /></button>)}</div></div>;
}
