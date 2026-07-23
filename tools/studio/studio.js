const token = document.querySelector('meta[name="studio-token"]').content;
const $ = (selector) => document.querySelector(selector);
const form = $("#scene-form"),
  title = $("#title"),
  original = $("#original"),
  remaster = $("#remaster"),
  add = $("#add"),
  status = $("#form-status");
let appState = null,
  editing = null,
  files = { original: null, remaster: null },
  dimensions = { original: null, remaster: null },
  urls = {};
const api = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: { ...options.headers, "x-studio-token": token },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Erreur locale.");
  return body;
};
const bytes = (value) =>
  value < 1024
    ? `${value} o`
    : value < 1048576
      ? `${(value / 1024).toFixed(0)} Ko`
      : `${(value / 1048576).toFixed(1)} Mo`;
const number = (value) => String(value).padStart(3, "0");
const normalize = (value) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
function gameFor(value) {
  const key = normalize(value);
  return appState?.games.find(
    (game) => normalize(game.title) === key || normalize(game.slug) === key,
  );
}
function updateGameHint() {
  const game = gameFor(title.value);
  $("#game-hint").textContent = title.value.trim()
    ? game
      ? `Jeu existant — prochaine scène : #${number(game.nextNumber)}`
      : "Nouveau jeu — première scène : #001"
    : "Saisissez ou choisissez un jeu.";
  validate();
}
function validate() {
  add.disabled =
    !title.value.trim() ||
    !urls.original ||
    !urls.remaster ||
    add.dataset.busy === "true";
}
function setFile(side, file) {
  if (urls[side]?.startsWith("blob:")) URL.revokeObjectURL(urls[side]);
  delete urls[side];
  files[side] = file || null;
  dimensions[side] = null;
  const drop = $(`#${side}-drop`),
    image = drop.querySelector("img"),
    meta = drop.querySelector(".file-meta");
  if (!file) {
    drop.classList.remove("loaded");
    image.removeAttribute("src");
    meta.textContent = "";
    validate();
    updatePreview();
    return;
  }
  if (
    ![
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
      "image/tiff",
    ].includes(file.type)
  ) {
    status.textContent =
      "Format refusé : utilisez JPEG, PNG, WebP, AVIF ou TIFF.";
    status.className = "status error";
    return;
  }
  urls[side] = URL.createObjectURL(file);
  image.src = urls[side];
  drop.classList.add("loaded");
  const probe = new Image();
  probe.onload = () => {
    dimensions[side] = {
      width: probe.naturalWidth,
      height: probe.naturalHeight,
    };
    meta.textContent = `${probe.naturalWidth} × ${probe.naturalHeight} — ${bytes(file.size)}`;
    updatePreview();
  };
  probe.src = urls[side];
  validate();
}
function setExistingImage(side, url) {
  if (urls[side]?.startsWith("blob:")) URL.revokeObjectURL(urls[side]);
  files[side] = null;
  dimensions[side] = null;
  urls[side] = url;
  const drop = $(`#${side}-drop`),
    image = drop.querySelector("img"),
    meta = drop.querySelector(".file-meta"),
    probe = new Image();
  image.src = url;
  drop.classList.add("loaded");
  probe.onload = () => {
    dimensions[side] = {
      width: probe.naturalWidth,
      height: probe.naturalHeight,
    };
    meta.textContent = `${probe.naturalWidth} × ${probe.naturalHeight} — image actuelle`;
    updatePreview();
  };
  probe.src = url;
  validate();
}
function resetSide(side) {
  $(`#${side}`).value = "";
  if (editing) setExistingImage(side, editing[side]);
  else setFile(side, null);
}
for (const side of ["original", "remaster"]) {
  const input = $(`#${side}`),
    drop = $(`#${side}-drop`);
  input.addEventListener("change", () => setFile(side, input.files?.[0]));
  drop.querySelector(".remove-file").addEventListener("click", (event) => {
    event.preventDefault();
    resetSide(side);
  });
  for (const type of ["dragenter", "dragover"])
    drop.addEventListener(type, (event) => {
      event.preventDefault();
      drop.classList.add("drag");
    });
  drop.addEventListener("dragleave", (event) => {
    event.preventDefault();
    drop.classList.remove("drag");
  });
  drop.addEventListener("drop", (event) => {
    event.preventDefault();
    drop.classList.remove("drag");
    setFile(side, event.dataTransfer?.files?.[0]);
  });
}
function updatePreview() {
  const ready =
    urls.original &&
    urls.remaster &&
    dimensions.original &&
    dimensions.remaster;
  $("#preview-block").hidden = !ready;
  $("#ratio-panel").hidden = !ready;
  if (!ready) return;
  $("#preview-original").src = urls.original;
  $("#preview-remaster").src = urls.remaster;
  const left = dimensions.original.width / dimensions.original.height,
    right = dimensions.remaster.width / dimensions.remaster.height,
    compatible = Math.abs(left - right) / left <= 0.01;
  $("#comparator").style.setProperty(
    "--preview-ratio",
    `${dimensions.original.width} / ${dimensions.original.height}`,
  );
  $("#ratio-message").textContent = compatible
    ? "✓ Les deux images sont correctement alignées."
    : "Les deux images n’ont pas les mêmes proportions. Le comparateur risque de produire un décalage.";
  $("#ratio-panel").classList.toggle("compatible", compatible);
  $("#ratio-panel")
    .querySelectorAll("label")
    .forEach((label) => (label.hidden = compatible));
  updateAdaptationPreview(compatible);
  $("#format-summary").textContent =
    `Original : ${dimensions.original.width} × ${dimensions.original.height}${files.original ? ` — ${bytes(files.original.size)}` : " — image actuelle"} · Remaster : ${dimensions.remaster.width} × ${dimensions.remaster.height}${files.remaster ? ` — ${bytes(files.remaster.size)}` : " — image actuelle"} · ${compatible ? "Format compatible" : "Vérifiez l’adaptation choisie"}`;
}
function updateAdaptationPreview(compatible) {
  const mode = compatible
    ? "none"
    : form.querySelector('input[name="adapt"]:checked').value;
  const originalRatio = dimensions.original.width / dimensions.original.height;
  const remasterRatio = dimensions.remaster.width / dimensions.remaster.height;
  const targetRatio =
    mode === "original"
      ? remasterRatio
      : mode === "balanced"
        ? Math.sqrt(originalRatio * remasterRatio)
        : originalRatio;
  $("#comparator").style.setProperty("--preview-ratio", `${targetRatio}`);
  $("#preview-original").style.objectFit =
    mode === "original" || mode === "balanced" ? "cover" : "contain";
  $("#preview-remaster").style.objectFit =
    mode === "remaster" || mode === "balanced" ? "cover" : "contain";
  $("#preview-reveal").dataset.adapted = mode;
}
document
  .querySelectorAll('input[name="adapt"]')
  .forEach((input) =>
    input.addEventListener("change", () =>
      updateAdaptationPreview(
        dimensions.original &&
          dimensions.remaster &&
          Math.abs(
            dimensions.original.width / dimensions.original.height -
              dimensions.remaster.width / dimensions.remaster.height,
          ) /
            (dimensions.original.width / dimensions.original.height) <=
            0.01,
      ),
    ),
  );
