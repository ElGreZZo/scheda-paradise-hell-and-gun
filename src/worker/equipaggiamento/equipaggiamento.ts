// Pagina Equipaggiamento: armi, seguaci, cartucciera.
// - Armi (repeating_armi): scegliendo il tipo dal manuale (cap. 11) lo script scrive abilità, danno, distanza,
//   distruttività, munizioni e note dell'arma; il nome solo se è vuoto. Tutto resta modificabile. «Attacca» tira
//   caratteristica + Mischia o Mira con la barra dei tiri; in chat le opportunità dell'abilità e quelle dell'arma, e
//   per le armi da fuoco se si è scaricata o inceppata (cap. 11, Munizioni). «Ricarica» toglie dalla cartucciera i ●
//   che l'arma consuma.
// - Seguaci (repeating_seguaci): scegliendo il tipo dal manuale lo script scrive velocità e note.
// I pulsanti delle righe: act_attacco e act_ricarica (clicked:repeating_armi:attacco). Niente underscore.
import { ABILITA, ARMI, SEGUACI, campiCaratteristica, nomeCaratteristica } from "../base/modello";
import { fra, intero } from "../base/numeri";
import { traduci } from "../base/testi";
import { BARRA, tira, totale, vociBarra } from "../tiri/prove";

/** Riga di una sezione ripetibile dall'attributo dell'evento: repeating_armi_<id>_tipo → repeating_armi_<id>_. */
export const prefissoRiga = (attributo: string | undefined, sezione: string): string => {
  const m = new RegExp(`^(repeating_${sezione}_[^_]+_)`).exec(attributo ?? "");
  return m ? m[1] : "";
};

/** I valori di una riga d'arma per il tipo scelto; vuoto se il tipo non è del manuale. Puro. */
export const valoriArma = (tipo: string, nomeAttuale: string): Record<string, string> => {
  const arma = ARMI.find((a) => a.id === tipo);
  if (!arma) return {};
  return {
    ...(nomeAttuale.trim() ? {} : { nome: arma.nome }),
    abilita: arma.abilita, danno: String(arma.danno), distanza: String(arma.distanza),
    distruttivita: String(arma.distruttivita), munizioni: String(arma.munizioni), note: arma.note, inceppa: String(arma.inceppa),
  };
};

/** «danno 3 · distanza 1 · distruttività ●●» per la card dell'attacco. Puro. */
export const dettaglioArma = (danno: number, distanza: number, distruttivita: number): string =>
  [`${traduci("equipment.weapon.damage")} ${danno}`, `${traduci("equipment.weapon.range")} ${distanza}`,
    `${traduci("equipment.weapon.destructiveness")} ${distruttivita > 0 ? "●".repeat(distruttivita) : "○"}`].join(" · ");

const CAMPI_ARMA = ["nome", "tipo", "abilita", "danno", "distanza", "distruttivita", "munizioni", "note", "inceppa"];

export const registraEquipaggiamento = (): void => {
  on("change:repeating_armi:tipo", (evento) => {
    if (evento.sourceType !== "player") return;
    const riga = prefissoRiga(evento.sourceAttribute, "armi");
    getAttrs([`${riga}nome`], (valori) => {
      const nuovi = valoriArma(evento.newValue ?? "", valori[`${riga}nome`] ?? "");
      setAttrs(Object.fromEntries(Object.entries(nuovi).map(([k, v]) => [`${riga}${k}`, v])));
    });
  });

  on("change:repeating_seguaci:tipo", (evento) => {
    if (evento.sourceType !== "player") return;
    const riga = prefissoRiga(evento.sourceAttribute, "seguaci");
    const seguace = SEGUACI.find((s) => s.id === evento.newValue);
    if (!seguace) return;
    getAttrs([`${riga}nome`], (valori) => setAttrs({
      ...((valori[`${riga}nome`] ?? "").trim() ? {} : { [`${riga}nome`]: seguace.nome }),
      [`${riga}velocita`]: String(seguace.velocita), [`${riga}note`]: seguace.note,
    }));
  });

  on("clicked:repeating_armi:attacco", (evento) => {
    const riga = prefissoRiga(evento.sourceAttribute, "armi");
    const abilitaPossibili = ["mischia", "mira"];
    const campiCar = ABILITA.filter((a) => abilitaPossibili.includes(a.id)).flatMap((a) => Object.values(campiCaratteristica(a.caratteristiche[0])));
    getAttrs([...CAMPI_ARMA.map((c) => `${riga}${c}`), ...abilitaPossibili, ...campiCar, ...BARRA], (valori) => {
      const v = (c: string) => valori[`${riga}${c}`] ?? "";
      const abilita = ABILITA.find((a) => a.id === (v("abilita") || "mischia")) ?? ABILITA.find((a) => a.id === "mischia")!;
      const car = abilita.caratteristiche[0];
      const arma = ARMI.find((a) => a.id === v("tipo"));
      const voci = [{ nome: nomeCaratteristica(car), valore: totale(valori, car) }, { nome: abilita.nome, valore: intero(valori[abilita.id]) }, ...vociBarra(valori)];
      tira(v("nome") || abilita.nome, voci, valori, [...abilita.opportunita, ...(arma?.opportunita ?? [])], {
        dettaglio: dettaglioArma(intero(v("danno")), intero(v("distanza")), intero(v("distruttivita"))),
        nota: v("note").trim() || undefined,
        inceppa: intero(v("inceppa")),
      });
    });
  });

  on("clicked:repeating_armi:ricarica", (evento) => {
    const riga = prefissoRiga(evento.sourceAttribute, "armi");
    getAttrs([`${riga}munizioni`, "cartucciera", "cartucciera_max"], (valori) => {
      const restano = intero(valori.cartucciera, intero(valori.cartucciera_max, 30)) - intero(valori[`${riga}munizioni`]);
      setAttrs({ cartucciera: String(fra(restano, 0, intero(valori.cartucciera_max, 30))) });
    });
  });
};
