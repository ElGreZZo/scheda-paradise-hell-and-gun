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
    abilita: 23, archetipi: 10, armi: 13, base: 22, caratteristiche: 4, carriere: 7, colori: 3, dimensioni: 5,
    distanze: 8, distruttivita: 6, poteri: 51, ricchezza: 7, seguaci: 4,
  });
});

test("dati: i poteri attivi e superiori hanno il testo di ogni livello e gli attacchi hanno le statistiche", () => {
  type Livello = { livello: number; testo?: string[]; attacco?: { distruttivita: number } };
  type Potere = { id: string; categoria: string; livelli: Livello[] };
  const { voci } = JSON.parse(readFileSync(new URL("../dati/poteri.json", import.meta.url), "utf8")) as { voci: Potere[] };
  const senzaTesto = voci.filter((p) => ["attivo", "superiore"].includes(p.categoria))
    .flatMap((p) => p.livelli.filter((l) => !l.testo?.length).map((l) => `${p.id} ${l.livello}`));
  assert.deepEqual(senzaTesto, []);
  const attacchi = voci.flatMap((p) => p.livelli.filter((l) => l.attacco).map((l) => `${p.id} ${l.livello}`));
  assert.deepEqual(attacchi, ["bestialita 2", "fuoco_purificatore 3", "geomanzia 4", "potere_del_sangue 3", "potere_della_cenere 3",
    "putrescenza 4", "signore_della_tempesta 4", "umbra 3"]);
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
