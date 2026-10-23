// Interfaccia: linguette delle pagine e barra dei tiri colorata quando non è normale.
import { intero } from "../base/numeri";

const PAGINE = ["personaggio", "poteri", "equipaggiamento", "origini"];

/** 1 se la barra dei tiri cambia qualcosa (soglia diversa da 4+, dadi in più o in meno, un modificatore). Puro. */
export const barraAttiva = (valori: Valori): string =>
  intero(valori.tiro_soglia, 4) !== 4 || intero(valori.tiro_dadi) !== 0 || valori.mod_stordito === "1" || valori.mod_scosso === "1" ? "1" : "0";

export const registraInterfaccia = (): void => {
  PAGINE.forEach((pagina) => on(`clicked:pagina${pagina}`, () => setAttrs({ pagina })));
  on("sheet:opened change:tiro_soglia change:tiro_dadi change:mod_stordito change:mod_scosso", () => {
    getAttrs(["tiro_soglia", "tiro_dadi", "mod_stordito", "mod_scosso"], (valori) => setAttrs({ tiro_attivo: barraAttiva(valori) }, { silent: true }));
  });
};
