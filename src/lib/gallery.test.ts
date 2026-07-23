import { describe, expect, it } from "vitest";
import { clampPosition } from "@/components/BeforeAfterViewer";
import { searchGallery } from "@/lib/gallery-search";
import { randomOtherIndex, shuffleItems } from "@/lib/shuffle";
import type { GalleryItem } from "@/types/gallery";

const items: GalleryItem[] = [
  { id: "lake-01", title: "Echo Lake", scene: "Twin Moons", aliases: ["Lac cobalt"], originalImage: "/1.png", remasteredImage: "/2.png", searchText: "echo lake twin moons lac cobalt" },
  { id: "vault-01", title: "Sun Vault", aliases: [], originalImage: "/3.png", remasteredImage: "/4.png", searchText: "sun vault" },
  { id: "jungle-01", title: "Verdant Signal", aliases: [], originalImage: "/5.png", remasteredImage: "/6.png", searchText: "verdant signal jungle" },
];
describe("viewer", () => { it("borne la séparation", () => { expect(clampPosition(-3)).toBe(0); expect(clampPosition(52)).toBe(52); expect(clampPosition(140)).toBe(100); }); });
describe("recherche", () => { it("recherche les titres, scènes et alias sans accents", () => { expect(searchGallery(items, "cobalt")[0]?.id).toBe("lake-01"); expect(searchGallery(items, "Écho lune")).toHaveLength(0); expect(searchGallery(items, "sun")[0]?.id).toBe("vault-01"); }); });
describe("mélange", () => { it("conserve chaque élément une seule fois", () => { const values = [0.8, 0.1]; let i = 0; const shuffled = shuffleItems(items, () => values[i++] ?? 0.4); expect(new Set(shuffled.map((item) => item.id)).size).toBe(items.length); }); it("choisit toujours une autre position", () => { expect(randomOtherIndex(3, 1, () => 0)).not.toBe(1); expect(randomOtherIndex(1, 0)).toBe(0); }); });
