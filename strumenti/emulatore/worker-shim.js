// Ambiente dei sheet worker di Roll20, emulato dentro un Web Worker (uno per blocco di codice della
// scheda, come in partita).
//
// Il codice della scheda viene accodato a questo file: usa le stesse funzioni globali che trova su
// Roll20 (on, getAttrs, setAttrs, getSectionIDs, generateRowID, removeRepeatingRow, getTranslationByKey,
// startRoll, finishRoll, $20, populateListOptions e le funzioni del Charactermancer). Ogni chiamata
// diventa un messaggio verso la pagina, che tiene gli attributi e risponde in modo asincrono.

const ascoltatori = []; // { eventi: Set<string>, funzione }
let traduzioni = {};
let lingua = "it";
let prossimaRichiesta = 1;
const inAttesa = new Map();
let datiCharmancer = {};
// Contesto dell'evento in corso: riga ripetibile (per "repeating_sezione_campo" senza id) ed
// eventuale evento del Charactermancer (che cambia il significato di setAttrs).
let contesto = null;

const invia = (tipo, dati = {}) => postMessage({ tipo, ...dati });
const richiedi = (tipo, dati) =>
  new Promise((risolvi) => {
    const id = prossimaRichiesta++;
    inAttesa.set(id, risolvi);
    invia(tipo, { id, ...dati });
  });

function segnalaErrore(e) {
  invia("errore", { messaggio: String(e?.stack || e) });
}

// Conserva il contesto del momento della chiamata anche dentro le callback.
function conContesto(funzione) {
  const catturato = contesto;
  return (...argomenti) => {
    const precedente = contesto;
    contesto = catturato;
    try {
      return funzione?.(...argomenti);
    } catch (e) {
      segnalaErrore(e);
    } finally {
      contesto = precedente;
    }
  };
}

const ID_RIGA = /^repeating_([^_]+)_(-[A-Za-z0-9_-]{19})_(.+)$/;
function risolviNome(nome) {
  const nomeStringa = String(nome);
  if (ID_RIGA.test(nomeStringa)) return nomeStringa;
  const m = /^repeating_([^_]+)_(.+)$/i.exec(nomeStringa);
  if (m && contesto?.riga && contesto.sezione.toLowerCase() === m[1].toLowerCase()) return `repeating_${m[1]}_${contesto.riga}_${m[2]}`;
  return nomeStringa;
}
const nelCharmancer = () => contesto?.mancer === "page" || contesto?.mancer === "mancer";

self.on = (eventi, funzione) => {
  ascoltatori.push({ eventi: new Set(String(eventi).toLowerCase().split(/\s+/).filter(Boolean)), funzione });
};

self.getAttrs = (nomi, callback) => {
  const richiesti = [...(nomi ?? [])];
  const cb = conContesto(callback);
  richiedi("getAttrs", { nomi: richiesti.map(risolviNome) }).then((valori) => {
    const risultato = {};
    richiesti.forEach((nome, i) => {
      if (valori[i] !== undefined) risultato[nome] = valori[i];
    });
    cb(risultato);
  });
};

self.setAttrs = (valori, opzioni, callback) => {
  if (typeof opzioni === "function") [callback, opzioni] = [opzioni, {}];
  const cb = conContesto(callback);
  if (nelCharmancer()) {
    richiedi("charmancer", { funzione: "impostaValori", argomenti: [valori ?? {}, Boolean(opzioni?.silent)] }).then(() => cb());
    return;
  }
  const risolti = {};
  for (const [nome, valore] of Object.entries(valori ?? {})) risolti[risolviNome(nome)] = valore;
  richiedi("setAttrs", { valori: risolti, silent: Boolean(opzioni?.silent) }).then(() => cb());
};

self.getSectionIDs = (sezione, callback) => {
  const cb = conContesto(callback);
  richiedi("getSectionIDs", { sezione: String(sezione).replace(/^repeating_/i, "") }).then((ids) => cb(ids));
};

self.setSectionOrder = (sezione, ordine, callback) => {
  const cb = conContesto(callback);
  richiedi("setSectionOrder", { sezione: String(sezione).replace(/^repeating_/i, ""), ordine }).then(() => cb());
};

// Il prefisso completo "repeating_<sezione>_<idRiga>" si passa com'e': risolviNome serve ai nomi
// senza id, e dentro l'evento di una riga ci infilerebbe l'id una seconda volta.
const PREFISSO_RIGA = /^repeating_([^_]+)_(-[A-Za-z0-9_-]{19})$/;
self.removeRepeatingRow = (prefisso) => invia("removeRepeatingRow", { prefisso: PREFISSO_RIGA.test(String(prefisso)) ? String(prefisso) : risolviNome(prefisso) });

const ALFABETO = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
self.generateRowID = () => {
  let tempo = Date.now();
  let parte = "";
  for (let i = 0; i < 7; i++) {
    parte = ALFABETO[tempo % 63] + parte;
    tempo = Math.floor(tempo / 63);
  }
  let id = "-" + parte;
  for (let i = 0; i < 12; i++) id += ALFABETO[Math.floor(Math.random() * 63)];
  return id;
};

