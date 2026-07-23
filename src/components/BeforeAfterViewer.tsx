/* eslint-disable @next/next/no-img-element */
"use client";
import { ChevronsLeftRight } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type { GalleryItem } from "@/types/gallery";

export const clampPosition = (value: number) => Math.max(0, Math.min(100, value));

export function BeforeAfterViewer({ item, className = "", compact = false }: { item: GalleryItem; className?: string; compact?: boolean }) {
  const [position, setPosition] = useState(50);
  const [active, setActive] = useState(false);
  const [failed, setFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const lastTap = useRef(0);
  const update = useCallback((clientX: number) => {
    const box = root.current?.getBoundingClientRect();
    if (box) setPosition(clampPosition(((clientX - box.left) / box.width) * 100));
  }, []);
  return <div ref={root} className={`viewer ${className}`} data-active={active} role="slider" tabIndex={0} aria-label={`Comparaison de ${item.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(position)} aria-valuetext={`${Math.round(position)} % de l’image remasterisée`}
    onKeyDown={(event) => { if (event.shiftKey && event.key === "ArrowLeft") { event.preventDefault(); event.stopPropagation(); setPosition((value) => clampPosition(value - 10)); } if (event.shiftKey && event.key === "ArrowRight") { event.preventDefault(); event.stopPropagation(); setPosition((value) => clampPosition(value + 10)); } if (event.code === "Space") { event.preventDefault(); setPosition(50); } }}
    onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); const now = Date.now(); if (now - lastTap.current < 360) setPosition(50); else update(event.clientX); lastTap.current = now; setActive(true); }}
    onPointerMove={(event) => { if (active) update(event.clientX); }} onPointerUp={() => setActive(false)} onPointerCancel={() => setActive(false)}>
    <img src={item.originalImage} alt={`Version originale de ${item.title}`} draggable={false} loading="eager" onError={() => setFailed(true)} />
    <div className="reveal-layer" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}><img src={item.remasteredImage} alt={`Réinterprétation moderne de ${item.title}`} draggable={false} loading="eager" onError={() => setFailed(true)} /></div>
    <span className="divider" style={{ left: `${position}%` }} /><span className="handle" style={{ left: `${position}%` }} aria-hidden="true"><ChevronsLeftRight size={compact ? 15 : 17} /></span>
    {!compact && <span className="hint" aria-hidden="true">↔</span>}{failed && <div className="image-error" role="status">Cette paire d’images ne peut pas être affichée.</div>}
  </div>;
}
