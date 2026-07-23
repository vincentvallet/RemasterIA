import { access, copyFile, mkdir, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { humanizeSlug, slugifyGame } from "../tools/gallery/core.mjs";

const root = process.cwd();
const galleryDir = path.join(root, "public", "gallery");
const dryRun = process.argv.includes("--dry-run");
const files = (await readdir(galleryDir, { withFileTypes: true })).filter((entry) => entry.isFile()).map((entry) => entry.name);
const pairs = new Map();
for (const file of files) {
  const match = file.match(/^([12])_(.+?)\.(jpe?g|png|webp|avif|tiff?)$/i);
  if (!match) continue;
  const key = match[2].toLocaleLowerCase("fr-FR");
  const pair = pairs.get(key) ?? {};
  pair[match[1] === "1" ? "original" : "remaster"] = file;
  pairs.set(key, pair);
}
const complete = [...pairs].filter(([, pair]) => pair.original && pair.remaster);
if (!complete.length) {
  console.log("✓ Aucun ancien fichier à migrer.");
  process.exit(0);
}
const plan = complete.map(([key, pair]) => {
  const sceneMatch = key.match(/^(.*?)[-_](\d+)$/);
  const slug = slugifyGame(sceneMatch?.[1] || key);
  const number = sceneMatch ? Number(sceneMatch[2]) : 1;
  return { key, pair, slug, title: humanizeSlug(slug), number, prefix: String(number).padStart(3, "0") };
});
const destinations = new Set();
for (const item of plan) {
  const destination = `${item.slug}/${item.prefix}`;
  if (destinations.has(destination)) throw new Error(`Migration ambiguë : plusieurs paires ciblent ${destination}.`);
  destinations.add(destination);
  console.log(`${item.pair.original} + ${item.pair.remaster} → ${destination}-{original,remaster,thumbnail}.webp`);
}
if (dryRun) {
  console.log(`✓ Aperçu terminé : ${plan.length} paire(s), aucun fichier modifié.`);
  process.exit(0);
}
const backupDir = path.join(root, ".gallery-migration-backup", new Date().toISOString().replace(/[:.]/g, "-"));
await mkdir(backupDir, { recursive: true });
const staged = [];
try {
  for (const item of plan) {
    const destinationDir = path.join(galleryDir, item.slug);
    await mkdir(destinationDir, { recursive: true });
    for (const suffix of ["original", "remaster", "thumbnail"]) await access(path.join(destinationDir, `${item.prefix}-${suffix}.webp`)).then(() => { throw new Error(`Destination existante : ${item.slug}/${item.prefix}-${suffix}.webp`); }).catch((error) => { if (error.code !== "ENOENT") throw error; });
    await copyFile(path.join(galleryDir, item.pair.original), path.join(backupDir, item.pair.original));
    await copyFile(path.join(galleryDir, item.pair.remaster), path.join(backupDir, item.pair.remaster));
    const originalTmp = path.join(destinationDir, `.${item.prefix}-original.tmp.webp`);
    const remasterTmp = path.join(destinationDir, `.${item.prefix}-remaster.tmp.webp`);
    const thumbnailTmp = path.join(destinationDir, `.${item.prefix}-thumbnail.tmp.webp`);
    await sharp(path.join(galleryDir, item.pair.original)).rotate().resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true }).webp({ quality: 82, effort: 5, smartSubsample: true }).toFile(originalTmp);
    await sharp(path.join(galleryDir, item.pair.remaster)).rotate().resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true }).webp({ quality: 82, effort: 5, smartSubsample: true }).toFile(remasterTmp);
    await sharp(path.join(galleryDir, item.pair.remaster)).rotate().resize({ width: 480, withoutEnlargement: true }).webp({ quality: 70, effort: 4 }).toFile(thumbnailTmp);
    for (const [temporary, final] of [[originalTmp, "original"], [remasterTmp, "remaster"], [thumbnailTmp, "thumbnail"]]) {
      const target = path.join(destinationDir, `${item.prefix}-${final}.webp`);
      await rename(temporary, target);
      staged.push(target);
    }
  }
  for (const item of plan) {
    await rm(path.join(galleryDir, item.pair.original));
    await rm(path.join(galleryDir, item.pair.remaster));
  }
  console.log(`✓ Migration terminée. Sauvegarde : ${backupDir}`);
  console.log("Exécutez npm run gallery:rebuild pour reconstruire le manifeste.");
} catch (error) {
  for (const file of staged) await rm(file, { force: true }).catch(() => {});
  throw error;
}
