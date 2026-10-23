// Base dati dal manuale: legge .cache/testo/manuale.md (npm run estrai-testo) e scrive i JSON di dati/ che
// vengono dal testo, con i testi copiati parola per parola. Il manuale è ancora in sviluppo: quando ne arriva
// una versione nuova si rifà l'estrazione e si guarda il diff di git.
//
//   dati/elenchi/caratteristiche.json   le 4 caratteristiche, con la descrizione e cosa danno
//   dati/elenchi/abilita.json           abilità comuni (cap. 3) e di combattimento (cap. 4): caratteristica,
//                                       costi in punti esperienza, opportunità
//   dati/elenchi/distanze.json          distanze da 0 a 7
//   dati/elenchi/distruttivita.json     livelli di distruttività
//   dati/elenchi/dimensioni.json        taglie dei personaggi
//   dati/elenchi/colori.json            nero, bianco, grigio
//   dati/elenchi/ricchezza.json         livelli di ricchezza: munizioni ricaricate, armi, animali
//   dati/archetipi.json                 i 10 archetipi di immortali
//   dati/carriere.json                  le 7 carriere, con i poteri di carriera (testo e livelli)
//   dati/poteri.json                    i poteri: categoria, colore richiesto, livelli con nome e costo
//   dati/equipaggiamento/armi.json      le armi del cap. 11
//   dati/equipaggiamento/seguaci.json   gli animali del cap. 11
//
// Le voci si cercano per nome (gli elenchi NOMI qui sotto): un nome che non si trova ferma l'estrazione; una voce
// nuova del manuale finirebbe dentro quella prima e la farebbe fallire (livelli doppi, campi in più), quindi va
// aggiunta qui. regole/ (numeri delle regole, scritti a mano con le frasi del manuale) non si tocca.
//
// Uso:  npm run estrai-dati

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATI = path.join(RADICE, "dati");
const MANUALE = path.join(RADICE, ".cache", "testo", "manuale.md");
export const FONTE = "PHaG 1.6";

export const NOMI = {
  caratteristiche: ["Possanza", "Agilità", "Astuzia", "Potenza"],
  abilita: ["Atletica", "Carpenteria", "Cavalcare", "Consapevolezza", "Contrattare", "Forgiare", "Furtività", "Gioco", "Grazia", "Legge",
    "Ingannare", "Intimidire", "Istruzione", "Meccanica", "Medicina", "Percezione", "Pianificare", "Socialità", "Sopravvivenza"],
  combattimento: ["Mischia", "Mira", "Demoralizzare", "Difesa"],
  archetipi: ["Arcangelo", "Caduto", "Cherubino", "Demone possessore", "Jinn", "Oni", "Puttino", "Serafino", "Wendingo", "Dullahan"],
  carriere: ["Artista", "Avventuriero", "Becchino", "Cacciatore di taglie", "Dottore", "Messaggero", "Soldato"],
  poteri: {
    comune: ["Addestratore", "Aggressore provetto", "Aiutanti", "Alchimista", "Artista marziale", "Cecchino provetto", "Entrate costanti",
      "Lavoratore ispirato", "Leader di Sgherri", "Non si smette di lavorare quando si è stanchi …", "Persona influente", "Pistolero provetto",
      "Reti di informatori", "Rituali", "Sfruttare l'ambiente", "Si smette di lavorare quando il lavoro è finito", "Spirito di iniziativa",
      "Volontà di ferro", "Tecnico"],
    passivo: ["Ali", "Aspetto alieno", "Aura nascosta", "Breccia dell’aura", "Cacciatore di immortali", "Compagno innaturale", "Corpo pesante",
      "Munizioni celesti", "Munizioni infernali", "Mutaforma", "Pelle a scaglie", "Pelle di mercurio"],
    attivo: ["Animalità", "Bestialità", "Dementia", "Empatia", "Evocazione", "Fuoco purificatore", "Geomanzia", "Illusione", "Lux", "Possessione",
      "Potere del sangue", "Potere della cenere", "Putrescenza", "Signore della tempesta", "Telepatia", "Umbra"],
    superiore: ["Guerra", "Maestro della forgia", "Morte", "Tefillin"],
  },
  armi: ["Pugni e calci", "Armi improvvisate", "Coltello", "Arma da mischia", "Coppia di armi da mischia", "Armi ad asta", "Armi da mischia grandi",
    "Lazzo/Frusta", "Pistola", "Coppia di pistole", "Arco", "Carabina", "Fucile a pallettoni"],
  seguaci: ["Cavallo", "Cane/Falco", "Procione/Scimmia", "Pappagallo/Lontra"],
};

