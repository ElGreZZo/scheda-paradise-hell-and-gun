// Traduzioni della scheda: dal sorgente annidato src/traduzioni/it.json al
// translation.json piatto che vuole Roll20, e i testi della lingua di base riempiti nell'HTML dalla build.
//
// Nei template gli elementi tradotti restano vuoti, con gli attributi di Roll20:
//   <span data-i18n="inventory.details.notes.label"></span>      il testo
//   data-i18n-title, data-i18n-placeholder, data-i18n-aria-label  gli attributi title, placeholder, aria-label
//   ^{chiave} nel value dei pulsanti di tiro (type="roll")
// La build scrive dentro il testo italiano (e l'attributo accanto a data-i18n-*): l'HTML si legge anche senza
// traduzioni e il confronto con i commit di prima resta possibile. Su Roll20 una chiave che manca nel file si
// vede come [chiave] (prove T0, 01/10/2026), quindi la build si ferma; dentro un <rolltemplate> ^{chiave} non
// viene tradotto, e lì si usa data-i18n.

const ATTRIBUTI = ["title", "placeholder", "aria-label"];
const VUOTI = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const CHIAVE = /^[A-Za-z0-9_-]+$/;

const escapeTesto = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttributo = (s) => escapeTesto(s).replace(/"/g, "&quot;");
const ENTITA = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export const decodifica = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (tutto, e) =>
  e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITA[e.toLowerCase()] ?? tutto);

// Pezzo di una chiave da un testo usato come valore (elenchi del modello fatti di soli testi, filtro chiave dei
// template): "Ogni riposo" → "ogni_riposo", "Nano-potenziamento" → "nano_potenziamento".
export const pezzoDiChiave = (testo) => String(testo).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

// {"header": {"title": "X"}} → {"header.title": "X"}. Il sorgente annidato non può avere un nodo che è sia testo
// sia gruppo; un punto dentro un nome lo permetterebbe ("a.b" testo e "a": {"b": {…}}), quindi è un errore.
export function appiattisci(albero, prefisso = "") {
  const piatto = {};
  for (const [nome, valore] of Object.entries(albero)) {
    const chiave = prefisso ? `${prefisso}.${nome}` : nome;
    if (!CHIAVE.test(nome)) throw new Error(`traduzioni: nome "${chiave}" non valido (lettere, cifre, _ e -; il punto separa i livelli)`);
    if (typeof valore === "string") {
      if (!valore.trim()) throw new Error(`traduzioni: testo vuoto in "${chiave}"`);
      piatto[chiave] = valore;
    } else if (valore && typeof valore === "object" && !Array.isArray(valore)) Object.assign(piatto, appiattisci(valore, chiave));
    else throw new Error(`traduzioni: "${chiave}" deve essere un testo o un gruppo`);
  }
  return piatto;
}

