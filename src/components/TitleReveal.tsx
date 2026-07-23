"use client";
import type { GalleryItem } from "@/types/gallery";
export function TitleReveal({ item, onClose }: { item: GalleryItem; onClose: () => void }) { return <button className="title-reveal" onClick={onClose} aria-label="Masquer le titre"><strong>{item.title}</strong>{item.scene && <small>{item.scene}</small>}</button>; }
