// Mockup: la barra dei tiri, uguale nei quattro mock (qui c'e' solo la logica, lo stile e' di ogni mock).
// Niente si salva e niente torna com'era dopo il tiro: la scheda fa da riferimento, non gioca al posto del giocatore.
//
// Controlli:   [data-soglia="2..6"]  [data-gm="0|1"]  [data-mod="stordito|scosso|aspetto"]
//              [data-piu="dadi|diff"]  [data-meno="dadi|diff"]
// Uscite:      [data-out="soglia|soglia-nome|dadi|diff|formula|dadi-chat|successi|esuberi|esito|gm"]
// Riserve:     [data-base="5"] [data-ambito="abilita|attacco|difesa"] [data-prefisso="Mischia "]
// Chat:        [data-chat] con le righe delle opportunita' [data-costo="2"]
(() => {
  const stato = { soglia: 4, dadi: 0, diff: 1, gm: false, mod: { stordito: false, scosso: false, aspetto: true } };
  // Modificatori pronti: condizioni del manuale e bonus dei poteri del personaggio.
  const MOD = {
    aspetto: { nome: "Aspetto alieno", dadi: 1, ambiti: ["difesa"] },
    stordito: { nome: "Stordito", dadi: -1, ambiti: null },
    scosso: { nome: "Scosso", dadi: -1, ambiti: null },
  };
  const NOMI_SOGLIA = { 2: "due vantaggi", 3: "vantaggio", 4: "normale", 5: "svantaggio", 6: "due svantaggi" };
  const SEQUENZA = [6, 5, 4, 2, 1, 3, 5, 2, 6, 4, 1, 3]; // i dadi d'esempio della chat, sempre gli stessi
  const segno = n => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n);

  const attivi = ambito => Object.entries(MOD).filter(([k, m]) => stato.mod[k] && (!m.ambiti || m.ambiti.includes(ambito)));
  const modifica = ambito => attivi(ambito).reduce((t, [, m]) => t + m.dadi, 0) + stato.dadi;
  const scrivi = (nome, testo) => document.querySelectorAll(`[data-out="${nome}"]`).forEach(el => { el.textContent = testo; });

  function aggiorna() {
    document.querySelectorAll("[data-soglia]").forEach(b => b.classList.toggle("on", +b.dataset.soglia === stato.soglia));
    document.querySelectorAll("[data-gm]").forEach(b => b.classList.toggle("on", (b.dataset.gm === "1") === stato.gm));
    document.querySelectorAll("[data-mod]").forEach(b => b.classList.toggle("on", stato.mod[b.dataset.mod]));
    document.querySelectorAll("[data-barra]").forEach(el =>
      el.classList.toggle("attiva", stato.soglia !== 4 || stato.dadi !== 0 || stato.mod.stordito || stato.mod.scosso));
    scrivi("soglia", stato.soglia + "+");
    scrivi("soglia-nome", NOMI_SOGLIA[stato.soglia]);
    scrivi("dadi", stato.dadi ? segno(stato.dadi) : "0");
    scrivi("diff", String(stato.diff));
    scrivi("gm", stato.gm ? "solo al GM" : "pubblico");
    document.querySelectorAll("[data-base]").forEach(el => {
      const n = Math.max(0, +el.dataset.base + modifica(el.dataset.ambito || "abilita"));
      el.textContent = (el.dataset.prefisso || "") + n + "D6";
    });
    chat();
  }

  // Il tiro d'esempio: Ezekiel attacca con lo spadone (Possanza 3 + Mischia 2).
  function chat() {
    if (!document.querySelector("[data-chat]")) return;
    let formula = "Possanza 3 + Mischia 2";
    for (const [, m] of attivi("attacco")) formula += ` ${m.dadi > 0 ? "+" : "−"} ${m.nome} ${Math.abs(m.dadi)}`;
    if (stato.dadi) formula += ` ${stato.dadi > 0 ? "+" : "−"} ${Math.abs(stato.dadi)} ${Math.abs(stato.dadi) === 1 ? "dado" : "dadi"}`;
    const n = Math.max(0, 5 + modifica("attacco"));
    formula += ` = ${n}D6`;
    const dadi = SEQUENZA.slice(0, n);
    const successi = dadi.filter(d => d >= stato.soglia).length;
    const riuscito = successi >= stato.diff;
    const esuberi = riuscito ? successi - stato.diff : 0;
    scrivi("formula", formula);
    scrivi("successi", String(successi));
    scrivi("esuberi", riuscito ? String(esuberi) : "—");
    scrivi("esito", riuscito ? "Riuscito" : "Fallito");
    document.querySelectorAll('[data-out="dadi-chat"]').forEach(el => {
      el.innerHTML = dadi.length ? dadi.map(d => `<b class="${d >= stato.soglia ? "s" : ""} ${d === 1 ? "uno" : ""}">${d}</b>`).join("") : "<small>nessun dado</small>";
    });
    document.querySelectorAll("[data-costo]").forEach(el => {
      const ok = riuscito && +el.dataset.costo <= esuberi;
      el.style.opacity = ok ? "" : ".35";
    });
  }

  document.addEventListener("click", e => {
    const t = e.target.closest("[data-soglia],[data-gm],[data-mod],[data-piu],[data-meno]");
    if (!t) return;
    if (t.dataset.soglia) stato.soglia = +t.dataset.soglia;
    else if (t.dataset.gm) stato.gm = t.dataset.gm === "1";
    else if (t.dataset.mod) stato.mod[t.dataset.mod] = !stato.mod[t.dataset.mod];
    else {
      const chi = t.dataset.piu || t.dataset.meno, d = t.dataset.piu ? 1 : -1;
      if (chi === "dadi") stato.dadi = Math.max(-9, Math.min(9, stato.dadi + d));
      if (chi === "diff") stato.diff = Math.max(1, Math.min(9, stato.diff + d));
    }
    aggiorna();
  });
  document.addEventListener("DOMContentLoaded", aggiorna);
})();
