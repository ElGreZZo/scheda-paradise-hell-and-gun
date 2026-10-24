// Risorse della pagina Personaggio e numeri della barra dei tiri.
// - Tracciati (macro tracciato): un clic sulla casella n porta le caselle piene a n, o a n - 1 se era l'ultima
//   piena. Per i danni e il mana usato si cambia quanto resta (pf, mana = massimo - pieni); non letali e
//   cartucciera (le caselle piene sono le munizioni rimaste) si contano direttamente.
// - Numeri con − e + (macro passi): act_<pulsante>meno e act_<pulsante>piu, fra un minimo e un massimo.
import { fra, intero } from "../base/numeri";
import { dopoIlClic } from "./calcoli";

const TRACCIATI = [
  { pulsante: "danno", rimasto: "pf", massimo: "pf_max", quante: 20 },
  { pulsante: "mana", rimasto: "mana", massimo: "mana_max", quante: 24 },
];

const DIRETTI = [
  { pulsante: "nonletale", attributo: "pf_non_letali", massimo: "pf_max", predefinito: 0, quante: 20 },
  { pulsante: "colpo", attributo: "cartucciera", massimo: "cartucciera_max", predefinito: 30, quante: 40 },
];

const PASSI: { pulsante: string; attributo: string; minimo: number; massimo: number; predefinito: number }[] = [
  { pulsante: "temporanei", attributo: "pf_temporanei", minimo: 0, massimo: 30, predefinito: 0 },
  { pulsante: "anime", attributo: "anime", minimo: 0, massimo: 30, predefinito: 1 },
  { pulsante: "ispirazione", attributo: "ispirazione", minimo: 0, massimo: 30, predefinito: 0 },
  { pulsante: "difficolta", attributo: "tiro_difficolta", minimo: 1, massimo: 20, predefinito: 1 },
  { pulsante: "dadi", attributo: "tiro_dadi", minimo: -20, massimo: 20, predefinito: 0 },
  { pulsante: "animedep", attributo: "anime_depositate", minimo: 0, massimo: 999, predefinito: 0 },
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
  DIRETTI.forEach(({ pulsante, attributo, massimo, predefinito, quante }) => {
    for (let n = 1; n <= quante; n++) {
      on(`clicked:${pulsante}${n}`, () => {
        getAttrs([attributo, massimo], (valori) => {
          const max = intero(valori[massimo], predefinito);
          setAttrs({ [attributo]: String(fra(dopoIlClic(n, intero(valori[attributo], predefinito)), 0, max)) });
        });
      });
    }
  });
  // La cartucciera non supera il suo massimo (30, 40 con Armaiolo) quando il massimo cambia.
  on("change:cartucciera_max", () => getAttrs(["cartucciera", "cartucciera_max"], (valori) => {
    const max = intero(valori.cartucciera_max, 30);
    if (intero(valori.cartucciera, max) > max) setAttrs({ cartucciera: String(max) });
  }));
  PASSI.forEach(({ pulsante, attributo, minimo, massimo, predefinito }) => {
    const cambia = (passo: number) => getAttrs([attributo], (valori) => {
      setAttrs({ [attributo]: String(fra(intero(valori[attributo], predefinito) + passo, minimo, massimo)) });
    });
    on(`clicked:${pulsante}meno`, () => cambia(-1));
    on(`clicked:${pulsante}piu`, () => cambia(1));
  });
};
