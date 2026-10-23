// Numeri letti dagli attributi (sempre testo, a volte vuoto). Puri.

/** Il numero intero del testo, o il predefinito se il testo non è un numero. */
export const intero = (valore: string | undefined, predefinito = 0): number => {
  const n = parseInt(String(valore ?? "").trim(), 10);
  return Number.isNaN(n) ? predefinito : n;
};

/** Il numero fra minimo e massimo. */
export const fra = (n: number, minimo: number, massimo: number): number => Math.min(massimo, Math.max(minimo, n));
