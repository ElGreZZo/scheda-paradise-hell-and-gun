// Compendio locale: pagine scaricate da Roll20 (una categoria per file) e ricerche con la stessa
// sintassi di getCompendiumQuery e degli accept delle select del Charactermancer.
//
//   Category:Spells Level:1|2 Classes:*Cleric|*Wizard "Item Rarity":Standard|None data-Parent:Human
// - termini separati da spazi, virgolette per chiavi o valori con spazi;
// - | separa valori alternativi, * iniziale vuol dire "contiene";
// - Category e Name sono la categoria e il nome della pagina, gli altri campi stanno in data.

export async function caricaCompendio(urlCartella) {
  const indice = await (await fetch(new URL("indice.json", urlCartella))).json();
  const categorie = new Map(); // categoria minuscola -> { nome, pagine: [], perNome: Map }
  const iniziali = new Map(); // expansion -> sigla (FBR14)
  const inCaricamento = new Map();

  async function categoria(nome) {
    const chiave = String(nome).toLowerCase();
    if (categorie.has(chiave)) return categorie.get(chiave);
    const voce = Object.entries(indice.categorie).find(([c]) => c.toLowerCase() === chiave);
    if (!voce) return null;
    if (!inCaricamento.has(chiave)) {
      inCaricamento.set(
        chiave,
        fetch(new URL(voce[1].file, urlCartella))
          .then((r) => r.json())
          .then(({ elenco, pagine }) => {
            for (const e of elenco) if (e.initials) iniziali.set(Number(e.expansion), e.initials);
            const perNome = new Map();
            for (const p of pagine) {
              p.data ??= {};
              p.data.blobs ??= [];
              const k = p.name.toLowerCase();
              if (!perNome.has(k)) perNome.set(k, []);
              perNome.get(k).push(p);
            }
            const c = { nome: voce[0], pagine, perNome };
            categorie.set(chiave, c);
            return c;
          }),
      );
    }
    return inCaricamento.get(chiave);
  }
  const tutteLeCategorie = () => Promise.all(Object.keys(indice.categorie).map(categoria));

  const stub = (nome) => ({ name: nome, expansion: 0, data: { blobs: [] } });
  const valoreOpzione = (p) => `${p.data.Category}:${p.name}${p.expansion ? `?expansion=${p.expansion}` : ""}`;
  const siglaDi = (p) => iniziali.get(Number(p.expansion)) || p.expansioninitials || "";

  /** Pagina da un riferimento "Categoria:Nome?expansion=N" (o solo "Nome"). */
  async function pagina(riferimento) {
    let rif = decodeURIComponent(String(riferimento ?? "")).trim();
    if (!rif) return null;
    let expansion = null;
    const e = /\?expansion=(\d+)$/.exec(rif);
    if (e) {
      expansion = Number(e[1]);
      rif = rif.slice(0, e.index);
    }
    const i = rif.indexOf(":");
    const candidati = [];
    if (i > 0 && (await categoria(rif.slice(0, i)))) {
      candidati.push(...((await categoria(rif.slice(0, i))).perNome.get(rif.slice(i + 1).toLowerCase()) ?? []));
    } else {
      for (const c of await tutteLeCategorie()) candidati.push(...(c.perNome.get(rif.toLowerCase()) ?? []));
    }
    if (!candidati.length) return stub(i > 0 ? rif.slice(i + 1) : rif);
    return candidati.find((p) => expansion === null || Number(p.expansion) === expansion) ?? candidati[0];
  }

  function analizzaQuery(query) {
    const termini = [];
    const testo = String(query).trim();
    let i = 0;
    while (i < testo.length) {
      while (testo[i] === " ") i++;
      let token = "";
      let virgolette = false;
      while (i < testo.length && (virgolette || testo[i] !== " ")) {
        if (testo[i] === '"') virgolette = !virgolette;
        else token += testo[i];
        i++;
      }
      if (!token) continue;
      const due = token.indexOf(":");
      if (due < 0) termini.push({ testo: token.toLowerCase() });
      else termini.push({ chiave: token.slice(0, due), valori: token.slice(due + 1).split("|") });
    }
    return termini;
  }

  const confronta = (campo, valori) => {
    const elenco = Array.isArray(campo) ? campo.map(String) : campo === undefined || campo === null ? [] : [String(campo)];
    return valori.some((v) => {
      const cerca = v.toLowerCase();
      if (cerca.startsWith("*")) return elenco.some((x) => x.toLowerCase().includes(cerca.slice(1)));
      return elenco.some((x) => x.toLowerCase() === cerca || x.split(/,\s*/).some((y) => y.toLowerCase() === cerca));
    });
  };

  /** Pagine che corrispondono a una query (o a un array di query, unite). */
  async function query(q) {
    if (Array.isArray(q)) return (await Promise.all(q.map(query))).flat();
    const termini = analizzaQuery(q);
    const cat = termini.find((t) => t.chiave?.toLowerCase() === "category");
    const insiemi = cat ? (await Promise.all(cat.valori.map((v) => categoria(v)))).filter(Boolean) : await tutteLeCategorie();
    const risultati = [];
    for (const c of insiemi) {
      for (const p of c.pagine) {
        const va = termini.every((t) => {
          if (t.testo) return p.name.toLowerCase().includes(t.testo);
          const k = t.chiave.toLowerCase();
          if (k === "category") return true;
          if (k === "name") return confronta(p.name, t.valori);
          const campo = Object.keys(p.data).find((x) => x.toLowerCase() === k);
          return confronta(campo ? p.data[campo] : undefined, t.valori);
        });
        if (va) risultati.push(p);
      }
    }
    return risultati.sort((a, b) => a.name.localeCompare(b.name) || Number(a.expansion) - Number(b.expansion));
  }

  /** Copia di una pagina per i worker (senza l'HTML, che serve solo al pannello informazioni). */
  const perWorker = (p) => (p ? { name: p.name, id: p.id, expansion: p.expansion, expansioninitials: siglaDi(p), data: p.data, content: p.content } : p);

  return { indice, categoria, pagina, query, valoreOpzione, siglaDi, perWorker, tutteLeCategorie };
}
