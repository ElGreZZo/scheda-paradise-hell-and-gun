// Ambiente dei test (npm test lo carica prima di tutto, con --import): le funzioni di Roll20 che lo script chiama
// anche nei calcoli puri. getTranslationByKey legge src/traduzioni/it.json appiattito come nella build; una chiave
// che manca dà false, come su Roll20.
import { readFileSync } from "node:fs";
import { appiattisci } from "../strumenti/traduzioni.mjs";

const traduzioni: Record<string, string> = appiattisci(JSON.parse(readFileSync(new URL("../src/traduzioni/it.json", import.meta.url), "utf8")));
(globalThis as unknown as { getTranslationByKey: (chiave: string) => string | false }).getTranslationByKey = (chiave) => traduzioni[chiave] ?? false;
