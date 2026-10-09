# Emulatore Roll20

Ambiente Roll20 emulato per provare una scheda in locale, senza account Pro. Non è Roll20: la prova finale va fatta in una partita vera (vedi [Differenze note](#differenze-note)).

```text
strumenti/
├── server.mjs          server statico senza dipendenze, radice = cartella del repository
└── emulatore/
    ├── emulatore.js    pagina, scheda nell'iframe, attributi, sezioni ripetibili, eventi, pannelli
    ├── worker-shim.js  on, getAttrs, setAttrs, getSectionIDs, $20... dentro un Web Worker
    ├── tiri.js         tiri dei pulsanti, roll template, Custom Roll Parsing
    ├── dadi.js         tiri in linea [[...]]
    ├── charmancer.js   Charactermancer (non usato da questa scheda)
    ├── compendio.js    compendio locale (non usato da questa scheda)
    ├── roll20-base.css regole di base di Roll20, ricostruite a mano
    ├── emulatore.css   stile della pagina dell'emulatore
    ├── sviluppo.html   emulatore puntato sulla scheda generata in dist/
    └── prova/          scheda di prova: switch di pagina, campo mostrato o nascosto, tiro
```

## Avvio

```sh
npm run dev
```

`npm run dev` ricompila la scheda in `dist/` a ogni modifica di `src/` e avvia il server; `npm start` avvia solo il server. Poi apri <http://localhost:8030/strumenti/emulatore/sviluppo.html> per la scheda di Paradise, Hell and Guns, oppure <http://localhost:8030/strumenti/emulatore/prova/index.html> per la scheda di prova. Serve il server: aprendo `index.html` come file, i moduli JavaScript e le `fetch` non partono. La porta si cambia con `node strumenti/server.mjs 9000`.

Il server ascolta solo su `127.0.0.1`, perché la sua radice contiene anche `manuali/`.

## Cosa si vede

- **A sinistra la scheda**, dentro un iframe come su Roll20, con il CSS della scheda e le regole di base della piattaforma.
- **Chat**: i tiri dei pulsanti, con il roll template della scheda. Passando il mouse su un risultato compare il dettaglio come su Roll20 ("Rolling 1d8 + 4[ROB] = (4) + 4[ROB]", con i dadi in grassetto): una finestrella che mostra l'HTML dei dadi, al posto del `title` del browser che lo mostrerebbe come codice.
- **Attributi**: tutti gli attributi del personaggio, modificabili. Una modifica emette `change:` come quelle fatte dalla scheda.
- **Eventi**: eventi inviati al worker, `setAttrs` con i valori cambiati, `console.log` ed errori del codice della scheda.
- **Barra**: scelta del personaggio, `sheet:opened` a mano, ripristino dal file, esporta e importa in JSON. Le modifiche restano salvate nel browser finché non si ripristina.
- **Salva su disco** e **Salvati**: il server di sviluppo (`strumenti/server.mjs`, `npm run dev` o `npm start`) salva il personaggio aperto in `strumenti/emulatore/salvataggi/<nome>.json`, fuori da git perché sono personaggi delle partite; *Salvati* elenca i salvataggi, il più recente per primo, e ne ricarica uno al posto del personaggio aperto (chiede conferma). Il salvataggio resta anche svuotando la scheda, il browser o cambiando profilo di Chrome. API: `GET /api/salvataggi`, `GET` e `PUT /api/salvataggi/<nome>` (lettere, numeri, `_ . -`). Con un altro server statico i due comandi si nascondono.

Dalla console del browser, `window.emulatore` dà accesso agli attributi (`emulatore.valore("nome")`), agli eventi (`emulatore.emettiEvento(["sheet:opened"])`) e ai tiri.

## Configurare una scheda

Ogni scheda ha un `index.html` che chiama `avviaEmulatore`. Una scheda custom arriva a Roll20 come **un solo HTML e un solo CSS**. Con `schedaCompleta` l'emulatore li divide come fa Roll20:
- i roll template si riconoscono dalla classe `sheet-rolltemplate-NOME`;
- ogni `<script type="text/worker">` diventa un worker;
- dal CSS spariscono i blocchi `/* start mobile */ … /* end mobile */`.

```js
avviaEmulatore({
  id: "prova",                      // chiave per salvare il personaggio nel browser
  titolo: "Scheda di prova",
  cartella: "./",                   // da dove leggere i file
  schedaCompleta: "sheet.html",
  css: "sheet.css",
  traduzioni: "translation.json",   // facoltativo
  personaggi: [{ id: "vuoto", etichetta: "Nuovo personaggio" }],
});
```

In alternativa si passano i file già separati: `html`, `cssScheda`, `cssChat`, `worker` (un elenco di file) e `rollTemplates` (nome → file).

## Differenze note

- Gli eventi `change:` partono solo se il valore cambia davvero. Nomi e `sourceAttribute` sono in minuscolo, come su Roll20.
- Una riga ripetibile aggiunta resta anche vuota (su Roll20 sparisce se non si compila nulla). In modifica le righe si spostano trascinando la maniglia ≡, come su Roll20.
- Il cestino di una riga la elimina subito, senza conferma, come su Roll20.
- Roll20 rinomina i campi dentro ogni riga ripetibile (`attr_repeating_<sezione>_<id>_<campo>`), così per esempio le radio di righe diverse restano gruppi separati. L'emulatore non lo fa: radio con lo stesso nome in righe diverse diventano un gruppo solo.
- `@{selected|...}` e `@{target|...}` usano il personaggio aperto. `&{tracker}`, `%{abilità}` e gli helper dei roll template non elencati (oltre a `rollWasCrit()`, `rollWasFumble()`, `rollTotal()`, `rollGreater()`, `rollLess()`, `rollBetween()`, anche con `computed::`) non sono emulati e finiscono nel registro degli eventi.
- I pulsanti nei messaggi `[testo](~bersaglio)` funzionano: al clic eseguono il pulsante d'azione della scheda (`clicked:…`), anche in una riga ripetibile (`~repeating_armi_<idRiga>_danni`).
- Un comando di tiro diventa un messaggio per riga, ma gli a capo dentro `{{...}}` restano nella proprietà (una descrizione su più righe esce in un messaggio solo, come i tratti della scheda D&D su Roll20).
- `startRoll` e `finishRoll` (Custom Roll Parsing) funzionano per i casi semplici.
- Traduzioni come su Roll20 (prove del 01/10/2026): `data-i18n`, `data-i18n-title`, `-placeholder`, `-aria-label` dal file `traduzioni`, anche nelle card in chat; una chiave che manca si vede come `[chiave]`, non con il testo scritto nell'HTML; `^{chiave}` si traduce nel comando di un tiro, non se è scritto dentro il roll template.
- Mancano la barra delle macro, i token, i permessi e la modalità scura.
- Nei worker manca `_` (underscore.js), che Roll20 invece fornisce.
