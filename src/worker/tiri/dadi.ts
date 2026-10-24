// Prove: riserva di d6, successi, esuberi, opportunità che si possono pagare. Puro: non chiama Roll20.
//
// Manuale 1.6, cap. 2: la riserva è «la somma dei ● presenti nella caratteristica interessata più ● dell’abilità»;
// «Per ogni dado che ottiene 4+ il personaggio ha ottenuto un successo»; vantaggio 3+, svantaggio 5+, si sommano fino
// a 2+ e 6+ (la soglia della barra); i successi oltre la difficoltà diventano esuberi, da spendere nelle opportunità.
// «Una comoda alternativa ai vantaggi e svantaggi è aggiungere o sottrarre dadi alla pool di dadi» (i dadi ± della
// barra). Stordire: «un dado in meno a tutte le pool di dadi».
import type { Opportunita } from "../base/modello";

/** Dadi mostrati nella card in chat (d1..d20 nel roll template prova). */
export const DADI_IN_CHAT = 20;
/** Opportunità mostrate nella card (o1..o16): Mira ne ha 11, il lazzo ne aggiunge 3. */
export const OPPORTUNITA_IN_CHAT = 16;

export interface Voce {
  nome: string;
  valore: number;
}

/** La riserva: la somma delle voci, mai sotto zero. */
export const riserva = (voci: Voce[]): number => Math.max(0, voci.reduce((somma, v) => somma + v.valore, 0));

/** «Possanza 3 + Mischia 2 − Stordito 1 = 4D6»: le voci a zero si saltano, tranne la prima. */
export const formula = (voci: Voce[]): string => {
  const parti = voci.filter((v, i) => i === 0 || v.valore !== 0)
    .map((v, i) => `${i === 0 ? "" : v.valore < 0 ? " − " : " + "}${v.nome} ${Math.abs(v.valore)}`);
  return `${parti.join("")} = ${riserva(voci)}D6`;
};

/** Come si mostra un dado: 3 un 1 (conta per l'inceppamento delle armi da fuoco), 2 un successo, 1 altrimenti. */
export const stileDado = (dado: number, soglia: number): number => (dado === 1 ? 3 : dado >= soglia ? 2 : 1);

export interface Esito {
  successi: number;
  /** 1 riuscito, 2 fallito. */
  esito: number;
  esuberi: number;
}

/** Successi, esito ed esuberi dei dadi. */
export const esitoProva = (dadi: number[], soglia: number, difficolta: number): Esito => {
  const successi = dadi.filter((d) => d >= soglia).length;
  const riuscito = successi >= difficolta;
  return { successi, esito: riuscito ? 1 : 2, esuberi: riuscito ? successi - difficolta : 0 };
};

/** Per ogni opportunità, 1 se gli esuberi bastano a pagarla, altrimenti 0 (k1..k16 nel roll template). */
export const opportunitaPagabili = (opportunita: Opportunita[], esito: Esito): number[] =>
  opportunita.slice(0, OPPORTUNITA_IN_CHAT).map((o) => (esito.esito === 1 && o.esuberi <= esito.esuberi ? 1 : 0));

export interface Prova {
  titolo: string;
  voci: Voce[];
  soglia: number;
  difficolta: number;
  gm: boolean;
  opportunita: Opportunita[];
  /** Riga in più sotto la formula (l'arma: danno, distanza, distruttività). */
  dettaglio?: string;
  /** Note in fondo alla card (le note dell'arma). */
  nota?: string;
  /** Quanti 1 inceppano l'arma da fuoco (0 o assente: nessun controllo). */
  inceppa?: number;
}

/** 1 se i dadi hanno almeno «inceppa» 1 (arma da fuoco scarica o inceppata), altrimenti 0. */
export const inceppata = (dadi: number[], inceppa = 0): number => (inceppa > 0 && dadi.filter((d) => d === 1).length >= inceppa ? 1 : 0);

/** Il comando del tiro, con il roll template prova. Le proprietà con [[0]] le riempie finishRoll. */
export const comandoProva = ({ titolo, voci, soglia, difficolta, gm, opportunita, dettaglio, nota, inceppa }: Prova): string => {
  const dadi = riserva(voci);
  const mostrati = Math.min(dadi, DADI_IN_CHAT);
  return [
    gm ? "/w gm " : "",
    "&{template:prova} ",
    `{{titolo=${titolo}}} `,
    "{{personaggio=@{character_name}}} ",
    `{{formula=${formula(voci)}}} `,
    dettaglio ? `{{dettaglio=${dettaglio}}} ` : "",
    nota ? `{{nota=${nota}}} ` : "",
    inceppa ? "{{inceppata=[[0]]}} " : "",
    `{{soglia=${soglia}+}} {{difficolta=${difficolta}}} `,
    dadi > 0 ? `{{tiro=[[${dadi}d6]]}} ` : "{{tiro=[[0]]}} {{nessundado=1}} ",
    "{{successi=[[0]]}} {{esuberi=[[0]]}} {{esito=[[0]]}} ",
    Array.from({ length: mostrati }, (_, i) => `{{d${i + 1}=[[0]]}} {{s${i + 1}=[[0]]}} `).join(""),
    opportunita.slice(0, OPPORTUNITA_IN_CHAT).map((o, i) => `{{o${i + 1}=${o.nome} (${o.esuberi})}} {{k${i + 1}=[[0]]}} `).join(""),
  ].join("").trimEnd();
};

/** I dadi usciti, dai risultati di startRoll. */
export const dadiUsciti = (risultato: RisultatoTiro | undefined): number[] =>
  [...(risultato?.rolls?.[0]?.results ?? risultato?.dice ?? [])].map(Number);

/** I valori calcolati da passare a finishRoll. */
export const calcolatiProva = (dadi: number[], prova: Pick<Prova, "soglia" | "difficolta" | "opportunita" | "inceppa">): Record<string, number> => {
  const esito = esitoProva(dadi, prova.soglia, prova.difficolta);
  const calcolati: Record<string, number> = { ...esito, ...(prova.inceppa ? { inceppata: inceppata(dadi, prova.inceppa) } : {}) };
  dadi.slice(0, DADI_IN_CHAT).forEach((d, i) => {
    calcolati[`d${i + 1}`] = d;
    calcolati[`s${i + 1}`] = stileDado(d, prova.soglia);
  });
  opportunitaPagabili(prova.opportunita, esito).forEach((k, i) => { calcolati[`k${i + 1}`] = k; });
  return calcolati;
};
