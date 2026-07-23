import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
// The studio modules are deliberately plain ESM so Node can run them without a build step.
import {
  allowedGalleryGitPath,
  applyGameOrder,
  applySceneOrder,
  assertInside,
  classifyGalleryScenes,
  commitMessage,
  findGame,
  gitPublishPrerequisite,
  nextSceneNumber,
  normalizeGameKey,
  ratiosCompatible,
  readManifest,
  scanGallery,
  sortManifest,
  slugifyGame,
  // @ts-expect-error JavaScript studio module
} from "../../tools/gallery/core.mjs";
// @ts-expect-error JavaScript studio module
import { processImages } from "../../tools/studio/image-processing.mjs";
import { DiscordNotice } from "@/components/DiscordNotice";
import { siteConfig, VIBECODECLUB_URL } from "@/config/site";

const temporary: string[] = [];
async function tempDir() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "remasteria-"));
  temporary.push(directory);
  return directory;
}
afterEach(async () => {
  await Promise.all(
    temporary
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("normalisation des jeux", () => {
  it("rapproche accents, casse, espaces, tirets et underscores", () => {
    expect(normalizeGameKey("  Héart__of--DARKNESS ")).toBe("heartofdarkness");
    const manifest = {
      games: [
        { slug: "heart-of-darkness", title: "Heart of Darkness", scenes: [] },
      ],
    };
    expect(findGame(manifest, "héart_of darkness")).toBe(manifest.games[0]);
  });

  it("produit un slug stable et sûr", () => {
    expect(slugifyGame("  L’Épée  du Roi ")).toBe("lepee-du-roi");
    expect(() => slugifyGame("../")).toThrow();
    const root = path.resolve("gallery-test");
    expect(() =>
      assertInside(root, path.resolve(root, "..", "secret")),
    ).toThrow();
  });
});

describe("scènes et Git", () => {
  it("utilise le maximum existant et ne compte pas les fichiers", () => {
    expect(nextSceneNumber([{ number: 1 }, { number: 2 }, { number: 4 }])).toBe(
      5,
    );
  });

  it("applique et valide un ordre manuel à toutes les scènes d’un jeu", () => {
    const game = {
      slug: "test",
      title: "Test",
      scenes: [
        { number: 1, order: undefined as number | undefined },
        { number: 2, order: undefined as number | undefined },
        { number: 3, order: undefined as number | undefined },
      ],
    };
    applySceneOrder(game, [3, 1, 2]);
    expect(game.scenes.map((scene) => scene.number)).toEqual([3, 1, 2]);
    expect(game.scenes.map((scene) => scene.order)).toEqual([1, 2, 3]);
    expect(() => applySceneOrder(game, [1, 2])).toThrow();
  });

  it("réordonne les dossiers et conserve cet ordre dans le manifeste", () => {
    const manifest = {
      games: [
        {
          slug: "alpha",
          title: "Alpha",
          order: undefined as number | undefined,
          scenes: [],
        },
        {
          slug: "beta",
          title: "Beta",
          order: undefined as number | undefined,
          scenes: [],
        },
        {
          slug: "gamma",
          title: "Gamma",
          order: undefined as number | undefined,
          scenes: [],
        },
      ],
    };
    applyGameOrder(manifest, ["gamma", "alpha", "beta"]);
    expect(manifest.games.map((game) => game.slug)).toEqual([
      "gamma",
      "alpha",
      "beta",
    ]);
    expect(manifest.games.map((game) => game.order)).toEqual([1, 2, 3]);
    sortManifest(manifest);
    expect(manifest.games.map((game) => game.slug)).toEqual([
      "gamma",
      "alpha",
      "beta",
    ]);
  });

  it("filtre strictement les chemins et génère le message de commit", () => {
    expect(allowedGalleryGitPath("public/gallery/game/001-original.webp")).toBe(
      true,
    );
    expect(allowedGalleryGitPath("data/gallery.json")).toBe(true);
    expect(allowedGalleryGitPath(".env.local")).toBe(false);
    expect(commitMessage([{ title: "Another World", number: 4 }])).toBe(
      "gallery: add Another World scene 004",
    );
    expect(
      commitMessage([
        { title: "A", number: 1 },
        { title: "B", number: 2 },
      ]),
    ).toBe("gallery: add 2 remastered scenes");
  });

  it("refuse clairement un dépôt sans commit initial ou sans origin", () => {
    expect(
      gitPublishPrerequisite({
        installed: true,
        repository: true,
        hasCommit: false,
        hasOrigin: false,
      }),
    ).toContain("aucun commit initial");
    expect(
      gitPublishPrerequisite({
        installed: true,
        repository: true,
        hasCommit: true,
        hasOrigin: false,
      }),
    ).toContain("origin");
    expect(
      gitPublishPrerequisite({
        installed: true,
        repository: true,
        hasCommit: true,
        hasOrigin: true,
      }),
    ).toBe("");
  });

  it("valide les proportions avec une tolérance de 1 %", () => {
    expect(
      ratiosCompatible(
        { width: 1920, height: 1080 },
        { width: 1280, height: 720 },
      ),
    ).toBe(true);
    expect(
      ratiosCompatible(
        { width: 1920, height: 1080 },
        { width: 1000, height: 1000 },
      ),
    ).toBe(false);
  });

  it("sépare les scènes en ligne des modifications à republier", () => {
    const online = {
      version: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
      games: [
        {
          slug: "another-world",
          title: "Another World",
          scenes: [
            {
              number: 1,
              original: "/gallery/another-world/001-original.webp",
              remaster: "/gallery/another-world/001-remaster.webp",
              thumbnail: "/gallery/another-world/001-thumbnail.webp",
            },
            {
              number: 2,
              original: "/gallery/another-world/002-original.webp",
              remaster: "/gallery/another-world/002-remaster.webp",
              thumbnail: "/gallery/another-world/002-thumbnail.webp",
              aiTool: "ChatGPT",
            },
          ],
        },
      ],
    };
    const local = structuredClone(online);
    local.games[0].scenes[1].aiTool = "Gemini";
    const result = classifyGalleryScenes(local, online);
    expect(
      result.published.map((scene: { number: number }) => scene.number),
    ).toEqual([1]);
    expect(
      result.pending.map((scene: { number: number }) => scene.number),
    ).toEqual([2]);
  });

  it("considère une image modifiée comme à publier même si le manifeste est identique", () => {
    const manifest = {
      version: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
      games: [
        {
          slug: "game",
          title: "Game",
          scenes: [
            {
              number: 1,
              original: "/gallery/game/001-original.webp",
              remaster: "/gallery/game/001-remaster.webp",
              thumbnail: "/gallery/game/001-thumbnail.webp",
            },
          ],
        },
      ],
    };
    const result = classifyGalleryScenes(manifest, structuredClone(manifest), [
      "public/gallery/game/001-remaster.webp",
    ]);
    expect(result.pending).toHaveLength(1);
    expect(result.published).toHaveLength(0);
  });
});

describe("manifestes et fichiers", () => {
  it("fonctionne sans gallery.json", async () => {
    const root = await tempDir();
    const manifest = await readManifest(path.join(root, "gallery.json"));
    expect(manifest.games).toEqual([]);
  });

  it("détecte les scènes incomplètes et les miniatures absentes", async () => {
    const root = await tempDir();
    await mkdir(path.join(root, "another-world"), { recursive: true });
    await writeFile(path.join(root, "another-world", "001-original.webp"), "");
    await writeFile(path.join(root, "another-world", "001-remaster.webp"), "");
    const result = await scanGallery(root);
    expect(result.issues.join(" ")).toContain("thumbnail manquant");
    expect(result.games[0].scenes).toHaveLength(0);
  });
});

describe("parcours d’image local", () => {
  it("produit deux WebP et une miniature puis permet le numéro suivant", async () => {
    const root = await tempDir();
    const sourceA = await sharp({
      create: { width: 640, height: 360, channels: 3, background: "#244c40" },
    })
      .png()
      .toBuffer();
    const sourceB = await sharp({
      create: { width: 800, height: 450, channels: 3, background: "#d96a43" },
    })
      .jpeg()
      .toBuffer();
    const first = await processImages(
      { buffer: sourceA, metadata: await sharp(sourceA).metadata() },
      { buffer: sourceB, metadata: await sharp(sourceB).metadata() },
      false,
    );
    for (const [name, data] of [
      ["001-original.webp", first.originalOutput.data],
      ["001-remaster.webp", first.remasterOutput.data],
      ["001-thumbnail.webp", first.thumbnail.data],
    ] as const)
      await writeFile(path.join(root, name), data);
    expect(
      (
        await sharp(
          await readFile(path.join(root, "001-original.webp")),
        ).metadata()
      ).format,
    ).toBe("webp");
    expect(
      (
        await sharp(
          await readFile(path.join(root, "001-thumbnail.webp")),
        ).metadata()
      ).width,
    ).toBeLessThanOrEqual(480);
    expect(nextSceneNumber([{ number: 1 }])).toBe(2);
    const second = await processImages(
      { buffer: sourceA, metadata: await sharp(sourceA).metadata() },
      { buffer: sourceB, metadata: await sharp(sourceB).metadata() },
      false,
    );
    await writeFile(
      path.join(root, "002-original.webp"),
      second.originalOutput.data,
    );
    await writeFile(
      path.join(root, "002-remaster.webp"),
      second.remasterOutput.data,
    );
    await writeFile(
      path.join(root, "002-thumbnail.webp"),
      second.thumbnail.data,
    );
    expect(
      (await scanGallery(path.dirname(root))).issues.some((issue: string) =>
        issue.includes("écras"),
      ),
    ).toBe(false);
  });

  it("recadre réellement un remaster incompatible au ratio de l’original", async () => {
    const landscape = await sharp({
      create: { width: 640, height: 360, channels: 3, background: "#244c40" },
    })
      .png()
      .toBuffer();
    const square = await sharp({
      create: { width: 600, height: 600, channels: 3, background: "#d96a43" },
    })
      .png()
      .toBuffer();
    const adapted = await processImages(
      { buffer: landscape, metadata: await sharp(landscape).metadata() },
      { buffer: square, metadata: await sharp(square).metadata() },
      true,
    );
    expect(
      adapted.remasterOutput.info.width / adapted.remasterOutput.info.height,
    ).toBeCloseTo(16 / 9, 2);
    const preserved = await processImages(
      { buffer: landscape, metadata: await sharp(landscape).metadata() },
      { buffer: square, metadata: await sharp(square).metadata() },
      false,
    );
    expect(
      preserved.remasterOutput.info.width /
        preserved.remasterOutput.info.height,
    ).toBeCloseTo(1, 2);
  });

  it("adapte au choix l’original ou les deux images à parts égales", async () => {
    const landscape = await sharp({
      create: {
        width: 800,
        height: 450,
        channels: 3,
        background: "#244c40",
      },
    })
      .png()
      .toBuffer();
    const square = await sharp({
      create: {
        width: 600,
        height: 600,
        channels: 3,
        background: "#d96a43",
      },
    })
      .png()
      .toBuffer();
    const originalAdapted = await processImages(
      { buffer: landscape, metadata: await sharp(landscape).metadata() },
      { buffer: square, metadata: await sharp(square).metadata() },
      "original",
    );
    expect(
      originalAdapted.originalOutput.info.width /
        originalAdapted.originalOutput.info.height,
    ).toBeCloseTo(1, 2);
    const balanced = await processImages(
      { buffer: landscape, metadata: await sharp(landscape).metadata() },
      { buffer: square, metadata: await sharp(square).metadata() },
      "balanced",
    );
    const expected = Math.sqrt(16 / 9);
    expect(
      balanced.originalOutput.info.width / balanced.originalOutput.info.height,
    ).toBeCloseTo(expected, 2);
    expect(
      balanced.remasterOutput.info.width / balanced.remasterOutput.info.height,
    ).toBeCloseTo(expected, 2);
  });
});

describe("prévisualisation du studio", () => {
  it("accepte les fichiers déposés hors du champ natif et reproduit le ratio original", async () => {
    const html = await readFile(
      path.join(process.cwd(), "tools", "studio", "index.html"),
      "utf8",
    );
    const script = await readFile(
      path.join(process.cwd(), "tools", "studio", "studio.js"),
      "utf8",
    );
    const css = await readFile(
      path.join(process.cwd(), "tools", "studio", "studio.css"),
      "utf8",
    );
    expect(html).not.toMatch(/type="file"[^>]*\srequired/);
    expect(script).toContain('"--preview-ratio"');
    expect(script).toContain('mode === "balanced"');
    expect(script).toContain('? "cover" : "contain"');
    expect(css).toContain("aspect-ratio: var(--preview-ratio");
    expect(css).toContain("background: #e9ece6");
  });

  it("propose l’édition et l’état de publication sans bouton Voir", async () => {
    const html = await readFile(
      path.join(process.cwd(), "tools", "studio", "index.html"),
      "utf8",
    );
    const script = await readFile(
      path.join(process.cwd(), "tools", "studio", "studio.js"),
      "utf8",
    );
    const server = await readFile(
      path.join(process.cwd(), "tools", "studio", "server.mjs"),
      "utf8",
    );
    expect(html).toContain('id="creation-list"');
    expect(script).toContain("En ligne sur Internet");
    expect(script).toContain(">Éditer</button>");
    expect(script).not.toContain(">Voir</a>");
    expect(server).toContain('request.method === "PUT"');
    expect(html).toContain('value="balanced"');
    expect(script).toContain("Faire glisser pour réordonner");
    expect(script).toContain('class="scene-thumbs"');
    expect(script).toContain('class="game-folder" open');
    expect(script).toContain('api("/api/games/order"');
    expect(server).toContain("reorderGames(request)");
  });
});

describe("encart VibeCodeClub", () => {
  it("rend le texte exact avec uniquement VibeCodeClub.fr cliquable", () => {
    const markup = renderToStaticMarkup(
      createElement(DiscordNotice, { url: siteConfig.vibeCodeClubUrl }),
    );
    expect(markup.replace(/<[^>]+>/g, "")).toBe(
      "Partagez vos RemasterIA sur le Discord de VibeCodeClub.fr",
    );
    expect(markup.match(/<a /g)).toHaveLength(1);
    expect(markup).toContain(`href="${VIBECODECLUB_URL}"`);
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noopener noreferrer"');
    expect(markup).not.toContain("discord.gg");
  });

  it("reste sur une ligne sur ordinateur et autorise un retour propre sur mobile", async () => {
    const css = await readFile(
      path.join(process.cwd(), "src", "app", "globals.css"),
      "utf8",
    );
    expect(css).toContain(".discord-notice p { white-space: nowrap; }");
    expect(css).toContain(".discord-notice p { white-space: normal; }");
    expect(css).toContain(".discord-notice a");
  });
});
