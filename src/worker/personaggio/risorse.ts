// Risorse della pagina Personaggio e numeri della barra dei tiri.
// - Tracciati (macro tracciato): un clic sulla casella n porta le caselle piene a n, o a n - 1 se era l'ultima
//   piena. Per i danni e il mana usato si cambia quanto resta (pf, mana = massimo - pieni); i non letali si
//   contano direttamente.
// - Numeri con − e + (macro passi): act_<pulsante>meno e act_<pulsante>piu, fra un minimo e un massimo.
import { fra, intero } from "../base/numeri";
import { dopoIlClic } from "./calcoli";

const TRACCIATI = [
  { pulsante: "danno", rimasto: "pf", massimo: "pf_max", quante: 20 },
  { pulsante: "mana", rimasto: "mana", massimo: "mana_max", quante: 24 },
];

const PASSI: { pulsante: string; attributo: string; minimo: number; massimo: number; predefinito: number }[] = [
  { pulsante: "temporanei", attributo: "pf_temporanei", minimo: 0, massimo: 30, predefinito: 0 },
  { pulsante: "anime", attributo: "anime", minimo: 0, massimo: 30, predefinito: 1 },
  { pulsante: "ispirazione", attributo: "ispirazione", minimo: 0, massimo: 30, predefinito: 0 },
  { pulsante: "difficolta", attributo: "tiro_difficolta", minimo: 1, massimo: 20, predefinito: 1 },
  { pulsante: "dadi", attributo: "tiro_dadi", minimo: -20, massimo: 20, predefinito: 0 },
];

export const registraRisorse = (): void => {
  TRACCIATI.forEach(({ pulsante, rimasto, massimo, quante }) => {
    for (let n = 1; n <= quante; n++) {
      on(`clicked:${pulsante}${n}`, () => {
        getAttrs([rimasto, massimo], (valori) => {
          const max = intero(valori[massimo]);
          const pieni = fra(dopoIlClic(n, max - intero(valori[rimasto], max)), 0, max);
          setAttrs({ [rimasto]: String(max - pieni) });
        });
      });
    }
  });
  for (let n = 1; n <= 20; n++) {
    on(`clicked:nonletale${n}`, () => {
      getAttrs(["pf_non_letali", "pf_max"], (valori) => {
        setAttrs({ pf_non_letali: String(fra(dopoIlClic(n, intero(valori.pf_non_letali)), 0, intero(valori.pf_max))) });
      });
    });
  }
  PASSI.forEach(({ pulsante, attributo, minimo, massimo, predefinito }) => {
    const cambia = (passo: number) => getAttrs([attributo], (valori) => {
      setAttrs({ [attributo]: String(fra(intero(valori[attributo], predefinito) + passo, minimo, massimo)) });
    });
    on(`clicked:${pulsante}meno`, () => cambia(-1));
    on(`clicked:${pulsante}piu`, () => cambia(1));
  });
};
