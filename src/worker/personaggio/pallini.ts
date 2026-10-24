// Pallini delle caratteristiche (6 per i ● e 4 per l'Inc) e delle abilità (5). Ogni pallino è un pulsante
// act_<pulsante><n> (macro pallini in src/scheda/macro.njk): il clic porta il valore a n, o a n - 1 se n era già
// l'ultimo pieno. I nomi dei pulsanti non hanno underscore: su Roll20 clicked: altrimenti non scatta.
import { ABILITA, CARATTERISTICHE } from "../base/modello";
import { intero } from "../base/numeri";
import { dopoIlClic } from "./calcoli";

interface Gruppo {
  pulsante: string;
  attributo: string;
  quanti: number;
  predefinito: number;
}

const GRUPPI: Gruppo[] = [
  ...CARATTERISTICHE.flatMap(({ id }) => [
    { pulsante: id, attributo: id, quanti: 6, predefinito: 2 },
    { pulsante: `${id}inc`, attributo: `${id}_inc`, quanti: 4, predefinito: 0 },
  ]),
  ...ABILITA.map(({ id }) => ({ pulsante: id, attributo: id, quanti: 5, predefinito: 0 })),
  // Ricchezza da ○ a ●●●●●● (cap. 11), anche quella depositata.
  { pulsante: "ricchezza", attributo: "ricchezza", quanti: 6, predefinito: 0 },
  { pulsante: "ricchezzadep", attributo: "ricchezza_depositata", quanti: 6, predefinito: 0 },
];

export const registraPallini = (): void => {
  GRUPPI.forEach(({ pulsante, attributo, quanti, predefinito }) => {
    for (let n = 1; n <= quanti; n++) {
      on(`clicked:${pulsante}${n}`, () => {
        getAttrs([attributo], (valori) => setAttrs({ [attributo]: String(dopoIlClic(n, intero(valori[attributo], predefinito))) }));
      });
    }
  });
};
