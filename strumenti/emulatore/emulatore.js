// Emulatore locale di una scheda Roll20 (Custom Sheet Sandbox, CSE).
//
// Riproduce quanto basta per usare e studiare una scheda fuori da Roll20:
// - HTML e CSS della scheda in un iframe, traduzioni data-i18n, pulsanti roll e action;
// - attributi legati ai campi (attr_*, anche _max), pseudo-attributi (character_name,
//   character_id, charactermancer_step), sezioni ripetibili con aggiungi, modifica, elimina, sposta;
// - sheet worker in Web Worker separati (uno per blocco di codice), con eventi change:, clicked:,
//   sheet:opened, remove:, sheet:compendium-drop, $20 e populateListOptions;
// - tiri con @{attributi}, ^{traduzioni}, ?{domande}, [[tiri in linea]], roll template con helper,
//   sussurri, Custom Roll Parsing (startRoll/finishRoll);
// - Charactermancer (charmancer.js) e compendio locale (compendio.js), se l'esempio li ha;
// - pannelli con chat, attributi modificabili, compendio, stato del wizard e registro degli eventi.
// Non è Roll20: vedi README.md in questa cartella per le differenze note.

import { creaMotoreTiri } from "./tiri.js";
import { caricaCompendio } from "./compendio.js";
import { creaCharmancer } from "./charmancer.js";

const $ = (selettore, radice = document) => radice.querySelector(selettore);
const $$ = (selettore, radice = document) => [...radice.querySelectorAll(selettore)];
const escapeHtml = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const ID_RIGA = /^repeating_([^_]+)_(-[A-Za-z0-9_-]{19})_(.+)$/;
const PSEUDO = { character_name: "name", character_id: "id", charactermancer_step: "mancerstep" };

async function testo(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.text();
}

// ---------------------------------------------------------------- attributi

class Attributi {
  constructor() {
    this.mappa = new Map(); // nome in minuscolo -> { name, current, max }
  }
  static base(nome) {
    const s = String(nome);
    return /_max$/i.test(s) ? { base: s.slice(0, -4), campo: "max" } : { base: s, campo: "current" };
  }
  carica(elenco) {
    this.mappa.clear();
    for (const a of elenco) this.mappa.set(a.name.toLowerCase(), { name: a.name, current: a.current ?? "", max: a.max ?? "" });
  }
  esporta() {
    return [...this.mappa.values()];
  }
  ha(nome) {
    const { base, campo } = Attributi.base(nome);
    const a = this.mappa.get(base.toLowerCase());
    return Boolean(a) && (campo === "current" || a.max !== "");
  }
  leggi(nome) {
    const { base, campo } = Attributi.base(nome);
    return this.mappa.get(base.toLowerCase())?.[campo];
  }
  scrivi(nome, valore) {
    const { base, campo } = Attributi.base(nome);
    const chiave = base.toLowerCase();
    const a = this.mappa.get(chiave) ?? { name: base, current: "", max: "" };
    a[campo] = valore;
    this.mappa.set(chiave, a);
  }
  elimina(prefisso) {
    const p = prefisso.toLowerCase();
    const rimossi = {};
    for (const [chiave, a] of this.mappa) {
      if (chiave.startsWith(p + "_")) {
        rimossi[a.name] = a.current;
        this.mappa.delete(chiave);
      }
    }
    return rimossi;
  }
  righe(sezione) {
    const ids = new Map();
    const prefisso = `repeating_${sezione}_`.toLowerCase();
    for (const a of this.mappa.values()) {
      const m = ID_RIGA.exec(a.name);
      if (m && m[1].toLowerCase() === sezione.toLowerCase() && a.name.toLowerCase().startsWith(prefisso)) ids.set(m[2].toLowerCase(), m[2]);
    }
    const ordine = String(this.leggi(`_reporder_repeating_${sezione}`) ?? "").split(",").filter(Boolean);
    const ordinati = ordine.filter((id) => ids.has(id.toLowerCase())).map((id) => ids.get(id.toLowerCase()));
    const vuote = ordine.filter((id) => !ids.has(id.toLowerCase()) && /^-[A-Za-z0-9_-]{19}$/.test(id));
    return [...new Set([...ordinati, ...ids.values(), ...vuote])];
  }
}

// ---------------------------------------------------------------- pagina

const PAGINA = `
  <header class="barra">
    <h1 id="titolo-scheda"></h1>
    <span class="sottotitolo">emulatore Roll20 · <span id="titolo-personaggio"></span> <span id="stato-charmancer" class="distintivo" hidden></span></span>
    <span class="spazio"></span>
    <label>Personaggio <select id="scelta-personaggio"></select></label>
    <button id="comando-apertura" title="Emette di nuovo l'evento sheet:opened">sheet:opened</button>
    <button id="comando-ripristina" title="Ricarica il personaggio dal file, perdendo le modifiche salvate nel browser">Ripristina</button>
    <button id="comando-esporta" title="Scarica il personaggio (attributi e dati del wizard) in JSON">Esporta</button>
    <label class="file" title="Carica un personaggio esportato">Importa<input id="comando-importa" type="file" accept=".json,application/json"></label>
    <button id="comando-salva-disco" title="Salva il personaggio su disco (strumenti/emulatore/salvataggi/, fuori da git), per ricaricarlo quando serve">Salva su disco</button>
    <label id="etichetta-salvataggi" title="Ricarica un personaggio salvato su disco al posto di quello aperto">Salvati <select id="scelta-salvataggio"></select></label>
  </header>
  <main class="area">
    <div class="scheda-scorrimento"><iframe id="scheda-iframe" title="Scheda del personaggio"></iframe></div>
    <aside>
      <nav class="linguette">
        <button class="attiva" data-pannello="pannello-chat">Chat</button>
        <button data-pannello="pannello-attributi">Attributi</button>
        <button data-pannello="pannello-compendio" id="linguetta-compendio" hidden>Compendio</button>
        <button data-pannello="pannello-wizard" id="linguetta-wizard" hidden>Wizard</button>
        <button id="linguetta-registro" data-pannello="pannello-registro">Eventi</button>
      </nav>
      <section class="pannello" id="pannello-chat">
        <div class="strumenti">Risultato dei tiri, con i roll template della scheda <span class="spazio"></span><button id="comando-svuota-chat">Svuota</button></div>
        <div id="chat-elenco" class="textchatcontainer"></div>
      </section>
      <section class="pannello" id="pannello-attributi" hidden>
        <div class="strumenti"><input id="attributi-filtro" placeholder="Filtra per nome"><span id="attributi-conteggio"></span></div>
        <div class="tabella-attributi"><table><thead><tr><th>nome</th><th>current</th><th>max</th></tr></thead><tbody id="attributi-corpo"></tbody></table></div>
      </section>
      <section class="pannello" id="pannello-compendio" hidden>
        <div class="strumenti"><select id="compendio-categoria"></select><input id="compendio-cerca" placeholder="Cerca per nome o query (Category:Spells Level:1)"></div>
        <div class="compendio-corpo"><ul id="compendio-elenco"></ul><div id="compendio-anteprima"><p class="suggerimento">Trascina una voce sulla scheda per il drop dal compendio, o cliccala per leggerla.</p></div></div>
      </section>
      <section class="pannello" id="pannello-wizard" hidden>
        <div class="strumenti">Dati del Charactermancer (getCharmancerData) <span class="spazio"></span><span id="wizard-slide"></span></div>
        <pre id="wizard-dati"></pre>
      </section>
      <section class="pannello" id="pannello-registro" hidden>
        <div class="strumenti">Eventi, setAttrs, chiamate del wizard, console ed errori dei worker (passa col mouse per i dettagli) <button id="comando-svuota-registro">Svuota</button></div>
        <ul id="registro-elenco"></ul>
      </section>
    </aside>
  </main>
  <dialog id="dialogo-domanda">
    <form method="dialog">
      <p id="domanda-testo"></p>
      <div id="domanda-campo"></div>
      <menu><button value="annulla">Annulla</button> <button value="ok" class="principale">Invia</button></menu>
    </form>
  </dialog>`;