self.getTranslationByKey = (chiave) => (Object.prototype.hasOwnProperty.call(traduzioni, chiave) ? traduzioni[chiave] : false);
self.getTranslationLanguage = () => lingua;
self.setDefaultToken = (valori) => invia("log", { messaggio: `setDefaultToken ${JSON.stringify(valori)}` });
self.populateListOptions = (opzioni) => invia("populateListOptions", { opzioni });

self.startRoll = (testo, callback) => {
  const cb = conContesto(callback);
  const promessa = richiedi("startRoll", { testo, contesto });
  promessa.then((esito) => cb(esito));
  return promessa;
};
self.finishRoll = (rollId, calcolati) => invia("finishRoll", { rollId, calcolati: calcolati ?? {} });

// ---------------------------------------------------------------- compendio
self.getCompendiumPage = (pagine, campi, callback) => {
  if (typeof campi === "function") [callback, campi] = [campi, undefined];
  const cb = conContesto(callback);
  richiedi("getCompendiumPage", { pagine, contesto }).then((esito) => cb(esito));
};
self.getCompendiumQuery = (query, callback) => {
  const cb = conContesto(callback);
  richiedi("getCompendiumQuery", { query }).then((esito) => cb(esito));
};

// ---------------------------------------------------------------- Charactermancer
self.getCharmancerData = () => JSON.parse(JSON.stringify(datiCharmancer));
const funzioneCharmancer = (funzione, numeroArgomenti) =>
  (...argomenti) => {
    let callback;
    if (typeof argomenti.at(-1) === "function") callback = argomenti.pop();
    // alcune funzioni accettano la callback come unico argomento (getRepeatingSections)
    const cb = conContesto(callback);
    return richiedi("charmancer", { funzione, argomenti: argomenti.slice(0, numeroArgomenti) }).then((esito) => {
      cb(esito);
      return esito;
    });
  };
self.startCharactermancer = funzioneCharmancer("startCharactermancer", 1);
self.changeCharmancerPage = funzioneCharmancer("changeCharmancerPage", 1);
self.setCharmancerText = funzioneCharmancer("setCharmancerText", 1);
self.showChoices = funzioneCharmancer("showChoices", 1);
self.hideChoices = funzioneCharmancer("hideChoices", 1);
self.setCharmancerOptions = funzioneCharmancer("setCharmancerOptions", 3);
self.disableCharmancerOptions = funzioneCharmancer("disableCharmancerOptions", 3);
self.changeCompendiumPage = funzioneCharmancer("changeCompendiumPage", 3);
self.addRepeatingSection = funzioneCharmancer("addRepeatingSection", 3);
self.clearRepeatingSections = funzioneCharmancer("clearRepeatingSections", 1);
self.clearRepeatingSectionById = funzioneCharmancer("clearRepeatingSectionById", 1);
self.getRepeatingSections = funzioneCharmancer("getRepeatingSections", 1);
self.deleteCharmancerData = funzioneCharmancer("deleteCharmancerData", 1);
self.finishCharactermancer = funzioneCharmancer("finishCharactermancer", 0);

// ---------------------------------------------------------------- $20: jQuery ridotto di Roll20
const gestoriJquery = new Map();
let prossimoGestore = 1;
self.$20 = (selettore) => {
  const oggetto = {};
  for (const op of ["addClass", "removeClass", "toggleClass"]) {
    oggetto[op] = (classe) => {
      invia("jquery", { selettore, op, argomenti: [classe] });
      return oggetto;
    };
  }
  oggetto.on = (evento, funzione) => {
    const id = prossimoGestore++;
    gestoriJquery.set(id, conContesto(funzione));
    invia("jquery", { selettore, op: "on", argomenti: [evento], id });
    return oggetto;
  };
  return oggetto;
};

for (const livello of ["log", "info", "warn", "error"]) {
  const originale = console[livello].bind(console);
  console[livello] = (...argomenti) => {
    originale(...argomenti);
    invia("console", { livello, messaggio: argomenti.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ") });
  };
}

self.onmessage = ({ data }) => {
  if (data.tipo === "init") {
    traduzioni = data.traduzioni ?? {};
    lingua = data.lingua ?? "it";
  } else if (data.tipo === "charmancerData") {
    datiCharmancer = data.dati ?? {};
  } else if (data.tipo === "risposta") {
    if (data.charmancer) datiCharmancer = data.charmancer;
    const risolvi = inAttesa.get(data.id);
    inAttesa.delete(data.id);
    risolvi?.(data.dati);
  } else if (data.tipo === "jqueryEvento") {
    gestoriJquery.get(data.id)?.(data.eventInfo);
  } else if (data.tipo === "evento") {
    if (data.charmancer) datiCharmancer = data.charmancer;
    const nomi = data.nomi.map((n) => n.toLowerCase());
    for (const { eventi, funzione } of ascoltatori) {
      if (!nomi.some((n) => eventi.has(n))) continue;
      const precedente = contesto;
      contesto = data.contesto;
      // triggerName è il nome dell'ascoltatore scattato; per page:, mancerchange: e mancerroll: senza prefisso
      const scattato = nomi.find((n) => eventi.has(n));
      const triggerName = /^(page|mancerchange|mancerroll):/.test(scattato) ? scattato.slice(scattato.indexOf(":") + 1) : scattato;
      try {
        funzione({ ...data.eventInfo, triggerName });
      } catch (e) {
        segnalaErrore(e);
      } finally {
        contesto = precedente;
      }
    }
  }
};