let position = 50,
  dragging = false;
const comparator = $("#comparator");
function setPosition(value) {
  position = Math.max(0, Math.min(100, value));
  $("#preview-reveal").style.clipPath = `inset(0 ${100 - position}% 0 0)`;
  $("#divider").style.left = `${position}%`;
  $("#handle").style.left = `${position}%`;
  comparator.setAttribute("aria-valuenow", Math.round(position));
}
function pointer(event) {
  const box = comparator.getBoundingClientRect();
  setPosition(((event.clientX - box.left) / box.width) * 100);
}
comparator.addEventListener("pointerdown", (event) => {
  comparator.setPointerCapture(event.pointerId);
  dragging = true;
  pointer(event);
});
comparator.addEventListener("pointermove", (event) => {
  if (dragging) pointer(event);
});
comparator.addEventListener("pointerup", () => (dragging = false));
comparator.addEventListener("dblclick", () => setPosition(50));
comparator.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") setPosition(position - 5);
  if (event.key === "ArrowRight") setPosition(position + 5);
  if (event.key === " ") setPosition(50);
});
function sceneRow(scene) {
  const indicator = scene.online
    ? '<span class="online-indicator">● En ligne sur Internet</span>'
    : '<span class="pending-indicator">À publier</span>';
  const removable = !scene.online && !scene.wasPublished;
  return `<article class="pending" draggable="true" data-slug="${scene.slug}" data-number="${scene.number}"><span class="drag-handle" title="Faire glisser pour réordonner" aria-hidden="true">⋮⋮</span><span class="order-badge">Ordre ${scene.order}</span><div class="scene-thumbs" aria-label="Avant et après"><span><img src="${scene.original}" alt="Avant"><small>Avant</small></span><span><img src="${scene.remaster}" alt="Après"><small>Après</small></span></div><div class="scene-info"><strong>Scène #${number(scene.number)}</strong><small>${bytes(scene.totalBytes)} · ${escapeHtml(scene.aiTool || "Outil IA non renseigné")}</small>${indicator}</div><div class="pending-actions"><button class="edit" data-slug="${scene.slug}" data-number="${scene.number}">Éditer</button>${removable ? `<button class="remove" data-slug="${scene.slug}" data-number="${scene.number}">Retirer</button>` : ""}</div></article>`;
}
function renderSceneGroups(git) {
  const scenes = [
    ...(git.pending || []).map((scene) => ({ ...scene, online: false })),
    ...(git.published || []).map((scene) => ({ ...scene, online: true })),
  ];
  const groups = new Map();
  for (const scene of scenes) {
    const group = groups.get(scene.slug) || {
      slug: scene.slug,
      title: scene.title,
      gameOrder: scene.gameOrder,
      scenes: [],
    };
    group.scenes.push(scene);
    groups.set(scene.slug, group);
  }
  return [...groups.values()]
    .sort(
      (left, right) =>
        left.gameOrder - right.gameOrder ||
        left.title.localeCompare(right.title, "fr"),
    )
    .map((group) => {
      group.scenes.sort(
        (left, right) => left.order - right.order || left.number - right.number,
      );
      return `<details class="game-folder" open draggable="true" data-slug="${group.slug}"><summary><span class="folder-title"><span class="folder-drag-handle" title="Faire glisser le dossier" aria-hidden="true">⋮⋮</span><strong>${escapeHtml(group.title)}</strong></span><span><span class="folder-order">Ordre global ${group.gameOrder}</span> · ${group.scenes.length} création${group.scenes.length > 1 ? "s" : ""}</span></summary><div class="game-scenes" data-slug="${group.slug}">${group.scenes.map(sceneRow).join("")}</div></details>`;
    })
    .join("");
}
async function saveOrder(container) {
  const slug = container.dataset.slug;
  const rows = [...container.querySelectorAll(":scope > .pending")];
  rows.forEach((row, index) => {
    row.querySelector(".order-badge").textContent = `Ordre ${index + 1}`;
  });
  try {
    await api(`/api/games/${encodeURIComponent(slug)}/order`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        numbers: rows.map((row) => Number(row.dataset.number)),
      }),
    });
    status.textContent =
      "Nouvel ordre enregistré. Il sera appliqué au site après publication.";
    status.className = "status success";
    await load();
  } catch (error) {
    status.textContent = error.message;
    status.className = "status error";
    await load();
  }
}
async function saveFolderOrder(container) {
  const folders = [...container.querySelectorAll(":scope > .game-folder")];
  folders.forEach((folder, index) => {
    folder.querySelector(".folder-order").textContent =
      `Ordre global ${index + 1}`;
  });
  try {
    await api("/api/games/order", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slugs: folders.map((folder) => folder.dataset.slug),
      }),
    });
    status.textContent =
      "Nouvel ordre des dossiers enregistré. Il sera appliqué au site après publication.";
    status.className = "status success";
    await load();
  } catch (error) {
    status.textContent = error.message;
    status.className = "status error";
    await load();
  }
}
function bindOrdering() {
  let dragged = null,
    draggedFolder = null;
  document.querySelectorAll(".pending[draggable]").forEach((row) => {
    row.addEventListener("dragstart", (event) => {
      event.stopPropagation();
      dragged = row;
      row.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      dragged = null;
    });
  });
  document.querySelectorAll(".game-scenes").forEach((container) => {
    container.addEventListener("dragover", (event) => {
      if (!dragged || dragged.dataset.slug !== container.dataset.slug) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const target = event.target.closest(".pending");
      if (!target || target === dragged) return;
      const after =
        event.clientY >
        target.getBoundingClientRect().top + target.offsetHeight / 2;
      container.insertBefore(dragged, after ? target.nextSibling : target);
    });
    container.addEventListener("drop", async (event) => {
      if (!dragged || dragged.dataset.slug !== container.dataset.slug) return;
      event.preventDefault();
      event.stopPropagation();
      await saveOrder(container);
    });
  });
  document.querySelectorAll(".game-folder[draggable]").forEach((folder) => {
    folder.addEventListener("dragstart", (event) => {
      if (event.target.closest(".pending")) return;
      draggedFolder = folder;
      folder.classList.add("dragging-folder");
      event.dataTransfer.effectAllowed = "move";
    });
    folder.addEventListener("dragend", () => {
      folder.classList.remove("dragging-folder");
      draggedFolder = null;
    });
  });
  const folderContainer = $("#creation-list");
  folderContainer.addEventListener("dragover", (event) => {
    if (!draggedFolder) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const target = event.target.closest(".game-folder");
    if (!target || target === draggedFolder) return;
    const after =
      event.clientY >
      target.getBoundingClientRect().top + target.offsetHeight / 2;
    folderContainer.insertBefore(
      draggedFolder,
      after ? target.nextSibling : target,
    );
  });
  folderContainer.addEventListener("drop", async (event) => {
    if (!draggedFolder) return;
    event.preventDefault();
    await saveFolderOrder(folderContainer);
  });
}
function findScene(slug, sceneNumber) {
  return [
    ...(appState.git.pending || []),
    ...(appState.git.published || []),
  ].find(
    (scene) => scene.slug === slug && scene.number === Number(sceneNumber),
  );
}
function beginEdit(scene) {
  editing = scene;
  form.querySelector('input[name="adapt"][value="none"]').checked = true;
  title.value = scene.title;
  $("#ai-tool").value = scene.aiTool || "";
  original.value = "";
  remaster.value = "";
  setExistingImage("original", scene.original);
  setExistingImage("remaster", scene.remaster);
  $("#edit-banner").hidden = false;
  add.textContent = "Enregistrer les modifications";
  status.textContent = "";
  updateGameHint();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}
