// Calcoli del personaggio. Puri: non chiamano Roll20.
//
// Manuale 1.6:
// - le caratteristiche partono da ●● (cap. 9) e l'incremento dell'archetipo si somma (cap. 7);
// - punti ferita: 2 + Possanza (cap. 2); mana: il doppio della Potenza (cap. 2). Gli incrementi contano anche qui
//   (risposta del master del 23/10/2026);
// - in forma mortale l'immortale «perde due ● a tutte le caratteristiche» (cap. 5). Il totale mostrato e i tiri
//   lo tengono; punti ferita e mana massimi no: il manuale non lo dice (domanda per il master).

/** Il totale di una caratteristica: ● + Inc, meno 2 in forma mortale, mai sotto zero. */
export const totaleCaratteristica = (base: number, inc: number, mortale: boolean): number => Math.max(0, base + inc - (mortale ? 2 : 0));

/** Punti ferita massimi: 2 + Possanza (con l'incremento). */
export const pfMassimi = (possanza: number): number => 2 + Math.max(0, possanza);

/** Mana massimo: il doppio della Potenza (con l'incremento). */
export const manaMassimo = (potenza: number): number => 2 * Math.max(0, potenza);

/** Quanto resta dopo che il massimo è cambiato: i danni (o il mana usato) restano gli stessi. La prima volta
 *  (massimo di prima 0) la risorsa parte piena. Mai sotto zero né sopra il massimo nuovo. */
export const restaDopoIlMassimo = (rimasto: number, massimoPrima: number, massimoNuovo: number): number =>
  Math.min(massimoNuovo, Math.max(0, massimoPrima > 0 ? rimasto + (massimoNuovo - massimoPrima) : massimoNuovo));

/** Il valore dopo il clic sul pallino (o sulla casella) n: diventa n, oppure n - 1 se n era già l'ultimo pieno. */
export const dopoIlClic = (n: number, attuale: number): number => (n === attuale ? n - 1 : n);
