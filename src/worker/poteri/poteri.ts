// Pagina Poteri (repeating_poteri): una card per potere.
// - I pallini della card (act_livello1…5) portano attr_livello a n, o a n - 1 se n era già l'ultimo pieno.
// - «Testo» (act_apri) apre e chiude i testi del manuale (attr_aperto).
// - attr_tipo dice se il potere scelto è innato o affine per l'archetipo (cap. 7: costano la metà dei punti
//   esperienza). Si ricalcola quando cambia il potere, quando cambia l'archetipo e all'apertura della scheda.
// I testi del manuale li mostra il CSS (stili/poteri.css.njk): lo script non li conosce.
import { ARCHETIPI } from "../base/modello";
import { intero } from "../base/numeri";
import { prefissoRiga } from "../equipaggiamento/equipaggiamento";
import { dopoIlClic } from "../personaggio/calcoli";

/** «innato», «affine» o vuoto: il potere scelto (id del cap. 10; i poteri di carriera, "<carriera>/<id>", mai)
 *  rispetto all'archetipo. Innato vince su affine (il Serafino ha Ali fra gli innati e fra gli affini). Puro. */
export const tipoPotere = (potere: string, archetipo: string): string => {
  const a = ARCHETIPI.find((x) => x.id === archetipo);
  if (!a || !potere) return "";
  if (a.innati.includes(potere)) return "innato";
  return a.affini.includes(potere) ? "affine" : "";
};

/** Riscrive attr_tipo di tutte le card, solo dove cambia. */
const aggiornaTipi = (): void => {
  getSectionIDs("poteri", (ids) => {
    const campi = ids.flatMap((id) => [`repeating_poteri_${id}_potere`, `repeating_poteri_${id}_tipo`]);
    getAttrs(["archetipo", ...campi], (valori) => {
      const nuovi: Record<string, string> = {};
      for (const id of ids) {
        const tipo = tipoPotere(valori[`repeating_poteri_${id}_potere`] ?? "", valori.archetipo ?? "");
        if ((valori[`repeating_poteri_${id}_tipo`] ?? "") !== tipo) nuovi[`repeating_poteri_${id}_tipo`] = tipo;
      }
      if (Object.keys(nuovi).length) setAttrs(nuovi, { silent: true });
    });
  });
};

export const registraPoteri = (): void => {
  for (let n = 1; n <= 5; n++) {
    on(`clicked:repeating_poteri:livello${n}`, (evento) => {
      const campo = `${prefissoRiga(evento.sourceAttribute, "poteri")}livello`;
      getAttrs([campo], (valori) => setAttrs({ [campo]: String(dopoIlClic(n, intero(valori[campo]))) }));
    });
  }

  on("clicked:repeating_poteri:apri", (evento) => {
    const campo = `${prefissoRiga(evento.sourceAttribute, "poteri")}aperto`;
    getAttrs([campo], (valori) => setAttrs({ [campo]: valori[campo] === "1" ? "0" : "1" }));
  });

  on("change:repeating_poteri:potere", (evento) => {
    const riga = prefissoRiga(evento.sourceAttribute, "poteri");
    getAttrs(["archetipo"], (valori) => setAttrs({ [`${riga}tipo`]: tipoPotere(evento.newValue ?? "", valori.archetipo ?? "") }, { silent: true }));
  });

  on("sheet:opened change:archetipo", aggiornaTipi);
};
