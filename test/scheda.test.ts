// Calcoli puri dello script della scheda: personaggio (totali, punti ferita, mana, pallini) e tiri (riserva, esito,
// esuberi, opportunità, comando per la chat).
import assert from "node:assert/strict";
import { test } from "node:test";
import { valoriArchetipo } from "../src/worker/personaggio/archetipo.ts";
import { dopoIlClic, manaMassimo, pfMassimi, restaDopoIlMassimo, totaleCaratteristica } from "../src/worker/personaggio/calcoli.ts";
import { calcolaDerivati } from "../src/worker/personaggio/derivati.ts";
import { barraAttiva } from "../src/worker/personaggio/interfaccia.ts";
import { calcolatiProva, comandoProva, esitoProva, formula, opportunitaPagabili, riserva, stileDado } from "../src/worker/tiri/dadi.ts";

test("caratteristiche: ● + Inc, −2 in forma mortale, mai sotto zero", () => {
  assert.equal(totaleCaratteristica(2, 3, false), 5);
  assert.equal(totaleCaratteristica(2, 3, true), 3);
  assert.equal(totaleCaratteristica(1, 0, true), 0);
});

test("punti ferita e mana: 2 + Possanza e 2 × Potenza (Ezekiel: Possanza 3, Potenza 2 + Inc 3)", () => {
  assert.equal(pfMassimi(3), 5);
  assert.equal(manaMassimo(5), 10);
});

test("quanto resta quando cambia il massimo: i danni restano, la prima volta si parte pieni", () => {
  assert.equal(restaDopoIlMassimo(0, 0, 5), 5);
  assert.equal(restaDopoIlMassimo(3, 5, 6), 4);
  assert.equal(restaDopoIlMassimo(1, 5, 3), 0);
  assert.equal(restaDopoIlMassimo(9, 5, 5), 5);
});

test("pallini: il clic porta a n, sull'ultimo pieno lo toglie", () => {
  assert.equal(dopoIlClic(3, 1), 3);
  assert.equal(dopoIlClic(3, 3), 2);
  assert.equal(dopoIlClic(1, 1), 0);
});

test("derivati di Ezekiel: totali, PF 5/5, mana 10/10; in forma mortale cambiano solo i totali", () => {
  const valori = { possanza: "3", agilita: "2", astuzia: "2", astuzia_inc: "1", potenza: "2", potenza_inc: "3", pf: "0", pf_max: "0", mana: "0", mana_max: "0" };
  const d = calcolaDerivati(valori);
  assert.deepEqual([d.possanza_totale, d.agilita_totale, d.astuzia_totale, d.potenza_totale], ["3", "2", "3", "5"]);
  assert.deepEqual([d.pf, d.pf_max, d.pf_danni, d.mana, d.mana_max, d.mana_usato], ["5", "5", "0", "10", "10", "0"]);
  const m = calcolaDerivati({ ...valori, forma: "mortale", pf: "4", pf_max: "5", mana: "10", mana_max: "10" });
  assert.deepEqual([m.possanza_totale, m.potenza_totale, m.pf, m.pf_max, m.pf_danni], ["1", "3", "4", "5", "1"]);
});

test("archetipo: colore e incrementi del manuale (Serafino: bianco, Potenza 3, Astuzia 1)", () => {
  assert.deepEqual(valoriArchetipo("serafino"), { colore: "bianco", possanza_inc: "0", agilita_inc: "0", astuzia_inc: "1", potenza_inc: "3" });
  assert.deepEqual(valoriArchetipo(""), {});
});

test("barra dei tiri attiva se soglia, dadi o modificatori non sono normali", () => {
  assert.equal(barraAttiva({ tiro_soglia: "4", tiro_dadi: "0" }), "0");
  assert.equal(barraAttiva({ tiro_soglia: "3" }), "1");
  assert.equal(barraAttiva({ tiro_dadi: "-1" }), "1");
  assert.equal(barraAttiva({ mod_scosso: "1" }), "1");
});

test("riserva e formula", () => {
  const voci = [{ nome: "Possanza", valore: 3 }, { nome: "Mischia", valore: 2 }, { nome: "dadi", valore: 0 }, { nome: "Stordito", valore: -1 }];
  assert.equal(riserva(voci), 4);
  assert.equal(formula(voci), "Possanza 3 + Mischia 2 − Stordito 1 = 4D6");
  assert.equal(riserva([{ nome: "Agilità", valore: 0 }, { nome: "Scosso", valore: -1 }]), 0);
});

test("esito: successi da soglia+, esuberi oltre la difficoltà", () => {
  assert.deepEqual(esitoProva([6, 5, 4, 2, 1], 4, 1), { successi: 3, esito: 1, esuberi: 2 });
  assert.deepEqual(esitoProva([6, 5, 4, 2, 1], 5, 3), { successi: 2, esito: 2, esuberi: 0 });
  assert.deepEqual(esitoProva([3, 3], 3, 2), { successi: 2, esito: 1, esuberi: 0 });
  assert.equal(stileDado(1, 4), 3);
  assert.equal(stileDado(4, 4), 2);
  assert.equal(stileDado(3, 4), 1);
});

test("opportunità pagabili con gli esuberi, nessuna se la prova fallisce", () => {
  const opp = [{ nome: "Muoversi", esuberi: 1 }, { nome: "Rompere oggetto", esuberi: 2 }];
  assert.deepEqual(opportunitaPagabili(opp, { successi: 2, esito: 1, esuberi: 1 }), [1, 0]);
  assert.deepEqual(opportunitaPagabili(opp, { successi: 0, esito: 2, esuberi: 0 }), [0, 0]);
});

test("comando del tiro: template, dadi, opportunità; zero dadi senza tiro", () => {
  const prova = { titolo: "Atletica", voci: [{ nome: "Possanza", valore: 3 }, { nome: "Atletica", valore: 1 }], soglia: 4, difficolta: 1, gm: true, opportunita: [{ nome: "Muoversi", esuberi: 1 }] };
  const comando = comandoProva(prova);
  assert.match(comando, /^\/w gm &\{template:prova\} \{\{titolo=Atletica\}\}/);
  assert.match(comando, /\{\{tiro=\[\[4d6\]\]\}\}/);
  assert.match(comando, /\{\{d4=\[\[0\]\]\}\} \{\{s4=\[\[0\]\]\}\}/);
  assert.doesNotMatch(comando, /\{\{d5=/);
  assert.match(comando, /\{\{o1=Muoversi \(1\)\}\} \{\{k1=\[\[0\]\]\}\}/);
  const vuoto = comandoProva({ ...prova, gm: false, voci: [{ nome: "Possanza", valore: 0 }] });
  assert.match(vuoto, /\{\{tiro=\[\[0\]\]\}\} \{\{nessundado=1\}\}/);
  assert.deepEqual(calcolatiProva([6, 1], prova), { successi: 1, esito: 1, esuberi: 0, d1: 6, s1: 2, d2: 1, s2: 3, k1: 0 });
});
