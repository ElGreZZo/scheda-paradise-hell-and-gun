// Build della scheda: dai sorgenti in src/ ai file che Roll20 vuole, in dist/.
//
//   dist/scheda.html        src/scheda/scheda.njk (Nunjucks) con lo script dentro <script type="text/worker">: i moduli
//                           TypeScript di src/worker/, uniti da esbuild a partire da main.ts
//   dist/scheda.css         src/scheda.css, con gli @import locali ("parte.css") copiati al loro posto
//   dist/translation.json   src/traduzioni/it.json appiattito (strumenti/traduzioni.mjs); la build scrive i testi
//                           anche negli elementi con data-i18n
//
// I template ricevono dati (la base dati dati/, letta da strumenti/dati.mjs), worker (lo script) e sviluppo: true
// solo con npm run dev.
//
// Uso:  npm run build                       una volta, con lo script minificato (per Roll20)
//       npm run build -- --leggibile        una volta, con lo script non compresso (per il debug su Roll20)
//       npm run build -- --senza-chiave     una volta, con l'elenco dei testi visibili che non hanno ancora una chiave
//       npm run dev                         ricompila a ogni modifica in src/ e dati/ e avvia l'emulatore; script
//                                           non compresso e con la source map (i .ts negli strumenti di Chrome)
//       node strumenti/build.mjs --watch    solo la ricompilazione
//
// Nunjucks con delimitatori cambiati, perché {{ }} è di Roll20 (roll template e pulsanti di tiro):
//   {% … %} blocchi (include, for, if, macro)   {$ … $} variabili   {#- … -#} commenti

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import nunjucks from "nunjucks";
import { leggiDati } from "./dati.mjs";
import { appiattisci, chiaviDelloScript, pezzoDiChiave, riempiTraduzioni, testiSenzaChiave } from "./traduzioni.mjs";

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(RADICE, "src");
const DATI = path.join(RADICE, "dati");
const DIST = path.join(RADICE, "dist");
export const PORTA = 8030;

// Filtro chiave: {$ v | chiave $} è il pezzo di chiave di traduzione di un testo usato come valore (pezzoDiChiave).
const ambiente = () =>
  new nunjucks.Environment(new nunjucks.FileSystemLoader(path.join(SRC, "scheda"), { noCache: true }), {
    autoescape: false,
    throwOnUndefined: true,
    // Le righe con solo un blocco ({% include %}, {% for %}…) spariscono dal risultato.
    trimBlocks: true,
    lstripBlocks: true,
    tags: { blockStart: "{%", blockEnd: "%}", variableStart: "{$", variableEnd: "$}", commentStart: "{#-", commentEnd: "-#}" },
  }).addFilter("chiave", pezzoDiChiave);

// Roll template: nella chat Roll20 applica solo le regole che iniziano con .sheet-rolltemplate-<nome>, quindi
// ogni regola comune a tutte le card andrebbe ripetuta per ogni template. Nel CSS si scrive una volta con il
// segnaposto .sheet-rolltemplate-ogni, e qui diventa un selettore per ogni template di src/scheda/pagine/rolltemplate/.
export function espandiRollTemplate(testo, nomi) {
  return testo.replace(/(^|[}\/])([^{}\/]*\.sheet-rolltemplate-ogni[^{}\/]*)\{/g, (_, prima, preludio) => {
    const spazio = /^\s*/.exec(preludio)[0];
    const selettori = preludio.trim().split(",").map((s) => s.trim()).flatMap((s) => (s.includes(".sheet-rolltemplate-ogni") ? nomi.map((n) => s.replaceAll(".sheet-rolltemplate-ogni", `.sheet-rolltemplate-${n}`)) : [s]));
    return `${prima}${spazio}${selettori.join(",\n")} {`;
  });
}
const nomiRollTemplate = async () => (await readdir(path.join(SRC, "scheda", "pagine", "rolltemplate")).catch(() => [])).filter((f) => f.endsWith(".njk")).map((f) => path.basename(f, ".njk")).sort();

