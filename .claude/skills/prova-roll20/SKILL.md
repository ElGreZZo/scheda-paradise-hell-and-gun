---
name: prova-roll20
description: Prova la scheda di Paradise, Hell and Guns direttamente su Roll20 dal Chrome di debug (Playwright) - build, caricamento di HTML, CSS e translation.json nello Sheet Sandbox dell'utente (o in una partita di prova con scheda Custom), personaggio di prova, controlli in console e in chat, pulizia e registro delle prove. Usala quando una modifica va verificata su Roll20 dopo l'emulatore, o per caricare la scheda in una partita.
---

# Prova su Roll20

Obiettivo: verificare su Roll20 quello che l'emulatore non può dire. Dove l'emulatore e la scheda condividono un errore, solo Roll20 lo mostra (filtro del CSS, pulizia dell'HTML, Mustache, traduzioni, attributi caricati pigramente). Prima si prova nell'emulatore (`npm run dev`), poi qui. Cosa sappiamo di Roll20: [docs/roll20.md](../../../docs/roll20.md).

## Regole fisse

1. **Solo nello Sheet Sandbox o in una partita di prova** creati per questa scheda, con nome e id scritti nella tabella *Partite* qui sotto. Le partite vere (campagne, partite del master o di altri) restano in **sola lettura**: niente clic, niente schede aperte, niente trascinamenti.
2. **Controlla la partita prima di ogni azione**: `window.campaign_id === <id>` (un numero). Se non coincide, fermati.
3. **Login, pagamenti e account li gestisce l'utente.** Se Roll20 chiede il login, chiedi all'utente di farlo nel Chrome di debug. Non scrivere mai credenziali.
4. **Crea partite o sandbox, e cancellale, solo col via dell'utente**, con il nome che sceglie lui. Prima di cancellare, salva su disco i personaggi.
5. **Le schede del browser non tue non si toccano**: il Chrome di debug è anche quello dell'utente, e altre chat possono averci schede aperte. Apri una scheda nuova per la prova e chiudila alla fine. Niente `browser_resize` sulle schede che l'utente guarda.
6. **Pulisci dopo**: righe e attributi aggiunti per la prova si tolgono, poi si confrontano i conteggi.
7. **Riporta all'utente** cosa hai caricato (build, data), cosa hai provato, cosa hai visto (anche gli errori), cosa hai rimesso a posto. Aggiorna il *Registro* qui sotto.

## Partite

| Uso | Nome | Id | Note |
|---|---|---|---|
| Sheet Sandbox | *(da creare)* | — | da creare col via dell'utente: `https://app.roll20.net/sheetsandbox` → «Crea nuova sandbox» |
| Partita di prova (per mostrare la scheda) | PHaG - Prova scheda | 22140561 | creata il 23/10/2026 col via dell'utente; scheda Custom da `/campaigns/campaignsettings/22140561` |

Quando ne crei una, scrivi qui nome, id e data.

## Procedura

### 1. Build e file da caricare

```sh
npm run controlla && npm test && npm run build -- --leggibile
```

Usa `--leggibile` per leggere gli errori dello script; per una partita da mostrare, `npm run build` (minificato). Copia `dist/scheda.html`, `dist/scheda.css` e `dist/translation.json` in `.playwright-mcp/roll20/<AAAA-MM-GG>-<argomento>/`. È fuori da git, e Playwright carica file solo da dentro la cartella del repo. Controlla i file copiati prima di caricarli.

### 2. Chrome di debug

Playwright (`.mcp.json`) si collega a Chrome sulla porta 9222, non apre un browser suo. Se un comando `browser_*` dà `ECONNREFUSED`, lancia:

```powershell
powershell -ExecutionPolicy Bypass -File strumenti/avvia-chrome.ps1
```

Lo script non fa niente se Chrome è già aperto. Il profilo è lo stesso della scheda di Farsight, quindi il login a Roll20 di solito c'è già. Poi `browser_tabs` con `list`, per sapere quali schede ci sono, e `new` per la tua.

### 3. Aprire la partita

Apri `https://app.roll20.net/editor/setcampaign/<id>` nella tua scheda e aspetta che l'editor sia carico:

```js
for (let i = 0; i < 90 && !(window.Campaign && Campaign.characters); i++) await new Promise((ok) => setTimeout(ok, 1000));
if (window.campaign_id !== ID) throw new Error("partita sbagliata");
```

Se resta su «Caricamento...» (un file di Roll20 non scaricato, `ERR_CONNECTION_CLOSED` in console), ricarica.

### 4. Caricare la scheda (Sandbox)

Nella finestra «Sheet Sandbox Tools» dell'editor ci sono `#sheetHtml`, `#sheetCss`, `#sheetTranslation`. Con `browser_run_code`:

```js
async (page) => {
  const cartella = "<percorso assoluto di .playwright-mcp/roll20/…>";
  await page.locator("#sheetCss").setInputFiles(`${cartella}/scheda.css`);
  await page.locator("#sheetHtml").setInputFiles(`${cartella}/scheda.html`);
  await page.locator("#sheetTranslation").setInputFiles(`${cartella}/translation.json`);
}
```

Ogni file ricarica e salva subito. Carica prima il CSS: se carichi solo l'HTML, le schede si ricaricano con il CSS vecchio. Se sono cambiate le traduzioni, **ricarica la partita** (`/editor/setcampaign/<id>`): lo script le riceve solo al caricamento.

Per una **partita di prova** con scheda Custom, si carica dalle impostazioni (`/campaigns/campaignsettings/<id>`): editor Ace più textarea e il link `#save-changes-button`, come descritto in [docs/roll20.md](../../../docs/roll20.md). In `browser_run_code_unsafe` non c'è `fs`: per leggere i file si aggiunge alla pagina un `<input type="file">` nascosto, lo si riempie con `page.setInputFiles` e si leggono i file con `file.text()` (provato il 23/10/2026). Il menu `select[name="charsheettype"]` è nascosto: si cambia con `jQuery(sel).val("custom").trigger("change")`.

### 5. Personaggio di prova

Usa un personaggio fatto apposta («Prova scheda»), mai quelli di una campagna. Se non c'è, crealo con `Campaign.characters.create({ name: "Prova scheda" })`.

Per aprire la scheda, **carica sempre prima gli attributi**: senza, lo script ricalcola a vuoto e crea attributi doppi.

```js
const ch = Campaign.characters.find((c) => c.get("name") === "Prova scheda");
await new Promise((ok) => ch.attribs.fetch({ success: ok, error: ok }));
const prima = { ids: ch.attribs.map((a) => a.id), n: ch.attribs.length }; // annotala anche su file
ch.view.showDialog();
```

La scheda è un iframe della stessa origine con `.charsheet`. Per i valori, leggi gli attributi da `ch.attribs`.

### 6. Controlli

- **Console**: gli errori della scheda. Sono di Roll20, non nostri, e si ignorano:
  - `trackVttError is not defined`;
  - `groundcover is not defined`;
  - CSP di `bat.bing.com`;
  - `Permissions policy violation: unload`;
  - `totallyNotAnalytics` non scaricato.
- **CSS applicato**: se in console c'è «Potential CSS security violation», Roll20 ha scartato tutto il foglio.
- **Nessuna `[chiave]`** visibile nella scheda o nelle card.
- **Tiri**: il messaggio in chat (`#textchat .message`), il roll template, i valori calcolati.
- Quello che la modifica doveva fare, confrontato con l'emulatore.

### 7. Pulizia e registro

Togli righe e attributi aggiunti (`attr.destroy()` sugli id che non erano in `prima`), poi confronta il conteggio. Chiudi la scheda del browser che hai aperto. Scrivi una riga nel *Registro* e riporta all'utente.

## Registro

| Data | Partita | Build | Cosa | Esito |
|---|---|---|---|---|
| 23/10/2026 | PHaG - Prova scheda (22140561) | 0.0.1, `npm run build` | creata la partita con scheda Custom; caricata tre volte (correzioni di `label` e `small` di Roll20); personaggio «Prova scheda»: archetipo Serafino, pallini, danni, mana, tiro di Mischia (Custom Roll Parsing), iniziativa | ok: nessuna violazione del CSS, nessuna `[chiave]`, 19 attributi senza doppi; «Prova scheda» lasciato nella partita come esempio |
| 24/10/2026 | PHaG - Prova scheda (22140561) | 0.0.2 | pagina Equipaggiamento su «Prova scheda»: pistola dal manuale, attacco, ricarica | ok dopo una correzione: a 830px la riga delle armi sbordava (ora su due livelli); tolte riga e cartucciera della prova, resta `pagina` |
| 23/10/2026 | PHaG - Prova scheda (22140561) | 0.0.1 | creati 10 personaggi «Archetipo Carriera» con le regole del cap. 9 (attributi con `ch.attribs.create`, file in `.playwright-mcp/roll20/2026-10-23-v0.0.1/personaggi.json`); aperte tutte le schede; tiri di Ingannare e Mischia | ok: dopo la ricarica 50 attributi ciascuno, nessun doppio; all'apertura lo script ricalcola gli stessi valori (aggiunge solo `tiro_attivo`); personaggi lasciati nella partita |
