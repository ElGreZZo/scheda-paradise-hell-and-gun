// Tiri in linea [[...]] calcolati come Roll20, in forma ridotta.
//
// Supporta: numeri, dadi NdM (anche 0dM e d%), modificatori kh kl dh dl k d, ! (esplosione),
// r e ro (ritira, anche r<N ro<N), cs e cf (soglie di critico e fallimento), >N <N (conteggio dei
// successi), gruppi {a, b}kh1, etichette [testo], + - * / %, parentesi (anche vuote, valgono 0 come
// in Roll20), floor ceil round abs.
// Il titolo del risultato riproduce quello di Roll20:
//   Rolling 2d12+(3) = (<span class="basicdiceroll">11</span>+<span class="basicdiceroll">2</span>)+(3)

export class ErroreTiro extends Error {}

const FUNZIONI = { floor: Math.floor, ceil: Math.ceil, round: Math.round, abs: Math.abs };

function confronto(op, soglia) {
  const n = Number(soglia);
  if (op === ">") return (v) => v >= n;
  if (op === "<") return (v) => v <= n;
  return (v) => v === n;
}

function tokenizza(testo) {
  const token = [];
  let i = 0;
  while (i < testo.length) {
    const resto = testo.slice(i);
    let m;
    if ((m = /^\s+/.exec(resto))) {
      token.push({ tipo: "spazio", testo: m[0] });
    } else if ((m = /^\[[^\]]*\]/.exec(resto))) {
      token.push({ tipo: "etichetta", testo: m[0] });
    } else if ((m = /^(\d*)d(\d+|%|F)((?:kh\d*|kl\d*|dh\d*|dl\d*|k\d*|d\d+|!!?|!p|ro?[<>=]?\d+|cs[<>=]?\d+|cf[<>=]?\d+|[<>]=?\d+|s[ad])*)/i.exec(resto))) {
      token.push({ tipo: "dado", testo: m[0], quanti: m[1] === "" ? 1 : Number(m[1]), facce: m[2] === "%" ? 100 : m[2].toUpperCase() === "F" ? "F" : Number(m[2]), modificatori: m[3] });
    } else if ((m = /^\d+(\.\d+)?/.exec(resto))) {
      token.push({ tipo: "numero", testo: m[0], valore: Number(m[0]) });
    } else if ((m = /^(floor|ceil|round|abs)(?=\s*\()/i.exec(resto))) {
      token.push({ tipo: "funzione", testo: m[0], nome: m[0].toLowerCase() });
    } else if ((m = /^\}((?:kh|kl|dh|dl|k|d)\d+|[<>]=?\d+)?/.exec(resto))) {
      token.push({ tipo: "}", testo: m[0], modificatore: m[1] ?? "" });
    } else if ("+-*/%(){,".includes(resto[0])) {
      token.push({ tipo: resto[0], testo: resto[0] });
    } else {
      throw new ErroreTiro(`SyntaxError: Expected "(", "[", "{", number or dice but "${resto[0]}" found.`);
    }
    i += m ? m[0].length : 1;
  }
  return token;
}

function analizzaModificatori(testo) {
  const mod = { tieni: null, esplodi: false, ritira: null, ritiraUnaVolta: false, critico: null, fallimento: null, successo: null };
  for (const x of testo.matchAll(/(kh|kl|dh|dl|k|d)(\d*)|(!!|!p|!)|(ro|r)([<>=]?)(\d+)|(cs|cf)([<>=]?)(\d+)|([<>])=?(\d+)|s[ad]/gi)) {
    if (x[1]) mod.tieni = { tipo: x[1].toLowerCase(), n: x[2] === "" ? 1 : Number(x[2]) };
    else if (x[3]) mod.esplodi = true;
    else if (x[4]) {
      mod.ritira = confronto(x[5] || "=", x[6]);
      mod.ritiraUnaVolta = x[4].toLowerCase() === "ro";
    } else if (x[7]) mod[x[7].toLowerCase() === "cs" ? "critico" : "fallimento"] = confronto(x[8] || "=", x[9]);
    else if (x[10]) mod.successo = confronto(x[10], x[11]);
  }
  return mod;
}

function scarta(valori, tieni) {
  if (!tieni) return;
  const tenuti = valori.filter((x) => !x.scartato).sort((a, b) => a.v - b.v);
  const n = Math.min(tieni.n, tenuti.length);
  const daScartare = { kh: tenuti.slice(0, tenuti.length - n), k: tenuti.slice(0, tenuti.length - n), kl: tenuti.slice(n), dh: tenuti.slice(tenuti.length - n), dl: tenuti.slice(0, n), d: tenuti.slice(0, n) }[tieni.tipo];
  for (const x of daScartare) x.scartato = true;
}

