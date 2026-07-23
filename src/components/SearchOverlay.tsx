/* eslint-disable @next/next/no-img-element */
"use client";
import { Search, X } from "lucide-react";
import { useMemo, useRef, useEffect, useState } from "react";
import { searchGallery } from "@/lib/gallery-search";
import type { GalleryItem } from "@/types/gallery";
export function SearchOverlay({ items, onSelect, onClose }: { items: GalleryItem[]; onSelect: (item: GalleryItem) => void; onClose: () => void }) {
  const [query, setQuery] = useState(""); const input = useRef<HTMLInputElement>(null); const results = useMemo(() => query ? searchGallery(items, query) : items, [items, query]);
  useEffect(() => input.current?.focus(), []);
  return <div className="overlay" role="dialog" aria-modal="true" aria-label="Rechercher une création" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className="dialog"><div className="dialog-head"><Search size={19} /><input ref={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un jeu ou une scène…" aria-label="Recherche"/><button className="icon-button" onClick={onClose} aria-label="Fermer"><X size={18}/></button></div><div className="results">{results.map((item) => <button className="result" key={item.id} onClick={() => onSelect(item)}><img src={item.thumbnailImage || item.remasteredImage} alt="" loading="lazy"/><span><strong>{item.title}</strong>{item.scene && <small>{item.scene}</small>}</span></button>)}{!results.length && <div className="empty">Aucune création trouvée.</div>}</div></div></div>;
}