// Riempie l'HTML generato con i testi di traduzioni (piatto). Restituisce l'HTML, le chiavi usate e gli errori:
// chiavi che mancano, elementi con data-i18n non vuoti nel template, attributi scritti due volte, <option>
// tradotte senza value (il valore salvato cambierebbe con la lingua), ^{…} dentro un roll template.
export function riempiTraduzioni(html, traduzioni) {
  const usate = new Set();
  const errori = [];
  const usa = (chiave, dove) => {
    usate.add(chiave);
    if (!Object.hasOwn(traduzioni, chiave)) errori.push(`chiave che manca in src/traduzioni/it.json: ${chiave} (${dove})`);
    return traduzioni[chiave] ?? `[${chiave}]`;
  };
  // Lo script resta fuori: tolto prima e rimesso alla fine.
  const script = [];
  const senzaScript = html.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/g, (_, apertura, corpo, chiusura) => `${apertura}\u0000${script.push(corpo) - 1}\u0000${chiusura}`);
  const uscita = senzaScript.replace(/<([a-zA-Z][\w-]*)(\s[^>]*)>/g, (tag, nome, attributi) => {
    if (!/\sdata-i18n-/.test(attributi)) return tag;
    let nuovi = attributi;
    for (const attributo of ATTRIBUTI) {
      const m = new RegExp(`\\sdata-i18n-${attributo}="([^"]*)"`).exec(nuovi);
      if (!m) continue;
      if (new RegExp(`\\s${attributo}="`).test(nuovi)) errori.push(`<${nome}> con ${attributo}= e data-i18n-${attributo}=: tieni solo data-i18n-${attributo} (${m[1]})`);
      const testo = usa(m[1], `data-i18n-${attributo}`);
      nuovi = nuovi.slice(0, m.index + m[0].length) + ` ${attributo}="${escapeAttributo(testo)}"` + nuovi.slice(m.index + m[0].length);
    }
    return `<${nome}${nuovi}>`;
  });
  // Testo: l'elemento deve essere vuoto nel template (al più spazi); la build ci mette il testo.
  const pezzi = [];
  let ultimo = 0;
  for (const m of uscita.matchAll(/<([a-zA-Z][\w-]*)\b[^>]*\sdata-i18n="([^"]*)"[^>]*>/g)) {
    const [tag, nome, chiave] = m;
    const fine = m.index + tag.length;
    const chiusura = new RegExp(`^\\s*</${nome}>`).exec(uscita.slice(fine));
    if (!chiusura) {
      errori.push(`<${nome} data-i18n="${chiave}"> non è vuoto nel template: il testo lo mette la build`);
      continue;
    }
    if (nome.toLowerCase() === "option" && !/\svalue="/.test(tag)) errori.push(`<option data-i18n="${chiave}"> senza value: scrivi value con il testo di prima`);
    pezzi.push(uscita.slice(ultimo, fine), escapeTesto(usa(chiave, `<${nome}>`)));
    ultimo = fine + chiusura[0].length - `</${nome}>`.length;
  }
  pezzi.push(uscita.slice(ultimo));
  const riempito = pezzi.join("");
  // ^{chiave} nei pulsanti di tiro; dentro i roll template Roll20 non lo traduce.
  for (const m of riempito.matchAll(/<button\b[^>]*type="roll"[^>]*\svalue="([^"]*)"/g)) for (const r of m[1].matchAll(/\^\{([^{}]+)\}/g)) usa(r[1], "pulsante di tiro");
  for (const m of riempito.matchAll(/<rolltemplate class="([^"]+)">([\s\S]*?)<\/rolltemplate>/g)) {
    for (const r of m[2].matchAll(/\^\{([^{}]+)\}/g)) errori.push(`^{${r[1]}} nel roll template ${m[1]}: Roll20 non lo traduce, usa <span data-i18n="${r[1]}"></span>`);
  }
  return { html: riempito.replace(/\u0000(\d+)\u0000/g, (_, n) => script[Number(n)]), usate, errori };
}