// Un @import vale solo in cima al foglio. Roll20 trasforma quelli della scheda in <link> (in partita
// il font della Community Edition arriva così): qui si spostano in testa, prima del CSS di base.
const conImportInCima = (css) => {
  const importazioni = [];
  const resto = css.replace(/@import\s[^;]+;/g, (regola) => (importazioni.push(regola), ""));
  return [...importazioni, resto].join("\n");
};

// Roll20 fa passare le immagini dal suo proxy: in locale si usa l'indirizzo originale.
const senzaProxy = (css) => css.replace(/https:\/\/imgsrv\.roll20\.net\/?\?src=([^'")\s]+)/g, (_, u) => decodeURIComponent(u));

// Una scheda custom arriva a Roll20 come un solo HTML e un solo CSS: la piattaforma ne ricava roll
// template, slide del Charactermancer e blocchi del worker con le espressioni di loadCustomSheetCode
// (verificate nel client di Roll20 il 15 settembre 2026), e toglie dal CSS i blocchi "start mobile".
export function dividiSchedaCompleta(htmlCompleto, css) {
  const rollTemplates = {};
  const worker = [];
  let html = htmlCompleto.replace(/(<rolltemplate [^>]+>)([\s\S]*?)(<\/rolltemplate>)/gi, (_, apertura, contenuto) => {
    const nome = /(class="sheet-rolltemplate-)([^"]+)(">)/i.exec(apertura)?.[2];
    if (nome) rollTemplates[nome] = contenuto;
    return "";
  });
  html = html.replace(/(<charmancer [^>]+>)([\s\S]*?)(<\/charmancer>)/gi, "");
  html = html.replace(/(<script [^>]+>)([\s\S]*?)(<\/script>)/gi, (tutto, apertura, codice) => {
    if (!/(type=["|']text\/worker["|']>)/i.test(apertura)) return tutto;
    worker.push(codice);
    return "";
  });
  const cssSenzaMobile = css.replace(/\/\*\s*?start mobile\s*?\*\/[\s\S]*?\/\*\s*?end mobile\s*?\*\//gim, "");
  return { html, css: cssSenzaMobile, rollTemplates, worker };
}

export async function avviaEmulatore(config) {
  const base = new URL(config.cartella, location.href);
  const url = (file) => new URL(file, base).href;
  const leggiMappa = async (mappa) => Object.fromEntries(await Promise.all(Object.entries(mappa ?? {}).map(async ([nome, f]) => [nome, await testo(url(f))])));
  const completa = config.schedaCompleta
    ? dividiSchedaCompleta(await testo(url(config.schedaCompleta)), await testo(url(config.css)))
    : null;
  const nomiWorker = completa ? completa.worker.map((_, n) => `${config.schedaCompleta} (worker ${n + 1})`) : config.worker;
  const [html, cssScheda, cssChat, cssBase, codiciWorker, shim, traduzioneJson, rollTemplates, impostazioniScheda] = await Promise.all([
    completa ? completa.html : testo(url(config.html)),
    completa ? [completa.css] : Promise.all(config.cssScheda.map((f) => testo(url(f)))),
    completa ? [completa.css] : Promise.all((config.cssChat ?? []).map((f) => testo(url(f)))),
    testo(new URL("./roll20-base.css", import.meta.url).href),
    completa ? completa.worker : Promise.all(config.worker.map((f) => testo(url(f)))),
    testo(new URL("./worker-shim.js", import.meta.url).href),
    config.traduzioni ? testo(url(config.traduzioni)).then(JSON.parse) : { values: {}, lang: "it" },
    completa ? completa.rollTemplates : leggiMappa(config.rollTemplates),
    config.impostazioni ? testo(url(config.impostazioni)).then(JSON.parse) : [],
  ]);
  const charmancerTemplates = config.charmancer ? { pagine: await leggiMappa(config.charmancer.pagine), ripetibili: await leggiMappa(config.charmancer.ripetibili) } : null;
  const compendio = config.compendio ? await caricaCompendio(new URL(config.compendio, base)) : null;
  const traduzioni = traduzioneJson.values ?? traduzioneJson;

  document.body.innerHTML = PAGINA;
  const attributi = new Attributi();
  const registro = creaRegistro();
  const chat = creaChat();
  let personaggio = { name: "Nuovo personaggio", id: "-EMULATOREPERSONAGG", campi: {} };
  let sceltaPersonaggio = null;

  // ------------------------------------------------ stile
  // In partita il CSS della scheda vale due volte: nell'iframe della scheda, senza prefissi, e
  // nella pagina principale (prefissato con .charsheet), dove servono le regole dei roll template.
  const stileChat = document.createElement("style");
  stileChat.textContent = senzaProxy(conImportInCima(cssBase + "\n" + cssChat.join("\n")));
  document.head.append(stileChat);

  // ------------------------------------------------ scheda (in un iframe, come su Roll20)
  const iframe = $("#scheda-iframe");
  await new Promise((pronto) => {
    iframe.addEventListener("load", pronto, { once: true });
    iframe.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><base href="${base.href}"></head>
      <body style="margin:0;padding:25px"><div id="scheda-finestra" class="ui-dialog"><div id="scheda-radice" class="charactersheet tab-pane charsheet lang-${escapeHtml(traduzioneJson.lang ?? "it")}"></div><div class="charmancer tab-pane charsheet" style="display:none"></div></div></body></html>`;
  });
  const doc = iframe.contentDocument;
  const stileScheda = doc.createElement("style");
  stileScheda.title = "charsheet";
  stileScheda.textContent = senzaProxy(conImportInCima(cssBase + "\n" + cssScheda.join("\n")));
  doc.head.append(stileScheda);
  const radice = doc.querySelector("#scheda-radice");
  const contenitoreCharmancer = doc.querySelector(".charmancer");

  const valoriPredefiniti = new Map(); // nome minuscolo (o repeating_sezione_campo) -> valore
  const sezioni = new Map(); // sezione minuscola -> { nome, contenitori: [{ elemento, template }] }
  const indice = new Map(); // nome attributo minuscolo -> [elementi]

  // Come Roll20 (prove del 01/10/2026): una chiave che manca nel file delle traduzioni si vede come [chiave], non
  // con il testo scritto nell'HTML.
  const traduzione = (chiave) => traduzioni[chiave] ?? `[${chiave}]`;
  const traduci = (nodo) => {
    for (const el of $$("[data-i18n]", nodo)) el.textContent = traduzione(el.dataset.i18n);
    for (const el of $$("[data-i18n-placeholder]", nodo)) el.placeholder = traduzione(el.dataset.i18nPlaceholder);
    for (const el of $$("[data-i18n-title]", nodo)) el.title = traduzione(el.dataset.i18nTitle);
    for (const el of $$("[data-i18n-aria-label]", nodo)) el.setAttribute("aria-label", traduzione(el.dataset.i18nAriaLabel));
    // data-i18n-list: gli elementi della lista in ordine alfabetico di traduzione
    for (const lista of $$("[data-i18n-list]", nodo)) {
      const voci = [...lista.children].filter((c) => c.hasAttribute("data-i18n-list-item"));
      voci.sort((a, b) => (traduzioni[a.dataset.i18nListItem] ?? a.textContent).localeCompare(traduzioni[b.dataset.i18nListItem] ?? b.textContent)).forEach((v) => lista.append(v));
    }
    // Roll20 aggiunge ui-draggable ai pulsanti di tiro (trascinabili nella barra delle macro) e molti CSS lo usano.
    for (const el of $$('button[type="roll"]', nodo)) el.classList.add("ui-draggable");
  };

  const valorePredefinito = (el) => {
    if (el.tagName === "SELECT") {
      const o = el.querySelector("option[selected]") ?? el.options[0];
      return o ? (o.getAttribute("value") ?? o.textContent) : "";
    }
    if (el.tagName === "TEXTAREA") return el.textContent;
    if (el.tagName === "INPUT") {
      if (el.type === "checkbox") return el.hasAttribute("checked") ? el.value : "0";
      if (el.type === "radio") return el.hasAttribute("checked") ? el.value : undefined;
      return el.getAttribute("value") ?? "";
    }
    return undefined;
  };

  const nomeCampo = (el) => el.getAttribute("name").slice(5); // senza "attr_"
  const rigaDi = (el) => el.closest(".repitem");
  const nomeCompleto = (el) => {
    const riga = rigaDi(el);
    if (!riga) return nomeCampo(el);
    return `repeating_${riga.closest(".repcontainer").dataset.groupname.slice(10)}_${riga.dataset.reprowid}_${nomeCampo(el)}`;
  };
  const contestoDi = (el) => {
    const riga = rigaDi(el);
    return riga ? { sezione: riga.closest(".repcontainer").dataset.groupname.slice(10), riga: riga.dataset.reprowid } : null;
  };

  function indicizza(nodo) {
    for (const el of $$('[name^="attr_"]', nodo)) {
      if (el.closest("fieldset")) continue; // i modelli delle sezioni ripetibili non sono campi veri
      const nome = nomeCompleto(el).toLowerCase();
      if (!indice.has(nome)) indice.set(nome, []);
      indice.get(nome).push(el);
    }
  }
  function deindicizza(nodo) {
    const togliere = new Set($$('[name^="attr_"]', nodo));
    if (!togliere.size) return;
    for (const [nome, elementi] of indice) {
      const restano = elementi.filter((e) => !togliere.has(e));
      if (restano.length) indice.set(nome, restano);
      else indice.delete(nome);
    }
  }

  function valore(nome) {
    const minuscolo = String(nome).toLowerCase();
    if (PSEUDO[minuscolo]) return minuscolo === "character_name" ? personaggio.name : minuscolo === "character_id" ? personaggio.id : (personaggio.campi?.mancerstep ?? "");
    if (attributi.ha(nome)) return attributi.leggi(nome);
    const m = ID_RIGA.exec(nome);
    const chiave = m ? `repeating_${m[1]}_${m[3]}`.toLowerCase() : minuscolo;
    return valoriPredefiniti.get(chiave);
  }

  function mostraValore(el, v) {
    let s = v === undefined || v === null ? "" : String(v);
    if (el.tagName === "INPUT" && (el.type === "checkbox" || el.type === "radio")) el.checked = el.value === s;
    else if (el.tagName === "INPUT") {
      el.value = s;
      el.setAttribute("value", s); // i selettori CSS [value="..."] leggono l'attributo, non la proprietà
    } else if (el.tagName === "SELECT" || el.tagName === "TEXTAREA") el.value = s;
    else {
      if (el.hasAttribute("data-i18n-dynamic") && traduzioni[s] !== undefined) s = traduzioni[s];
      el.textContent = s;
    }
  }
  function aggiornaDom(nome) {
    for (const el of indice.get(String(nome).toLowerCase()) ?? []) mostraValore(el, valore(nome));
  }
  const aggiornaTuttoIlDom = () => {
    for (const [nome, elementi] of indice) for (const el of elementi) mostraValore(el, valore(nomeCompleto(el) ?? nome));
  };

  function preparaScheda() {
    radice.innerHTML = html;
    traduci(radice);
    for (const el of $$('[name^="attr_"]', radice)) {
      if (el.closest("fieldset")) continue;
      const v = valorePredefinito(el);
      if (v !== undefined && !valoriPredefiniti.has(nomeCampo(el).toLowerCase())) valoriPredefiniti.set(nomeCampo(el).toLowerCase(), v);
    }
    for (const fieldset of $$('fieldset[class*="repeating_"]', radice)) {
      const nome = [...fieldset.classList].find((c) => c.startsWith("repeating_")).slice(10);
      const chiave = nome.toLowerCase();
      if (!sezioni.has(chiave)) sezioni.set(chiave, { nome, contenitori: [] });
      for (const el of $$('[name^="attr_"]', fieldset)) {
        const v = valorePredefinito(el);
        if (v !== undefined) valoriPredefiniti.set(`repeating_${chiave}_${nomeCampo(el)}`.toLowerCase(), v);
      }
      fieldset.style.display = "none";
      const contenitore = doc.createElement("div");
      contenitore.className = "repcontainer";
      contenitore.dataset.groupname = `repeating_${nome}`;
      const controlli = doc.createElement("div");
      controlli.className = "repcontrol";
      controlli.dataset.groupname = `repeating_${nome}`;
      controlli.innerHTML = '<button type="button" class="btn repcontrol_edit">Modify</button><button type="button" class="btn repcontrol_add">+Add</button>';
      fieldset.after(contenitore, controlli);
      // La stessa sezione può comparire più volte (repeating_tratti nel PG e nel PNG): stessi dati, modelli propri.
      sezioni.get(chiave).contenitori.push({ elemento: contenitore, template: fieldset.innerHTML });
    }
    indicizza(radice);
  }

  function creaRiga(sezione, id) {
    const s = sezioni.get(sezione.toLowerCase());
    if (!s) return registro.aggiungi("errore", `repeating_${sezione}: sezione non presente nell'HTML`);
    for (const { elemento: contenitore, template } of s.contenitori) {
      if ($$(":scope > .repitem", contenitore).some((r) => r.dataset.reprowid.toLowerCase() === id.toLowerCase())) continue;
      const riga = doc.createElement("div");
      riga.className = "repitem";
      riga.dataset.reprowid = id;
      riga.innerHTML = '<div class="itemcontrol"><button type="button" class="btn btn-danger pictos repcontrol_del">#</button><a class="btn repcontrol_move">≡</a></div>' + template;
      traduci(riga);
      contenitore.append(riga);
      indicizza(riga);
      for (const el of $$('[name^="attr_"]', riga)) mostraValore(el, valore(nomeCompleto(el)));
    }
  }
  function disegnaRighe() {
    for (const s of sezioni.values()) {
      for (const { elemento } of s.contenitori) {
        deindicizza(elemento);
        elemento.innerHTML = "";
      }
      for (const id of attributi.righe(s.nome)) creaRiga(s.nome, id);
    }
  }

  // ------------------------------------------------ tiri
  const motore = creaMotoreTiri({
    valore,
    traduzioni,
    rollTemplates,
    nomePersonaggio: () => personaggio.name,
    registro: (tipo, messaggio) => registro.aggiungi(tipo, messaggio),
    chiedi: chiediAllUtente,
  });

  async function tira(comando, contesto, { perCharmancer = false } = {}) {
    try {
      const messaggi = await motore.esegui(comando, contesto);
      for (const m of messaggi) chat.aggiungi(m);
      return perCharmancer ? messaggi.tiri ?? [] : messaggi;
    } catch (e) {
      chat.errore(e.message);
      registro.aggiungi("errore", `tiro: ${e.message}`);
      return null;
    }
  }

  function chiediAllUtente(domanda, scelte, predefinito) {
    const dialogo = $("#dialogo-domanda");
    $("#domanda-testo").textContent = domanda;
    const campo = $("#domanda-campo");
    campo.innerHTML = scelte
      ? `<select>${scelte.map((s, i) => `<option value="${i}">${escapeHtml(s.etichetta)}</option>`).join("")}</select>`
      : `<input value="${escapeHtml(predefinito)}">`;
    // La risposta si prende dal submit del modulo e dall'annullamento con Esc: l'evento "close" del
    // dialogo non arriva in tutti i browser (in Chrome pilotato da Playwright non scatta), e senza di
    // lui il tiro resterebbe in attesa per sempre.
    return new Promise((risolvi) => {
      const modulo = dialogo.querySelector("form");
      const rispondi = (ok) => {
        const el = campo.firstElementChild;
        risolvi(ok ? (scelte ? scelte[Number(el.value)].valore : el.value) : null);
      };
      modulo.addEventListener("submit", (evento) => rispondi((evento.submitter?.value ?? dialogo.returnValue) === "ok"), { once: true });
      dialogo.addEventListener("cancel", () => rispondi(false), { once: true });
      dialogo.showModal();
      campo.firstElementChild.focus();
    });
  }

  // ------------------------------------------------ worker e eventi
  let workers = [];
  const versioneWorker = new Map();
  let versioneCharmancer = 0;
  let scrittureRecenti = [];

  function avviaWorker() {
    for (const w of workers) w.terminate();
    const righeShim = shim.split("\n").length;
    workers = codiciWorker.map((codice, n) => {
      const sorgente = `${shim}\n;try {\n${codice}\n} catch (e) { segnalaErrore(e); }\n`;
      const w = new Worker(URL.createObjectURL(new Blob([sorgente], { type: "text/javascript" })));
      w.etichetta = `worker ${n + 1}`;
      w.onerror = (e) => registro.aggiungi("errore", `${w.etichetta}: ${e.message} (riga ${e.lineno - righeShim - 1} di ${nomiWorker[n]})`);
      w.onmessage = ({ data }) => gestisciMessaggio(w, data);
      w.postMessage({ tipo: "init", traduzioni, lingua: traduzioneJson.lang ?? "it" });
      return w;
    });
    versioneWorker.clear();
  }
  const datiCharmancerPer = (w) => {
    if (!charmancer || versioneWorker.get(w) === versioneCharmancer) return undefined;
    versioneWorker.set(w, versioneCharmancer);
    return charmancer.stato.dati;
  };
  const rispondi = (w, id, dati) => w.postMessage({ tipo: "risposta", id, dati, charmancer: datiCharmancerPer(w) });

  function emettiEvento(nomi, eventInfo = {}, contesto = null) {
    registro.aggiungi("evento", nomi[0] + (nomi.length > 1 ? `  (anche ${nomi.slice(1).join(", ")})` : ""), eventInfo);
    for (const w of workers) w.postMessage({ tipo: "evento", nomi, eventInfo, contesto, charmancer: datiCharmancerPer(w) });
  }

  // Scrive un attributo e, se il valore cambia, emette change: come Roll20.
  function imposta(nome, nuovo, origine, silenzioso = false) {
    const nomeStringa = String(nome);
    const minuscolo = nomeStringa.toLowerCase();
    const precedente = valore(nomeStringa);
    if (PSEUDO[minuscolo]) {
      if (minuscolo === "character_name") {
        personaggio.name = String(nuovo);
        $("#titolo-personaggio").textContent = personaggio.name;
      } else if (minuscolo === "charactermancer_step") personaggio.campi.mancerstep = String(nuovo);
      aggiornaDom(nomeStringa);
      salva();
      if (!silenzioso && String(precedente) !== String(nuovo)) emettiEvento([`change:${minuscolo}`], { sourceAttribute: minuscolo, sourceType: origine, previousValue: precedente, newValue: nuovo });
      return true;
    }
    if (String(precedente ?? "") === String(nuovo ?? "") && attributi.ha(nomeStringa)) return false;
    attributi.scrivi(nomeStringa, nuovo);
    const m = ID_RIGA.exec(nomeStringa);
    if (m) creaRiga(m[1], m[2]);
    aggiornaDom(nomeStringa);
    pannelloAttributi.aggiorna();
    salva();
    if (!silenzioso) {
      const nomi = m ? [`change:repeating_${m[1]}:${m[3]}`.toLowerCase(), `change:repeating_${m[1]}`.toLowerCase()] : [`change:${minuscolo}`];
      const contesto = m ? { sezione: m[1], riga: m[2] } : null;
      emettiEvento(nomi, { sourceAttribute: minuscolo, sourceType: origine, previousValue: precedente, newValue: nuovo }, contesto);
    }
    return true;
  }

  async function gestisciMessaggio(w, data) {
    switch (data.tipo) {
      case "getAttrs":
        rispondi(w, data.id, data.nomi.map((n) => valore(n)));
        break;
      case "setAttrs": {
        const adesso = Date.now();
        scrittureRecenti = scrittureRecenti.filter((t) => adesso - t < 2000);
        scrittureRecenti.push(adesso);
        if (scrittureRecenti.length > 6000) {
          registro.aggiungi("errore", "più di 6000 setAttrs in 2 secondi: probabile ciclo di eventi, scrittura ignorata");
          rispondi(w, data.id);
          break;
        }
        const cambiati = Object.entries(data.valori).filter(([n, v]) => String(valore(n) ?? "") !== String(v ?? ""));
        if (cambiati.length) registro.aggiungi("setAttrs", `${w.etichetta}: ` + cambiati.map(([n, v]) => `${n} = ${JSON.stringify(v)}`).join(", ").slice(0, 600), data.valori);
        for (const [n, v] of Object.entries(data.valori)) imposta(n, v, "sheetworker", data.silent);
        rispondi(w, data.id);
        break;
      }
      case "getSectionIDs":
        rispondi(w, data.id, attributi.righe(data.sezione));
        break;
      case "setSectionOrder":
        attributi.scrivi(`_reporder_repeating_${data.sezione}`, data.ordine.join(","));
        disegnaRighe();
        salva();
        rispondi(w, data.id);
        break;
      case "removeRepeatingRow":
        eliminaRiga(data.prefisso, "sheetworker");
        break;
      case "startRoll":
        try {
          rispondi(w, data.id, await motore.esegui(data.testo, data.contesto, { crp: true }));
        } catch (e) {
          chat.errore(e.message);
          rispondi(w, data.id, { rollId: null, results: {} });
        }
        break;
      case "finishRoll": {
        try {
          const messaggio = motore.concludi(data.rollId, data.calcolati);
          if (messaggio) chat.aggiungi(messaggio);
        } catch (e) {
          chat.errore(e.message);
        }
        break;
      }
      case "getCompendiumPage": {
        if (!compendio) {
          registro.aggiungi("errore", "getCompendiumPage: questo esempio non ha un compendio");
          rispondi(w, data.id, null);
          break;
        }
        const elenco = [].concat(data.pagine ?? []);
        const pagine = await Promise.all(elenco.filter((p) => p !== "").map((p) => compendio.pagina(p)));
        const contesto = data.contesto;
        if (charmancer?.stato.attivo && contesto?.mancer === "mancer" && contesto.campo) {
          charmancer.funzioni.salvaDatiCompendio(contesto.campo, elenco.length && elenco[0] !== "" ? pagine[0] : null);
          versioneCharmancer++;
        }
        registro.aggiungi("compendio", `getCompendiumPage ${elenco.join(", ") || '""'}`);
        rispondi(w, data.id, Array.isArray(data.pagine) ? pagine.map(compendio.perWorker) : compendio.perWorker(pagine[0] ?? null));
        break;
      }
      case "getCompendiumQuery": {
        const risultati = compendio ? await compendio.query(data.query) : [];
        registro.aggiungi("compendio", `getCompendiumQuery ${JSON.stringify(data.query)}: ${risultati.length} pagine`);
        rispondi(w, data.id, risultati.map(compendio?.perWorker ?? ((x) => x)));
        break;
      }
      case "charmancer": {
        if (!charmancer) {
          registro.aggiungi("errore", `${data.funzione}: questo esempio non ha il Charactermancer`);
          rispondi(w, data.id, null);
          break;
        }
        let esito = null;
        try {
          esito = await charmancer.funzioni[data.funzione](...(data.argomenti ?? []));
        } catch (e) {
          registro.aggiungi("errore", `${data.funzione}: ${e.stack || e}`);
        }
        if (data.funzione !== "impostaValori") registro.aggiungi("wizard", `${data.funzione}(${JSON.stringify(data.argomenti ?? []).slice(1, -1).slice(0, 300)})`);
        rispondi(w, data.id, esito ?? null);
        break;
      }
      case "jquery":
        gestisciJquery(w, data);
        break;
      case "populateListOptions": {
        const { elemenetId, elementId, optionsHTML, overwrite } = data.opzioni ?? {};
        const el = doc.getElementById(elemenetId ?? elementId);
        if (el) el.innerHTML = (overwrite === false ? el.innerHTML : "") + (optionsHTML ?? "");
        break;
      }
      case "console":
        registro.aggiungi("console", `${w.etichetta}: ${data.messaggio}`);
        break;
      case "log":
        registro.aggiungi("log", data.messaggio);
        break;
      case "errore":
        registro.aggiungi("errore", `${w.etichetta}: ${data.messaggio}`);
        break;
    }
  }

  // $20: le operazioni sulle classi valgono per chi guarda la scheda; .on() registra un gestore delegato.
  const gestoriJquery = [];
  function gestisciJquery(w, { selettore, op, argomenti, id }) {
    let elementi = [];
    try {
      elementi = [...doc.querySelectorAll(selettore)];
    } catch {
      return registro.aggiungi("log", `$20: selettore non valido ${selettore}`);
    }
    if (op === "on") {
      const evento = argomenti[0];
      if (!gestoriJquery.some((g) => g.evento === evento)) {
        doc.addEventListener(evento, (e) => {
          for (const g of gestoriJquery.filter((x) => x.evento === e.type)) {
            let el = null;
            try {
              el = e.target.closest?.(g.selettore);
            } catch {}
            if (!el) continue;
            const htmlAttributes = Object.fromEntries([...el.attributes].map((a) => [a.name, a.value]));
            g.worker.postMessage({ tipo: "jqueryEvento", id: g.id, eventInfo: { htmlAttributes: { ...htmlAttributes, tagName: el.tagName.toLowerCase(), checked: el.checked }, altKey: e.altKey, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey } });
          }
        });
      }
      gestoriJquery.push({ selettore, evento, id, worker: w });
      return;
    }
    const metodo = { addClass: "add", removeClass: "remove", toggleClass: "toggle" }[op];
    for (const el of elementi) for (const c of String(argomenti[0]).split(/\s+/).filter(Boolean)) el.classList[metodo](c);
  }

  // ------------------------------------------------ Charactermancer
  const charmancer = charmancerTemplates
    ? creaCharmancer({
        doc,
        contenitore: contenitoreCharmancer,
        radiceScheda: radice,
        pagine: charmancerTemplates.pagine,
        ripetibili: charmancerTemplates.ripetibili,
        traduci,
        compendio,
        emetti: emettiEvento,
        registro: (tipo, messaggio) => registro.aggiungi(tipo, messaggio),
        salvaDati: (dati) => {
          versioneCharmancer++;
          personaggio.mancerdata = dati;
          salva();
          pannelloWizard.aggiorna();
        },
        alCambioStato: (stato) => {
          if (stato.pagina) personaggio.campi.mancerstep = stato.pagina;
          const distintivo = $("#stato-charmancer");
          distintivo.hidden = !stato.attivo;
          distintivo.textContent = `Charactermancer: ${stato.pagina ?? ""}${stato.bloccato ? " (in applicazione)" : ""}`;
          pannelloWizard.aggiorna();
        },
        tira: (comando) => tira(comando, null, { perCharmancer: true }),
      })
    : null;

  // ------------------------------------------------ righe ripetibili
  function aggiungiRiga(sezione) {
    const id = generaIdRiga();
    const s = sezioni.get(sezione.toLowerCase());
    // Roll20 crea la riga subito ma salva gli attributi solo quando si compila un campo:
    // qui si salva l'ordine, così la riga vuota resta dopo un ricaricamento.
    attributi.scrivi(`_reporder_repeating_${s.nome}`, [...attributi.righe(s.nome), id].join(","));
    creaRiga(s.nome, id);
    salva();
    registro.aggiungi("log", `aggiunta riga ${id} in repeating_${s.nome}`);
  }
  function eliminaRiga(prefisso, origine) {
    const m = /^repeating_([^_]+)_(-[A-Za-z0-9_-]{19})$/.exec(prefisso);
    if (!m) return registro.aggiungi("errore", `removeRepeatingRow: prefisso non valido "${prefisso}"`);
    const rimossi = attributi.elimina(prefisso);
    const ordine = String(attributi.leggi(`_reporder_repeating_${m[1]}`) ?? "").split(",").filter((id) => id && id.toLowerCase() !== m[2].toLowerCase());
    attributi.scrivi(`_reporder_repeating_${m[1]}`, ordine.join(","));
    for (const { elemento } of sezioni.get(m[1].toLowerCase())?.contenitori ?? []) {
      for (const riga of $$(":scope > .repitem", elemento)) {
        if (riga.dataset.reprowid.toLowerCase() === m[2].toLowerCase()) {
          deindicizza(riga);
          riga.remove();
        }
      }
    }
    pannelloAttributi.aggiorna();
    salva();
    emettiEvento([`remove:repeating_${m[1]}`.toLowerCase()], { sourceAttribute: prefisso.toLowerCase(), sourceType: origine, removedInfo: rimossi });
  }
  const generaIdRiga = () => {
    const alfabeto = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    let tempo = Date.now();
    let parte = "";
    for (let i = 0; i < 7; i++) {
      parte = alfabeto[tempo % 63] + parte;
      tempo = Math.floor(tempo / 63);
    }
    let id = "-" + parte;
    for (let i = 0; i < 12; i++) id += alfabeto[Math.floor(Math.random() * 63)];
    return id;
  };

  // ------------------------------------------------ interazioni con la scheda
  radice.addEventListener("change", (e) => {
    const el = e.target;
    if (!el.matches?.('[name^="attr_"]') || el.closest("fieldset")) return;
    let v = el.value;
    if (el.type === "checkbox") v = el.checked ? el.value : "0";
    if (el.type === "radio" && !el.checked) return;
    const nome = nomeCompleto(el);
    const m = ID_RIGA.exec(nome);
    if (m) {
      // la riga esiste davvero solo quando ha un attributo: si allinea l'ordine
      const ordine = attributi.righe(m[1]);
      if (!ordine.some((id) => id.toLowerCase() === m[2].toLowerCase())) attributi.scrivi(`_reporder_repeating_${m[1]}`, [...ordine, m[2]].join(","));
    }
    imposta(nome, v, "player");
  });

  radice.addEventListener("click", (e) => {
    const el = e.target.closest("button, a.repcontrol_move");
    if (!el || !radice.contains(el)) return;
    if (el.matches('button[type="roll"]')) {
      e.preventDefault();
      tira(el.getAttribute("value") ?? "", contestoDi(el));
    } else if (el.matches('button[type="action"]')) {
      e.preventDefault();
      const nome = el.getAttribute("name")?.replace(/^act_/, "") ?? "";
      const contesto = contestoDi(el);
      const htmlAttributes = { ...Object.fromEntries([...el.attributes].map((a) => [a.name, a.value])), tagName: "button" };
      if (contesto) {
        const nomeEvento = `clicked:repeating_${contesto.sezione}:${nome}`.toLowerCase();
        emettiEvento([nomeEvento], { sourceAttribute: `repeating_${contesto.sezione}_${contesto.riga}_${nome}`.toLowerCase(), sourceType: "player", htmlAttributes }, contesto);
      } else emettiEvento([`clicked:${nome}`.toLowerCase()], { sourceAttribute: nome.toLowerCase(), sourceType: "player", htmlAttributes });
    } else if (el.matches(".repcontrol_add")) {
      aggiungiRiga(el.closest(".repcontrol").dataset.groupname.slice(10));
    } else if (el.matches(".repcontrol_edit")) {
      const gruppo = el.closest(".repcontrol").dataset.groupname;
      const contenitore = el.closest(".repcontrol").previousElementSibling;
      const attivo = contenitore.classList.toggle("editmode");
      el.textContent = attivo ? "Done" : "Modify";
      registro.aggiungi("log", `${gruppo}: modalità modifica ${attivo ? "attiva" : "disattiva"}`);
    } else if (el.matches(".repcontrol_del")) {
      const riga = el.closest(".repitem");
      const sezione = riga.closest(".repcontainer").dataset.groupname.slice(10);
      // Come Roll20: il cestino elimina subito, senza conferma (nel suo codice il clic chiama deleteRepeatingRow).
      eliminaRiga(`repeating_${sezione}_${riga.dataset.reprowid}`, "player");
    }
    // .repcontrol_move: niente al clic, le righe si spostano trascinando (sotto), come su Roll20.
  });

  // Trascinamento delle righe in modifica, come su Roll20 (jQuery UI sortable, osservato in partita
  // il 25/09/2026): la riga presa diventa l'"helper" (classe ui-sortable-helper, position absolute,
  // z-index 1000, segue il cursore) e al suo posto c'è un segnaposto vuoto alto quanto la riga
  // (div.repitem.ui-sortable-placeholder, visibility hidden), che si sposta fra le righe e indica dove
  // cadrà. Al rilascio la riga prende il posto del segnaposto; l'ordine va in _reporder_repeating_<sezione>.
  // Stesse classi e stili in linea di Roll20, così il CSS della scheda li può disegnare.
  radice.addEventListener("pointerdown", (e) => {
    const maniglia = e.target.closest(".repcontrol_move");
    if (!maniglia || e.button !== 0) return;
    const riga = maniglia.closest(".repitem");
    const contenitore = riga.parentElement;
    e.preventDefault();
    const box = riga.getBoundingClientRect();
    const presa = e.clientY - box.top;
    const segnaposto = doc.createElement("div");
    segnaposto.className = "repitem ui-sortable-placeholder";
    segnaposto.style.cssText = `visibility: hidden; height: ${box.height}px;`;
    contenitore.insertBefore(segnaposto, riga);
    riga.classList.add("ui-sortable-helper");
    riga.style.cssText = `width: ${box.width}px; height: ${box.height}px; position: absolute; z-index: 1000;`;
    const genitore = riga.offsetParent ?? doc.body;
    const posiziona = (y) => {
      const g = genitore.getBoundingClientRect();
      riga.style.left = `${box.left - g.left + genitore.scrollLeft}px`;
      riga.style.top = `${y - presa - g.top + genitore.scrollTop}px`;
    };
    posiziona(e.clientY);
    const altre = () => [...contenitore.children].filter((r) => r.classList.contains("repitem") && r !== riga && r !== segnaposto);
    // Movimento e rilascio si ascoltano sul documento: la maniglia fa parte della riga che si sposta.
    const sposta = (ev) => {
      posiziona(ev.clientY);
      const dopo = altre().find((r) => {
        const b = r.getBoundingClientRect();
        return ev.clientY < b.top + b.height / 2;
      });
      if (dopo !== segnaposto.nextElementSibling) contenitore.insertBefore(segnaposto, dopo ?? null);
    };
    const rilascia = () => {
      doc.removeEventListener("pointermove", sposta);
      doc.removeEventListener("pointerup", rilascia);
      doc.removeEventListener("pointercancel", rilascia);
      contenitore.insertBefore(riga, segnaposto);
      segnaposto.remove();
      riga.classList.remove("ui-sortable-helper");
      riga.removeAttribute("style");
      const sezione = contenitore.dataset.groupname.slice(10);
      const ordine = [...contenitore.children].filter((r) => r.classList.contains("repitem")).map((r) => r.dataset.reprowid);
      if (ordine.join(",") === attributi.righe(sezione).join(",")) return;
      attributi.scrivi(`_reporder_repeating_${sezione}`, ordine.join(","));
      registro.aggiungi("log", `ordine di repeating_${sezione}: ${ordine.join(", ")}`);
      disegnaRighe();
      salva();
    };
    doc.addEventListener("pointermove", sposta);
    doc.addEventListener("pointerup", rilascia);
    doc.addEventListener("pointercancel", rilascia);
  });

  // Drop dal compendio: Roll20 riempie i campi con accept (Name, Category, data, Content o un campo
  // dei dati della pagina) e poi emette sheet:compendium-drop.
  doc.addEventListener("dragover", (e) => {
    if (e.dataTransfer?.types.includes("application/x-compendio")) e.preventDefault();
  });
  doc.addEventListener("drop", async (e) => {
    const rif = e.dataTransfer?.getData("application/x-compendio");
    if (!rif || !compendio) return;
    e.preventDefault();
    const p = await compendio.pagina(rif);
    registro.aggiungi("compendio", `drop sulla scheda: ${rif}`);
    for (const el of $$("[accept]", radice)) {
      if (el.closest("fieldset") || !el.getAttribute("name")?.startsWith("attr_")) continue;
      const accept = el.getAttribute("accept");
      const v = accept === "Name" ? p.name : accept === "Category" ? p.data.Category : accept === "data" ? JSON.stringify(p.data) : accept === "Content" ? p.content ?? "" : p.data[accept] ?? "";
      imposta(nomeCompleto(el), typeof v === "object" ? JSON.stringify(v) : v, "player");
    }
    emettiEvento(["sheet:compendium-drop"], { sourceType: "player" });
  });

  // ------------------------------------------------ pannelli
  const pannelloAttributi = creaPannelloAttributi(attributi, (nome, v) => imposta(nome, v, "player"));
  const pannelloWizard = creaPannelloWizard();
  if (compendio) avviaPannelloCompendio();

  function creaRegistro() {
    const elenco = $("#registro-elenco");
    return {
      aggiungi(tipo, messaggio, dettaglio) {
        const riga = document.createElement("li");
        riga.className = `registro-${tipo}`;
        const ora = new Date().toLocaleTimeString("it-IT", { hour12: false }) + "." + String(new Date().getMilliseconds()).padStart(3, "0");
        riga.innerHTML = `<span class="ora">${ora}</span> <span class="tipo">${escapeHtml(tipo)}</span> <span class="messaggio">${escapeHtml(messaggio)}</span>`;
        if (dettaglio !== undefined) {
          try {
            riga.title = JSON.stringify(dettaglio, null, 2).slice(0, 4000);
          } catch {}
        }
        elenco.prepend(riga);
        while (elenco.children.length > 1500) elenco.lastChild.remove();
        if (tipo === "errore") $("#linguetta-registro").classList.add("con-errori");
      },
      svuota() {
        elenco.innerHTML = "";
        $("#linguetta-registro").classList.remove("con-errori");
      },
    };
  }

  function creaChat() {
    const elenco = $("#chat-elenco");
    const scorri = () => (elenco.scrollTop = elenco.scrollHeight);
    // Pulsanti nei messaggi: [testo](~bersaglio) diventa un pulsante che esegue il pulsante d'azione
    // della scheda, come su Roll20. Il bersaglio può avere davanti "selected|" o il nome del
    // personaggio; in una riga ripetibile è repeating_<sezione>_<idRiga>_<nome> (con startRoll l'ID
    // di riga va scritto per intero).
    const conPulsanti = (html) => html.replace(/\[([^\]]+)\]\(~([^)\s]+)\)/g, (_, testo, bersaglio) => `<a class="emu-azione-chat" data-azione="${escapeHtml(bersaglio.replace(/^[^|]*\|/, ""))}">${testo}</a>`);
    // Suggerimento dei tiri in linea: Roll20 mostra il title come HTML (tipsy), con i dadi in evidenza; il
    // title del browser lo mostrerebbe come codice. Il testo è quello di Roll20 (dadi.js): passano solo gli
    // span dei dadi, il resto resta testo.
    const suggerimento = Object.assign(document.createElement("div"), { className: "emu-suggerimento", hidden: true });
    document.body.append(suggerimento);
    const soloDadi = (titolo) => escapeHtml(titolo)
      .replace(/&lt;span class=&quot;(basicdiceroll[a-z ]*)&quot;&gt;/g, '<span class="$1">')
      .replace(/&lt;\/span&gt;/g, "</span>");
    elenco.addEventListener("mouseover", (e) => {
      const tiro = e.target.closest(".inlinerollresult");
      if (!tiro) return;
      if (tiro.title) {
        tiro.dataset.titolo = tiro.title;
        tiro.removeAttribute("title");
      }
      if (!tiro.dataset.titolo) return;
      suggerimento.innerHTML = soloDadi(tiro.dataset.titolo);
      suggerimento.hidden = false;
      const r = tiro.getBoundingClientRect();
      suggerimento.style.left = `${Math.max(4, Math.min(r.left, window.innerWidth - suggerimento.offsetWidth - 4))}px`;
      suggerimento.style.top = `${Math.max(4, r.top - suggerimento.offsetHeight - 6)}px`;
    });
    elenco.addEventListener("mouseout", (e) => {
      if (e.target.closest(".inlinerollresult")) suggerimento.hidden = true;
    });
    elenco.addEventListener("click", (e) => {
      const pulsante = e.target.closest(".emu-azione-chat");
      if (!pulsante) return;
      const bersaglio = pulsante.dataset.azione;
      const m = /^repeating_([^_]+)_(-[A-Za-z0-9_-]{19})_(.+)$/i.exec(bersaglio);
      if (m) emettiEvento([`clicked:repeating_${m[1]}:${m[3]}`.toLowerCase()], { sourceAttribute: bersaglio.toLowerCase(), sourceType: "player" }, { sezione: m[1], riga: m[2] });
      else emettiEvento([`clicked:${bersaglio}`.toLowerCase()], { sourceAttribute: bersaglio.toLowerCase(), sourceType: "player" });
    });
    return {
      aggiungi({ autore, html: corpo, comando, sussurro }) {
        const m = document.createElement("div");
        m.className = `message ${sussurro ? "private" : "general"}`;
        m.innerHTML = `<span class="by">${escapeHtml(autore)}${sussurro ? ` (a ${escapeHtml(sussurro)})` : ""}:</span>${conPulsanti(corpo)}`;
        // Le scritte fisse delle card (data-i18n dentro i roll template) Roll20 le traduce.
        for (const el of m.querySelectorAll("[data-i18n]")) el.textContent = traduzione(el.dataset.i18n);
        m.title = comando;
        elenco.append(m);
        scorri();
      },
      errore(testoErrore) {
        const m = document.createElement("div");
        m.className = "message error";
        m.textContent = testoErrore;
        elenco.append(m);
        scorri();
      },
      svuota: () => (elenco.innerHTML = ""),
    };
  }

  function creaPannelloAttributi(archivio, alCambio) {
    const corpo = $("#attributi-corpo");
    const filtro = $("#attributi-filtro");
    const MASSIMO = 400;
    let inAttesa = false;
    const disegna = () => {
      inAttesa = false;
      if ($("#pannello-attributi").hidden) return;
      const f = filtro.value.trim().toLowerCase();
      const righe = archivio
        .esporta()
        .filter((a) => !f || a.name.toLowerCase().includes(f))
        .sort((a, b) => a.name.localeCompare(b.name));
      corpo.innerHTML = righe
        .slice(0, MASSIMO)
        .map((a) => `<tr><td class="nome" title="${escapeHtml(a.name)}">${escapeHtml(a.name)}</td><td><input data-nome="${escapeHtml(a.name)}" value="${escapeHtml(a.current)}"></td><td><input data-nome="${escapeHtml(a.name)}_max" value="${escapeHtml(a.max)}"></td></tr>`)
        .join("");
      $("#attributi-conteggio").textContent = `${Math.min(righe.length, MASSIMO)} di ${righe.length} (${archivio.mappa.size} in tutto)`;
    };
    corpo.addEventListener("change", (e) => {
      if (e.target.dataset.nome) alCambio(e.target.dataset.nome, e.target.value);
    });
    filtro.addEventListener("input", disegna);
    return {
      aggiorna() {
        if (inAttesa || document.activeElement?.closest?.("#attributi-corpo")) return;
        inAttesa = true;
        setTimeout(disegna, 250);
      },
      disegna,
    };
  }

  function creaPannelloWizard() {
    let inAttesa = false;
    const disegna = () => {
      inAttesa = false;
      if (!charmancer || $("#pannello-wizard").hidden) return;
      $("#wizard-slide").textContent = charmancer.stato.attivo ? `slide ${charmancer.stato.pagina}` : "non attivo";
      $("#wizard-dati").textContent = JSON.stringify(charmancer.stato.dati, (k, v) => (k === "data" && v && typeof v === "object" ? Object.fromEntries(Object.keys(v).map((c) => [c, `(dati della pagina del compendio: ${Object.keys(v[c] ?? {}).length} campi)`])) : v), 2);
    };
    return {
      aggiorna() {
        if (inAttesa) return;
        inAttesa = true;
        setTimeout(disegna, 300);
      },
      disegna,
    };
  }

  function avviaPannelloCompendio() {
    $("#linguetta-compendio").hidden = false;
    const categoria = $("#compendio-categoria");
    const cerca = $("#compendio-cerca");
    const elenco = $("#compendio-elenco");
    const anteprima = $("#compendio-anteprima");
    categoria.innerHTML = Object.entries(compendio.indice.categorie).map(([c, i]) => `<option value="${escapeHtml(c)}">${escapeHtml(c)} (${i.voci})</option>`).join("");
    let giro = 0;
    const aggiorna = async () => {
      const mio = ++giro;
      const testoCerca = cerca.value.trim();
      const query = testoCerca.includes(":") ? (/category:/i.test(testoCerca) ? testoCerca : `Category:"${categoria.value}" ${testoCerca}`) : `Category:"${categoria.value}"${testoCerca ? ` "${testoCerca}"` : ""}`;
      const risultati = await compendio.query(query);
      if (mio !== giro) return;
      elenco.innerHTML = risultati
        .slice(0, 300)
        .map((p) => `<li draggable="true" data-rif="${escapeHtml(compendio.valoreOpzione(p))}">${escapeHtml(p.name)} <small>${escapeHtml(compendio.siglaDi(p))}</small></li>`)
        .join("") + (risultati.length > 300 ? `<li class="altri">… altre ${risultati.length - 300}</li>` : "");
    };
    categoria.addEventListener("change", aggiorna);
    cerca.addEventListener("input", aggiorna);
    elenco.addEventListener("dragstart", (e) => {
      const rif = e.target.closest("li[data-rif]")?.dataset.rif;
      if (rif) e.dataTransfer.setData("application/x-compendio", rif);
    });
    elenco.addEventListener("click", async (e) => {
      const rif = e.target.closest("li[data-rif]")?.dataset.rif;
      if (!rif) return;
      const p = await compendio.pagina(rif);
      anteprima.innerHTML = `<h3>${escapeHtml(p.name)}</h3><p class="rif">${escapeHtml(rif)}</p><div class="contenuto">${p.htmlcontent || escapeHtml(p.content ?? "")}</div><details><summary>data</summary><pre>${escapeHtml(JSON.stringify(p.data, null, 2))}</pre></details>`;
    });
    aggiorna();
  }

  // ------------------------------------------------ personaggi e salvataggio
  const chiaveArchivio = () => `emulatore-roll20:${config.id}:${sceltaPersonaggio}`;
  let timerSalvataggio = null;
  function salva() {
    clearTimeout(timerSalvataggio);
    timerSalvataggio = setTimeout(() => {
      try {
        localStorage.setItem(chiaveArchivio(), JSON.stringify(esportaPersonaggio()));
      } catch (e) {
        registro.aggiungi("errore", `salvataggio locale non riuscito: ${e.message}`);
      }
    }, 400);
  }
  const esportaPersonaggio = () => ({ name: personaggio.name, id: personaggio.id, campi: personaggio.campi, mancerdata: personaggio.mancerdata ?? null, attributi: attributi.esporta() });

  async function caricaPersonaggio(scelta, { daFile = false } = {}) {
    sceltaPersonaggio = scelta;
    const definizione = config.personaggi.find((p) => p.id === scelta);
    let dati = null;
    if (!daFile) {
      try {
        dati = JSON.parse(localStorage.getItem(chiaveArchivio()) ?? "null");
      } catch {
        dati = null;
      }
    }
    const dalFile = !dati;
    if (!dati) {
      if (definizione.file) dati = JSON.parse(await testo(url(definizione.file)));
      else {
        // personaggio nuovo: le impostazioni predefinite della scheda (sheet.json) diventano attributi
        const predefiniti = impostazioniScheda.filter((i) => i.default !== undefined).map((i) => ({ name: i.attribute, current: i.default, max: "" }));
        dati = { name: definizione.etichetta, attributi: predefiniti };
      }
    }
    personaggio = { name: dati.name, id: dati.id ?? dati.campi?.id ?? "-EMULATOREPERSONAGG", campi: { ...(dati.campi ?? {}) }, mancerdata: dati.mancerdata ?? null };
    attributi.carica(dati.attributi ?? []);
    chat.svuota();
    registro.svuota();
    registro.aggiungi("log", `personaggio caricato: ${dati.name} (${attributi.mappa.size} attributi, ${dalFile ? "dal file" : "dal salvataggio del browser"})`);
    disegnaRighe();
    aggiornaTuttoIlDom();
    charmancer?.carica(personaggio.mancerdata ?? {});
    versioneCharmancer++;
    pannelloAttributi.disegna();
    $("#titolo-personaggio").textContent = dati.name;
    avviaWorker();
    emettiEvento(["sheet:opened"], { sourceType: "sheetworker" });
    salva();
  }

  // ------------------------------------------------ barra comandi
  preparaScheda();
  document.title = `${config.titolo} · emulatore Roll20`;
  $("#titolo-scheda").textContent = config.titolo;
  if (charmancer) $("#linguetta-wizard").hidden = false;
  const selettore = $("#scelta-personaggio");
  selettore.innerHTML = config.personaggi.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.etichetta)}</option>`).join("");
  selettore.addEventListener("change", () => caricaPersonaggio(selettore.value));
  $("#comando-ripristina").addEventListener("click", () => {
    if (confirm("Ripartire dai dati del file e perdere le modifiche fatte in questo browser?")) {
      localStorage.removeItem(chiaveArchivio());
      caricaPersonaggio(sceltaPersonaggio, { daFile: true });
    }
  });
  $("#comando-apertura").addEventListener("click", () => emettiEvento(["sheet:opened"], { sourceType: "sheetworker" }));
  $("#comando-esporta").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(esportaPersonaggio(), null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${personaggio.name.replace(/\W+/g, "_")}.json` });
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $("#comando-importa").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const dati = JSON.parse(await file.text());
    localStorage.setItem(chiaveArchivio(), JSON.stringify(dati));
    e.target.value = "";
    caricaPersonaggio(sceltaPersonaggio);
  });
  // Salvataggi su disco (server di sviluppo, strumenti/server.mjs): non si perdono svuotando la scheda o il
  // browser. Senza il server (per esempio un altro server statico) i due comandi si nascondono.
  const sceltaSalvataggio = $("#scelta-salvataggio");
  const aggiornaSalvataggi = async () => {
    try {
      const r = await fetch("/api/salvataggi", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const voci = await r.json();
      sceltaSalvataggio.innerHTML = `<option value="">${voci.length ? "—" : "nessuno"}</option>` + voci.map((v) => `<option value="${escapeHtml(v.nome)}">${escapeHtml(v.nome)} · ${new Date(v.data).toLocaleString("it-IT")}</option>`).join("");
    } catch {
      $("#comando-salva-disco").hidden = true;
      $("#etichetta-salvataggi").hidden = true;
    }
  };
  $("#comando-salva-disco").addEventListener("click", async () => {
    const scelto = prompt("Nome del salvataggio (lettere, numeri, _ . -)", personaggio.name.replace(/[^A-Za-z0-9_.-]+/g, "_"));
    if (!scelto) return;
    const nome = scelto.trim().replace(/[^A-Za-z0-9_.-]+/g, "_").slice(0, 80);
    const r = await fetch(`/api/salvataggi/${encodeURIComponent(nome)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(esportaPersonaggio(), null, 2) });
    registro.aggiungi(r.ok ? "log" : "errore", r.ok ? `personaggio salvato su disco: salvataggi/${nome}.json` : `salvataggio su disco non riuscito: ${(await r.json().catch(() => ({}))).errore ?? r.status}`);
    aggiornaSalvataggi();
  });
  sceltaSalvataggio.addEventListener("change", async () => {
    const nome = sceltaSalvataggio.value;
    sceltaSalvataggio.value = "";
    if (!nome || !confirm(`Caricare «${nome}» al posto del personaggio aperto? Quello che non hai salvato su disco si perde.`)) return;
    const r = await fetch(`/api/salvataggi/${encodeURIComponent(nome)}`, { cache: "no-store" });
    if (!r.ok) return registro.aggiungi("errore", `salvataggio non trovato: ${nome}`);
    localStorage.setItem(chiaveArchivio(), await r.text());
    caricaPersonaggio(sceltaPersonaggio);
  });
  aggiornaSalvataggi();

  $("#comando-svuota-chat").addEventListener("click", () => chat.svuota());
  $("#comando-svuota-registro").addEventListener("click", () => registro.svuota());
  for (const linguetta of $$(".linguette button")) {
    linguetta.addEventListener("click", () => {
      $$(".linguette button").forEach((b) => b.classList.toggle("attiva", b === linguetta));
      $$(".pannello").forEach((p) => (p.hidden = p.id !== linguetta.dataset.pannello));
      if (linguetta.dataset.pannello === "pannello-attributi") pannelloAttributi.disegna();
      if (linguetta.dataset.pannello === "pannello-wizard") pannelloWizard.disegna();
    });
  }

  await caricaPersonaggio(config.personaggi[0].id);
  // Per il debug dalla console del browser.
  window.emulatore = { attributi, valore, imposta, emettiEvento, tira, sezioni, indice, charmancer, compendio, personaggio: () => personaggio };
}
