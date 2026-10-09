// Controlli della build sui vincoli di Roll20 (strumenti/build.mjs): filtro di sicurezza del CSS, sezioni inverse
// dei roll template, pulsanti di tiro con campi senza valore iniziale.
import assert from "node:assert/strict";
import { test } from "node:test";
import { inverseSbagliate, riferimentiSenzaValore, violazioniCssRoll20 } from "../strumenti/build.mjs";

test("CSS: Roll20 scarta il foglio con lettere accentate o data:", () => {
  assert.deepEqual(violazioniCssRoll20(".a { color: red; }"), []);
  assert.equal(violazioniCssRoll20(".a::after { content: \"\u00e8\"; }").length, 1);
  // "\u25cf" (U+25CF) \u00e8 fuori dall'intervallo vietato: passa.
  assert.deepEqual(violazioniCssRoll20(".a::after { content: \"\u25cf\"; }"), []);
  assert.equal(violazioniCssRoll20(".a { background: url(data:image/png;base64,AA); }").length, 1);
});

test("roll template: {{#^prop}} su una proprietà non si vede mai", () => {
  assert.deepEqual(inverseSbagliate("{{#^rollTotal() t 0}}x{{/^rollTotal() t 0}} {{#^danni}}y{{/^danni}}"), ["{{#^danni}}"]);
});

test("pulsanti di tiro: ogni @{campo} ha un campo con un valore iniziale", () => {
  const html = '<input name="attr_possanza" value="2"><button type="roll" value="[[@{possanza}d6>4]] [[@{mischia}d6]]"></button>';
  assert.deepEqual(riferimentiSenzaValore(html), ["@{mischia}"]);
});
