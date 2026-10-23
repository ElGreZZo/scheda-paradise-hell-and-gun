# Attributi della scheda

Nomi degli attributi di Roll20 (`attr_…`), decisi con l'utente il 23/10/2026 per la versione 0.0.1. **Non si rinominano più**: in una partita in corso un attributo rinominato fa perdere i dati. Se proprio serve, si aggiunge il nuovo e lo script converte il vecchio all'apertura. Sono gli stessi nomi dei campi della scheda PDF (`docs/stampa/`), dove esistono.

| Cosa | Attributi | Valori |
|---|---|---|
| Intestazione | `giocatore`, `archetipo`, `carriera`, `colore`, `forma`, `px_posseduti`, `px_usati` | `archetipo` e `carriera`: id di `dati/`; `colore`: `bianco`, `nero`, `grigio`; `forma`: `immortale`, `mortale` |
| Caratteristiche | `possanza`, `agilita`, `astuzia`, `potenza` e `<caratteristica>_inc` | i ● (partono da 2) e l'incremento dell'archetipo |
| Abilità | gli id di `dati/elenchi/abilita.json`: `atletica` … `sopravvivenza`, `mischia`, `mira`, `demoralizzare`, `difesa` | da 0 a 5 |
| Punti ferita | `pf` (rimasti, con il massimo in `pf_max`), `pf_non_letali`, `pf_temporanei` | `pf` e `pf_max` vanno sulla barra del token |
| Altre risorse | `mana` (con `mana_max`), `anime`, `ispirazione` | |
| Barra dei tiri | `tiro_gm`, `tiro_soglia`, `tiro_difficolta`, `tiro_dadi`, `mod_stordito`, `mod_scosso` | `tiro_gm`: `0` pubblico, `1` solo GM; `tiro_soglia` da 2 a 6 |

Calcolati dallo script (si possono cambiare senza perdere dati, perché si ricalcolano):

| Attributo | Cosa |
|---|---|
| `<caratteristica>_totale` | ● + Inc, −2 in forma mortale |
| `pf_max`, `mana_max` | 2 + Possanza, 2 × Potenza (con l'incremento) |
| `pf_danni`, `mana_usato` | caselle piene dei tracciati |
| `pagina` | linguetta aperta |
| `tiro_attivo` | 1 se la barra dei tiri non è normale (barra colorata) |
