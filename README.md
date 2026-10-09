# Scheda di Paradise, Hell and Guns per Roll20

Scheda custom per Roll20 del gioco di ruolo **Paradise, Hell and Guns** (weird west con angeli e demoni), in sviluppo.

**Stato:** c'è lo scheletro (build, emulatore, test) e la base dati estratta dal manuale. La scheda vera e propria aspetta il disegno: per ora la build produce una pagina provvisoria che mostra archetipi e carriere letti da `dati/`.

## Struttura

```text
manuali/               i docx del manuale e della scheda cartacea (fuori da git: il manuale non è pubblicato)
.cache/testo/          il testo dei docx (npm run estrai-testo), base per estrarre e controllare i dati
dati/                  la base dati del manuale in JSON, con gli schemi (dati/README.md)
src/
├── scheda/            l'HTML della scheda: scheda.njk (Nunjucks) e le parti in pagine/
├── scheda.css         indice del CSS, con le parti in stili/
├── stili/
├── traduzioni/it.json i testi della scheda (diventa translation.json)
└── worker/            lo script della scheda in TypeScript (main.ts, roll20.d.ts)
strumenti/
├── build.mjs          da src/ a dist/scheda.html, scheda.css, translation.json, con i controlli dei vincoli di Roll20
├── dati.mjs           legge dati/ per i template
├── estrai_testo.py    dai docx a .cache/testo/
├── estrai_dati.mjs    da .cache/testo/manuale.md ai JSON di dati/
├── controlla.mjs      schemi, riferimenti e testi di dati/ confrontati con il manuale
├── traduzioni.mjs     traduzioni: da it.json a translation.json, testi nell'HTML
├── server.mjs         server locale dell'emulatore (porta 8030)
├── avvia-chrome.ps1   Chrome di debug (porta 9222) per Playwright, per le prove su Roll20
└── emulatore/         emulatore di Roll20 (README.md)
test/                  test (node --test)
docs/
├── domande-per-il-master.md   dubbi sul manuale
└── roll20.md                  cosa sappiamo di Roll20: vincoli, Sandbox, script, pubblicazione
.claude/
├── CLAUDE.md          contesto e regole per Claude (stato del progetto, come lavorare)
└── skills/prova-roll20/       procedura per provare la scheda su Roll20
.mcp.json              server Playwright collegato al Chrome di debug
```

## Comandi

```sh
npm install
npm run estrai-testo   # dai docx di manuali/ a .cache/testo/ (serve Python)
npm run estrai-dati    # rifà i JSON di dati/ dal manuale (dopo una versione nuova del manuale)
npm run controlla      # controlla dati/: errori (escono con codice 1) e avvisi sul manuale
npm run build          # dist/ per Roll20 (script minificato); -- --leggibile per lo script non compresso
npm run dev            # ricompila a ogni modifica e avvia l'emulatore: http://localhost:8030/strumenti/emulatore/sviluppo.html
npm test               # test
npm run tipi           # controllo dei tipi di TypeScript
```

Il server dell'emulatore usa la porta 8030, così può girare insieme a quello della scheda di Farsight (8020).

## Prove su Roll20

Le schede custom richiedono il Pro: le prove si fanno nello Sheet Sandbox dell'utente. Con Claude Code si usa la skill `prova-roll20`. Lo strumento è Playwright (`.mcp.json`), collegato al Chrome di debug lanciato da `strumenti/avvia-chrome.ps1`. La prima volta, Claude Code chiede di abilitare il server `playwright` del progetto. I vincoli di Roll20 che conosciamo sono in [docs/roll20.md](docs/roll20.md).

## Il manuale e la base dati

Il manuale (`manuali/Pad 1.5.docx`) non è nel repository. Per lavorare sui dati va copiato in `manuali/`. Poi si lancia `npm run estrai-testo`.

I dati che vengono dal testo li scrive `npm run estrai-dati`. Nei file si riconoscono da `generato_da`: non vanno modificati a mano. I testi sono copiati parola per parola, e `npm run controlla` verifica che ognuno si trovi nel manuale. Quando arriva una versione nuova del manuale:

1. si mette il docx in `manuali/` e si aggiorna il nome in `strumenti/estrai_testo.py` e `FONTE` in `strumenti/estrai_dati.mjs`;
2. `npm run estrai-testo && npm run estrai-dati && npm run controlla`;
3. si guarda il diff di git di `dati/`.

Una voce nuova del manuale (un potere, un'arma) va aggiunta agli elenchi `NOMI` di `estrai_dati.mjs`.

`dati/regole/base.json` (i numeri delle regole: PF, mana, soglie dei dadi…) è scritto a mano, con le frasi del manuale da cui viene ogni valore: anche quelle le controlla `npm run controlla`.

Gli avvisi di `npm run controlla` sono dubbi sul manuale: poteri citati ma non descritti, costi strani, caratteristiche mancanti. Sono raccolti, con gli altri dubbi trovati leggendo, in [docs/domande-per-il-master.md](docs/domande-per-il-master.md).

## Vincoli di Roll20 controllati dalla build

- **CSS:** il filtro di sicurezza di Roll20 scarta tutto il foglio se trova lettere accentate, `·`, `data:` e altro. «●» invece passa. La build si ferma prima.
- **`@import` nei commenti del CSS:** l'emulatore, che imita Roll20 portando gli import in cima al foglio, prende ogni `@import` fino al primo punto e virgola, anche dentro un commento, e il foglio si rompe. Su Roll20 non è provato: la build si ferma comunque.
- **`<optgroup>`:** Roll20 lo toglie dall'HTML.
- **Roll template:** `{{#^prop}}` su una proprietà non si vede mai; si scrive `{{^prop}}…{{/prop}}`.
- **Pulsanti di tiro:** un `@{campo}` senza un input con un valore iniziale manda errori in chat.
- **Traduzioni:** una chiave che manca si vedrebbe come `[chiave]`.

La build, l'emulatore e i controlli vengono dalla scheda di Farsight (repo `Farsight custom sheet`), dove sono stati provati su Roll20.
