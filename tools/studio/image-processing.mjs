import sharp from "sharp";

export function orientedSize(metadata) {
  const swaps = [5, 6, 7, 8].includes(metadata.orientation);
  return {
    width: swaps ? metadata.height : metadata.width,
    height: swaps ? metadata.width : metadata.height,
  };
}

export async function adaptiveWebp(pipeline) {
  let result;
  let quality = 74;
  for (const candidate of [84, 82, 78, 74]) {
    result = await pipeline
      .clone()
      .webp({ quality: candidate, effort: 5, smartSubsample: true })
      .toBuffer({ resolveWithObject: true });
    quality = candidate;
    if (result.data.length <= 1_200_000) break;
  }
  return { ...result, quality, warning: result.data.length > 1_200_000 };
}

function targetDimensions(input, ratio) {
  let width = Math.min(input.width, 2560);
  let height = Math.round(width / ratio);
  if (height > 2560) {
    height = 2560;
    width = Math.round(height * ratio);
  }
  return { width, height };
}

function fittedPipeline(image, input, targetRatio, crop) {
  const pipeline = sharp(image.buffer).rotate();
  if (!crop)
    return pipeline.resize({
      width: 2560,
      height: 2560,
      fit: "inside",
      withoutEnlargement: true,
    });
  return pipeline.resize({
    ...targetDimensions(input, targetRatio),
    fit: "cover",
    position: "centre",
    withoutEnlargement: false,
  });
}

export async function processImages(original, remaster, adaptMode = "none") {
  const originalInput = orientedSize(original.metadata);
  const remasterInput = orientedSize(remaster.metadata);
  if (adaptMode === true) adaptMode = "remaster";
  if (adaptMode === false) adaptMode = "none";
  const allowedModes = new Set(["none", "remaster", "original", "balanced"]);
  if (!allowedModes.has(adaptMode))
    throw new Error("Mode d’adaptation invalide.");
  const originalRatio = originalInput.width / originalInput.height;
  const remasterRatio = remasterInput.width / remasterInput.height;
  const targetRatio =
    adaptMode === "remaster"
      ? originalRatio
      : adaptMode === "original"
        ? remasterRatio
        : adaptMode === "balanced"
          ? Math.sqrt(originalRatio * remasterRatio)
          : null;
  const originalPipeline = fittedPipeline(
    original,
    originalInput,
    targetRatio,
    adaptMode === "original" || adaptMode === "balanced",
  );
  const remasterPipeline = fittedPipeline(
    remaster,
    remasterInput,
    targetRatio,
    adaptMode === "remaster" || adaptMode === "balanced",
  );
  const [originalOutput, remasterOutput] = await Promise.all([
    adaptiveWebp(originalPipeline),
    adaptiveWebp(remasterPipeline),
  ]);
  const thumbnail = await sharp(remasterOutput.data)
    .resize({ width: 480, withoutEnlargement: true })
    .webp({ quality: 70, effort: 4 })
    .toBuffer({ resolveWithObject: true });
  return {
    originalInput,
    remasterInput,
    originalOutput,
    remasterOutput,
    thumbnail,
    targetRatio,
  };
}
