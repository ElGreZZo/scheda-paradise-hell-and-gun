// Valori calcolati della pagina Personaggio: totali delle caratteristiche, punti ferita e mana massimi, caselle piene
// dei tracciati. Si ricalcolano quando cambia uno dei valori da cui dipendono e all'apertura della scheda.
// pf e mana sono quanto resta (con il massimo in pf_max e mana_max, che Roll20 usa per le barre del token);
// pf_danni e mana_usato sono le caselle piene dei tracciati (massimo meno quanto resta).
import { CARATTERISTICHE, campiCaratteristica } from "../base/modello";
import { fra, intero } from "../base/numeri";
import { manaMassimo, pfMassimi, restaDopoIlMassimo, totaleCaratteristica } from "./calcoli";

const CAMPI = [
  ...CARATTERISTICHE.flatMap(({ id }) => [campiCaratteristica(id).base, campiCaratteristica(id).inc]),
  "forma", "pf", "pf_max", "pf_non_letali", "mana", "mana_max",
];

/** I valori calcolati dai valori letti. Puro. */
export const calcolaDerivati = (valori: Valori): Record<string, string> => {
  const mortale = valori.forma === "mortale";
  const uscita: Record<string, string> = {};
  const immortale: Record<string, number> = {};
  CARATTERISTICHE.forEach(({ id }) => {
    const { base, inc, totale } = campiCaratteristica(id);
    const [b, i] = [intero(valori[base], 2), intero(valori[inc], 0)];
    immortale[id] = totaleCaratteristica(b, i, false);
    uscita[totale] = String(totaleCaratteristica(b, i, mortale));
  });
  const pfMax = pfMassimi(immortale.possanza);
  const manaMax = manaMassimo(immortale.potenza);
  const pf = restaDopoIlMassimo(intero(valori.pf), intero(valori.pf_max), pfMax);
  const mana = restaDopoIlMassimo(intero(valori.mana), intero(valori.mana_max), manaMax);
  Object.assign(uscita, {
    pf_max: String(pfMax), pf: String(pf), pf_danni: String(pfMax - pf),
    pf_non_letali: String(fra(intero(valori.pf_non_letali), 0, pfMax)),
    mana_max: String(manaMax), mana: String(mana), mana_usato: String(manaMax - mana),
  });
  return uscita;
};

export const ricalcola = (): void => {
  getAttrs(CAMPI, (valori) => setAttrs(calcolaDerivati(valori), { silent: true }));
};

export const registraDerivati = (): void => {
  const eventi = ["sheet:opened", ...CAMPI.filter((c) => !c.endsWith("_max")).map((c) => `change:${c}`)];
  on(eventi.join(" "), () => ricalcola());
};