function endEdit() {
  editing = null;
  form.querySelector('input[name="adapt"][value="none"]').checked = true;
  $("#edit-banner").hidden = true;
  original.value = "";
  remaster.value = "";
  setFile("original", null);
  setFile("remaster", null);
  title.value = "";
  $("#ai-tool").value = "";
  add.textContent = "Ajouter à la galerie";
  updateGameHint();
}
$("#cancel-edit").addEventListener("click", endEdit);
async function load() {
  appState = await api("/api/state");
  $("#games").innerHTML = appState.games
    .map((game) => `<option value="${escapeHtml(game.title)}"></option>`)
    .join("");
  const siteLink = $("#open-site");
  siteLink.hidden = !appState.publicSiteUrl;
  if (appState.publicSiteUrl) siteLink.href = appState.publicSiteUrl;
  const git = appState.git;
  $("#git-state").textContent = !git.installed
    ? "Git indisponible"
    : !git.repository
      ? "Dépôt Git non initialisé"
      : `${git.branch}${git.remote ? " · origin connecté" : " · aucun origin"}`;
  $("#pending-count").textContent =
    `${git.pending.length} création${git.pending.length > 1 ? "s" : ""} à publier`;
  $("#publish").textContent = git.pending.length
    ? `Publier ${git.pending.length} création${git.pending.length > 1 ? "s" : ""}`
    : "Publier les créations";
  $("#publish").disabled = !git.pending.length;
  $("#creation-list").innerHTML =
    git.pending.length || git.published?.length
      ? renderSceneGroups(git)
      : '<p class="empty">Aucune création détectée.</p>';
  bindOrdering();
  document.querySelectorAll(".edit").forEach((button) =>
    button.addEventListener("click", () => {
      const scene = findScene(button.dataset.slug, button.dataset.number);
      if (scene) beginEdit(scene);
    }),
  );
  document.querySelectorAll(".remove").forEach((button) =>
    button.addEventListener("click", async () => {
      if (!confirm("Retirer uniquement cette création locale ?")) return;
      try {
        await api(
          `/api/scenes/${encodeURIComponent(button.dataset.slug)}/${button.dataset.number}`,
          { method: "DELETE" },
        );
        await load();
      } catch (error) {
        alert(error.message);
      }
    }),
  );
  updateGameHint();
}
function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}
title.addEventListener("input", updateGameHint);
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  add.dataset.busy = "true";
  validate();
  add.textContent = "Optimisation en cours…";
  status.textContent = "Conversion WebP et création de la miniature…";
  status.className = "status";
  try {
    const data = new FormData();
    data.set("title", title.value);
    data.set("aiTool", $("#ai-tool").value);
    data.set("adapt", form.elements.adapt.value);
    if (files.original) data.set("original", files.original);
    if (files.remaster) data.set("remaster", files.remaster);
    const currentEdit = editing;
    const result = currentEdit
      ? await api(
          `/api/scenes/${encodeURIComponent(currentEdit.slug)}/${currentEdit.number}`,
          { method: "PUT", body: data },
        )
      : await api("/api/scenes", { method: "POST", body: data });
    if (currentEdit) {
      status.innerHTML = `<strong>${escapeHtml(result.game.title)} #${number(result.number)} modifiée.</strong> Cette mise à jour est maintenant prête à être publiée.`;
    } else {
      const before =
          result.stats.original.before + result.stats.remaster.before,
        after =
          result.stats.original.after +
          result.stats.remaster.after +
          result.stats.thumbnail.after,
        reduction = Math.max(0, Math.round((1 - after / before) * 100));
      status.innerHTML = `<strong>${escapeHtml(result.game.title)} #${number(result.number)} ajoutée.</strong> Original : ${bytes(result.stats.original.before)} → ${bytes(result.stats.original.after)} · Remaster : ${bytes(result.stats.remaster.before)} → ${bytes(result.stats.remaster.after)} · Miniature : ${bytes(result.stats.thumbnail.after)} · Réduction totale : ${reduction} %${result.stats.warning ? " · Une image reste supérieure à 1,2 Mo à qualité 74." : ""}`;
    }
    status.className = "status success";
    endEdit();
    await load();
  } catch (error) {
    status.textContent = error.message;
    status.className = "status error";
  } finally {
    add.dataset.busy = "false";
    add.textContent = editing
      ? "Enregistrer les modifications"
      : "Ajouter à la galerie";
    validate();
  }
});
const dialog = $("#publish-dialog");
$("#publish").addEventListener("click", () => {
  $("#publish-copy").textContent =
    `${appState.git.pending.length} création${appState.git.pending.length > 1 ? "s" : ""} vont être envoyées sur GitHub. Netlify redéploiera ensuite automatiquement le site.`;
  $("#publish-progress").innerHTML = "";
  dialog.showModal();
});
$("#cancel-publish").addEventListener("click", () => dialog.close());
$("#confirm-publish").addEventListener("click", async () => {
  const button = $("#confirm-publish");
  button.disabled = true;
  $("#cancel-publish").disabled = true;
  $("#publish-progress").innerHTML =
    "<span>○ Vérification de la galerie et de Git…</span>";
  try {
    const result = await api("/api/publish", { method: "POST" });
    $("#publish-progress").innerHTML =
      result.steps
        .map((step) => `<span>✓ ${escapeHtml(step)}</span>`)
        .join("") + "<span>○ Netlify va maintenant redéployer le site</span>";
    $("#publish-copy").textContent =
      `Commit ${result.hash} envoyé sur ${result.branch}. Netlify devrait maintenant démarrer automatiquement un nouveau déploiement.`;
    button.textContent = "Terminé";
    button.onclick = () => {
      dialog.close();
      load();
    };
  } catch (error) {
    $("#publish-progress").innerHTML =
      `<span style="color:var(--danger)">✗ ${escapeHtml(error.message)}</span>`;
  } finally {
    button.disabled = false;
    $("#cancel-publish").disabled = false;
  }
});
load().catch((error) => {
  status.textContent = error.message;
  status.className = "status error";
});
