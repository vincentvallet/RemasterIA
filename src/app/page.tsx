import manifest from "@/generated/gallery.json";
import { GalleryExperience } from "@/components/GalleryExperience";
import { siteConfig } from "@/config/site";
import type { GalleryManifest } from "@/types/gallery";

export default function HomePage() {
  return <GalleryExperience items={(manifest as GalleryManifest).items} communityUrl={siteConfig.vibeCodeClubUrl} />;
}
