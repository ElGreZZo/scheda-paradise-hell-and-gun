// Charactermancer: il wizard a slide delle schede Roll20, lato pagina.
//
// Riproduce il comportamento descritto in https://wiki.roll20.net/Charactermancer_Development e
// osservato in partita con la scheda D&D 5E (registrazioni in "scheda d&d/registrazioni"):
// - slide <charmancer> con campi comp_*, pulsanti back/submit/cancel/finish/action/roll;
// - sezioni condizionali (showChoices aggiunge la classe choice-showing);
// - select con accept="query" riempite dal compendio, con la sigla della fonte;
// - sezioni ripetibili del wizard: <div class="sezione repeating_ID_nome" data-repeating=...>, campi
//   rinominati comp_repeating_ID_nome_campo;
// - oggetto dati { slide: { values, data, repeating } }, salvato col personaggio (mancerdata);
// - eventi page:, mancerchange:, mancerroll:, clicked:, mancer:cancel, mancerfinish:.

const ALFABETO = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"; // senza "_": la scheda divide gli id sugli underscore
function nuovoId() {
  let tempo = Date.now();
  let parte = "";
  for (let i = 0; i < 7; i++) {
    parte = ALFABETO[tempo % 63] + parte;
    tempo = Math.floor(tempo / 63);
  }
  let id = "-" + parte;
  for (let i = 0; i < 12; i++) id += ALFABETO[Math.floor(Math.random() * 63)];
  return id;
}
const cssEscape = (s) => (globalThis.CSS?.escape ? CSS.escape(s) : String(s).replace(/[^\w-]/g, (c) => `\\${c}`));
const selettoreDiClasse = (s) => (/^[.#[]/.test(s) ? s : `.${s.split(/\s+/).map((x, i) => (i === 0 ? cssEscape(x) : x)).join(" ")}`);

export function creaCharmancer({ doc, contenitore, radiceScheda, pagine, ripetibili, traduci, compendio, emetti, registro, salvaDati, alCambioStato, tira }) {
  const stato = { attivo: false, pagina: null, bloccato: false, dati: {} };

  const slide = () => contenitore;
  const datiPagina = (p = stato.pagina) => (stato.dati[p] ??= { values: {}, data: {} });
  const notifica = () => {
    salvaDati(stato.dati);
    alCambioStato?.(stato);
  };

  // ------------------------------------------------ nomi dei campi
  const nomeCampo = (el) => el.getAttribute("name").replace(/^comp_/, "");
  const sezioneDi = (el) => el.closest("[data-repeating]")?.dataset.repeating ?? null;
  /** nomi di evento per un campo o un pulsante: il campo stesso, poi la sezione e le sezioni esterne */
  function nomiEvento(prefisso, el, nome) {
    const sezione = sezioneDi(el);
    if (!sezione) return { nomi: [`${prefisso}:${nome}`], sourceSection: undefined };
    const nomi = [];
    const breve = (s) => s.replace(/^repeating_-[A-Za-z0-9-]+?_/, "repeating_");
    const campo = nome.startsWith(sezione + "_") ? nome.slice(sezione.length + 1) : nome;
    nomi.push(`${prefisso}:${breve(sezione)}_${campo}`, `${prefisso}:${breve(sezione)}`);
    for (let padre = el.closest("[data-repeating]")?.parentElement?.closest("[data-repeating]"); padre; padre = padre.parentElement?.closest("[data-repeating]")) {
      nomi.push(`${prefisso}:${breve(padre.dataset.repeating)}`);
    }
    return { nomi, sourceSection: sezione };
  }

  // ------------------------------------------------ valori dei campi
  function leggiCampo(el) {
    if (el.type === "checkbox") return el.checked ? el.value : "0";
    if (el.type === "radio") return el.checked ? el.value : undefined;
    return el.value;
  }
  function scriviCampo(el, v) {
    const s = v === undefined || v === null ? "" : String(v);
    if (el.type === "checkbox" || el.type === "radio") el.checked = el.value === s;
    else if (el.tagName === "SELECT") {
      el.value = s;
      if (el.value !== s && s !== "") el.dataset.valoreInAttesa = s; // l'opzione arriverà con setCharmancerOptions
    } else {
      el.value = s;
      if (el.tagName === "INPUT") el.setAttribute("value", s);
    }
  }
  const campiNellaSlide = (nome) => [...slide().querySelectorAll(`[name="comp_${cssEscape(nome)}"]`)];

  function cambiaValore(nome, valore, sourceType, { silenzioso = false } = {}) {
    const valori = datiPagina().values;
    const precedente = valori[nome];
    valori[nome] = valore;
    const campi = campiNellaSlide(nome);
    if (sourceType !== "player") for (const el of campi) scriviCampo(el, valore);
    notifica();
    if (silenzioso) return;
    const { nomi, sourceSection } = campi[0] ? nomiEvento("mancerchange", campi[0], nome) : { nomi: [`mancerchange:${nome}`] };
    emetti(nomi, { currentStep: stato.pagina, newValue: valore, previousValue: precedente, sourceType, sourceAttribute: nome, sourceSection, triggerName: nomi[0].slice(13) }, { mancer: "mancer", passo: stato.pagina, campo: nome });
  }

  // ------------------------------------------------ select dal compendio
  async function riempiSelect(select, elementi, impostazioni = {}, daCompendio = false) {
    for (const o of [...select.querySelectorAll("option[data-dinamica]")]) o.remove();
    const statiche = [...select.options];
    const primaNonVuota = statiche.find((o) => o.value !== "");
    const valori = [];
    for (const { valore, etichetta } of elementi) {
      const o = doc.createElement("option");
      o.value = valore;
      o.textContent = etichetta;
      o.dataset.dinamica = "1";
      if (daCompendio) o.className = "sheet-compendium-opt";
      if ((impostazioni.disable ?? []).includes(valore)) o.disabled = true;
      select.insertBefore(o, primaNonVuota ?? null);
      valori.push(valore);
    }
    const nome = select.getAttribute("name")?.replace(/^comp_/, "");
    const salvato = select.dataset.valoreInAttesa ?? datiPagina().values[nome];
    if (impostazioni.selected !== undefined) {
      select.value = impostazioni.selected;
      if (nome && datiPagina().values[nome] !== impostazioni.selected) cambiaValore(nome, impostazioni.selected, "worker", { silenzioso: Boolean(impostazioni.silent) });
    } else if (salvato !== undefined) {
      select.value = salvato;
    }
    delete select.dataset.valoreInAttesa;
    return valori;
  }

  async function elementiDa(opzioni, impostazioni = {}) {
    const categoria = impostazioni.category;
    const conCategoria = (x) => (categoria && !String(x).startsWith(categoria + ":") ? `${categoria}:${x}` : String(x));
    let elementi = [];
    let daCompendio = false;
    if (typeof opzioni === "string") {
      daCompendio = true;
      elementi = (await compendio.query(opzioni)).map((p) => ({ valore: compendio.valoreOpzione(p), etichetta: impostazioni.show_source !== false && compendio.siglaDi(p) ? `${p.name} (${compendio.siglaDi(p)})` : p.name }));
    } else if (Array.isArray(opzioni)) {
      elementi = opzioni.map((x) => (typeof x === "object" && x ? { valore: conCategoria(x.value ?? x.name), etichetta: x.label ?? x.name ?? x.value } : { valore: conCategoria(x), etichetta: String(x).replace(/^[^:]+:/, "") }));
    }
    for (const x of impostazioni.add ?? []) elementi.push({ valore: conCategoria(x), etichetta: String(x).replace(/^[^:]+:/, "") });
    return { elementi, daCompendio };
  }

  function trovaSelect(target) {
    const nome = String(target).replace(/^comp_/, "");
    let trovati = campiNellaSlide(nome).filter((el) => el.tagName === "SELECT");
    if (!trovati.length) {
      try {
        trovati = [...slide().querySelectorAll(selettoreDiClasse(String(target)))].flatMap((el) => (el.tagName === "SELECT" ? [el] : [...el.querySelectorAll("select")]));
      } catch {
        trovati = [];
      }
    }
    return trovati;
  }

  // ------------------------------------------------ pagina del compendio nel pannello informazioni
  async function mostraPaginaCompendio(elemento, riferimento) {
    const p = riferimento ? await compendio.pagina(riferimento) : null;
    const html = p?.htmlcontent || p?.content || `<p><em>${riferimento ? `Pagina "${riferimento}" non presente nel compendio locale.` : ""}</em></p>`;
    elemento.innerHTML = "";
    const iframe = doc.createElement("iframe");
    iframe.style.cssText = "width:100%;height:calc(100% - 5px);border:0;background:#fff";
    iframe.srcdoc = `<!doctype html><meta charset="utf-8"><base target="_blank"><style>body{font:13px/1.5 "Helvetica Neue",Helvetica,Arial,sans-serif;color:#333;padding:8px 12px;margin:0}h1,h2,h3{font-family:Georgia,serif;color:#58180d}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:2px 6px}img{max-width:100%}</style><h1>${p?.name ?? ""}</h1>${html}`;
    elemento.append(iframe);
  }

  // ------------------------------------------------ slide
  async function caricaSlide(nome, sourceType = "worker") {
    if (pagine[nome] === undefined) {
      registro("errore", `Charactermancer: slide "${nome}" inesistente`);
      return;
    }
    if (stato.pagina && stato.pagina !== nome) pulisciValoriOrfani();
    stato.pagina = nome;
    datiPagina();
    contenitore.innerHTML = pagine[nome];
    contenitore.classList.toggle("locked", stato.bloccato);
    traduci(contenitore);
    // valori salvati
    for (const el of slide().querySelectorAll('[name^="comp_"]')) {
      const v = datiPagina().values[nomeCampo(el)];
      if (v !== undefined) scriviCampo(el, v);
    }
    // select con accept e pannelli del compendio
    await Promise.all(
      [...slide().querySelectorAll("select[accept]")].map(async (s) => {
        const { elementi } = await elementiDa(s.getAttribute("accept"), { show_source: true });
        await riempiSelect(s, elementi, {}, true);
      }),
    );
    for (const el of slide().querySelectorAll(".sheet-compendium-page[accept]")) mostraPaginaCompendio(el, el.getAttribute("accept"));
    contenitore.scrollTop = 0;
    notifica();
    registro("log", `Charactermancer: slide ${nome}`);
    emetti([`page:${nome}`], { sourceType, triggerName: nome, currentStep: nome }, { mancer: "page", passo: nome });
    // Rivisitando una slide Roll20 riemette le modifiche dei valori salvati, così i worker la ricostruiscono.
    for (const [campo, valore] of Object.entries(datiPagina().values)) {
      if (campo.startsWith("repeating_") || valore === "" || valore === undefined || valore === null) continue;
      const el = campiNellaSlide(campo)[0];
      if (!el) continue;
      emetti([`mancerchange:${campo}`], { currentStep: nome, newValue: valore, previousValue: valore, sourceType: "worker", sourceAttribute: campo, triggerName: campo }, { mancer: "mancer", passo: nome, campo });
    }
  }

  function pulisciValoriOrfani() {
    const d = stato.dati[stato.pagina];
    if (!d) return;
    for (const campo of Object.keys(d.values)) if (!campiNellaSlide(campo).length) delete d.values[campo];
  }

  function mostra(attivo) {
    stato.attivo = attivo;
    contenitore.style.display = attivo ? "block" : "none";
    radiceScheda.style.display = attivo ? "none" : "";
    alCambioStato?.(stato);
  }

  function requisitiMancanti() {
    const mancanti = [...slide().querySelectorAll('[required], [required] input, [required] select')]
      .filter((el) => el.matches("input, select, textarea") && el.offsetParent !== null && !el.value);
    slide().querySelectorAll(".hilite-errore").forEach((el) => el.classList.remove("hilite-errore"));
    for (const el of mancanti) (el.closest("label") ?? el).classList.add("hilite", "hilite-errore");
    return mancanti;
  }

  // ------------------------------------------------ interazione del giocatore
  contenitore.addEventListener("change", (e) => {
    const el = e.target;
    if (!el.matches?.('[name^="comp_"]') || stato.bloccato) return;
    const v = leggiCampo(el);
    if (v === undefined) return;
    cambiaValore(nomeCampo(el), v, "player");
  });

  contenitore.addEventListener("click", async (e) => {
    const pulsante = e.target.closest("button");
    if (!pulsante || !contenitore.contains(pulsante)) return;
    const tipo = pulsante.getAttribute("type");
    if (["back", "submit", "here", "cancel", "finish", "action", "roll", "button"].includes(tipo)) e.preventDefault();
    if (stato.bloccato && tipo !== "button") return;
    const valore = pulsante.getAttribute("value");
    if (tipo === "back") await caricaSlide(valore, "player");
    else if (tipo === "submit") {
      if (requisitiMancanti().length) registro("log", "Charactermancer: campi obbligatori mancanti");
      else await caricaSlide(valore, "player");
    } else if (tipo === "cancel") {
      pulisciValoriOrfani();
      mostra(false);
      notifica();
      emetti(["mancer:cancel"], { value: valore, triggerName: "mancer:cancel" }, null);
    } else if (tipo === "finish") {
      pulisciValoriOrfani();
      stato.bloccato = true;
      if (pagine.final !== undefined) await caricaSlide("final", "player");
      contenitore.classList.add("locked");
      emetti([`mancerfinish:${valore}`], { data: stato.dati, triggerName: `mancerfinish:${valore}` }, { mancer: "finish", passo: stato.pagina });
    } else if (tipo === "action") {
      const nome = (pulsante.getAttribute("name") ?? "").replace(/^act_/, "");
      const { nomi, sourceSection } = nomiEvento("clicked", pulsante, nome);
      const attributi = Object.fromEntries([...pulsante.attributes].map((a) => [a.name, a.value]));
      emetti(nomi, { triggerName: nomi[0], sourceSection, sourceAttribute: nome, currentStep: stato.pagina, htmlAttributes: { ...attributi, tagName: "button" } }, { mancer: "mancer", passo: stato.pagina });
    } else if (tipo === "roll") {
      const nome = (pulsante.getAttribute("name") ?? "").replace(/^roll_/, "");
      const tiri = await tira(valore ?? "");
      if (!tiri) return;
      const { nomi, sourceSection } = nomiEvento("mancerroll", pulsante, nome);
      emetti(nomi, { triggerName: nomi[0].slice(11), sourceSection, sourceAttribute: nome, currentStep: stato.pagina, roll: tiri }, { mancer: "mancer", passo: stato.pagina });
    } else if (tipo === "button" && pulsante.dataset.scroll) {
      contenitore.scrollTop = 0;
      contenitore.closest("body")?.ownerDocument.defaultView.scrollTo(0, 0);
    }
  });

  // ------------------------------------------------ funzioni chiamate dai worker
  const funzioni = {
    async startCharactermancer(pagina) {
      stato.bloccato = false;
      mostra(true);
      await caricaSlide(pagina);
    },
    async changeCharmancerPage(pagina) {
      if (!stato.attivo) mostra(true);
      await caricaSlide(pagina);
    },
    setCharmancerText(aggiornamenti) {
      for (const [chiave, html] of Object.entries(aggiornamenti ?? {})) {
        let elementi = [];
        try {
          elementi = [...slide().querySelectorAll(selettoreDiClasse(chiave))];
        } catch {
          registro("log", `setCharmancerText: selettore non valido "${chiave}"`);
        }
        for (const el of elementi) {
          el.innerHTML = html ?? "";
          traduci(el);
        }
      }
    },
    showChoices(classi = []) {
      for (const c of [].concat(classi)) for (const el of slide().querySelectorAll(selettoreDiClasse(c))) el.classList.add("choice-showing");
    },
    hideChoices(classi) {
      const elementi = classi && [].concat(classi).length ? [].concat(classi).flatMap((c) => [...slide().querySelectorAll(selettoreDiClasse(c))]) : [...slide().querySelectorAll(".choice-showing")];
      for (const el of elementi) el.classList.remove("choice-showing");
    },
    async setCharmancerOptions(target, opzioni, impostazioni = {}) {
      const select = trovaSelect(target);
      if (!select.length) registro("log", `setCharmancerOptions: nessuna select per "${target}"`);
      const { elementi, daCompendio } = await elementiDa(opzioni, impostazioni ?? {});
      let valori = elementi.map((e) => e.valore);
      for (const s of select) valori = await riempiSelect(s, elementi, impostazioni ?? {}, daCompendio);
      return valori;
    },
    disableCharmancerOptions(target, valori = [], impostazioni = {}) {
      for (const s of trovaSelect(target)) {
        for (const o of s.options) o.disabled = valori.includes(o.value) && o.value !== s.value && o.value !== "";
      }
    },
    changeCompendiumPage(target, pagina) {
      let elementi = [];
      try {
        elementi = [...slide().querySelectorAll(selettoreDiClasse(target))];
      } catch {}
      for (const el of elementi) mostraPaginaCompendio(el, pagina);
    },
    addRepeatingSection(target, sezione, nome) {
      const nomeSezione = nome || sezione;
      let destinazione = null;
      try {
        destinazione = slide().querySelector(selettoreDiClasse(target)) ?? slide().querySelector(`[data-repeating="${cssEscape(target)}"]`);
      } catch {}
      if (!destinazione) {
        registro("errore", `addRepeatingSection: destinazione "${target}" non trovata`);
        return null;
      }
      if (ripetibili[sezione] === undefined) {
        registro("errore", `addRepeatingSection: sezione "${sezione}" inesistente`);
        return null;
      }
      const d = datiPagina();
      d.repeating ??= [];
      // Rivisitando la slide si riusano gli id delle sezioni con lo stesso nome.
      const presenti = new Set([...slide().querySelectorAll("[data-repeating]")].map((el) => el.dataset.repeating));
      const riusabile = d.repeating.find((r) => !presenti.has(r) && r.replace(/^repeating_-[A-Za-z0-9-]+_/, "") === nomeSezione);
      const id = riusabile ?? `repeating_${nuovoId()}_${nomeSezione}`;
      if (!d.repeating.includes(id)) d.repeating.push(id);
      const div = doc.createElement("div");
      div.className = `${sezione} ${id}`;
      div.dataset.repeating = id;
      div.innerHTML = ripetibili[sezione];
      for (const el of div.querySelectorAll("[name]")) {
        const n = el.getAttribute("name");
        const m = /^(comp|act|roll)_(.*)$/.exec(n);
        if (m) el.setAttribute("name", `${m[1]}_${id}_${m[2]}`);
      }
      traduci(div);
      destinazione.append(div);
      for (const el of div.querySelectorAll('[name^="comp_"]')) {
        const v = d.values[nomeCampo(el)];
        if (v !== undefined) scriviCampo(el, v);
      }
      notifica();
      // valori ripristinati: come per le slide rivisitate, si riemettono le modifiche
      for (const el of div.querySelectorAll('[name^="comp_"]')) {
        const campo = nomeCampo(el);
        const v = d.values[campo];
        if (v === undefined || v === "" || v === null) continue;
        const { nomi, sourceSection } = nomiEvento("mancerchange", el, campo);
        setTimeout(() => emetti(nomi, { currentStep: stato.pagina, newValue: v, previousValue: v, sourceType: "worker", sourceAttribute: campo, sourceSection, triggerName: nomi[0].slice(13) }, { mancer: "mancer", passo: stato.pagina, campo }), 0);
      }
      return id;
    },
    clearRepeatingSections(target) {
      let radice = null;
      try {
        radice = slide().querySelector(selettoreDiClasse(target));
      } catch {}
      if (!radice) return;
      rimuoviSezioni([...radice.querySelectorAll("[data-repeating]")]);
    },
    clearRepeatingSectionById(ids = []) {
      rimuoviSezioni([].concat(ids).flatMap((id) => [...slide().querySelectorAll(`[data-repeating="${cssEscape(id)}"]`)]));
    },
    getRepeatingSections(target) {
      let radice = slide();
      if (target) {
        try {
          radice = slide().querySelector(selettoreDiClasse(target)) ?? slide();
        } catch {}
      }
      const elementi = [...radice.querySelectorAll("[data-repeating]")];
      const albero = {};
      const nodi = new Map();
      for (const el of elementi) nodi.set(el, {});
      for (const el of elementi) {
        const padre = el.parentElement?.closest("[data-repeating]");
        if (padre && nodi.has(padre)) nodi.get(padre)[el.dataset.repeating] = nodi.get(el);
        else albero[el.dataset.repeating] = nodi.get(el);
      }
      return { list: elementi.map((el) => el.dataset.repeating), tree: albero };
    },
    deleteCharmancerData(elencoPagine) {
      const daTogliere = elencoPagine && [].concat(elencoPagine).length ? [].concat(elencoPagine) : Object.keys(stato.dati);
      for (const p of daTogliere) delete stato.dati[p];
      if (stato.pagina) datiPagina();
      notifica();
    },
    finishCharactermancer() {
      stato.bloccato = false;
      contenitore.classList.remove("locked");
      mostra(false);
      notifica();
    },
    /** setAttrs chiamato da un evento del Charactermancer: imposta i campi della slide corrente */
    impostaValori(valori, silenzioso) {
      for (const [nome, v] of Object.entries(valori ?? {})) {
        const campo = String(nome).replace(/^comp_/, "");
        const campi = campiNellaSlide(campo);
        for (const el of campi) if (el.type === "checkbox" || el.type === "radio") scriviCampo(el, v);
        cambiaValore(campo, v, "worker", { silenzioso });
      }
    },
    salvaDatiCompendio(campo, pagina) {
      if (!stato.pagina || !campo) return;
      const d = datiPagina();
      if (pagina === null) delete d.data[campo];
      else d.data[campo] = pagina.data;
      notifica();
    },
  };

  function rimuoviSezioni(elementi) {
    const d = datiPagina();
    const ids = new Set();
    for (const el of elementi) {
      ids.add(el.dataset.repeating);
      for (const figlio of el.querySelectorAll("[data-repeating]")) ids.add(figlio.dataset.repeating);
    }
    for (const el of elementi) el.remove();
    for (const id of ids) {
      for (const campo of Object.keys(d.values)) if (campo.startsWith(id + "_")) delete d.values[campo];
    }
    d.repeating = (d.repeating ?? []).filter((r) => !ids.has(r));
    notifica();
  }

  return {
    stato,
    funzioni,
    carica(dati) {
      stato.dati = dati && typeof dati === "object" ? dati : {};
      stato.attivo = false;
      stato.pagina = null;
      stato.bloccato = false;
      mostra(false);
    },
  };
}
