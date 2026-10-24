# Attributi della scheda

Nomi degli attributi di Roll20 (`attr_…`), decisi con l'utente il 23/10/2026 per la versione 0.0.1 e il 24/10/2026 per la 0.0.2 (equipaggiamento) e la 0.0.3 (archetipo e carriera) e la 0.0.4 (poteri). **Non si rinominano più**: in una partita in corso un attributo rinominato fa perdere i dati. Se proprio serve, si aggiunge il nuovo e lo script converte il vecchio all'apertura. Sono gli stessi nomi dei campi della scheda PDF (`docs/stampa/`), dove esistono.

| Cosa | Attributi | Valori |
|---|---|---|
| Intestazione | `giocatore`, `archetipo`, `carriera`, `colore`, `forma`, `px_posseduti`, `px_usati` | `archetipo` e `carriera`: id di `dati/`; `colore`: `bianco`, `nero`, `grigio`; `forma`: `immortale`, `mortale` |
| Caratteristiche | `possanza`, `agilita`, `astuzia`, `potenza` e `<caratteristica>_inc` | i ● (partono da 2) e l'incremento dell'archetipo |
| Abilità | gli id di `dati/elenchi/abilita.json`: `atletica` … `sopravvivenza`, `mischia`, `mira`, `demoralizzare`, `difesa` | da 0 a 5 |
| Punti ferita | `pf` (rimasti, con il massimo in `pf_max`), `pf_non_letali`, `pf_temporanei` | `pf` e `pf_max` vanno sulla barra del token |
| Altre risorse | `mana` (con `mana_max`), `anime`, `ispirazione` | |
| Armi (`repeating_armi`) | `nome`, `tipo`, `abilita`, `danno`, `distanza`, `distruttivita`, `munizioni`, `note` | `tipo`: id di `dati/equipaggiamento/armi.json` o vuoto (Altro); `abilita`: `mischia` o `mira`; `munizioni`: ● consumati da una ricarica |
| Oggetti (`repeating_oggetti`) | `nome`, `dove`, `note` | `dove`: `I`, `A`, `B`, `C`, `N` |
| Seguaci (`repeating_seguaci`) | `nome`, `tipo`, `velocita`, `note` | `tipo`: id di `dati/equipaggiamento/seguaci.json` o vuoto |
| Cartucciera e ricchezza | `cartucciera` (con il massimo in `cartucciera_max`), `ricchezza`, `anime_depositate`, `anime_depositate_dove`, `ricchezza_depositata`, `ricchezza_depositata_dove` | `cartucciera_max` 30, 40 con Armaiolo; ricchezza da 0 a 6 |
| Poteri (`repeating_poteri`) | `potere`, `nome`, `livello`, `aperto`, `note` | `potere`: id di `dati/poteri.json`, `<carriera>/<id>` per un potere di carriera (`soldato/abile_nelle_armi`), vuoto per un potere scritto a mano (Altro), che usa `nome`; `livello`: ● posseduti, da 0 a 5; `aperto`: `1` se la card mostra i testi del manuale |
| Archetipo e carriera | `natura1_uso`, `natura2_uso`, `flashback_uso`, `patto`, `punti_fissi`, `storia`, `note` | `natura1_uso`, `natura2_uso`: `1` se la prima o la seconda natura dell'archetipo è già usata in questa sessione; `flashback_uso`: `1` se il flashback è usato in questo arco narrativo; gli altri sono testo libero |
| Barra dei tiri | `tiro_gm`, `tiro_soglia`, `tiro_difficolta`, `tiro_dadi`, `mod_stordito`, `mod_scosso` | `tiro_gm`: `0` pubblico, `1` solo GM; `tiro_soglia` da 2 a 6 |

Calcolati dallo script (si possono cambiare senza perdere dati, perché si ricalcolano):

| Attributo | Cosa |
|---|---|
| `<caratteristica>_totale` | ● + Inc, −2 in forma mortale |
| `pf_max`, `mana_max` | 2 + Possanza, 2 × Potenza (con l'incremento) |
| `pf_danni`, `mana_usato` | caselle piene dei tracciati |
| `pagina` | linguetta aperta |
| `tiro_attivo` | 1 se la barra dei tiri non è normale (barra colorata) |
| `repeating_poteri_…_tipo` | `innato` o `affine` se il potere lo è per l'archetipo scelto, altrimenti vuoto |
| `repeating_armi_…_inceppa` | quanti 1 scaricano l'arma da fuoco (2, 3 la pistola, 0 se non è da fuoco); lo scrive la scelta del tipo |
