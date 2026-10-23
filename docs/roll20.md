# Roll20: cosa sappiamo delle schede custom

Raccolto lavorando alla scheda di Farsight (repo `Farsight custom sheet`, settembre–ottobre 2026), provato su Roll20 dove è indicato. Vale anche per questa scheda: la build, l'emulatore e i controlli vengono da lì.

## Account e partite

- **Schede custom solo col Pro**, e solo il **creatore della partita** usa l'editor della scheda e lo Sheet Sandbox. Il Pro ce l'ha l'utente (dal 28/09/2026); il master di Paradise, Hell and Guns no. Le prove su Roll20 si fanno quindi nelle partite dell'utente.
- **Sheet Sandbox**: `https://app.roll20.net/sheetsandbox` («Le mie sandbox per schede personalizzate», «Crea nuova sandbox», fino a 15). Nell'editor del Sandbox c'è la finestra «Sheet Sandbox Tools» con tre input file: `#sheetHtml`, `#sheetCss`, `#sheetTranslation`. Scegliere un file ricarica le schede e salva subito.
  - Caricando solo l'HTML, Roll20 ricarica con il CSS salvato prima: un errore subito dopo può venire dal CSS vecchio.
  - Le impostazioni del Sandbox stanno in `https://app.roll20.net/sheetsandbox/settings/<id>`.
- **Partita normale con scheda Custom** (per mostrare la scheda ad altri): `https://app.roll20.net/campaigns/campaignsettings/<id>`.
  - Ci sono tre editor Ace (`#customsheet-layout`, `#customsheet-css`, `#customsheet-translation`) con le textarea `customcharsheet_layout`, `_style`, `_translation`.
  - Si scrive con `ace.edit(pannello.querySelector('.editor')).setValue(testo, -1)` più il valore della textarea, poi il link `#save-changes-button`.
  - Roll20 riformatta `translation.json` con i tab: per verificare si confrontano le chiavi, non il testo.
- **Id della partita**: `window.campaign_id` (un numero), non `Campaign.id`. Va controllato prima di ogni azione.
- **GM**: il creatore è sempre GM. Per giocare usa «Avvia come giocatore invece?», cioè `/editor/setcampaign/<id>?desiredrole=player`. Un GM promosso dal creatore non deve accettare niente, gli basta ricaricare.

## Cosa fa Roll20 alla scheda

