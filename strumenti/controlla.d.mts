// Tipi di controlla.mjs, per i test (test/dati.test.ts).

export function normalizza(testo: string): string;
export function controlla(opzioni?: { stampa?: (riga: string) => void }): Promise<{ errori: string[]; avvisi: string[] }>;
