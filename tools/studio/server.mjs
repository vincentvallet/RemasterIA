import { createServer } from "node:http";
import { Readable } from "node:stream";
import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  access,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import open from "open";
import { orientedSize, processImages } from "./image-processing.mjs";
import {
  allowedGalleryGitPath,
  applyGameOrder,
  applySceneOrder,
  assertInside,
  classifyGalleryScenes,
  commitMessage,
  emptyManifest,
  findGame,
  nextSceneNumber,
  gitPublishPrerequisite,
  normalizeGameKey,
  readManifest,
  ratiosCompatible,
  slugifyGame,
  validateManifest,
  writeManifestAtomic,
} from "../gallery/core.mjs";

const exec = promisify(execFile);
const root = process.cwd();
try {
  const localEnv = await readFile(path.join(root, ".env.local"), "utf8");
  for (const line of localEnv.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
    process.env[match[1]] = value;
  }
} catch (error) {
  if (error?.code !== "ENOENT")
    console.warn("Le fichier .env.local n’a pas pu être lu.");
}
const studioDir = path.join(root, "tools", "studio");
const galleryDir = path.join(root, "public", "gallery");
const manifestPath = path.join(root, "data", "gallery.json");
const sessionToken = randomBytes(32).toString("hex");
const maxUploadBytes =
  Math.max(1, Number(process.env.STUDIO_MAX_FILE_MB) || 30) * 1024 * 1024;
const allowedFormats = new Set(["jpeg", "png", "webp", "avif", "tiff"]);
const localHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
const portStart = Number(process.env.STUDIO_PORT) || 4174;

function json(response, status, value) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(value));
}

function localRequest(request) {
  const host = String(request.headers.host || "")
    .split(":")[0]
    .toLocaleLowerCase();
  if (!localHosts.has(host)) return false;
  const remote = request.socket.remoteAddress || "";
  return (
    remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1"
  );
}

function authorized(request) {
  if (
    request.url?.startsWith("/api/") &&
    request.headers["x-studio-token"] !== sessionToken
  )
    return false;
  const origin = request.headers.origin;
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (!localHosts.has(parsed.hostname.toLocaleLowerCase())) return false;
    } catch {
      return false;
    }
  }
  return true;
}

async function command(args, options = {}) {
  return exec("git", args, {
    cwd: root,
    windowsHide: true,
    maxBuffer: 1024 * 1024,
    ...options,
  });
}

