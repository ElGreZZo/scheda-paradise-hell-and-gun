// La base dati dati/ per i template: ogni file JSON (fuori da schemi/) diventa una variabile con le sue voci,
// col nome del file: dati.abilita, dati.archetipi, dati.armi, dati.base (le regole)…
//
// I template ricevono le voci così come sono in dati/: se una scheda ha bisogno solo di una parte (i nomi per un
// menu), la sceglie il template.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATI = path.join(RADICE, "dati");

async function fileJson(cartella) {
  const voci = await readdir(cartella, { withFileTypes: true });
  const elenchi = await Promise.all(voci.map((v) => {
    const pieno = path.join(cartella, v.name);
    if (v.isDirectory()) return v.name === "schemi" ? [] : fileJson(pieno);
    return v.name.endsWith(".json") ? [pieno] : [];
  }));
  return elenchi.flat();
}

export async function leggiDati() {
  const dati = {};
  for (const file of (await fileJson(DATI)).sort()) {
    const nome = path.basename(file, ".json");
    if (nome in dati) throw new Error(`dati/: due file con lo stesso nome (${nome}.json): i template li vedono per nome`);
    dati[nome] = JSON.parse(await readFile(file, "utf8")).voci;
  }
  return dati;
}
