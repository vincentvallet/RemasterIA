import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

export const MANIFEST_VERSION = 1;
export const SCENE_FILE = /^(\d{3})-(original|remaster|thumbnail)\.webp$/i;
export const emptyManifest = () => ({
  version: MANIFEST_VERSION,
  updatedAt: new Date(0).toISOString(),
  games: [],
});

export function normalizeGameKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr-FR")
    .replace(/[\s_-]+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function slugifyGame(value) {
  const slug = String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr-FR")
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug || slug === "." || slug === ".." || path.isAbsolute(slug))
    throw new Error("Le nom du jeu ne permet pas de créer un dossier sûr.");
  return slug;
}

export function humanizeSlug(slug) {
  return slug
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("fr-FR"));
}

export function isSafeSlug(slug) {
  return (
    typeof slug === "string" &&
    slug === slugifyGame(slug) &&
    !slug.includes("..") &&
    !path.isAbsolute(slug)
  );
}

export function assertInside(parent, candidate) {
  const parentPath = path.resolve(parent);
  const candidatePath = path.resolve(candidate);
  if (
    candidatePath !== parentPath &&
    !candidatePath.startsWith(`${parentPath}${path.sep}`)
  )
    throw new Error("Chemin refusé : sortie du dossier de galerie.");
  return candidatePath;
}

export function findGame(manifest, title) {
  const wanted = normalizeGameKey(title);
  return manifest.games.find(
    (game) =>
      normalizeGameKey(game.title) === wanted ||
      normalizeGameKey(game.slug) === wanted,
  );
}

export function nextSceneNumber(gameOrScenes) {
  const scenes = Array.isArray(gameOrScenes)
    ? gameOrScenes
    : (gameOrScenes?.scenes ?? []);
  return (
    scenes.reduce(
      (maximum, scene) => Math.max(maximum, Number(scene.number) || 0),
      0,
    ) + 1
  );
}

export function ratiosCompatible(first, second, tolerance = 0.01) {
  if (!first?.width || !first?.height || !second?.width || !second?.height)
    return false;
  const left = first.width / first.height;
  const right = second.width / second.height;
  return Math.abs(left - right) / left <= tolerance;
}

