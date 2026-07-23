import path from "node:path";
import {
  readManifest,
  scanGallery,
  writeManifestAtomic,
  humanizeSlug,
} from "../tools/gallery/core.mjs";

const root = process.cwd();
const manifestPath = path.join(root, "data", "gallery.json");
const existing = await readManifest(manifestPath, { allowMissing: true });
const scanned = await scanGallery(path.join(root, "public", "gallery"));
if (scanned.issues.length) {
  for (const issue of scanned.issues) console.warn(`⚠ ${issue}`);
  console.error(
    "Le manifeste n’a pas été réécrit : corrigez les scènes incomplètes pour éviter toute perte silencieuse.",
  );
  process.exitCode = 1;
} else {
  const now = new Date().toISOString();
  const rebuilt = {
    version: 1,
    updatedAt: now,
    games: scanned.games.map((diskGame) => {
      const oldGame = existing.games.find(
        (game) => game.slug === diskGame.slug,
      );
      return {
        slug: diskGame.slug,
        title: oldGame?.title || humanizeSlug(diskGame.slug),
        ...(oldGame?.order ? { order: oldGame.order } : {}),
        scenes: diskGame.scenes.map((scene) => {
          const old = oldGame?.scenes.find(
            (candidate) => candidate.number === scene.number,
          );
          return {
            id: `${diskGame.slug}-${String(scene.number).padStart(3, "0")}`,
            ...scene,
            ...(old?.order ? { order: old.order } : {}),
            ...(old?.aiTool ? { aiTool: old.aiTool } : {}),
            createdAt: old?.createdAt || now,
            ...(old?.width ? { width: old.width } : {}),
            ...(old?.height ? { height: old.height } : {}),
          };
        }),
      };
    }),
  };
  await writeManifestAtomic(manifestPath, rebuilt);
  console.log(`✓ Manifeste reconstruit : ${rebuilt.games.length} jeu(x).`);
}
