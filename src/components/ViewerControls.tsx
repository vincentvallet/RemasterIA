/* eslint-disable @next/next/no-img-element */
"use client";
import { CircleHelp, Images, Search, Shuffle } from "lucide-react";

function Control({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return <button className="icon-button" type="button" onClick={onClick} disabled={disabled} aria-label={label}>{children}<span className="tooltip" role="tooltip">{label}</span></button>;
}
export function ViewerControls({ idle, onSearch, onRandom, onThumbnails, onReveal }: { idle: boolean; onSearch: () => void; onRandom: () => void; onThumbnails: () => void; onReveal: () => void }) {
  return <header className={`topbar ${idle ? "idle" : ""}`}><div className="logo"><img src="/brand/remasteria-logo.webp" width="640" height="114" alt="RemasterIA" /></div><div className="controls">
    <Control label="Révéler le titre (?)" onClick={onReveal}><CircleHelp size={18} /></Control>
    <Control label="Rechercher (Ctrl K)" onClick={onSearch}><Search size={18} /></Control>
    <Control label="Paire aléatoire (R)" onClick={onRandom}><Shuffle size={18} /></Control>
    <Control label="Afficher les miniatures" onClick={onThumbnails}><Images size={18} /></Control>
  </div></header>;
}