export function validateManifest(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value))
    return {
      ok: false,
      errors: ["La racine du manifeste doit être un objet."],
    };
  if (value.version !== MANIFEST_VERSION)
    errors.push(`Version attendue : ${MANIFEST_VERSION}.`);
  if (
    typeof value.updatedAt !== "string" ||
    Number.isNaN(Date.parse(value.updatedAt))
  )
    errors.push("updatedAt doit être une date ISO valide.");
  if (!Array.isArray(value.games)) errors.push("games doit être un tableau.");
  else {
    const slugs = new Set();
    const gameOrders = new Set();
    for (const game of value.games) {
      if (!game || typeof game !== "object") {
        errors.push("Chaque jeu doit être un objet.");
        continue;
      }
      if (!isSafeSlug(game.slug))
        errors.push(`Slug de jeu invalide : ${String(game.slug)}.`);
      if (slugs.has(game.slug)) errors.push(`Jeu en double : ${game.slug}.`);
      slugs.add(game.slug);
      if (
        game.order !== undefined &&
        (!Number.isInteger(game.order) || game.order < 1)
      )
        errors.push(`Ordre de jeu invalide : ${game.slug}.`);
      if (game.order !== undefined && gameOrders.has(game.order))
        errors.push(`Ordre de jeu en double : ${game.order}.`);
      if (game.order !== undefined) gameOrders.add(game.order);
      if (typeof game.title !== "string" || !game.title.trim())
        errors.push(`Titre manquant pour ${game.slug}.`);
      if (!Array.isArray(game.scenes)) {
        errors.push(`Scènes invalides pour ${game.slug}.`);
        continue;
      }
      const numbers = new Set();
      const orders = new Set();
      for (const scene of game.scenes) {
        if (
          !Number.isInteger(scene?.number) ||
          scene.number < 1 ||
          scene.number > 999
        )
          errors.push(`Numéro invalide dans ${game.slug}.`);
        if (numbers.has(scene?.number))
          errors.push(`Numéro en double dans ${game.slug} : ${scene?.number}.`);
        numbers.add(scene?.number);
        if (
          scene?.order !== undefined &&
          (!Number.isInteger(scene.order) || scene.order < 1)
        )
          errors.push(`Ordre invalide dans ${game.slug} #${scene?.number}.`);
        if (scene?.order !== undefined && orders.has(scene.order))
          errors.push(`Ordre en double dans ${game.slug} : ${scene.order}.`);
        if (scene?.order !== undefined) orders.add(scene.order);
        const prefix = `/gallery/${game.slug}/${String(scene?.number).padStart(3, "0")}`;
        for (const [key, suffix] of [
          ["original", "-original.webp"],
          ["remaster", "-remaster.webp"],
          ["thumbnail", "-thumbnail.webp"],
        ]) {
          if (scene?.[key] !== `${prefix}${suffix}`)
            errors.push(
              `Chemin ${key} invalide pour ${game.slug} #${scene?.number}.`,
            );
        }
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

export async function readManifest(manifestPath, { allowMissing = true } = {}) {
  try {
    const parsed = JSON.parse(await readFile(manifestPath, "utf8"));
    const validation = validateManifest(parsed);
    if (!validation.ok) throw new Error(validation.errors.join(" "));
    return parsed;
  } catch (error) {
    if (allowMissing && error?.code === "ENOENT") return emptyManifest();
    throw new Error(
      `Manifeste invalide : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function sortManifest(manifest) {
  const existingPositions = new Map(
    manifest.games.map((game, index) => [game.slug, index + 1]),
  );
  manifest.games.sort(
    (a, b) =>
      (a.order ?? existingPositions.get(a.slug)) -
        (b.order ?? existingPositions.get(b.slug)) ||
      a.title.localeCompare(b.title, "fr", { sensitivity: "base" }),
  );
  for (const game of manifest.games)
    game.scenes.sort(
      (a, b) =>
        (a.order ?? a.number) - (b.order ?? b.number) || a.number - b.number,
    );
  return manifest;
}

export function applyGameOrder(manifest, slugs) {
  if (
    !Array.isArray(slugs) ||
    slugs.length !== manifest.games.length ||
    new Set(slugs).size !== slugs.length ||
    slugs.some(
      (slug) =>
        typeof slug !== "string" ||
        !manifest.games.some((game) => game.slug === slug),
    )
  )
    throw new Error("La liste d’ordre ne correspond pas aux jeux.");
  const positions = new Map(slugs.map((slug, index) => [slug, index + 1]));
  for (const game of manifest.games) game.order = positions.get(game.slug);
  manifest.games.sort((a, b) => a.order - b.order);
  return manifest;
}

export function applySceneOrder(game, numbers) {
  if (!game || !Array.isArray(game.scenes)) throw new Error("Jeu introuvable.");
  if (
    !Array.isArray(numbers) ||
    numbers.length !== game.scenes.length ||
    new Set(numbers).size !== numbers.length ||
    numbers.some(
      (number) =>
        !Number.isInteger(number) ||
        !game.scenes.some((scene) => scene.number === number),
    )
  )
    throw new Error("La liste d’ordre ne correspond pas aux scènes du jeu.");
  const positions = new Map(
    numbers.map((number, index) => [number, index + 1]),
  );
  for (const scene of game.scenes) scene.order = positions.get(scene.number);
  game.scenes.sort((a, b) => a.order - b.order);
  return game;
}

export async function writeManifestAtomic(manifestPath, manifest) {
  const validation = validateManifest(manifest);
  if (!validation.ok) throw new Error(validation.errors.join(" "));
  await mkdir(path.dirname(manifestPath), { recursive: true });
  const temporary = `${manifestPath}.${process.pid}.${Date.now()}.tmp`;
  const backup = `${manifestPath}.bak`;
  let hadPrevious = false;
  try {
    await access(manifestPath);
    hadPrevious = true;
    await copyFile(manifestPath, backup);
  } catch {}
  try {
    await writeFile(
      temporary,
      `${JSON.stringify(sortManifest(manifest), null, 2)}\n`,
      { encoding: "utf8", flag: "wx" },
    );
    await rename(temporary, manifestPath);
    if (hadPrevious) await rm(backup, { force: true });
  } catch (error) {
    await rm(temporary, { force: true });
    if (hadPrevious) await copyFile(backup, manifestPath).catch(() => {});
    throw error;
  }
}

export async function scanGallery(galleryDir) {
  const games = [];
  const issues = [];
  await mkdir(galleryDir, { recursive: true });
  for (const entry of await readdir(galleryDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!isSafeSlug(entry.name)) {
      issues.push(`Dossier de jeu invalide : ${entry.name}.`);
      continue;
    }
    const byNumber = new Map();
    for (const file of await readdir(path.join(galleryDir, entry.name), {
      withFileTypes: true,
    })) {
      if (!file.isFile()) continue;
      const match = file.name.match(SCENE_FILE);
      if (!match) {
        issues.push(`Fichier non reconnu : ${entry.name}/${file.name}.`);
        continue;
      }
      const number = Number(match[1]);
      if (number < 1) {
        issues.push(`Numéro invalide : ${entry.name}/${file.name}.`);
        continue;
      }
      const record = byNumber.get(number) ?? {};
      if (record[match[2]])
        issues.push(`Doublon ${match[2]} : ${entry.name} #${match[1]}.`);
      record[match[2]] = file.name;
      byNumber.set(number, record);
    }
    if (!byNumber.size) issues.push(`Dossier sans scène : ${entry.name}.`);
    const scenes = [];
    for (const [number, files] of [...byNumber.entries()].sort(
      (a, b) => a[0] - b[0],
    )) {
      const missing = ["original", "remaster", "thumbnail"].filter(
        (kind) => !files[kind],
      );
      if (missing.length) {
        issues.push(
          `Scène incomplète : ${entry.name} #${String(number).padStart(3, "0")} (${missing.join(", ")} manquant).`,
        );
        continue;
      }
      const prefix = `/gallery/${entry.name}/${String(number).padStart(3, "0")}`;
      scenes.push({
        number,
        original: `${prefix}-original.webp`,
        remaster: `${prefix}-remaster.webp`,
        thumbnail: `${prefix}-thumbnail.webp`,
      });
    }
    games.push({ slug: entry.name, scenes });
  }
  return { games, issues };
}

export async function filesExistForScene(root, scene) {
  const paths = [scene.original, scene.remaster, scene.thumbnail].map((url) =>
    assertInside(
      path.join(root, "public", "gallery"),
      path.join(
        root,
        "public",
        url.replace(/^\//, "").replace(/^gallery[\\/]/, "gallery/"),
      ),
    ),
  );
  return Promise.all(
    paths.map(async (file) => {
      try {
        return (await stat(file)).isFile();
      } catch {
        return false;
      }
    }),
  );
}

export function allowedGalleryGitPath(file) {
  const normalized = String(file).replaceAll("\\", "/").replace(/^\.\//, "");
  return (
    normalized === "data/gallery.json" ||
    normalized.startsWith("public/gallery/")
  );
}

function comparableScene(game, scene, gameIndex, sceneIndex) {
  return {
    title: game.title,
    gameOrder: game.order ?? gameIndex + 1,
    aiTool: scene.aiTool || "",
    order: scene.order ?? sceneIndex + 1,
    original: scene.original,
    remaster: scene.remaster,
    thumbnail: scene.thumbnail,
    width: scene.width || 0,
    height: scene.height || 0,
  };
}

export function classifyGalleryScenes(
  manifest,
  onlineManifest,
  changedPaths = [],
) {
  const onlineById = new Map(
    (onlineManifest?.games || []).flatMap((game, gameIndex) =>
      game.scenes.map((scene, index) => [
        `${game.slug}:${scene.number}`,
        { game, scene, gameIndex, index },
      ]),
    ),
  );
  const changed = changedPaths.map((file) =>
    String(file).replaceAll("\\", "/").replace(/^\.\//, ""),
  );
  const pending = [];
  const published = [];
  for (const [gameIndex, game] of manifest.games.entries()) {
    for (const [index, scene] of game.scenes.entries()) {
      const online = onlineById.get(`${game.slug}:${scene.number}`);
      const item = {
        ...scene,
        slug: game.slug,
        title: game.title,
        gameOrder: game.order ?? gameIndex + 1,
        order: scene.order ?? index + 1,
        wasPublished: Boolean(online),
      };
      const prefix = `public/gallery/${game.slug}/${String(scene.number).padStart(3, "0")}-`;
      const imageChanged = changed.some((file) => file.startsWith(prefix));
      const metadataChanged =
        !online ||
        JSON.stringify(comparableScene(game, scene, gameIndex, index)) !==
          JSON.stringify(
            comparableScene(
              online.game,
              online.scene,
              online.gameIndex,
              online.index,
            ),
          );
      (imageChanged || metadataChanged ? pending : published).push(item);
    }
  }
  return { pending, published };
}

export function commitMessage(scenes) {
  if (scenes.length === 1)
    return `gallery: add ${scenes[0].title} scene ${String(scenes[0].number).padStart(3, "0")}`;
  return `gallery: add ${scenes.length} remastered scenes`;
}

export function gitPublishPrerequisite({
  installed,
  repository,
  hasCommit,
  hasOrigin,
}) {
  if (!installed)
    return "Git n’est pas installé ou n’est pas accessible depuis le terminal.";
  if (!repository)
    return "Le projet n’est pas encore initialisé comme dépôt Git.";
  if (!hasCommit)
    return "Le dépôt ne contient aucun commit initial. Créez le premier commit avant de publier depuis le studio.";
  if (!hasOrigin) return "Aucun remote Git « origin » n’est configuré.";
  return "";
}