async function gitState(manifest) {
  try {
    const [{ stdout: branch }, { stdout: status }, remote, upstream] =
      await Promise.all([
        command(["branch", "--show-current"]),
        command(["status", "--porcelain=v1", "--untracked-files=all"]),
        command(["remote", "get-url", "origin"]).catch(() => ({ stdout: "" })),
        command([
          "rev-parse",
          "--abbrev-ref",
          "--symbolic-full-name",
          "@{upstream}",
        ]).catch(() => ({ stdout: "" })),
      ]);
    const changed = status.split(/\r?\n/).filter(Boolean);
    let upstreamRef = upstream.stdout.trim();
    if (!upstreamRef && remote.stdout.trim() && branch.trim()) {
      const originBranch = `refs/remotes/origin/${branch.trim()}`;
      upstreamRef = await command(["rev-parse", "--verify", originBranch])
        .then(() => originBranch)
        .catch(() => "");
    }
    let onlineManifest = emptyManifest();
    let changedFromOnline = [];
    if (upstreamRef) {
      const onlineJson = await command([
        "show",
        `${upstreamRef}:data/gallery.json`,
      ]).catch(() => null);
      if (onlineJson?.stdout) {
        const parsed = JSON.parse(onlineJson.stdout);
        if (validateManifest(parsed).ok) onlineManifest = parsed;
      }
      const diff = await command([
        "diff",
        "--name-only",
        upstreamRef,
        "--",
        "public/gallery",
        "data/gallery.json",
      ]).catch(() => ({ stdout: "" }));
      changedFromOnline = diff.stdout.split(/\r?\n/).filter(Boolean);
    }
    const changedPaths = [
      ...changed.map((line) => line.slice(3).replaceAll("\\", "/")),
      ...changedFromOnline,
    ];
    const classified = classifyGalleryScenes(
      manifest,
      onlineManifest,
      changedPaths,
    );
    const withSizes = async (scenes) =>
      Promise.all(
        scenes.map(async (scene) => {
          const totalBytes = (
            await Promise.all(
              [scene.original, scene.remaster, scene.thumbnail].map(
                async (url) => {
                  try {
                    return (
                      await stat(
                        path.join(root, "public", url.replace(/^\//, "")),
                      )
                    ).size;
                  } catch {
                    return 0;
                  }
                },
              ),
            )
          ).reduce((sum, size) => sum + size, 0);
          return { ...scene, totalBytes };
        }),
      );
    const [pending, published] = await Promise.all([
      withSizes(classified.pending),
      withSizes(classified.published),
    ]);
    return {
      installed: true,
      repository: true,
      branch: branch.trim() || "(aucune)",
      remote: remote.stdout.trim(),
      changed: changed.length,
      pending,
      published,
    };
  } catch (error) {
    return {
      installed: error?.code !== "ENOENT",
      repository: false,
      branch: "",
      remote: "",
      changed: 0,
      pending: [],
      published: [],
    };
  }
}

async function state() {
  const manifest = await readManifest(manifestPath);
  const games = manifest.games.map((game) => ({
    slug: game.slug,
    title: game.title,
    nextNumber: nextSceneNumber(game),
  }));
  return {
    manifest,
    games,
    git: await gitState(manifest),
    publicSiteUrl: process.env.NEXT_PUBLIC_SITE_URL || "",
  };
}

async function parseForm(request) {
  const length = Number(request.headers["content-length"] || 0);
  if (length > maxUploadBytes * 2 + 1024 * 1024)
    throw Object.assign(
      new Error("Les fichiers envoyés sont trop volumineux."),
      { status: 413 },
    );
  const webRequest = new Request(`http://127.0.0.1${request.url}`, {
    method: request.method,
    headers: request.headers,
    body: Readable.toWeb(request),
    duplex: "half",
  });
  return webRequest.formData();
}

async function parseJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024)
      throw Object.assign(new Error("Requête trop volumineuse."), {
        status: 413,
      });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Corps JSON invalide.");
  }
}

function adaptationMode(form) {
  const mode = String(form.get("adapt") || "none");
  if (!["none", "remaster", "original", "balanced"].includes(mode))
    throw new Error("Mode d’adaptation invalide.");
  return mode;
}

async function fileBuffer(form, name) {
  const file = form.get(name);
  if (!(file instanceof File) || !file.size)
    throw new Error(
      `L’image ${name === "original" ? "originale" : "remasterisée"} est obligatoire.`,
    );
  if (file.size > maxUploadBytes)
    throw Object.assign(
      new Error(
        `Chaque image doit peser au maximum ${Math.round(maxUploadBytes / 1024 / 1024)} Mo.`,
      ),
      { status: 413 },
    );
  const buffer = Buffer.from(await file.arrayBuffer());
  let metadata;
  try {
    metadata = await sharp(buffer, {
      animated: true,
      failOn: "error",
    }).metadata();
  } catch {
    throw new Error(
      "Le fichier est corrompu ou n’est pas une image prise en charge.",
    );
  }
  if (!allowedFormats.has(metadata.format) || (metadata.pages || 1) > 1)
    throw new Error(
      "Format refusé. Utilisez JPEG, PNG, WebP, AVIF ou TIFF non animé.",
    );
  const mimeFormats = {
    "image/jpeg": "jpeg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/tiff": "tiff",
  };
  if (file.type && mimeFormats[file.type] !== metadata.format)
    throw new Error(
      "Le type MIME annoncé ne correspond pas au contenu réel du fichier.",
    );
  return { buffer, metadata, inputBytes: file.size };
}