// Abilità con cui si usa ogni arma. Il manuale non lo scrive arma per arma: Mischia è per le armi da mischia, Mira
// per quelle da tiro o da lancio (cap. 4, Attaccare). Pugni e calci e armi improvvisate sono attacchi in mischia.
const ABILITA_ARMI = { lazzo_frusta: "mira", pistola: "mira", coppia_di_pistole: "mira", arco: "mira", carabina: "mira", fucile_a_pallettoni: "mira" };

// Nomi dei poteri scritti in modo diverso negli archetipi e nelle carriere ("Pelle a scaglia" per l'Oni,
// "munizioni infernali o celesti" per il Criminale).
const ALIAS_POTERI = { pelle_a_scaglia: "pelle_a_scaglie", empatico: "empatia", ritualista: "rituali", celesti: "munizioni_celesti" };

export const ident = (nome) => nome.toLowerCase().replace(/[’']/g, "_").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const idPotere = (nome) => ALIAS_POTERI[ident(nome)] ?? ident(nome);
const idCaratteristica = (nome) => ident(nome.replace(/^(la |l’|l')/i, "").replace(/^all’|^all'/i, ""));
const pallini = (s) => (s.match(/●/g) ?? []).length;
const pulisci = (s) => s.replace(/\s+$/, "").replace(/^\s+/, "");

// ------------------------------------------------------------------------------------------------ testo
let righe = [];
const titolo = (prefisso) => {
  const i = righe.findIndex((r) => r.startsWith(prefisso));
  if (i < 0) throw new Error(`titolo che manca nel manuale: ${prefisso}`);
  return i;
};
// Righe di una sezione: dal titolo al titolo successivo dello stesso livello o di uno superiore.
function sezione(prefisso) {
  const inizio = titolo(prefisso);
  const livello = /^#+/.exec(righe[inizio])[0].length;
  let fine = inizio + 1;
  while (fine < righe.length && !(/^#+ /.test(righe[fine]) && /^#+/.exec(righe[fine])[0].length <= livello)) fine++;
  return righe.slice(inizio + 1, fine);
}
// Blocchi di una sezione che iniziano con una riga uguale a uno dei nomi (nell'ordine del manuale).
function blocchi(linee, nomi) {
  const inizi = nomi.map((nome) => {
    const i = linee.findIndex((r) => pulisci(r) === nome);
    if (i < 0) throw new Error(`voce che manca nel manuale: ${nome}`);
    return [i, nome];
  }).sort((a, b) => a[0] - b[0]);
  return inizi.map(([i, nome], k) => ({ nome, corpo: linee.slice(i + 1, k + 1 < inizi.length ? inizi[k + 1][0] : linee.length).map(pulisci).filter(Boolean) }));
}
// Tabelle: le righe fra <TABELLA> e </TABELLA>, con le celle.
const celle = (riga) => riga.replace(/^\|\s?|\s?\|$/g, "").split(" | ").map(pulisci);

// Opportunità: "Nome (2): testo" oppure "Nome!: (2) testo".
const OPPORTUNITA = /^(.+?)\s*(?:\((\d+)\)\s*:|:\s*\((\d+)\))\s*(.*)$/;
function opportunita(riga) {
  const m = OPPORTUNITA.exec(riga);
  if (!m || m[1].length > 45) return null;
  return { nome: pulisci(m[1]), esuberi: Number(m[2] ?? m[3]), testo: pulisci(m[4]) };
}

// ------------------------------------------------------------------------------------------------ elenchi
function caratteristiche() {
  return blocchi(sezione("### Caratteristiche"), NOMI.caratteristiche).map(({ nome, corpo }) => {
    const tabella = corpo.filter((r) => r.startsWith("|")).flatMap((r) => celle(r)).join(" / ");
    const effetti = tabella.split(" / ").map((pezzo) => {
      const m = /^([^.]+)\.\s*(.*)$/.exec(pezzo);
      return { nome: m[1], testo: m[2] };
    });
    return { id: ident(nome), nome, descrizione: corpo.filter((r) => !r.startsWith("|") && !r.startsWith("<") && !r.startsWith("</")), effetti };
  });
}

// "Normalmente associata all'astuzia o possanza per gli sport." → ["astuzia", "possanza"]; Demoralizzare:
// "viene eseguito con astuzia + demoralizzare".
function caratteristicheAbilita(testo) {
  const eseguito = /viene eseguito con (\p{L}+) \+/u.exec(testo);
  if (eseguito) return [ident(eseguito[1])];
  const frase = /(?:[Nn]ormalmente associat[ao]|va associato)[^.]*/.exec(testo)?.[0] ?? "";
  const trovate = NOMI.caratteristiche.map((n) => [n, frase.toLowerCase().indexOf(n.toLowerCase())]).filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1]);
  return trovate.map(([n]) => ident(n));
}

function abilita() {
  const leggi = (linee, nomi, tipo) => blocchi(linee, nomi).map(({ nome, corpo }) => {
    const costo = corpo.find((r) => r.startsWith("Costo:"));
    if (!costo) throw new Error(`abilità senza costo: ${nome}`);
    const descrizione = corpo.slice(0, corpo.indexOf(costo));
    const dopo = corpo.slice(corpo.indexOf(costo) + 1);
    const opp = dopo.map(opportunita).filter(Boolean);
    return {
      id: ident(nome), nome, tipo,
      caratteristiche: caratteristicheAbilita(descrizione.join(" ")),
      costi_px: [...costo.matchAll(/●+ (\d+)\./g)].map((m) => Number(m[1])),
      descrizione,
      opportunita: opp,
    };
  });
  const capitolo4 = sezione("## 4 - Combattimento");
  const finoReazioni = capitolo4.slice(0, capitolo4.findIndex((r) => pulisci(r) === "Reazioni"));
  return [...leggi(sezione("## 3 - Azioni e abilità"), NOMI.abilita, "comune"), ...leggi(finoReazioni, NOMI.combattimento, "combattimento")];
}

function distanze() {
  return sezione("### Distanze").map((r) => /^Distanza (\d) \(([^)]+)\) (.*)$/.exec(pulisci(r))).filter(Boolean)
    .map((m) => ({ valore: Number(m[1]), nome: m[2], testo: `Distanza ${m[1]} (${m[2]}) ${m[3]}` }));
}

function distruttivita() {
  return sezione("### Distruttività").map(pulisci).filter((r) => /^●+ /.test(r))
    .map((r) => ({ valore: pallini(r.split(" ")[0]), nome: /^●+ ([^,]+),/.exec(r)[1], testo: r }));
}

function dimensioni() {
  return sezione("### Dimensioni di un personaggio").map(pulisci).map((r) => /^(Piccolo|Medio|Grande|Molto grande|Enorme): (.*)$/.exec(r)).filter(Boolean)
    .map((m) => ({ id: ident(m[1]), nome: m[1], testo: m[2] }));
}

function colori() {
  return sezione("### Colori").map(pulisci).map((r) => /^(Nero|Bianco|Grigio) è (.*)$/.exec(r)).filter(Boolean)
    .map((m) => ({ id: ident(m[1]), nome: m[1], testo: `${m[1]} è ${m[2]}` }));
}

function ricchezza() {
  const linee = sezione("### Ricchezza e spese").map(pulisci).filter(Boolean);
  const livelli = [];
  for (const r of linee) {
    if (/^[●○]+ /.test(r)) livelli.push({ valore: pallini(r.split(" ")[0]), testo: r.slice(r.indexOf(" ") + 1) });
    const ultimo = livelli.at(-1);
    let m;
    if (!ultimo) continue;
    if ((m = /^Munizioni ricaricate a settimana: (.*)$/.exec(r))) ultimo.munizioni_settimana = /^[●]+$/.test(m[1]) ? pallini(m[1]) : m[1];
    else if ((m = /^Armi: (.*)$/.exec(r))) ultimo.armi = /^\d+$/.test(m[1]) ? Number(m[1]) : m[1];
    else if ((m = /^Animali: (.*)$/.exec(r))) ultimo.animali = /^\d+$/.test(m[1]) ? Number(m[1]) : m[1];
  }
  return livelli;
}

// ------------------------------------------------------------------------------------------------ archetipi e carriere
// "Cacciatore di immortali ●. Ali ●." → [{ potere, livello }]
const poteriConPallini = (testo) => [...testo.matchAll(/([^,.●]+?)\s*(●+)/g)].map((m) => ({ potere: idPotere(pulisci(m[1])), livello: m[2].length }));
const elencoPoteri = (testo) => testo.replace(/\.\s*$/, "").split(",").map(pulisci).filter(Boolean).map(idPotere);

function archetipi() {
  const capitolo = sezione("## 7 - Archetipi di immortali");
  return blocchi(capitolo, NOMI.archetipi).map(({ nome, corpo }) => {
    const campo = (prefisso) => {
      const r = corpo.find((x) => x.startsWith(prefisso));
      if (!r) throw new Error(`${nome}: manca "${prefisso}"`);
      return pulisci(r.slice(prefisso.length));
    };
    const incrementi = Object.fromEntries([...campo("Incrementi di caratteristica:").matchAll(/(\p{L}+)\s*(●+)/gu)].map((m) => [idCaratteristica(m[1]), m[2].length]));
    const inizioNatura = corpo.findIndex((r) => r.startsWith("Natura dell'immortale"));
    const natura = [];
    for (const r of corpo.slice(inizioNatura + 1)) {
      const m = /^([^:]{2,40}): (.*)$/.exec(r);
      if (m) natura.push({ nome: m[1], testo: [m[2]] });
      else natura.at(-1).testo.push(r);
    }
    return {
      id: ident(nome), nome,
      colore: ident(campo("Colore:").replace(/\.$/, "")),
      descrizione: corpo.slice(0, corpo.findIndex((r) => r.startsWith("Colore:"))),
      incrementi,
      poteri_innati: poteriConPallini(campo("Poteri innati:")),
      poteri_affini: elencoPoteri(campo("Poteri affini:")),
      natura,
    };
  });
}

// "(abilità) socialità, percezione, difesa, (caratteristica) astuzia, (poteri) Dementia o Empatico (a seconda del colore)."
function abilitaLavorative(testo) {
  const px = Number(/investire (\d+) punti esperienza/.exec(testo)[1]);
  const gruppi = Object.fromEntries([...testo.matchAll(/\((abilità|caratteristica|poteri)\)\s*([^(]*(?:\(a seconda del colore\))?[^(]*)/g)]
    .map((m) => [m[1], m[2].replace(/[,.\s]+$/, "")]));
  const poteri = (gruppi.poteri ?? "").split(",").map(pulisci).filter(Boolean).map((p) => {
    const colore = /^(.+?) o (.+?) \(a seconda del colore\)$/.exec(p);
    // Il primo dei due è per i neri o per i bianchi? Si legge dai colori dei poteri (solo bianchi / solo neri).
    return colore ? { a_seconda_del_colore: [idPotere(colore[1]), idPotere(colore[2])] } : { potere: idPotere(p) };
  });
  return {
    px,
    abilita: (gruppi["abilità"] ?? "").split(",").map(pulisci).filter(Boolean).map(ident),
    caratteristiche: (gruppi.caratteristica ?? "").split(",").map(pulisci).filter(Boolean).map(ident),
    poteri,
    testo,
  };
}

// Ogni carriera (manuale 1.6): «motto», descrizione, Ferri del mestiere, Abilità lavorative, Ispirazione, poi
// "Poteri del …" con i poteri di carriera. Un potere di carriera inizia con una riga che è solo il nome (niente
// punto, due punti o ●); le righe prima del primo nome sono regole comuni ai poteri della carriera (Messaggero).
const nomePotereCarriera = (r) => r.length < 50 && !/[.:●…]/.test(r) && !/^[-|<]/.test(r);

function carriere() {
  return blocchi(sezione("## 8 - Carriere"), NOMI.carriere).map(({ nome, corpo }) => {
    const indice = (prefisso) => corpo.findIndex((r) => r.startsWith(prefisso));
    const dopoPrefisso = (r) => pulisci(r.replace(/^[^:.]+[:.]\s*/, ""));
    const iFerri = indice("Ferri del mestiere");
    const iAbilita = indice("Abilità lavorative");
    const iIspirazione = indice("Ispirazione");
    const iPoteri = corpo.findIndex((r) => /^Poteri del/.test(r));
    if ([iFerri, iAbilita, iIspirazione, iPoteri].some((i) => i < 0)) throw new Error(`${nome}: manca un campo della carriera`);
    const motto = /^«(.*)»\.?$/.exec(corpo[0]);
    const regole = [];
    const poteri = [];
    for (const r of corpo.slice(iPoteri + 1)) {
      if (nomePotereCarriera(r)) poteri.push({ nome: r, testo: [] });
      else if (!poteri.length) regole.push(r);
      else poteri.at(-1).testo.push(r);
    }
    if (!poteri.length) throw new Error(`${nome}: nessun potere di carriera`);
    return {
      id: ident(nome), nome,
      ...(motto ? { motto: motto[1] } : {}),
      descrizione: corpo.slice(motto ? 1 : 0, iFerri),
      ferri_del_mestiere: dopoPrefisso(corpo[iFerri]),
      abilita_lavorative: abilitaLavorative(dopoPrefisso(corpo[iAbilita])),
      ispirazione: dopoPrefisso(corpo[iIspirazione]),
      ...(regole.length ? { regole_poteri: regole } : {}),
      poteri: poteri.map((p) => ({ id: ident(p.nome), nome: p.nome, testo: p.testo, livelli: livelliDa(p.testo) })),
    };
  });
}

// ------------------------------------------------------------------------------------------------ poteri
// Livelli e costi di un potere, nei vari modi in cui li scrive il manuale: "| ● (4) | testo |", "● Nome (2): …",
// "● (2), ●● (4)", "Nome ●● (8): …". "(2+)" (Tefillin) vuol dire 2 più il costo del potere associato.
function livelliDa(corpo) {
  const livelli = [];
  const livello = (pallini, costo, nome) => livelli.push({
    livello: pallini.length,
    ...(nome ? { nome: pulisci(nome) } : {}),
    costo_px: Number(costo.replace("+", "")),
    ...(costo.endsWith("+") ? { costo_variabile: true } : {}),
  });
  for (const r of corpo) {
    let m;
    if ((m = /^\| (●+) \((\d+\+?)\) \| /.exec(r))) livello(m[1], m[2]);
    else if ((m = /^(●+) ([^●(]+?) \((\d+\+?)\)/.exec(r))) livello(m[1], m[3], m[2]);
    else if (/^●/.test(r)) for (const c of r.matchAll(/(●+) \((\d+\+?)\)/g)) livello(c[1], c[2]);
    else if ((m = /^(.{2,45}?) (●+)\s+\((\d+\+?)\)/.exec(r))) livello(m[2], m[3], m[1]);
  }
  return livelli;
}

function poteri() {
  const capitolo = sezione("## 10 - Poteri");
  // Le sottosezioni sono titoli ### dentro il capitolo: le righe da un titolo al successivo.
  const sottosezione = (titoloSezione) => {
    const inizio = capitolo.findIndex((r) => r.startsWith(titoloSezione));
    const fine = capitolo.findIndex((r, k) => k > inizio && /^###? /.test(r));
    return capitolo.slice(inizio + 1, fine < 0 ? capitolo.length : fine);
  };
  const sezioni = { comune: "### Poteri comuni", passivo: "### Poteri passivi", attivo: "### Poteri attivi", superiore: "### Poteri superiori" };
  return Object.entries(NOMI.poteri).flatMap(([categoria, nomi]) => blocchi(sottosezione(sezioni[categoria]), nomi).map(({ nome, corpo }) => {
    const colore = corpo.map((r) => /^solo (?:per )?(bianchi|neri)$/i.exec(r)).find(Boolean);
    const solo = colore && (colore[1].toLowerCase() === "bianchi" ? "bianco" : "nero");
    const livelli = livelliDa(corpo);
    const doppi = livelli.map((l) => l.livello).filter((l, k, tutti) => tutti.indexOf(l) !== k);
    if (doppi.length) throw new Error(`${nome}: livelli doppi (${doppi.join(", ")}): una voce nuova del manuale da aggiungere a NOMI.poteri?`);
    return {
      id: ident(nome), nome, categoria,
      ...(solo ? { solo } : {}),
      livelli,
      reazione: corpo.some((r) => r.startsWith("Reazione")),
      effetto_combo: corpo.some((r) => /^effett[oi] combo/i.test(r)),
    };
  }));
}

// ------------------------------------------------------------------------------------------------ equipaggiamento
function armi() {
  const sezioneArmi = sezione("### Armi");
  return blocchi(sezioneArmi, NOMI.armi).map(({ nome, corpo }) => {
    const iStat = corpo.findIndex((r) => /^Danno:/.test(r));
    if (iStat < 0) throw new Error(`${nome}: mancano le statistiche`);
    const stat = corpo[iStat];
    const numero = (etichetta) => Number(new RegExp(`${etichetta}:\\s*(\\d+)`).exec(stat)?.[1]);
    const segni = (etichetta) => new RegExp(`${etichetta}:\\s*([●○]+)`).exec(stat)?.[1];
    const id = ident(nome);
    const note = [];
    const opp = [];
    let tabella = null;
    for (const r of corpo.slice(iStat + 1)) {
      if (r === "<TABELLA>") tabella = [];
      else if (r === "</TABELLA>") continue;
      else if (r.startsWith("|")) tabella.push(celle(r));
      else if (opportunita(r)) opp.push(opportunita(r));
      else note.push(r);
    }
    return {
      id, nome,
      abilita: ABILITA_ARMI[id] ?? "mischia",
      descrizione: corpo.slice(0, iStat),
      danno: numero("Danno"),
      distanza: numero("Distanza"),
      ...(segni("Munizioni") ? { munizioni: pallini(segni("Munizioni")) } : {}),
      distruttivita: pallini(segni("Distruttività") ?? ""),
      statistiche: stat,
      note,
      ...(opp.length ? { opportunita: opp } : {}),
      ...(tabella ? { tabella } : {}),
    };
  });
}

function seguaci() {
  return blocchi(sezione("### Seguaci"), NOMI.seguaci).map(({ nome, corpo }) => ({ id: ident(nome), nome, testo: corpo }));
}

// ------------------------------------------------------------------------------------------------ scrittura
const FILE = {
  "elenchi/caratteristiche.json": ["caratteristiche", "2 - Regole base", caratteristiche],
  "elenchi/abilita.json": ["abilita", "3 - Azioni e abilità; 4 - Combattimento", abilita],
  "elenchi/distanze.json": ["distanze", "2 - Regole base", distanze],
  "elenchi/distruttivita.json": ["distruttivita", "5 - Regole avanzate", distruttivita],
  "elenchi/dimensioni.json": ["dimensioni", "5 - Regole avanzate", dimensioni],
  "elenchi/colori.json": ["colori", "5 - Regole avanzate", colori],
  "elenchi/ricchezza.json": ["ricchezza", "11 - Armi ed oggettistica", ricchezza],
  "archetipi.json": ["archetipi", "7 - Archetipi di immortali", archetipi],
  "carriere.json": ["carriere", "8 - Carriere", carriere],
  "poteri.json": ["poteri", "10 - Poteri", poteri],
  "equipaggiamento/armi.json": ["armi", "11 - Armi ed oggettistica", armi],
  "equipaggiamento/seguaci.json": ["seguaci", "11 - Armi ed oggettistica", seguaci],
};

export async function estrai() {
  righe = (await readFile(MANUALE, "utf8")).replace(/\r/g, "").split("\n");
  for (const [file, [schema, capitolo, funzione]] of Object.entries(FILE)) {
    const voci = funzione();
    const contenuto = {
      $schema: `${path.relative(path.dirname(path.join(DATI, file)), path.join(DATI, "schemi")).replaceAll("\\", "/")}/${schema}.schema.json`,
      fonte: { manuale: FONTE, capitolo },
      generato_da: "strumenti/estrai_dati.mjs",
      voci,
    };
    await mkdir(path.dirname(path.join(DATI, file)), { recursive: true });
    await writeFile(path.join(DATI, file), `${JSON.stringify(contenuto, null, 2)}\n`);
    console.log(`dati/${file}: ${voci.length} voci`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await estrai();
