process.env.STUDIO_NO_OPEN = "1";
import { request } from "node:http";
const { address, server } = await import("../tools/studio/server.mjs");

const page = await fetch(address);
const html = await page.text();
const token = html.match(/name="studio-token" content="([a-f0-9]+)"/)?.[1];
const state = await fetch(`${address}/api/state`, { headers: { "x-studio-token": token ?? "" } });
const stateBody = await state.json();
const legacyNumber = stateBody.games.find((game) => game.slug === "heart-of-darkness")?.nextNumber;
const parsed = new URL(address);
const rejectedStatus = await new Promise((resolve, reject) => {
  const probe = request({ hostname: parsed.hostname, port: parsed.port, path: "/", headers: { host: "example.com" } }, (response) => {
    response.resume();
    response.on("end", () => resolve(response.statusCode));
  });
  probe.on("error", reject);
  probe.end();
});
console.log(`Studio HTTP ${page.status} — API ${state.status} — hôte non local ${rejectedStatus} — Heart of Darkness suivant #${String(legacyNumber).padStart(3, "0")}`);
process.exitCode = page.ok && state.ok && rejectedStatus === 403 && legacyNumber === 3 ? 0 : 1;
await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve(undefined)));