// CSS: un @import "file.css" locale viene sostituito dal file (ricorsivo); gli @import url(...) restano.
async function css(file) {
  const testo = espandiRollTemplate(await readFile(file, "utf8"), await nomiRollTemplate());
  const parti = [];
  for (const riga of testo.split("\n")) {
    const m = /^@import\s+"([^"]+\.css)";\s*$/.exec(riga.trim());
    parti.push(m ? (await css(path.join(path.dirname(file), m[1]))).trimEnd() : riga);
  }
  return parti.join("\n");
}

// Filtro di sicurezza di Roll20 sul CSS della scheda (copiato dal codice del VTT, 28/09/2026): toglie i commenti
// senza "*" dentro e l'@import dei Google Fonts, poi se trova uno di questi schemi scarta TUTTO il CSS, con
// "Potential CSS security violation; character sheet template styling thrown out." in console. Fra i vietati:
// i caratteri da \x7f a \xff (lettere accentate, "·"; "●" invece passa) e "\" seguito da lettera o cifra, quindi anche gli
// escape CSS come "\00B7". La build si ferma prima di produrre un CSS che Roll20 non caricherebbe.
const VIETATI_ROLL20 = [
  /\bdata:\b|eval|cookie|\bwindow\b|\bparent\b|\bthis\b/i,
  /behaviou?r|expression|moz-binding|@charset|javascript|vbscript|[<]|\\\w/i,
  /@import (?!url\(['"]https:\/\/fonts\.googleapis\.com\/css\?family=)/i,
  /[\x7f-\xff]/,
  /[\x00-\x08\x0B\x0C\x0E-\x1F]/,
  /&#/,
];
export function violazioniCssRoll20(testo) {
  const filtrato = testo
    .replace(/\/\*\s*start mobile\s*\*\/[\S\s]*?\/\*\s*end mobile\s*\*\//gi, "")
    .replace(/\/\*[^*]+\*\//g, "")
    .replace(/(@import url\(['|"].+['|"]\);*)/gi, "");
  return VIETATI_ROLL20.flatMap((regola) => {
    const m = regola.exec(filtrato);
    return m ? [`${regola}: ${JSON.stringify(filtrato.slice(Math.max(0, m.index - 40), m.index + 20))}`] : [];
  });
}

// Roll template: Roll20 li rende con Mustache.js 1.0.0 e definisce la negazione solo per le sue funzioni
// ({{#^rollTotal() …}}). {{#^prop}} su una proprietà cerca la chiave "^prop", che non c'è: la sezione non si vede
// mai. La sezione inversa di una proprietà è {{^prop}}…{{/prop}}.
export function inverseSbagliate(html) {
  return [...new Set([...html.matchAll(/\{\{#\^[^}(]+\}\}/g)].map((m) => m[0]))];
}

// Pulsanti di tiro: un @{campo} che il personaggio non ha ancora (riga aggiunta dopo l'apertura, attributo che lo
// script scrive solo quando cambia qualcosa) Roll20 lo prende dal valore iniziale della scheda. Lo danno input,
// select e textarea, non uno <span name="attr_…">: senza, la chat riceve anche "No attribute was found for
// @{Nome|campo}". Nelle sezioni ripetibili vale il campo della riga, poi quello del personaggio.
const CAMPI_DI_ROLL20 = new Set(["character_name", "character_id"]);
export function riferimentiSenzaValore(html) {
  const campi = (testo) => new Set([...testo.matchAll(/<(?:input|select|textarea)\b[^>]*\sname="attr_([^"]+)"/g)].map((m) => m[1].toLowerCase()));
  const riferimenti = (testo) => [...testo.matchAll(/<button\b[^>]*type="roll"[^>]*\svalue="([^"]*)"/g)].flatMap((m) => [...m[1].matchAll(/@\{([^}|]+)\}/g)].map((r) => r[1].toLowerCase()));
  const senzaTemplate = html.replace(/<rolltemplate[\s\S]*?<\/rolltemplate>/g, "").replace(/<script[\s\S]*?<\/script>/g, "");
  const sezioni = [...senzaTemplate.matchAll(/<fieldset class="repeating_([a-z0-9]+)">([\s\S]*?)<\/fieldset>/g)];
  const fuori = senzaTemplate.replace(/<fieldset class="repeating_[\s\S]*?<\/fieldset>/g, "");
  const delPersonaggio = campi(fuori);
  const mancanti = (nomi, locali = new Set()) => [...new Set(nomi)].filter((n) => !locali.has(n) && !delPersonaggio.has(n) && !CAMPI_DI_ROLL20.has(n));
  return [
    ...mancanti(riferimenti(fuori)).map((n) => `@{${n}}`),
    ...sezioni.flatMap(([, sezione, corpo]) => mancanti(riferimenti(corpo), campi(corpo)).map((n) => `repeating_${sezione}: @{${n}}`)),
  ];
}

// Script: esbuild segue gli import da main.ts e mette tutto in una funzione sola (Roll20 non ha i moduli).
async function script({ minifica, mappa }) {
  const esito = await esbuild.build({
    entryPoints: [path.join(SRC, "worker", "main.ts")],
    bundle: true,
    write: false,
    format: "iife",
    target: "es2020",
    charset: "utf8",
    legalComments: "none",
    minify: minifica,
    sourcemap: mappa ? "inline" : false,
    logLevel: "silent",
  });
  return esito.outputFiles[0].text.trimEnd();
}

// I sorgenti TypeScript dello script, tutti di seguito: per le chiavi di traduzione che usa (chiaviDelloScript).
async function sorgentiScript(cartella = path.join(SRC, "worker")) {
  const voci = await readdir(cartella, { withFileTypes: true });
  const testi = await Promise.all(voci.map((v) => (v.isDirectory() ? sorgentiScript(path.join(cartella, v.name)) : v.name.endsWith(".ts") ? readFile(path.join(cartella, v.name), "utf8") : "")));
  return testi.join("\n");
}

// Tutti i testi di un valore: i testi del manuale in dati/ si mostrano come sono, non sono "testi senza chiave".
const stringhe = (valore) => typeof valore === "string" ? [valore] : valore && typeof valore === "object" ? Object.values(valore).flatMap(stringhe) : [];

// Traduzioni: riempie l'HTML con i testi di src/traduzioni/it.json e si ferma per ogni errore (chiave che manca:
// su Roll20 si vedrebbe [chiave]). Avvisi, senza fermarsi: chiavi che nessuno usa e testi visibili senza chiave
// (il numero; l'elenco con --senza-chiave).
function traduci(generato, traduzioni, { sorgenti, dati, elencoSenzaChiave }) {
  const { html, usate, errori } = riempiTraduzioni(generato, traduzioni);
  const dalloScript = chiaviDelloScript(sorgenti);
  const zone = new Set(Object.keys(traduzioni).map((k) => k.split(".")[0]));
  const daControllare = [...dalloScript.chiavi, ...[...dalloScript.citate].filter((k) => zone.has(k.split(".")[0]))];
  errori.push(...[...new Set(daControllare)].filter((k) => !Object.hasOwn(traduzioni, k)).map((k) => `chiave che manca in src/traduzioni/it.json: ${k} (script)`));
  if (errori.length) throw new Error(`traduzioni:\n  ${[...new Set(errori)].join("\n  ")}`);
  const maiUsate = Object.keys(traduzioni).filter((k) => !usate.has(k) && !dalloScript.chiavi.has(k) && !dalloScript.citate.has(k) && !dalloScript.schemi.some((s) => s.test(k)));
  const senzaChiave = testiSenzaChiave(html, new Set(stringhe(dati)));
  console.log(`traduzioni: ${Object.keys(traduzioni).length} chiavi; ${senzaChiave.length} testi visibili senza chiave${elencoSenzaChiave ? "" : " (elenco: npm run build -- --senza-chiave)"}`);
  if (maiUsate.length) console.log(`traduzioni: chiavi che nessuno usa: ${maiUsate.join(", ")}`);
  if (elencoSenzaChiave) senzaChiave.forEach((t) => console.log(`  ${t}`));
  return html;
}

const leggiJson = async (file) => JSON.parse(await readFile(file, "utf8"));

export async function build({ minifica = true, mappa = false, sviluppo = false, elencoSenzaChiave = false } = {}) {
  const inizio = Date.now();
  const variabili = { dati: await leggiDati(), sviluppo };
  const traduzioni = appiattisci(await leggiJson(path.join(SRC, "traduzioni", "it.json")));
  const worker = await script({ minifica, mappa });
  const html = traduci(ambiente().render("scheda.njk", { ...variabili, worker }), traduzioni, { sorgenti: await sorgentiScript(), dati: variabili.dati, elencoSenzaChiave });
  const inverse = inverseSbagliate(html);
  if (inverse.length) throw new Error(`roll template con sezioni che su Roll20 non si vedono mai (scrivi {{^prop}}…{{/prop}}): ${inverse.join(", ")}`);
  // Roll20 toglie <optgroup> pulendo l'HTML della scheda: le intestazioni dei menu si fanno con voci disattivate.
  if (/<optgroup\b/i.test(html)) throw new Error("<optgroup> nella scheda: Roll20 lo toglie, usa una voce disattivata come intestazione");
  const senzaValore = riferimentiSenzaValore(html);
  if (senzaValore.length) throw new Error(`pulsanti di tiro con campi senza valore iniziale (serve un input, anche nascosto): ${senzaValore.join(", ")}`);
  const foglio = await css(path.join(SRC, "scheda.css"));
  // L'emulatore, che imita Roll20 portando gli import in cima, prende ogni "@import" fino al primo punto e virgola,
  // anche dentro un commento: il foglio si rompe (09/10/2026, la prima regola della scheda è sparita). Su Roll20 non
  // è provato: meglio non scriverlo.
  if (/\/\*(?:(?!\*\/)[\s\S])*@import/.test(foglio)) throw new Error("@import scritto in un commento del CSS: Roll20 lo sposta e rompe il foglio");
  const violazioni = violazioniCssRoll20(foglio);
  if (violazioni.length) throw new Error(`Roll20 scarterebbe tutto il CSS (filtro di sicurezza):\n  ${violazioni.join("\n  ")}`);
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  await writeFile(path.join(DIST, "scheda.html"), html);
  await writeFile(path.join(DIST, "scheda.css"), foglio);
  await writeFile(path.join(DIST, "translation.json"), `${JSON.stringify(traduzioni, null, 2)}\n`);
  console.log(`build: dist/scheda.html, dist/scheda.css e dist/translation.json in ${Date.now() - inizio} ms`);
}

// In sviluppo lo script non è compresso e porta la source map.
async function buildSicura() {
  try {
    await build({ minifica: false, mappa: true, sviluppo: true });
  } catch (e) {
    console.error(`build fallita: ${e.message}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argomenti = process.argv.slice(2);
  if (!argomenti.includes("--watch")) {
    await build({ minifica: !argomenti.includes("--leggibile"), elencoSenzaChiave: argomenti.includes("--senza-chiave") });
  } else {
    await buildSicura();
    let attesa;
    for (const cartella of [SRC, DATI]) watch(cartella, { recursive: true }, () => {
      clearTimeout(attesa);
      attesa = setTimeout(buildSicura, 150);
    });
    console.log("build: in ascolto delle modifiche in src/ e dati/");
    if (argomenti.includes("--serve")) {
      const { avviaServer } = await import("./server.mjs");
      avviaServer({ porta: PORTA, pronto: () => console.log(`Scheda di Paradise, Hell and Guns: http://localhost:${PORTA}/strumenti/emulatore/sviluppo.html`) });
    }
  }
}
