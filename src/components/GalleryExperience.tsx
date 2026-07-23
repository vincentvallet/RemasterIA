/* eslint-disable @next/next/no-img-element */
"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BeforeAfterViewer } from "@/components/BeforeAfterViewer";
import { DiscordNotice } from "@/components/DiscordNotice";
import { SearchOverlay } from "@/components/SearchOverlay";
import { ThumbnailStrip } from "@/components/ThumbnailStrip";
import { TitleReveal } from "@/components/TitleReveal";
import { ViewerControls } from "@/components/ViewerControls";
import { preloadPair } from "@/lib/image-preloader";
import { randomOtherIndex, shuffleItems } from "@/lib/shuffle";
import type { GalleryItem } from "@/types/gallery";

type Overlay = "search" | null;
export function GalleryExperience({
  items,
  communityUrl,
}: {
  items: GalleryItem[];
  communityUrl: string;
}) {
  const [order, setOrder] = useState(items);
  const [index, setIndex] = useState(0);
  const [viewerKey, setViewerKey] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [thumbs, setThumbs] = useState(false);
  const [idle, setIdle] = useState(false);
  const seen = useRef(new Set<string>());
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thumbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = order[index];
  const wake = useCallback(() => {
    setIdle(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdle(true), 3200);
  }, []);
  const select = useCallback(
    (next: number) => {
      if (!order.length) return;
      const safe = (next + order.length) % order.length;
      seen.current.add(order[safe].id);
      setIndex(safe);
      setViewerKey((value) => value + 1);
      setRevealed(false);
    },
    [order],
  );
  const random = useCallback(() => {
    if (order.length < 2) return;
    const unseen = order
      .map((item, itemIndex) => ({ item, itemIndex }))
      .filter(({ item }) => !seen.current.has(item.id));
    if (unseen.length)
      select(unseen[Math.floor(Math.random() * unseen.length)].itemIndex);
    else {
      const shuffled = shuffleItems(order);
      if (shuffled[0].id === current.id) {
        const other = randomOtherIndex(shuffled.length, 0);
        [shuffled[0], shuffled[other]] = [shuffled[other], shuffled[0]];
      }
      seen.current = new Set([shuffled[0].id]);
      setOrder(shuffled);
      setIndex(0);
      setViewerKey((value) => value + 1);
    }
  }, [current, order, select]);
  const openThumbs = useCallback(() => {
    setThumbs(true);
    if (thumbTimer.current) clearTimeout(thumbTimer.current);
    thumbTimer.current = setTimeout(() => setThumbs(false), 4500);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      setOrder(items);
      setIndex(0);
      if (items[0]) seen.current.add(items[0].id);
    }, 0);
    return () => clearTimeout(timer);
  }, [items]);
  useEffect(() => {
    if (!current) return;
    preloadPair(order[(index + 1) % order.length]);
  }, [current, index, order]);
  useEffect(() => {
    if (!revealed) return;
    const timer = setTimeout(() => setRevealed(false), 3600);
    return () => clearTimeout(timer);
  }, [revealed]);
  useEffect(() => {
    idleTimer.current = setTimeout(() => setIdle(true), 3200);
    const move = () => wake();
    addEventListener("pointermove", move, { passive: true });
    return () => {
      removeEventListener("pointermove", move);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [wake]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOverlay("search");
        return;
      }
      if (event.key === "Escape") {
        setOverlay(null);
        setThumbs(false);
        setRevealed(false);
        return;
      }
      if (typing || overlay) return;
      if (
        event.key.toLowerCase() === "j" ||
        event.key === "ArrowDown" ||
        (event.key === "ArrowRight" && !event.shiftKey)
      ) {
        event.preventDefault();
        select(index + 1);
      }
      if (
        event.key.toLowerCase() === "k" ||
        event.key === "ArrowUp" ||
        (event.key === "ArrowLeft" && !event.shiftKey)
      ) {
        event.preventDefault();
        select(index - 1);
      }
      if (event.key.toLowerCase() === "r") random();
      if (
        event.code === "Space" &&
        !(target instanceof Element && target.closest('[role="slider"]'))
      ) {
        event.preventDefault();
        setViewerKey((value) => value + 1);
      }
      if (event.key === "?" || (event.key === "/" && event.shiftKey))
        setRevealed((value) => !value);
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [index, overlay, random, select]);
  if (!current)
    return (
      <main className="experience">
        <div className="empty">
          Ajoutez une création avec RemasterIA Studio.
        </div>
      </main>
    );
  return (
    <main className="experience" onPointerDown={wake}>
      <img
        key={current.id}
        className="ambient"
        src={current.remasteredImage}
        alt=""
        aria-hidden="true"
      />
      <div className="ambient-veil" aria-hidden="true" />
      <ViewerControls
        idle={idle}
        onSearch={() => setOverlay("search")}
        onRandom={random}
        onThumbnails={() => (thumbs ? setThumbs(false) : openThumbs())}
        onReveal={() => setRevealed((value) => !value)}
      />
      {revealed && (
        <TitleReveal item={current} onClose={() => setRevealed(false)} />
      )}
      <div className="viewer-wrap">
        <BeforeAfterViewer key={`${current.id}-${viewerKey}`} item={current} />
      </div>
      <button
        className="edge-nav prev"
        onClick={() => select(index - 1)}
        aria-label="Création précédente (flèche gauche ou K)"
      >
        <ChevronLeft size={34} strokeWidth={2.5} />
      </button>
      <button
        className="edge-nav next"
        onClick={() => select(index + 1)}
        aria-label="Création suivante (flèche droite ou J)"
      >
        <ChevronRight size={34} strokeWidth={2.5} />
      </button>
      <div
        className="counter"
        aria-label={`Création ${index + 1} sur ${order.length}`}
      >
        {String(index + 1).padStart(2, "0")} /{" "}
        {String(order.length).padStart(2, "0")}
      </div>
      <ThumbnailStrip
        items={order}
        activeId={current.id}
        open={thumbs}
        onSelect={(next) => {
          select(next);
          setThumbs(false);
        }}
        onOpen={openThumbs}
        onClose={() => {
          if (thumbTimer.current) clearTimeout(thumbTimer.current);
          thumbTimer.current = setTimeout(() => setThumbs(false), 900);
        }}
      />
      <DiscordNotice url={communityUrl} />
      {overlay === "search" && (
        <SearchOverlay
          items={order}
          onClose={() => setOverlay(null)}
          onSelect={(item) => {
            select(order.findIndex((candidate) => candidate.id === item.id));
            setOverlay(null);
          }}
        />
      )}
    </main>
  );
}