async function optionalFileBuffer(form, name) {
  const file = form.get(name);
  return file instanceof File && file.size ? fileBuffer(form, name) : null;
}

async function imageBufferFromDisk(url) {
  const buffer = await readFile(
    path.join(root, "public", url.replace(/^\//, "")),
  );
  return {
    buffer,
    metadata: await sharp(buffer).metadata(),
    inputBytes: buffer.length,
  };
}

async function addScene(request) {
  const form = await parseForm(request);
  const title = String(form.get("title") || "")
    .trim()
    .replace(/\s+/g, " ");
  const aiTool = String(form.get("aiTool") || "")
    .trim()
    .slice(0, 80);
  const adapt = adaptationMode(form);
  if (!title || title.length > 100)
    throw new Error("Saisissez un nom de jeu valide (100 caractères maximum).");
  const [original, remaster] = await Promise.all([
    fileBuffer(form, "original"),
    fileBuffer(form, "remaster"),
  ]);
  const compatible = ratiosCompatible(
    orientedSize(original.metadata),
    orientedSize(remaster.metadata),
  );
  const processed = await processImages(
    original,
    remaster,
    compatible ? "none" : adapt,
  );
  const manifest = await readManifest(manifestPath);
  let game = findGame(manifest, title);
  if (!game) {
    const wanted = normalizeGameKey(title);
    const diskCollision = manifest.games.find(
      (candidate) => normalizeGameKey(candidate.slug) === wanted,
    );
    game = diskCollision || {
      slug: slugifyGame(title),
      title,
      order:
        manifest.games.reduce(
          (maximum, candidate, index) =>
            Math.max(maximum, candidate.order ?? index + 1),
          0,
        ) + 1,
      scenes: [],
    };
    if (!diskCollision) manifest.games.push(game);
  }
  const number = nextSceneNumber(game);
  if (number > 999)
    throw new Error("Ce jeu a atteint la limite de 999 scènes.");
  const prefix = String(number).padStart(3, "0");
  const destinationDir = assertInside(
    galleryDir,
    path.join(galleryDir, game.slug),
  );
  await mkdir(destinationDir, { recursive: true });
  const finals = {
    original: path.join(destinationDir, `${prefix}-original.webp`),
    remaster: path.join(destinationDir, `${prefix}-remaster.webp`),
    thumbnail: path.join(destinationDir, `${prefix}-thumbnail.webp`),
  };
  for (const file of Object.values(finals)) {
    try {
      await access(file);
      throw new Error(`La scène #${prefix} existe déjà. Rechargez le studio.`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const temporary = Object.fromEntries(
    Object.entries(finals).map(([key, file]) => [
      key,
      `${file}.${process.pid}.${Date.now()}.tmp`,
    ]),
  );
  const finalized = [];
  try {
    await Promise.all([
      writeFile(temporary.original, processed.originalOutput.data, {
        flag: "wx",
      }),
      writeFile(temporary.remaster, processed.remasterOutput.data, {
        flag: "wx",
      }),
      writeFile(temporary.thumbnail, processed.thumbnail.data, { flag: "wx" }),
    ]);
    for (const key of ["original", "remaster", "thumbnail"]) {
      await rename(temporary[key], finals[key]);
      finalized.push(finals[key]);
    }
    const now = new Date().toISOString();
    game.scenes.push({
      id: `${game.slug}-${prefix}`,
      number,
      order:
        game.scenes.reduce(
          (maximum, scene, index) =>
            Math.max(maximum, scene.order ?? index + 1),
          0,
        ) + 1,
      original: `/gallery/${game.slug}/${prefix}-original.webp`,
      remaster: `/gallery/${game.slug}/${prefix}-remaster.webp`,
      thumbnail: `/gallery/${game.slug}/${prefix}-thumbnail.webp`,
      ...(aiTool ? { aiTool } : {}),
      createdAt: now,
      width: processed.originalOutput.info.width,
      height: processed.originalOutput.info.height,
    });
    manifest.updatedAt = now;
    try {
      await writeManifestAtomic(manifestPath, manifest);
    } catch (error) {
      for (const file of finalized) await rm(file, { force: true });
      throw error;
    }
    return {
      game: { slug: game.slug, title: game.title },
      number,
      compatible,
      stats: {
        original: {
          before: original.inputBytes,
          after: processed.originalOutput.data.length,
          input: processed.originalInput,
          output: processed.originalOutput.info,
          quality: processed.originalOutput.quality,
        },
        remaster: {
          before: remaster.inputBytes,
          after: processed.remasterOutput.data.length,
          input: processed.remasterInput,
          output: processed.remasterOutput.info,
          quality: processed.remasterOutput.quality,
        },
        thumbnail: {
          after: processed.thumbnail.data.length,
          output: processed.thumbnail.info,
        },
        warning:
          processed.originalOutput.warning || processed.remasterOutput.warning,
      },
    };
  } catch (error) {
    for (const file of finalized)
      await rm(file, { force: true }).catch(() => {});
    throw error;
  } finally {
    for (const file of Object.values(temporary))
      await rm(file, { force: true }).catch(() => {});
  }
}

async function editScene(request, slug, number) {
  slug = slugifyGame(slug);
  if (!Number.isInteger(number) || number < 1 || number > 999)
    throw new Error("Numéro de scène invalide.");
  const form = await parseForm(request);
  const title = String(form.get("title") || "")
    .trim()
    .replace(/\s+/g, " ");
  const aiTool = String(form.get("aiTool") || "")
    .trim()
    .slice(0, 80);
  const adapt = adaptationMode(form);
  if (!title || title.length > 100)
    throw new Error("Saisissez un nom de jeu valide (100 caractères maximum).");
  const manifest = await readManifest(manifestPath);
  const game = manifest.games.find((candidate) => candidate.slug === slug);
  const scene = game?.scenes.find((candidate) => candidate.number === number);
  if (!game || !scene)
    throw Object.assign(new Error("Scène introuvable."), { status: 404 });
  const collision = manifest.games.find(
    (candidate) =>
      candidate !== game &&
      normalizeGameKey(candidate.title) === normalizeGameKey(title),
  );
  if (collision)
    throw new Error(
      "Ce titre appartient déjà à un autre jeu. Modifiez plutôt sa scène correspondante.",
    );

  const [newOriginal, newRemaster] = await Promise.all([
    optionalFileBuffer(form, "original"),
    optionalFileBuffer(form, "remaster"),
  ]);
  let processed = null;
  let compatible = true;
  const finals = {
    original: path.join(root, "public", scene.original.replace(/^\//, "")),
    remaster: path.join(root, "public", scene.remaster.replace(/^\//, "")),
    thumbnail: path.join(root, "public", scene.thumbnail.replace(/^\//, "")),
  };
  const backups = {};
  const temporary = {};
  const backedUp = [];
  try {
    if (newOriginal || newRemaster || adapt !== "none") {
      const originalInput =
        newOriginal || (await imageBufferFromDisk(scene.original));
      const remasterInput =
        newRemaster || (await imageBufferFromDisk(scene.remaster));
      compatible = ratiosCompatible(
        orientedSize(originalInput.metadata),
        orientedSize(remasterInput.metadata),
      );
      processed = await processImages(
        originalInput,
        remasterInput,
        compatible ? "none" : adapt,
      );
      const stamp = `${process.pid}.${Date.now()}`;
      for (const key of Object.keys(finals)) {
        temporary[key] = `${finals[key]}.${stamp}.tmp`;
        backups[key] = `${finals[key]}.${stamp}.bak`;
      }
      await Promise.all([
        writeFile(temporary.original, processed.originalOutput.data, {
          flag: "wx",
        }),
        writeFile(temporary.remaster, processed.remasterOutput.data, {
          flag: "wx",
        }),
        writeFile(temporary.thumbnail, processed.thumbnail.data, {
          flag: "wx",
        }),
      ]);
      for (const key of ["original", "remaster", "thumbnail"]) {
        await rename(finals[key], backups[key]);
        backedUp.push(key);
        await rename(temporary[key], finals[key]);
      }
      scene.width = processed.originalOutput.info.width;
      scene.height = processed.originalOutput.info.height;
    }
    game.title = title;
    if (aiTool) scene.aiTool = aiTool;
    else delete scene.aiTool;
    manifest.updatedAt = new Date().toISOString();
    await writeManifestAtomic(manifestPath, manifest);
    await Promise.all(
      Object.values(backups).map((file) => rm(file, { force: true })),
    );
    return {
      game: { slug: game.slug, title: game.title },
      number,
      compatible,
      imagesChanged: Boolean(processed),
    };
  } catch (error) {
    for (const key of backedUp.reverse()) {
      await rm(finals[key], { force: true }).catch(() => {});
      await rename(backups[key], finals[key]).catch(() => {});
    }
    throw error;
  } finally {
    await Promise.all(
      Object.values(temporary).map((file) =>
        rm(file, { force: true }).catch(() => {}),
      ),
    );
  }
}

async function reorderGame(request, slug) {
  slug = slugifyGame(slug);
  const body = await parseJson(request);
  const manifest = await readManifest(manifestPath);
  const game = manifest.games.find((candidate) => candidate.slug === slug);
  if (!game)
    throw Object.assign(new Error("Jeu introuvable."), { status: 404 });
  const currentOrder = game.scenes.map((scene) => scene.number);
  if (
    Array.isArray(body.numbers) &&
    body.numbers.length === currentOrder.length &&
    body.numbers.every((number, index) => number === currentOrder[index])
  )
    return { ok: true, slug, order: currentOrder, unchanged: true };
  applySceneOrder(game, body.numbers);
  manifest.updatedAt = new Date().toISOString();
  await writeManifestAtomic(manifestPath, manifest);
  return {
    ok: true,
    slug,
    order: game.scenes.map((scene) => scene.number),
  };
}

async function reorderGames(request) {
  const body = await parseJson(request);
  const manifest = await readManifest(manifestPath);
  const currentOrder = manifest.games.map((game) => game.slug);
  if (
    Array.isArray(body.slugs) &&
    body.slugs.length === currentOrder.length &&
    body.slugs.every((slug, index) => slug === currentOrder[index])
  )
    return { ok: true, order: currentOrder, unchanged: true };
  applyGameOrder(manifest, body.slugs);
  manifest.updatedAt = new Date().toISOString();
  await writeManifestAtomic(manifestPath, manifest);
  return { ok: true, order: manifest.games.map((game) => game.slug) };
}

async function removeScene(slug, number) {
  slug = slugifyGame(slug);
  if (!Number.isInteger(number) || number < 1 || number > 999)
    throw new Error("Numéro de scène invalide.");
  const manifest = await readManifest(manifestPath);
  const game = manifest.games.find((candidate) => candidate.slug === slug);
  const scene = game?.scenes.find((candidate) => candidate.number === number);
  if (!scene)
    throw Object.assign(new Error("Scène introuvable."), { status: 404 });
  const relativeFiles = [scene.original, scene.remaster, scene.thumbnail].map(
    (url) => `public/${url.replace(/^\//, "")}`,
  );
  for (const file of relativeFiles) {
    const tracked = await command(["ls-files", "--error-unmatch", "--", file])
      .then(() => true)
      .catch(() => false);
    if (tracked)
      throw new Error(
        "Cette création est déjà suivie par Git et ne peut pas être retirée depuis le studio.",
      );
  }
  const backups = [];
  try {
    for (const relative of relativeFiles) {
      const file = assertInside(galleryDir, path.join(root, relative));
      const backup = `${file}.remove-${sessionToken.slice(0, 8)}`;
      await rename(file, backup);
      backups.push([file, backup]);
    }
    game.scenes = game.scenes.filter(
      (candidate) => candidate.number !== number,
    );
    if (!game.scenes.length)
      manifest.games = manifest.games.filter(
        (candidate) => candidate.slug !== slug,
      );
    else
      applySceneOrder(
        game,
        game.scenes.map((candidate) => candidate.number),
      );
    if (manifest.games.length)
      applyGameOrder(
        manifest,
        manifest.games.map((candidate) => candidate.slug),
      );
    manifest.updatedAt = new Date().toISOString();
    await writeManifestAtomic(manifestPath, manifest);
    for (const [, backup] of backups) await rm(backup, { force: true });
  } catch (error) {
    for (const [file, backup] of backups.reverse())
      await rename(backup, file).catch(() => {});
    throw error;
  }
}

async function publish() {
  const installed = await exec("git", ["--version"], { windowsHide: true })
    .then(() => true)
    .catch(() => false);
  const repository =
    installed &&
    (await command(["rev-parse", "--is-inside-work-tree"])
      .then(() => true)
      .catch(() => false));
  const hasCommit =
    repository &&
    (await command(["rev-parse", "--verify", "HEAD"])
      .then(() => true)
      .catch(() => false));
  const remote = await command(["remote", "get-url", "origin"]).catch(
    () => null,
  );
  const prerequisiteError = gitPublishPrerequisite({
    installed,
    repository,
    hasCommit,
    hasOrigin: Boolean(remote?.stdout.trim()),
  });
  if (prerequisiteError) throw new Error(prerequisiteError);
  for (const marker of ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD"]) {
    const active = await command(["rev-parse", "--git-path", marker]).then(
      async ({ stdout }) =>
        access(path.resolve(root, stdout.trim()))
          .then(() => true)
          .catch(() => false),
    );
    if (active)
      throw new Error(
        "Une opération Git conflictuelle est en cours. Terminez-la avant de publier.",
      );
  }
  const cachedBefore = (
    await command(["diff", "--cached", "--name-only"])
  ).stdout
    .split(/\r?\n/)
    .filter(Boolean);
  const foreign = cachedBefore.filter((file) => !allowedGalleryGitPath(file));
  if (foreign.length)
    throw new Error(
      "Des fichiers extérieurs à la galerie sont déjà préparés dans Git. Publiez-les ou retirez-les de l’index avant de continuer.",
    );
  const manifest = await readManifest(manifestPath);
  const validation = validateManifest(manifest);
  if (!validation.ok) throw new Error(validation.errors.join(" "));
  const git = await gitState(manifest);
  if (!git.pending.length)
    throw new Error("Aucune nouvelle création à publier.");
  await command(["add", "--", "public/gallery", "data/gallery.json"]);
  const cached = (await command(["diff", "--cached", "--name-only"])).stdout
    .split(/\r?\n/)
    .filter(Boolean);
  if (!cached.length || cached.some((file) => !allowedGalleryGitPath(file)))
    throw new Error(
      "La préparation Git contient des fichiers inattendus ; publication interrompue.",
    );
  await command(["commit", "-m", commitMessage(git.pending)]);
  const hash = (await command(["rev-parse", "--short", "HEAD"])).stdout.trim();
  const branch = (await command(["branch", "--show-current"])).stdout.trim();
  try {
    await command(["push", "origin", "HEAD"]);
  } catch (error) {
    const message = `${error.stderr || ""} ${error.stdout || ""}`;
    if (/non-fast-forward|fetch first|rejected/i.test(message))
      throw new Error(
        "Le dépôt distant contient de nouvelles modifications. Récupérez-les avec « git pull --rebase » avant de publier.",
      );
    if (/auth|permission denied|could not read|403/i.test(message))
      throw new Error(
        "GitHub a refusé le push. Vérifiez que ce dépôt est connecté à votre compte GitHub sur cet ordinateur.",
      );
    throw new Error(
      `Le push Git a échoué : ${message.trim() || error.message}`,
    );
  }
  return {
    hash,
    branch,
    count: git.pending.length,
    date: new Date().toISOString(),
    steps: [
      "Galerie vérifiée",
      "Images préparées",
      "Fichiers ajoutés à Git",
      "Commit créé",
      "Push GitHub terminé",
    ],
  };
}

async function serveFile(response, file, type) {
  try {
    const body = await readFile(file);
    response.writeHead(200, {
      "content-type": type,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    response.end(body);
  } catch {
    json(response, 404, { error: "Fichier introuvable." });
  }
}

const server = createServer(async (request, response) => {
  try {
    if (!localRequest(request))
      return json(response, 403, {
        error: "Le studio est accessible uniquement depuis cet ordinateur.",
      });
    if (!authorized(request))
      return json(response, 403, {
        error: "Origine ou session locale refusée.",
      });
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/") {
      const html = (
        await readFile(path.join(studioDir, "index.html"), "utf8")
      ).replace("__STUDIO_TOKEN__", sessionToken);
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "content-security-policy":
          "default-src 'self'; img-src 'self' blob: data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
      });
      return response.end(html);
    }
    if (request.method === "GET" && url.pathname === "/studio.css")
      return serveFile(
        response,
        path.join(studioDir, "studio.css"),
        "text/css; charset=utf-8",
      );
    if (request.method === "GET" && url.pathname === "/studio.js")
      return serveFile(
        response,
        path.join(studioDir, "studio.js"),
        "text/javascript; charset=utf-8",
      );
    if (request.method === "GET" && url.pathname.startsWith("/gallery/")) {
      const file = assertInside(
        galleryDir,
        path.join(root, "public", url.pathname.replace(/^\//, "")),
      );
      return serveFile(response, file, "image/webp");
    }
    if (request.method === "GET" && url.pathname === "/api/state")
      return json(response, 200, await state());
    if (request.method === "POST" && url.pathname === "/api/scenes")
      return json(response, 201, await addScene(request));
    if (
      request.method === "PUT" &&
      url.pathname.match(/^\/api\/scenes\/[^/]+\/\d+$/)
    ) {
      const [, , , slug, rawNumber] = url.pathname.split("/");
      return json(
        response,
        200,
        await editScene(request, slug, Number(rawNumber)),
      );
    }
    if (
      request.method === "PUT" &&
      url.pathname.match(/^\/api\/games\/[^/]+\/order$/)
    ) {
      const [, , , slug] = url.pathname.split("/");
      return json(response, 200, await reorderGame(request, slug));
    }
    if (request.method === "PUT" && url.pathname === "/api/games/order")
      return json(response, 200, await reorderGames(request));
    if (
      request.method === "DELETE" &&
      url.pathname.match(/^\/api\/scenes\/[^/]+\/\d+$/)
    ) {
      const [, , , slug, rawNumber] = url.pathname.split("/");
      await removeScene(slug, Number(rawNumber));
      return json(response, 200, { ok: true });
    }
    if (request.method === "POST" && url.pathname === "/api/publish")
      return json(response, 200, await publish());
    json(response, 404, { error: "Route inconnue." });
  } catch (error) {
    console.error(error);
    json(response, error.status || 400, {
      error: error instanceof Error ? error.message : "Erreur inattendue.",
    });
  }
});

async function listen(port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "127.0.0.1");
  });
}

let port = portStart;
for (; port < portStart + 20; port++) {
  try {
    await listen(port);
    break;
  } catch (error) {
    if (error.code !== "EADDRINUSE") throw error;
  }
}
if (!server.listening) throw new Error("Aucun port local disponible.");
const address = `http://127.0.0.1:${port}`;
console.log(`RemasterIA Studio est prêt : ${address}`);
if (process.env.STUDIO_NO_OPEN !== "1") await open(address);

export { address, server };
