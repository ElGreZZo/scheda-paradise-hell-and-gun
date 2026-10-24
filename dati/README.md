# Base dati

I dati del manuale di Paradise, Hell and Guns (`manuali/PHaG 1.6.docx`) che servono alla scheda, in JSON. Ogni file ha `fonte` (versione del manuale e capitoli), le `voci` e lo schema in `schemi/`.

| File | Voci | Da dove |
|---|---|---|
| `elenchi/caratteristiche.json` | 4 caratteristiche, con descrizione ed effetti (pool, punti ferita, difesa, iniziativa, mana) | cap. 2 |
| `elenchi/abilita.json` | 19 abilità comuni e 4 di combattimento (Mischia, Mira, Demoralizzare, Difesa): caratteristica associata, costi in punti esperienza, opportunità | cap. 3 e 4 |
| `elenchi/distanze.json` | distanze da 0 (Ravvicinata) a 7 (Molto molto lontano) | cap. 2 |
| `elenchi/distruttivita.json` | 6 livelli di distruttività | cap. 5 |
| `elenchi/dimensioni.json` | 5 taglie | cap. 5 |
| `elenchi/colori.json` | nero, bianco, grigio | cap. 5 |
| `elenchi/ricchezza.json` | livelli di ricchezza da ○ a ●●●●●●: munizioni ricaricate a settimana, armi, animali | cap. 11 |
| `archetipi.json` | 10 archetipi: colore, incrementi di caratteristica, poteri innati e affini, natura dell'immortale | cap. 7 |
| `carriere.json` | 7 carriere: motto, ferri del mestiere, abilità lavorative, come si guadagna ispirazione, poteri di carriera (testo e livelli con costo) | cap. 8 |
| `poteri.json` | 51 poteri: categoria (comune, passivo, attivo, superiore), colore richiesto, testo, livelli con nome, costo e testo (con statistiche dell'attacco e opportunità a parte), effetti scenografici, reazione, effetto combo, riquadri | cap. 10 |
| `equipaggiamento/armi.json` | 13 armi: danno, distanza, munizioni, distruttività, note, opportunità proprie | cap. 11 |
| `equipaggiamento/seguaci.json` | 4 animali | cap. 11 |
| `regole/base.json` | i numeri delle regole (soglie dei dadi, PF, mana, ispirazione, iniziativa, munizioni, anime, forma mortale, flashback, patto, creazione, punti esperienza), con le frasi del manuale | cap. 2–15 |

## Convenzioni

- **id**: minuscole senza accenti, con `_` (`demone_possessore`, `breccia_dell_aura`). Sono stabili: la scheda li userà come valori salvati.
- **Testi**: copiati parola per parola dal manuale, errori di battitura compresi. `npm run controlla` verifica che ogni testo (`nome`, `testo`, `descrizione`, `citazioni`, `note`…) si trovi nel manuale. Apostrofi tipografici e spazi in più non contano.
- **Valori dedotti**: due campi non stanno scritti nel manuale voce per voce, e lo dice lo schema:
  - `abilita` delle armi (Mischia o Mira, da cap. 4 «Attaccare»);
  - `caratteristiche` delle abilità (dalla frase «Normalmente associata a…»).
- **Riferimenti**: i poteri di archetipi e carriere sono id di `poteri.json`. Quelli che il manuale cita senza descriverli restano come id, e `controlla` li segnala come avviso.
- **Poteri, livello per livello**: il testo di un livello è quello che il manuale scrive dopo «Nome ●● (8):», più le righe che seguono fino al livello o all'etichetta successivi. Le statistiche dell'attacco (`attacco`, dalla riga «Attacco: …» o «Danno: …») e le opportunità («Nome (2): …») stanno in campi propri: una frase scritta dopo le opportunità (il sovraccarico di Attacco elettrico) resta nel testo, prima di loro. Le righe senza livello vanno nel `testo` del potere; le introduzioni delle quattro categorie non sono di nessun potere e restano fuori.
- **Cosa non c'è ancora**: i costi in mana e anime dei poteri come numeri (oggi sono solo nel testo: «Spendendo un punto mana», «Questo potere costa un'anima»), gli oggetti magici e i manufatti, i nemici del cap. 12, le nemesi del cap. 13 e le fazioni del cap. 14. Sono i testi che cambiano di più fra una versione e l'altra del manuale: si aggiungono quando servono alla scheda.

## File generati e file scritti a mano

I file con `generato_da` li scrive `npm run estrai-dati` dal testo del manuale: una modifica a mano si perde alla prossima estrazione. Per cambiarli si corregge l'estrazione (`strumenti/estrai_dati.mjs`), o il manuale. `regole/base.json` è scritto a mano.