- **Filtro di sicurezza del CSS.** Se trova uno di questi, scarta **tutto** il foglio:
  - caratteristiche: caratteri da `\x7f` a `\xff` (lettere accentate, `·`), `data:`, `\` seguito da lettera o cifra, `eval`, `window`, `<`;
  - in console compare «Potential CSS security violation».
  
  «●» passa. I commenti senza `*` dentro vengono tolti prima del controllo. La build si ferma prima (`violazioniCssRoll20`).
- **`@import` dentro un commento del CSS** rompe il foglio nell'emulatore: gli import vengono portati in cima fino al primo `;`. Su Roll20 non è provato; la build si ferma comunque.
- **HTML ripulito**: `<optgroup>` sparisce (le `<option>` restano in fila), mentre `<option disabled>` e `&nbsp;` restano. Le intestazioni dei menu si fanno con voci disattivate.
- **Valori `computed::`** dei roll template diventano `span.inlinerollresult` viola.
- **Roll template**: li rende Mustache.js 1.0.0, che nella pagina è globale e si prova con `Mustache.render`. `{{#^prop}}` su una proprietà non si vede mai; la sezione inversa è `{{^prop}}…{{/prop}}`. Negano solo le funzioni di Roll20 (`{{#^rollTotal() …}}`).
- **Pulsanti di tiro**: un `@{campo}` senza un input (anche nascosto) con valore iniziale dà «No attribute was found» in chat. Uno `<span name="attr_…">` non basta.
- **Immagini**: la scheda è solo HTML e CSS incollati, quindi un'immagine va presa da un indirizzo `https://` pubblico. Per esempio `files.d20.io`: si carica dalla «Biblioteca grafiche» di una partita e Roll20 la converte in WebP. Tutto passa dal proxy `imgsrv.roll20.net`.
- **Larghezza**: la finestra della scheda parte da 900px, cioè circa 830px utili. Roll20 ricorda la misura per ogni personaggio.
- **Stili di Roll20 da annullare** (visti il 23/10/2026 nella partita di prova, l'emulatore non li ha):
  - `.largedialog label { width: 100%; display: block; padding-right: 10px }`: ogni `label` va a capo da solo;
  - `.largedialog small { display: block; width: 100%; text-align: right }`: ogni `small` diventa un blocco allineato a destra;
  - `.ui-dialog .charsheet input[type="number"] { width: 3.5em }`, che pesa (0,3,1).
  
  La scheda li annulla in `src/stili/base.css` (`.scheda label`, `.scheda small`, `[name]` sui campi numerici).
- **Pulsanti d'azione**: il reset `.scheda button[type="action"][name]` pesa (0,3,1); le regole di un pulsante con una classe devono pesare uguale e venire dopo (`.scheda button.pallino[name]`), altrimenti larghezza e altezza tornano `auto`.

## Script della scheda (sheet worker)

- **Attributi caricati pigramente.** `ch.view.showDialog()` da solo apre la scheda vuota: lo script ricalcola a vuoto e crea attributi doppi (il 29/09/2026 ne sono nati 232). Sempre prima `await new Promise((ok) => ch.attribs.fetch({ success: ok, error: ok }))`.
- **Traduzioni**: `data-i18n`, `data-i18n-title|placeholder|aria-label`, `^{chiave}` nei pulsanti di tiro (non dentro un `<rolltemplate>`), `getTranslationByKey` nello script.
  - Una chiave che manca si vede come `[chiave]`.
  - **Nel Sandbox lo script riceve le traduzioni nuove solo ricaricando la partita**: `/editor/setcampaign/<id>`.
  - Un `translation.json` da 705 KB il Sandbox lo accetta.
- **Custom Roll Parsing** (`startRoll` e `finishRoll`) funziona, anche con `&{tracker}`. Serve per contare esuberi e uni di una riserva di dadi.
- **Rete e file** (provato l'08/10/2026):
  - `fetch` verso server con CORS funziona, ma `setAttrs` dentro il `.then` fallisce («no character is active»): si scarica in una variabile e si scrive da un gestore (`clicked:…`).
  - `<input type="file">` è inerte.
  - Niente `document`, `XMLHttpRequest`, `importScripts`.
- **`change:` dato da script** a un campo nascosto non arriva allo script di Roll20. Non si premono da script i pulsanti di una modale chiusa: «Annulla» di una modale chiusa ha rimesso un valore vecchio.
- Nello script c'è `_` (underscore.js) su Roll20, non nell'emulatore.

## Regole per le prove

- **Partite vere in sola lettura**: niente clic, trascinamenti, schede aperte. Lo script di una scheda può riscrivere i valori all'apertura (`sheet:opened`), e anche un trascinamento annullato in jQuery UI sortable ha scambiato due righe.
- **Prima di una prova** si annotano id e conteggio degli attributi dei personaggi toccati (`ch.attribs.map(a => a.id)`). La variabile sparisce ricaricando la partita, quindi si scrive anche su file. Dopo la prova si tolgono le righe aggiunte (`attr.destroy()`) e si confrontano i conteggi.
- **Cancellare** partite, personaggi o sandbox solo con il via esplicito dell'utente, dopo averne salvato i dati su disco.
- **Schede del browser**: il Chrome di debug è anche quello dell'utente. Non toccare le schede che non hai aperto tu. Non usare `browser_resize` su una scheda che l'utente guarda: la dimensione emulata resta e la pagina sembra tagliata. Per uno screenshot grande si apre una scheda nuova e poi si chiude.
- **Il wiki di Roll20** blocca WebFetch (403) e ha una verifica anti-bot: si legge dal Chrome di debug, senza aggirare la verifica.

## Pubblicazione nel catalogo di Roll20 (per quando servirà)

Repository `Roll20/roll20-character-sheets`, letto per Farsight l'01/10/2026:
- **Una sola scheda per gioco.** Una seconda è possibile come scheda «Official», se l'editore scrive a licensing@roll20.net.
- **Creazione e avanzamento del personaggio**, testi delle regole, logo e immagini solo con il permesso scritto dell'editore. Qui l'editore è il master, cioè l'autore del gioco.
- **Politica sull'IA:** il codice scritto con l'IA è ammesso, se chi lo invia sa leggerlo e correggerlo. **I testi creativi dentro la scheda e le immagini devono essere scritti da persone**: l'IA può correggerli, non scriverli. La pena è la rimozione.
- Immagini nella cartella della scheda, fine riga LF, `sheet.json` e immagine di anteprima obbligatori, traduzioni via Crowdin.
