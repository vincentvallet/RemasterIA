import { MessageCircle } from "lucide-react";

export function DiscordNotice({ url }: { url: string }) {
  if (!url) return null;
  return <aside className="discord-notice" aria-label="Communauté RemasterIA">
    <MessageCircle size={17} aria-hidden="true" />
    <p>Partagez vos RemasterIA sur le Discord de <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Ouvrir VibeCodeClub.fr dans un nouvel onglet">VibeCodeClub.fr</a></p>
  </aside>;
}
