// Testi che lo script scrive (card in chat): vengono dal file delle traduzioni (src/traduzioni/it.json,
// translation.json su Roll20), come quelli dei template. I nomi del manuale (caratteristiche, abilità,
// opportunità) vengono invece dalla base dati (base/modello.ts) e restano come li ha scritti il master.

/** Il testo della chiave, con i segnaposto {nome} sostituiti dai valori. Una chiave che manca si vede come su
 *  Roll20: [chiave]. */
export const traduci = (chiave: string, valori: Record<string, string | number> = {}): string => {
  const testo = getTranslationByKey(chiave);
  if (testo === false || testo === undefined) return `[${chiave}]`;
  return testo.replace(/\{(\w+)\}/g, (tutto, nome: string) => (nome in valori ? String(valori[nome]) : tutto));
};
