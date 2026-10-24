# Istruzioni per gli agenti Claude

## Il progetto

Scheda custom per Roll20 di **Paradise, Hell and Guns** (PHaG, a volte PHeG): gioco di ruolo weird west in cui i personaggi sono angeli e demoni («immortali») nel selvaggio west. Riserva di d6, successi a 4+, esuberi spesi nelle opportunità, caratteristiche e abilità a pallini (●).

- **Il gioco è in sviluppo** ed è del master dell'utente («Jakob S.» su Roll20), che lo scrive. Dopo aver visto la scheda di Farsight dell'utente, gli ha chiesto questa. Il manuale (`manuali/PHaG 1.6.docx`, prima `Pad 1.5.docx`) e la scheda cartacea (`manuali/PHeG scheda 2.docx`) li ha dati lui. **Non sono pubblicati**: restano fuori da git.
- **L'utente** (Carmine, «GreZZo» su Roll20) scrive in italiano e vuole risposte in italiano. Ha il Pro di Roll20; il master no, quindi le prove su Roll20 si fanno nelle partite dell'utente.
- **Progetto gemello**: la scheda di Farsight, in `F:/Lavoro/Test/Farsight custom sheet`. Da lì vengono build, emulatore, controlli e quasi tutto quello che sappiamo di Roll20 ([docs/roll20.md](../docs/roll20.md)). Se serve un esempio di come si è risolto qualcosa (modali, roll template con Custom Roll Parsing, sezioni ripetibili, traduzioni), si guarda lì, ma il codice non si copia senza chiedere.

## Stato (23/10/2026)

- ✅ **Scheletro**: build (`npm run build`, `npm run dev`), emulatore sulla porta 8030, test, `tsc`, traduzioni da `src/traduzioni/it.json`.
- ✅ **Base dati** in `dati/`, estratta dal manuale: caratteristiche, 23 abilità con opportunità, 10 archetipi, 8 carriere, 45 poteri (livelli e costi), 13 armi, elenchi, regole. Vedi [dati/README.md](../dati/README.md).
- ⏳ **Domande per il master** in [docs/domande-per-il-master.md](../docs/domande-per-il-master.md): da girargli. Le risposte possono cambiare dati e regole.
- ⏳ **Disegno della scheda**: quattro mockup in `docs/mockup/` (online su https://elgrezzo.github.io/scheda-paradise-hell-and-gun/mockup/). Il master ha scelto lo **stile «Frontiera»** (mock A, 23/10/2026); la barra dei tiri è decisa (memoria `decisioni-tiri`). Scheda stampabile A4 in `docs/stampa/` (v0.0.3: due proposte per la pagina dei poteri, il master sceglie).
- ✅ **Scheda Roll20 0.0.1** (23/10/2026): pagina Personaggio in stile Frontiera (caratteristiche con Inc, abilità, PF con danni, non letali e temporanei, mana, anime, ispirazione, attacco e difesa), barra dei tiri, tiri con Custom Roll Parsing (successi, esuberi, opportunità) e iniziativa. Nomi degli attributi decisi con l'utente: non si rinominano più. Provata nell'emulatore e nella partita di prova «PHaG - Prova scheda» (22140561).
- ✅ **Scheda Roll20 0.0.2** (24/10/2026): pagina Equipaggiamento (armi dal manuale con attacco, opportunità dell'arma, inceppamento e ricarica; cartucciera; oggetti con il «dove»; ricchezza e depositi; seguaci). Provata nell'emulatore e nella partita di prova.
- ✅ **Scheda Roll20 0.0.3** (24/10/2026): pagina Archetipo e carriera (testi del manuale dell'archetipo e della carriera scelti nell'intestazione, mostrati dal CSS; nature con «usata in questa sessione»; patto, flashback, punti fissi, storia, note). Provata nell'emulatore e nella partita di prova.
- ✅ **Testi dei poteri** livello per livello in `dati/poteri.json` (24/10/2026): testo, livelli con attacco e opportunità, effetti scenografici, reazione, effetto combo.
- ✅ **Scheda Roll20 0.0.4** (24/10/2026): pagina Poteri con una card per potere (`repeating_poteri`): potere dal manuale o di carriera, pallini, etichetta innato/affine dall'archetipo, testi del manuale mostrati dal CSS (`src/stili/poteri.css.njk`, generato dai dati nella build). Le proposte B e C riguardano solo il PDF: su Roll20 la sezione ripetibile cresce da sola (decisione dell'utente). Provata nell'emulatore e nella partita di prova.
- ⬜ Poi: tiri degli attacchi dei poteri, costi in mana e anime, usi limitati e «Nuova sessione», riepilogo dei poteri nella pagina Personaggio, forse una scheda PNG per gli sgherri.
- Scheletro e base dati nel commit `a0dc210` su `main`; poi la skill `prova-roll20`, `docs/roll20.md` e questo file.

## Come lavora l'utente

- **Un passo per volta, piccolo.** L'utente decide i passi. Proponi il passo più piccolo utile, non architetture ampie. A fine passo riporta: cosa è cambiato, file toccati, verifiche fatte (con l'esito vero, anche se negativo), messaggio di commit proposto. Non iniziare il passo dopo senza il suo via.
- **Prima si decide, poi si sviluppa.** Le scelte (disegno, nomi degli attributi, cosa automatizzare) si discutono in chat, con una proposta per ogni domanda.
- **La scheda è di consultazione**: tira i dadi, mostra le regole che servono (opportunità, effetti dei poteri) e tiene il conto di risorse e contatori. Non gioca al posto del tavolo: le meccaniche narrative (patti, flashback, corruzione delle anime) sono testo e promemoria, non motori di regole.
- **Commit e push**: il commit lo fa l'utente, salvo che lo chieda a te. Niente push senza richiesta.

