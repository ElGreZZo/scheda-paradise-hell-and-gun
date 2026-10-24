// Controlli sulla base dati dati/.
//
//   1. schema JSON di ogni file (dati/schemi/)
//   2. id (o valori) univoci in ogni file
//   3. riferimenti: abilità e caratteristiche delle carriere, poteri di archetipi e carriere
//   4. ogni testo (nomi, testi, descrizioni, citazioni…) si trova parola per parola nel manuale
//      (.cache/testo/manuale.md, prodotta da npm run estrai-testo)
//   5. avvisi sul manuale, senza fermarsi: poteri citati ma non descritti, costi dei livelli fuori dallo schema degli
//      altri, livelli che mancano, incrementi degli archetipi diversi da 4, abilità senza caratteristica
//
// Uso:  npm run controlla
// Esce con codice 1 se c'è almeno un errore (gli avvisi no: sono domande per il manuale, docs/domande-per-il-master.md).

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATI = path.join(RADICE, "dati");
const SCHEMI = path.join(DATI, "schemi");
const MANUALE = path.join(RADICE, ".cache", "testo", "manuale.md");

// Campi con testi copiati dal manuale; gli altri (id, numeri, nota) sono nostri.
const CAMPI_TESTO = new Set(["nome", "testo", "descrizione", "citazioni", "statistiche", "ferri_del_mestiere", "uso", "note", "motto",
  "ispirazione", "regole_poteri", "tiro", "effetti_scenografici", "reazione", "effetto_combo", "riquadri"]);

// Apostrofi e virgolette tipografici come quelli dritti, spazi ridotti a uno.
export const normalizza = (s) => s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

async function fileJson(cartella = DATI) {
  const voci = await readdir(cartella, { withFileTypes: true });
  const elenchi = await Promise.all(voci.map(async (v) => {
    const pieno = path.join(cartella, v.name);
    if (v.isDirectory()) return pieno === SCHEMI ? [] : fileJson(pieno);
    return v.name.endsWith(".json") ? [pieno] : [];
  }));
  return elenchi.flat().sort();
}

// Ogni testo copiato, con il percorso: [percorso, testo].
function testi(valore, percorso = "", campo = "") {
  if (typeof valore === "string") return CAMPI_TESTO.has(campo) ? [[percorso, valore]] : [];
  if (Array.isArray(valore)) return valore.flatMap((v, i) => testi(v, `${percorso}[${i}]`, campo));
  if (valore && typeof valore === "object") return Object.entries(valore).flatMap(([k, v]) => testi(v, percorso ? `${percorso}.${k}` : k, k));
  return [];
}

