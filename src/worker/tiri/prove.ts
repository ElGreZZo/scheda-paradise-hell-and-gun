// Tiri della pagina Personaggio. Un clic sul nome di un'abilità tira caratteristica + abilità (la prima delle
// caratteristiche abituali del manuale), sul nome di una caratteristica solo la caratteristica; con i dadi e i
// modificatori della barra dei tiri. «Iniziativa» tira 2D6 + Astuzia e lo mette nell'ordine dei turni (&{tracker}).
// Custom Roll Parsing: lo script legge i dadi e passa a finishRoll successi, esuberi e opportunità pagabili.
// I pulsanti si chiamano act_tiro<id> (niente underscore).
import { ABILITA, CARATTERISTICHE, campiCaratteristica, nomeCaratteristica, type Opportunita } from "../base/modello";
import { fra, intero } from "../base/numeri";
import { traduci } from "../base/testi";
import { totaleCaratteristica } from "../personaggio/calcoli";
import { calcolatiProva, comandoProva, dadiUsciti, type Prova, type Voce } from "./dadi";

export const BARRA = ["tiro_gm", "tiro_soglia", "tiro_difficolta", "tiro_dadi", "mod_stordito", "mod_scosso", "forma"];

/** Il totale di una caratteristica dai valori letti (● + Inc, −2 in forma mortale). */
export const totale = (valori: Valori, id: string): number => {
  const { base, inc } = campiCaratteristica(id);
  return totaleCaratteristica(intero(valori[base], 2), intero(valori[inc], 0), valori.forma === "mortale");
};

/** Le voci della barra: dadi ±, Stordito, Scosso. */
export const vociBarra = (valori: Valori): Voce[] => [
  { nome: traduci("chat.extra_dice"), valore: intero(valori.tiro_dadi) },
  { nome: traduci("chat.stunned"), valore: valori.mod_stordito === "1" ? -1 : 0 },
  { nome: traduci("chat.shaken"), valore: valori.mod_scosso === "1" ? -1 : 0 },
];

/** Tira una prova con le opzioni della barra (soglia, difficoltà, pubblico o GM). altro: dettaglio, nota, inceppa. */
export const tira = (titolo: string, voci: Voce[], valori: Valori, opportunita: Opportunita[], altro: Pick<Prova, "dettaglio" | "nota" | "inceppa"> = {}): void => {
  const prova = {
    titolo, voci, opportunita, ...altro,
    soglia: fra(intero(valori.tiro_soglia, 4), 2, 6),
    difficolta: fra(intero(valori.tiro_difficolta, 1), 1, 20),
    gm: valori.tiro_gm === "1",
  };
  startRoll(comandoProva(prova), (risultati) => {
    finishRoll(risultati.rollId, calcolatiProva(dadiUsciti(risultati.results.tiro), prova));
  });
};

export const registraProve = (): void => {
  CARATTERISTICHE.forEach(({ id, nome }) => {
    const { base, inc } = campiCaratteristica(id);
    on(`clicked:tiro${id}`, () => getAttrs([base, inc, ...BARRA], (valori) => {
      tira(nome, [{ nome, valore: totale(valori, id) }, ...vociBarra(valori)], valori, []);
    }));
  });

  ABILITA.forEach(({ id, nome, caratteristiche, opportunita }) => {
    const car = caratteristiche[0] ?? "astuzia";
    const { base, inc } = campiCaratteristica(car);
    on(`clicked:tiro${id}`, () => getAttrs([id, base, inc, ...BARRA], (valori) => {
      const voci = [{ nome: nomeCaratteristica(car), valore: totale(valori, car) }, { nome, valore: intero(valori[id]) }, ...vociBarra(valori)];
      tira(nome, voci, valori, opportunita);
    }));
  });

  on("clicked:tiroiniziativa", () => getAttrs(["astuzia", "astuzia_inc", "forma", "tiro_gm"], (valori) => {
    const astuzia = totale(valori, "astuzia");
    const comando = `${valori.tiro_gm === "1" ? "/w gm " : ""}&{template:iniziativa} {{personaggio=@{character_name}}} {{tiro=[[2d6 + ${astuzia}[${nomeCaratteristica("astuzia")}] &{tracker}]]}}`;
    startRoll(comando, (risultati) => finishRoll(risultati.rollId));
  }));
};
