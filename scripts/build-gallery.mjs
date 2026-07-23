import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  readManifest,
  scanGallery,
  sortManifest,
} from "../tools/gallery/core.mjs";

const root = process.cwd();
const galleryDir = path.join(root, "public", "gallery");
const outputPath = path.join(root, "src", "generated", "gallery.json");
const dataPath = path.join(root, "data", "gallery.json");

await mkdir(galleryDir, { recursive: true });
const manifest = sortManifest(await readManifest(dataPath));
const scanned = await scanGallery(galleryDir);
for (const warning of scanned.issues) console.warn(`⚠ ${warning}`);

const items = manifest.games.flatMap((game) =>
  game.scenes.map((scene, index) => ({
    id: scene.id,
    order: scene.order ?? index + 1,
    title: game.title,
    scene: `Scène ${String(scene.number).padStart(3, "0")}`,
    aliases: [],
    originalImage: scene.original,
    remasteredImage: scene.remaster,
    thumbnailImage: scene.thumbnail,
    ...(scene.aiTool ? { aiTool: scene.aiTool } : {}),
    ...(scene.width ? { width: scene.width } : {}),
    ...(scene.height ? { height: scene.height } : {}),
    searchText:
      `${game.title} ${game.slug.replaceAll("-", " ")} ${scene.number}`.toLocaleLowerCase(
        "fr-FR",
      ),
  })),
);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), items }, null, 2)}\n`,
  "utf8",
);
console.log(
  `✓ ${items.length} scène(s) disponible(s) dans src/generated/gallery.json.`,
);
