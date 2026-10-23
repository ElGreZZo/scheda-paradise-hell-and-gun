// Scegliendo l'archetipo, lo script scrive il colore e gli incrementi di caratteristica del manuale (cap. 7).
// Si possono sempre cambiare a mano dopo: lo script li riscrive solo quando cambia l'archetipo.
import { ARCHETIPI, CARATTERISTICHE } from "../base/modello";

/** Colore e incrementi dell'archetipo (gli incrementi che l'archetipo non ha valgono 0); vuoto se non c'è. Puro. */
export const valoriArchetipo = (id: string): Record<string, string> => {
  const archetipo = ARCHETIPI.find((a) => a.id === id);
  if (!archetipo) return {};
  return {
    colore: archetipo.colore,
    ...Object.fromEntries(CARATTERISTICHE.map(({ id: c }) => [`${c}_inc`, String(archetipo.incrementi[c] ?? 0)])),
  };
};

export const registraArchetipo = (): void => {
  on("change:archetipo", (evento) => {
    if (evento.sourceType !== "player") return;
    const valori = valoriArchetipo(evento.newValue ?? "");
    if (Object.keys(valori).length) setAttrs(valori);
  });
};
