// Tipi di traduzioni.mjs, per i test.

export function decodifica(testo: string): string;
export function pezzoDiChiave(testo: string): string;
export function appiattisci(albero: Record<string, unknown>, prefisso?: string): Record<string, string>;
export function riempiTraduzioni(html: string, traduzioni: Record<string, string>): { html: string; usate: Set<string>; errori: string[] };
export function chiaviDelloScript(sorgenti: string): { chiavi: Set<string>; schemi: RegExp[]; citate: Set<string> };
export function testiVisibili(html: string): string[];
export function testiSenzaChiave(html: string, esclusi?: Set<string>): string[];