function tiraDado(token, casuale) {
  if (token.quanti > 1000) throw new ErroreTiro(`Tiro non valido: ${token.testo}`);
  const fudge = token.facce === "F";
  const facce = fudge ? 3 : token.facce;
  if (facce < 1) throw new ErroreTiro(`Tiro non valido: ${token.testo}`);
  const mod = analizzaModificatori(token.modificatori);
  const lancio = () => 1 + Math.floor(casuale() * facce) - (fudge ? 2 : 0);
  const valori = [];
  for (let k = 0; k < token.quanti; k++) {
    let v = lancio();
    for (let giri = 0; mod.ritira && mod.ritira(v) && giri < (mod.ritiraUnaVolta ? 1 : 100); giri++) v = lancio();
    valori.push({ v });
    for (let giri = 0; mod.esplodi && v === facce && facce > 1 && giri < 100; giri++) {
      v = lancio();
      valori.push({ v });
    }
  }
  scarta(valori, mod.tieni);
  const critico = mod.critico ?? ((v) => v === facce);
  const fallimento = mod.fallimento ?? ((v) => v === (fudge ? -1 : 1));
  const tenuti = valori.filter((x) => !x.scartato);
  const totale = mod.successo ? tenuti.filter((x) => mod.successo(x.v)).length : tenuti.reduce((s, x) => s + x.v, 0);
  for (const x of valori) {
    x.critico = critico(x.v);
    x.fallimento = fallimento(x.v);
  }
  const classi = (x) => ["basicdiceroll", x.critico ? "critsuccess " : "", x.fallimento ? "critfail " : "", x.scartato ? "dropped " : ""].join(" ").replace(/\s+/g, " ").trim();
  const espanso = "(" + valori.map((x) => `<span class="${classi(x)}">${x.v}</span>`).join("+") + ")";
  return { totale, espanso, valori, facce: token.facce };
}

export function tiraEspressione(testo, casuale = Math.random) {
  const token = tokenizza(testo);
  const significativi = token.filter((t) => t.tipo !== "spazio" && t.tipo !== "etichetta");
  let pos = 0;
  const dadi = [];
  const espansi = new Map(); // token dado -> html

  const guarda = () => significativi[pos];
  const prendi = (tipo) => {
    const t = significativi[pos];
    if (!t || (tipo && t.tipo !== tipo)) throw new ErroreTiro(`SyntaxError: Expected "${tipo}" but ${t ? `"${t.testo}"` : "end of input"} found.`);
    pos++;
    return t;
  };

  function espressione() {
    let valore = termine();
    while (guarda() && (guarda().tipo === "+" || guarda().tipo === "-")) {
      const op = prendi().tipo;
      const destra = termine();
      valore = op === "+" ? valore + destra : valore - destra;
    }
    return valore;
  }
  function termine() {
    let valore = fattore();
    while (guarda() && "*/%".includes(guarda().tipo)) {
      const op = prendi().tipo;
      const destra = fattore();
      valore = op === "*" ? valore * destra : op === "/" ? valore / destra : valore % destra;
    }
    return valore;
  }
  function fattore() {
    if (guarda() && (guarda().tipo === "-" || guarda().tipo === "+")) {
      const op = prendi().tipo;
      const v = fattore();
      return op === "-" ? -v : v;
    }
    return primario();
  }
  function primario() {
    const t = guarda();
    if (!t) throw new ErroreTiro("SyntaxError: Expected number or dice but end of input found.");
    if (t.tipo === "numero") return prendi().valore;
    if (t.tipo === "dado") {
      prendi();
      const esito = tiraDado(t, casuale);
      dadi.push(esito);
      espansi.set(t, esito.espanso);
      return esito.totale;
    }
    if (t.tipo === "funzione") {
      prendi();
      prendi("(");
      const v = espressione();
      prendi(")");
      return FUNZIONI[t.nome](v);
    }
    if (t.tipo === "(") {
      prendi();
      if (guarda()?.tipo === ")") {
        prendi();
        return 0;
      }
      const v = espressione();
      prendi(")");
      return v;
    }
    if (t.tipo === "{") {
      // gruppo {a, b, ...} con kh/kl/dh/dl o conteggio >N sui totali delle parti
      prendi();
      const parti = [{ v: espressione() }];
      while (guarda()?.tipo === ",") {
        prendi();
        parti.push({ v: espressione() });
      }
      const chiusura = prendi("}");
      if (/^[<>]/.test(chiusura.modificatore)) {
        const [, op, n] = /^([<>])=?(\d+)/.exec(chiusura.modificatore);
        return parti.filter((p) => confronto(op, n)(p.v)).length;
      }
      scarta(parti, chiusura.modificatore ? analizzaModificatori(chiusura.modificatore).tieni : null);
      return parti.filter((p) => !p.scartato).reduce((s, p) => s + p.v, 0);
    }
    throw new ErroreTiro(`SyntaxError: Expected number or dice but "${t.testo}" found.`);
  }

  const totale = significativi.length ? espressione() : 0;
  if (pos < significativi.length) throw new ErroreTiro(`SyntaxError: Expected end of input but "${significativi[pos].testo}" found.`);

  const tuttiIDadi = dadi.flatMap((d) => d.valori.filter((x) => !x.scartato));
  const critico = tuttiIDadi.some((x) => x.critico);
  const fallito = tuttiIDadi.some((x) => x.fallimento);
  const classe = critico && fallito ? "importantroll" : critico ? "fullcrit" : fallito ? "fullfail" : "";
  const espanso = token.map((t) => espansi.get(t) ?? t.testo).join("");
  return {
    totale: Math.round(totale * 1e6) / 1e6,
    espressione: testo,
    titolo: `Rolling ${testo} = ${espanso}`,
    classe,
    critico,
    fallito,
    dadi: dadi.map((d) => ({ facce: d.facce, risultati: d.valori.map((x) => x.v), tenuti: d.valori.filter((x) => !x.scartato).map((x) => x.v) })),
  };
}
