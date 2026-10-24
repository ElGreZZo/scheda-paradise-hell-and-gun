// Il modello della scheda, preso dalla base dati del manuale (dati/, npm run estrai-dati): caratteristiche,
// abilità con la caratteristica abituale e le opportunità, archetipi con colore e incrementi. esbuild mette i JSON
// dentro lo script; qui si tengono solo i campi che servono.
import abilitaJson from "../../../dati/elenchi/abilita.json";
import archetipiJson from "../../../dati/archetipi.json";
import caratteristicheJson from "../../../dati/elenchi/caratteristiche.json";
import armiJson from "../../../dati/equipaggiamento/armi.json";
import seguaciJson from "../../../dati/equipaggiamento/seguaci.json";

export interface Opportunita {
  nome: string;
  esuberi: number;
}
export interface Abilita {
  id: string;
  nome: string;
  tipo: "comune" | "combattimento";
  /** Caratteristiche con cui si tira di solito; la prima è quella che usa la scheda (Gioco: astuzia, o possanza per gli sport). */
  caratteristiche: string[];
  opportunita: Opportunita[];
}
export interface Archetipo {
  id: string;
  colore: string;
  incrementi: Record<string, number>;
  /** Id dei poteri innati e affini (cap. 7): costano la metà dei punti esperienza. */
  innati: string[];
  affini: string[];
}

export const CARATTERISTICHE: { id: string; nome: string }[] = caratteristicheJson.voci.map(({ id, nome }) => ({ id, nome }));
export const ABILITA: Abilita[] = abilitaJson.voci.map(({ id, nome, tipo, caratteristiche, opportunita }) => ({
  id, nome, tipo: tipo as Abilita["tipo"], caratteristiche, opportunita: opportunita.map(({ nome, esuberi }) => ({ nome, esuberi })),
}));
export const ARCHETIPI: Archetipo[] = archetipiJson.voci.map(({ id, colore, incrementi, poteri_innati, poteri_affini }) => ({
  id, colore, incrementi: incrementi as Record<string, number>, innati: poteri_innati.map((p) => p.potere), affini: poteri_affini,
}));

export interface Arma {
  id: string;
  nome: string;
  abilita: string;
  danno: number;
  distanza: number;
  /** ● di munizioni che consuma una ricarica (0 se non ne usa). */
  munizioni: number;
  distruttivita: number;
  /** Le note del manuale, senza le righe che introducono le opportunità («…nel seguente modo:»). */
  note: string;
  opportunita: Opportunita[];
  /** Quanti 1 di dado la scaricano o la inceppano (cap. 11, Munizioni): 2 per le armi da fuoco, 3 per la pistola
   *  («Per scaricare la pistola sono necessari tre 1»), 0 per le armi che non sono da fuoco. */
  inceppa: number;
}
export interface Seguace {
  id: string;
  nome: string;
  velocita: number;
  note: string;
}

const ARMI_DA_FUOCO: Record<string, number> = { pistola: 3, coppia_di_pistole: 2, carabina: 2, fucile_a_pallettoni: 2 };
export const ARMI: Arma[] = armiJson.voci.map((a) => ({
  id: a.id, nome: a.nome, abilita: a.abilita, danno: a.danno, distanza: a.distanza,
  munizioni: (a as { munizioni?: number }).munizioni ?? 0, distruttivita: a.distruttivita,
  note: a.note.filter((n) => !/:\s*$/.test(n)).join(" "),
  opportunita: ((a as { opportunita?: Opportunita[] }).opportunita ?? []).map(({ nome, esuberi }) => ({ nome, esuberi })),
  inceppa: ARMI_DA_FUOCO[a.id] ?? 0,
}));
/** Seguaci del manuale: la velocità dalla riga «Velocità N», le note dalle righe di regola (dopo la descrizione). */
export const SEGUACI: Seguace[] = seguaciJson.voci.map((s) => {
  const riga = s.testo.find((t) => /^Velocità \d/.test(t)) ?? "";
  return { id: s.id, nome: s.nome, velocita: Number(/\d+/.exec(riga)?.[0] ?? 1), note: s.testo.slice(1).filter((t) => t !== riga).join(" ") };
});

export const nomeCaratteristica =(id: string): string => CARATTERISTICHE.find((c) => c.id === id)?.nome ?? id;

/** Gli attributi di una caratteristica: il valore (●), l'incremento dell'archetipo (Inc) e il totale calcolato. */
export const campiCaratteristica = (id: string) => ({ base: id, inc: `${id}_inc`, totale: `${id}_totale` });
