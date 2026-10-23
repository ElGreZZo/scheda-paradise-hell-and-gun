// Il modello della scheda, preso dalla base dati del manuale (dati/, npm run estrai-dati): caratteristiche,
// abilità con la caratteristica abituale e le opportunità, archetipi con colore e incrementi. esbuild mette i JSON
// dentro lo script; qui si tengono solo i campi che servono.
import abilitaJson from "../../../dati/elenchi/abilita.json";
import archetipiJson from "../../../dati/archetipi.json";
import caratteristicheJson from "../../../dati/elenchi/caratteristiche.json";

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
}

export const CARATTERISTICHE: { id: string; nome: string }[] = caratteristicheJson.voci.map(({ id, nome }) => ({ id, nome }));
export const ABILITA: Abilita[] = abilitaJson.voci.map(({ id, nome, tipo, caratteristiche, opportunita }) => ({
  id, nome, tipo: tipo as Abilita["tipo"], caratteristiche, opportunita: opportunita.map(({ nome, esuberi }) => ({ nome, esuberi })),
}));
export const ARCHETIPI: Archetipo[] = archetipiJson.voci.map(({ id, colore, incrementi }) => ({ id, colore, incrementi: incrementi as Record<string, number> }));

export const nomeCaratteristica = (id: string): string => CARATTERISTICHE.find((c) => c.id === id)?.nome ?? id;

/** Gli attributi di una caratteristica: il valore (●), l'incremento dell'archetipo (Inc) e il totale calcolato. */
export const campiCaratteristica = (id: string) => ({ base: id, inc: `${id}_inc`, totale: `${id}_totale` });