// Chiavi usate dallo script, lette dai sorgenti di src/worker/ (nella build minificata i nomi delle funzioni
// cambiano): le chiavi scritte per intero in traduci("…") e getTranslationByKey("…") e i ^{…} dei testi dei tiri
// (chiavi); le chiavi composte in traduci(`abilities.${id}.name`) come schemi (abilities.<qualsiasi>.name), per
// non contare fra le chiavi che nessuno usa quelle che lo script trova da un id; ogni stringa fatta come una chiave
// (parole minuscole separate dal punto: "chat.check.mode.advantage", anche dentro una condizione) come citata.
export function chiaviDelloScript(sorgenti) {
  const chiavi = new Set();
  const schemi = [];
  const citate = new Set([...sorgenti.matchAll(/["'`]([a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+)+)["'`]/g)].map((m) => m[1]));
  for (const m of sorgenti.matchAll(/\b(?:traduci|getTranslationByKey)\(\s*(["'])([A-Za-z0-9_.-]+)\1/g)) chiavi.add(m[2]);
  for (const m of sorgenti.matchAll(/\^\{([A-Za-z0-9_.-]+)\}/g)) chiavi.add(m[1]);
  for (const m of sorgenti.matchAll(/\b(?:traduci|getTranslationByKey)\(\s*`([^`]*)`/g)) {
    if (!m[1].includes("${")) chiavi.add(m[1]);
    else schemi.push(new RegExp(`^${m[1].split(/\$\{[^}]*\}/).map((pezzo) => pezzo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[A-Za-z0-9_-]+")}$`));
  }
  return { chiavi, schemi, citate };
}

// Pezzi dell'HTML in ordine, fuori da script, style e commenti: { testo, dentro } per i testi (dentro = gli
// elementi aperti, dal più esterno) e { attributo, valore, tag } per title, placeholder e aria-label.
function pezziVisibili(html) {
  const pezzi = [];
  const aperti = [];
  const pulito = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  for (const m of pulito.matchAll(/<(\/?)([a-zA-Z][\w-]*)((?:\s+[^\s=>]+(?:="[^"]*")?)*)\s*\/?>|([^<]+)/g)) {
    if (m[4] !== undefined) {
      // Spazi dell'HTML ridotti a uno; gli spazi unificatori (&nbsp;, rientro delle qualifiche nei menu) si vedono e restano.
      const testo = decodifica(m[4]).replace(/[ \t\r\n\f]+/g, " ").replace(/^ | $/g, "");
      if (testo) pezzi.push({ testo, dentro: [...aperti] });
      continue;
    }
    const nome = m[2].toLowerCase();
    if (m[1]) {
      const i = aperti.map((a) => a.nome).lastIndexOf(nome);
      if (i >= 0) aperti.length = i;
      continue;
    }
    const attributi = Object.fromEntries([...m[3].matchAll(/([^\s=>]+)(?:="([^"]*)")?/g)].map((a) => [a[1].toLowerCase(), decodifica(a[2] ?? "")]));
    const tag = { nome, attributi };
    for (const attributo of ATTRIBUTI) if (attributi[attributo] !== undefined && attributi[attributo].trim()) pezzi.push({ attributo, valore: attributi[attributo], tag });
    if (!VUOTI.has(nome)) aperti.push(tag);
  }
  return pezzi;
}

const descrivi = (tag) => `<${tag.nome}${tag.attributi.class ? `.${tag.attributi.class.trim().split(/\s+/).join(".")}` : ""}>`;

// Testi visibili, per il confronto con un commit di prima (strumenti/confronta.mjs): spostarli nelle traduzioni
// non deve cambiarne nessuno. Righe "testo" e "attributo: valore", in ordine. Gli elementi in linea (span, b, i…)
// non spezzano il testo: "Punti psi spesi {{psi}}" e "<span>Punti psi spesi</span> {{psi}}" si leggono uguali.
const IN_LINEA = new Set(["span", "b", "i", "em", "strong", "small", "sub", "sup"]);
export function testiVisibili(html) {
  const righe = [];
  let testo = "";
  const chiudi = () => {
    const pulito = testo.replace(/[ \t\r\n\f]+/g, " ").replace(/^ | $/g, "");
    if (pulito) righe.push(pulito);
    testo = "";
  };
  const pulito = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  for (const m of pulito.matchAll(/<(\/?)([a-zA-Z][\w-]*)((?:\s+[^\s=>]+(?:="[^"]*")?)*)\s*\/?>|([^<]+)/g)) {
    if (m[4] !== undefined) {
      testo += decodifica(m[4]);
      continue;
    }
    if (!IN_LINEA.has(m[2].toLowerCase())) chiudi();
    if (m[1]) continue;
    for (const a of m[3].matchAll(/([^\s=>]+)="([^"]*)"/g)) {
      if (ATTRIBUTI.includes(a[1].toLowerCase()) && decodifica(a[2]).trim()) righe.push(`${a[1].toLowerCase()}: ${decodifica(a[2])}`);
    }
  }
  chiudi();
  return righe;
}

// Testi visibili senza chiave: testi con almeno una lettera (tolti i {{…}} dei roll template e i dadi come 1d12) il
// cui elemento non ha data-i18n, e title, placeholder, aria-label senza data-i18n-*. Restano fuori i testi in
// esclusi (nomi del manuale, che non si traducono), quelli dentro <textarea>, le icone (una lettera sola, o un
// elemento aria-hidden: la "i" delle carte, la "C" della concentrazione).
export function testiSenzaChiave(html, esclusi = new Set()) {
  const elenco = [];
  for (const p of pezziVisibili(html)) {
    if (p.testo !== undefined) {
      const genitore = p.dentro.at(-1);
      // trim() toglie anche gli spazi unificatori del rientro nei menu.
      const parole = p.testo.replace(/\{\{[^{}]*\}\}/g, "").replace(/\b\d*d\d+\b/g, "");
      if (!/\p{L}/u.test(parole) || /^\s*\p{L}\s*$/u.test(parole) || esclusi.has(p.testo.trim())) continue;
      if (genitore?.attributi["data-i18n"] !== undefined || p.dentro.some((t) => t.nome === "textarea" || t.attributi["aria-hidden"] === "true")) continue;
      elenco.push(`${genitore ? descrivi(genitore) : "(radice)"} ${p.testo}`);
    } else if (p.tag.attributi[`data-i18n-${p.attributo}`] === undefined && /\p{L}/u.test(p.valore) && !esclusi.has(p.valore)) {
      elenco.push(`${descrivi(p.tag)} ${p.attributo}="${p.valore}"`);
    }
  }
  return elenco;
}
