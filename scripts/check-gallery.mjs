import path from "node:path";
import { readManifest, scanGallery } from "../tools/gallery/core.mjs";

const root = process.cwd();
const problems = [];
let manifest;
try { manifest = await readManifest(path.join(root, "data", "gallery.json"), { allowMissing: true }); }
catch (error) { problems.push(error.message); }
const scanned = await scanGallery(path.join(root, "public", "gallery"));
problems.push(...scanned.issues);

if (manifest) {
  for (const game of manifest.games) {
    const diskGame = scanned.games.find((candidate) => candidate.slug === game.slug);
    if (!diskGame) problems.push(`Jeu du manifeste absent du disque : ${game.slug}.`);
    for (const scene of game.scenes) {
      if (!diskGame?.scenes.some((candidate) => candidate.number === scene.number)) problems.push(`Scène du manifeste absente ou incomplète : ${game.slug} #${String(scene.number).padStart(3, "0")}.`);
    }
  }
}
if (problems.length) {
  for (const problem of [...new Set(problems)]) console.error(`✗ ${problem}`);
  process.exitCode = 1;
} else console.log("✓ Galerie et manifeste valides.");
