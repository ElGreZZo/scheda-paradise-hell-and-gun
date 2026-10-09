// Server statico per l'emulatore, senza dipendenze. La radice è la cartella del repository.
//
// Uso:  npm start      oppure  node strumenti/server.mjs [porta]
// Poi apri http://localhost:8030/ e scegli l'index.html di una scheda.
// Serve un server perché i moduli ES e fetch() non funzionano aprendo i file con file://.
// In più salva i personaggi dell'emulatore su disco (/api/salvataggi, vedi sotto).

import { createServer } from "node:http";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TIPI = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
// Salvataggi dei personaggi dell'emulatore, su disco e fuori da git (sono personaggi delle partite):
//   GET /api/salvataggi          elenco [{ nome, data }], il più recente per primo
//   GET /api/salvataggi/<nome>   il personaggio salvato (JSON)
//   PUT /api/salvataggi/<nome>   salva il personaggio (JSON nel corpo)
const SALVATAGGI = path.join(RADICE, "strumenti", "emulatore", "salvataggi");
const NOME_SALVATAGGIO = /^[A-Za-z0-9_.-]{1,80}$/;

async function salvataggi(richiesta, risposta, nome) {
  const json = (codice, dati) => risposta.writeHead(codice, { "Content-Type": TIPI[".json"], "Cache-Control": "no-store" }).end(JSON.stringify(dati));
  if (!nome) {
    if (richiesta.method !== "GET") return json(405, { errore: "solo GET" });
    await mkdir(SALVATAGGI, { recursive: true });
    const file = (await readdir(SALVATAGGI)).filter((f) => f.endsWith(".json"));
    const voci = await Promise.all(file.map(async (f) => ({ nome: f.slice(0, -5), data: (await stat(path.join(SALVATAGGI, f))).mtime.toISOString() })));
    return json(200, voci.sort((a, b) => b.data.localeCompare(a.data)));
  }
  if (!NOME_SALVATAGGIO.test(nome)) return json(400, { errore: "nome non valido: lettere, numeri, _ . -" });
  const file = path.join(SALVATAGGI, `${nome}.json`);
  if (richiesta.method === "GET") return risposta.writeHead(200, { "Content-Type": TIPI[".json"], "Cache-Control": "no-store" }).end(await readFile(file));
  if (richiesta.method !== "PUT") return json(405, { errore: "solo GET e PUT" });
  const parti = [];
  for await (const parte of richiesta) parti.push(parte);
  const testo = Buffer.concat(parti).toString("utf8");
  if (!Array.isArray(JSON.parse(testo).attributi)) return json(400, { errore: "manca attributi: non è un personaggio dell'emulatore" });
  await mkdir(SALVATAGGI, { recursive: true });
  await writeFile(file, testo);
  return json(200, { nome });
}

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

async function elencoCartella(assoluto, relativo) {
  const voci = (await readdir(assoluto, { withFileTypes: true })).sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
  const righe = [];
  for (const v of voci) {
    if (v.name.startsWith(".")) continue;
    const href = encodeURI(path.posix.join(relativo, v.name)) + (v.isDirectory() ? "/" : "");
    let nota = "";
    if (v.isDirectory()) {
      try {
        await stat(path.join(assoluto, v.name, "index.html"));
        nota = ` · <a href="${href}index.html"><b>apri la scheda</b></a>`;
      } catch {}
    }
    righe.push(`<li><a href="${href}">${escapeHtml(v.name)}${v.isDirectory() ? "/" : ""}</a>${nota}</li>`);
  }
  return `<!doctype html><meta charset="utf-8"><title>Emulatore · ${escapeHtml(relativo)}</title>
<body style="font:15px/1.6 system-ui;padding:24px;max-width:760px">
<h1 style="font-size:20px">Emulatore Roll20 · ${escapeHtml(relativo)}</h1>
<ul>${relativo !== "/" ? '<li><a href="../">../</a></li>' : ""}${righe.join("")}</ul></body>`;
}

export function avviaServer({ radice = RADICE, porta = 8030, pronto = () => {} } = {}) {
  return createServer(async (richiesta, risposta) => {
    try {
      const percorso = decodeURIComponent(new URL(richiesta.url, "http://localhost").pathname);
      const api = /^\/api\/salvataggi\/?(.*)$/.exec(percorso);
      if (api) return await salvataggi(richiesta, risposta, api[1]);
      const assoluto = path.join(radice, path.normalize(percorso));
      if (!assoluto.startsWith(radice)) {
        risposta.writeHead(403).end("Vietato");
        return;
      }
      const info = await stat(assoluto);
      if (info.isDirectory()) {
        if (!percorso.endsWith("/")) {
          risposta.writeHead(301, { Location: encodeURI(percorso + "/") }).end();
          return;
        }
        risposta.writeHead(200, { "Content-Type": TIPI[".html"] }).end(await elencoCartella(assoluto, percorso));
        return;
      }
      risposta.writeHead(200, { "Content-Type": TIPI[path.extname(assoluto).toLowerCase()] ?? "application/octet-stream", "Cache-Control": "no-store" });
      risposta.end(await readFile(assoluto));
    } catch (e) {
      risposta.writeHead(e.code === "ENOENT" ? 404 : 500, { "Content-Type": "text/plain; charset=utf-8" }).end(e.code === "ENOENT" ? "Non trovato" : String(e));
    }
  }).listen(porta, "127.0.0.1", pronto); // solo in locale: la radice contiene anche manuali/ (il manuale non pubblicato)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const porta = Number(process.argv[2] ?? process.env.PORT ?? 8030);
  avviaServer({
    porta,
    pronto: () => {
      console.log(`Emulatore su http://localhost:${porta}/`);
      console.log(`Scheda di Paradise, Hell and Guns: http://localhost:${porta}/strumenti/emulatore/sviluppo.html`);
      console.log(`Scheda di prova: http://localhost:${porta}/strumenti/emulatore/prova/index.html`);
    },
  });
}
