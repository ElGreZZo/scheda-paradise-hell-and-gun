// Tipi di estrai_dati.mjs, per i test (test/dati.test.ts).

export const FONTE: string;
export const NOMI: Record<string, unknown>;
export function ident(nome: string): string;
export function estrai(): Promise<void>;