export async function controlla({ stampa = console.log } = {}) {
  const errori = [];
  const avvisi = [];
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  for (const f of (await readdir(SCHEMI)).filter((f) => f.endsWith(".schema.json"))) ajv.addSchema(JSON.parse(await readFile(path.join(SCHEMI, f), "utf8")), f);

  const dati = {};
  for (const pieno of await fileJson()) {
    const nome = path.relative(DATI, pieno).replaceAll("\\", "/");
    const contenuto = JSON.parse(await readFile(pieno, "utf8"));
    dati[nome] = contenuto;
    // 1. schema
    const schema = path.basename(contenuto.$schema ?? "");
    const valida = ajv.getSchema(schema);
    if (!valida) {
      errori.push(`${nome}: schema "${contenuto.$schema}" che non esiste in dati/schemi/`);
      continue;
    }
    if (!valida(contenuto)) for (const e of valida.errors) errori.push(`${nome}: schema: ${e.instancePath || "/"} ${e.message}${e.params?.additionalProperty ? ` (${e.params.additionalProperty})` : ""}`);
    // 2. id univoci
    const chiavi = (contenuto.voci ?? []).map((v) => v.id ?? v.valore);
    const doppie = chiavi.filter((k, i) => chiavi.indexOf(k) !== i);
    if (doppie.length) errori.push(`${nome}: id doppi: ${[...new Set(doppie)].join(", ")}`);
  }

  // 3. riferimenti
  const ids = (file) => new Set((dati[file]?.voci ?? []).map((v) => v.id));
  const abilita = ids("elenchi/abilita.json");
  const poteri = ids("poteri.json");
  const poteriMancanti = new Map();
  const potere = (id, dove) => {
    if (!poteri.has(id)) poteriMancanti.set(id, [...(poteriMancanti.get(id) ?? []), dove]);
  };
  for (const a of dati["archetipi.json"]?.voci ?? []) {
    for (const p of a.poteri_innati) potere(p.potere, `${a.nome} (innato)`);
    for (const p of a.poteri_affini) potere(p, `${a.nome} (affine)`);
    const somma = Object.values(a.incrementi).reduce((x, y) => x + y, 0);
    if (somma !== 4) avvisi.push(`${a.nome}: incrementi di caratteristica per ${somma} pallini (gli altri archetipi ne hanno 4)`);
  }
  for (const c of dati["carriere.json"]?.voci ?? []) {
    for (const a of c.abilita_lavorative.abilita) if (!abilita.has(a)) errori.push(`carriere.json: ${c.nome}: abilità "${a}" che non c'è in elenchi/abilita.json`);
    for (const p of c.abilita_lavorative.poteri) for (const id of p.potere ? [p.potere] : p.a_seconda_del_colore) potere(id, `${c.nome} (carriera)`);
  }
  for (const [id, dove] of poteriMancanti) avvisi.push(`potere "${id}" citato ma non descritto nel capitolo 10: ${dove.join(", ")}`);

  // Avvisi sui poteri: livelli doppi o che mancano, costi fuori schema (livello × costo del primo livello). I poteri di
  // carriera hanno costi propri (2, 4, 8 o 4, 8, 12): lì si guardano solo i livelli.
  const livelli = (nome, lista, costi) => {
    const numeri = lista.map((l) => l.livello);
    const doppi = numeri.filter((n, i) => numeri.indexOf(n) !== i);
    if (doppi.length) avvisi.push(`${nome}: livello ${[...new Set(doppi)].join(", ")} scritto due volte`);
    const mancano = [...Array(Math.max(...numeri)).keys()].map((i) => i + 1).filter((n) => !numeri.includes(n));
    if (mancano.length) avvisi.push(`${nome}: mancano i livelli ${mancano.join(", ")}`);
    if (!costi) return;
    const base = lista.find((l) => l.livello === 1)?.costo_px;
    const fuori = lista.filter((l) => base && !l.costo_variabile && l.costo_px !== base * l.livello);
    if (fuori.length) avvisi.push(`${nome}: costi ${lista.map((l) => l.costo_px).join(", ")} (fuori schema il livello ${fuori.map((l) => l.livello).join(", ")})`);
  };
  for (const p of dati["poteri.json"]?.voci ?? []) livelli(p.nome, p.livelli, true);
  for (const c of dati["carriere.json"]?.voci ?? []) for (const p of c.poteri) livelli(`${c.nome}, ${p.nome}`, p.livelli, false);
  for (const a of dati["elenchi/abilita.json"]?.voci ?? []) if (!a.caratteristiche.length) avvisi.push(`abilità ${a.nome}: il manuale non dice a quale caratteristica è associata`);

  // 4. testi nel manuale
  let manuale;
  try {
    manuale = normalizza(await readFile(MANUALE, "utf8"));
  } catch {
    errori.push("manca .cache/testo/manuale.md: lancia npm run estrai-testo (serve il docx in manuali/)");
  }
  let controllati = 0;
  if (manuale) {
    for (const [nome, contenuto] of Object.entries(dati)) {
      for (const [percorso, testo] of testi(contenuto.voci, "voci")) {
        controllati++;
        if (!manuale.includes(normalizza(testo))) errori.push(`${nome}: ${percorso}: testo che non è nel manuale: ${JSON.stringify(testo.slice(0, 90))}`);
      }
    }
  }

  for (const a of avvisi) stampa(`avviso: ${a}`);
  for (const e of errori) stampa(`ERRORE: ${e}`);
  stampa(`controlla: ${Object.keys(dati).length} file, ${controllati} testi confrontati con il manuale, ${errori.length} errori, ${avvisi.length} avvisi`);
  return { errori, avvisi };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { errori } = await controlla();
  if (errori.length) process.exitCode = 1;
}
