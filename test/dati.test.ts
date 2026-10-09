// La base dati dati/: schemi, riferimenti e testi copiati dal manuale (strumenti/controlla.mjs), e l'estrazione
// (strumenti/estrai_dati.mjs) che rifatta dà gli stessi file. Senza il manuale in manuali/ (.cache/testo) i test
// che lo leggono si saltano: il manuale non è nel repository.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { controlla } from "../strumenti/controlla.mjs";
import { leggiDati } from "../strumenti/dati.mjs";

const conManuale = existsSync(new URL("../.cache/testo/manuale.md", import.meta.url));

test("dati: nessun errore di npm run controlla", { skip: !conManuale && "manca .cache/testo/manuale.md (npm run estrai-testo)" }, async () => {
  const { errori } = await controlla({ stampa: () => {} });
  assert.deepEqual(errori, []);
});

test("dati: le voci attese del manuale", async () => {
  const dati = await leggiDati();
  const quante = Object.fromEntries(Object.entries(dati).map(([nome, voci]) => [nome, (voci as unknown[]).length]));
  assert.deepEqual(quante, {
    abilita: 23, archetipi: 10, armi: 13, base: 18, caratteristiche: 4, carriere: 8, colori: 3, dimensioni: 5,
    distanze: 8, distruttivita: 6, poteri: 45, ricchezza: 7, seguaci: 4,
  });
});

test("dati: l'estrazione rifatta dà gli stessi file", { skip: !conManuale && "manca .cache/testo/manuale.md (npm run estrai-testo)" }, async () => {
  const file = ["elenchi/abilita.json", "archetipi.json", "carriere.json", "poteri.json", "equipaggiamento/armi.json"];
  const prima = file.map((f) => readFileSync(new URL(`../dati/${f}`, import.meta.url), "utf8"));
  const { estrai } = await import("../strumenti/estrai_dati.mjs");
  const zitto = console.log;
  console.log = () => {};
  try {
    await estrai();
  } finally {
    console.log = zitto;
  }
  assert.deepEqual(file.map((f) => readFileSync(new URL(`../dati/${f}`, import.meta.url), "utf8")), prima);
});
