// Tipi di build.mjs, per i test (test/build.test.ts).

export const PORTA: number;
export function espandiRollTemplate(testo: string, nomi: string[]): string;
export function violazioniCssRoll20(testo: string): string[];
export function inverseSbagliate(html: string): string[];
export function riferimentiSenzaValore(html: string): string[];
export function build(opzioni?: { minifica?: boolean; mappa?: boolean; sviluppo?: boolean; elencoSenzaChiave?: boolean }): Promise<void>;