## Commit Semantic Release

Tutti i commit devono rispettare il formato Conventional Commits compatibile con Semantic Release:

```text
<tipo>(<ambito>): <descrizione breve>
```

Usa uno dei tipi seguenti: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `build`, `ci`, `chore`, `perf`, `revert`.

Esempi validi:

- `fix(doc): corregge un riferimento nelle regole`
- `feat(personaggio): aggiunge la scheda del personaggio`
- `chore(campagna): aggiorna i dati della campagna`

Il messaggio deve essere breve, chiaro e all'imperativo, con un ambito coerente con i file modificati. Non usare messaggi generici privi di tipo e ambito.

## Regole

- **Dati solo dal manuale.** Mai inventare valori o testi. Se un dato manca o è incoerente, va in `docs/domande-per-il-master.md` e si chiede all'utente.
- **Risposte del master**: vanno in `docs/domande-per-il-master.md` e nel manuale, con il testo sbagliato barrato e la correzione in corsivo (originale in `manuali/originali/`). `npm run estrai-testo` salta il testo barrato.
- **File generati**: i file di `dati/` con `generato_da` li scrive `npm run estrai-dati` dal testo del manuale (`npm run estrai-testo` lo estrae dai docx). Si corregge l'estrazione (`strumenti/estrai_dati.mjs`), non il JSON. `dati/regole/base.json` è scritto a mano, con le frasi del manuale. Dopo ogni modifica ai dati: `npm run controlla`, poi `npm test`.
- **Nomi degli attributi** (`attr_…`): si decidono con l'utente e poi non si rinominano più. Quando la scheda sarà usata in una partita, un attributo rinominato fa perdere i dati. Se proprio serve, si aggiunge il nuovo e lo script converte il vecchio all'apertura.
- **Testi dentro la scheda**: se un giorno la scheda va pubblicata nel catalogo di Roll20, i testi creativi dentro la scheda devono averli scritti persone (politica di Roll20 sull'IA). I testi del manuale li ha scritti il master; riassunti e descrizioni nuove no, quindi non scriverli tu senza dirlo.
- **Verifiche a ogni passo**: `npm run controlla`, `npm test`, `npm run tipi`, `npm run build`, poi una prova nell'emulatore. Su Roll20 solo quando serve, con la skill `prova-roll20`.

## Emulatore

`npm run dev` ricompila a ogni modifica e serve `http://localhost:8030/strumenti/emulatore/sviluppo.html` (documentazione in `strumenti/emulatore/README.md`). Farsight usa la porta 8020, così i due possono girare insieme.

- **I dati dell'utente nell'emulatore sono suoi.** Il personaggio sta nel `localStorage` del browser, chiave `emulatore-roll20:pheg-sviluppo:<personaggio>`. Prima di scrivere valori di prova copialo su disco (`PUT /api/salvataggi/<nome>` dalla pagina, file in `strumenti/emulatore/salvataggi/`, fuori da git). Alla fine rimettilo (`localStorage.setItem` e ricarica), poi confronta.
- **Più schede dell'emulatore aperte si sovrascrivono a vicenda**: ognuna salva il personaggio intero. Prova in una scheda appena ricaricata e, dopo aver rimesso i dati, ricarica tutte le schede dell'emulatore.
- Se l'utente sta provando in quel momento, non toccare la pagina.

## Strumenti e trappole note

- **Browser**: Playwright si collega al Chrome di debug sulla porta 9222 (`.mcp.json`). Se dà `ECONNREFUSED`, lancia `strumenti/avvia-chrome.ps1` senza chiedere. Le schede del browser che non hai aperto tu non si toccano. File da caricare o screenshot vanno in `.playwright-mcp/` (fuori da git).
- **Script Python con barre rovesciate**: non passarli con un heredoc dal tool Bash. Git Bash dimezza le barre e i file escono rotti. Scrivi lo script in un file dello scratchpad e lancialo, oppure usa il tool Edit. Anche gli heredoc con apostrofi dentro a stringhe tra apici singoli si rompono: per file JSON o JS lunghi usa Write o uno script Node in un file.
- **CSS**: niente lettere accentate né `·` (il filtro di Roll20 scarta tutto il foglio), e niente `@import` scritto nei commenti. La build si ferma in entrambi i casi.
- **docx**: non ci sono pandoc né python-docx. `strumenti/estrai_testo.py` legge i docx come zip + XML.

## Dove trovare cosa

| Cosa | Dove |
|---|---|
| Struttura del repo e comandi | [README.md](../README.md) |
| Base dati, convenzioni, cosa manca | [dati/README.md](../dati/README.md) |
| Dubbi sul manuale per il master | [docs/domande-per-il-master.md](../docs/domande-per-il-master.md) |
| Cosa sappiamo di Roll20 (vincoli, Sandbox, script, pubblicazione) | [docs/roll20.md](../docs/roll20.md) |
| Prove su Roll20 passo per passo | skill `prova-roll20` (`.claude/skills/prova-roll20/SKILL.md`) |
| Emulatore | [strumenti/emulatore/README.md](../strumenti/emulatore/README.md) |
| Testo del manuale (per cercare una regola) | `.cache/testo/manuale.md`, dopo `npm run estrai-testo` |
