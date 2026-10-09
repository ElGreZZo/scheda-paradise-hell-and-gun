// Le funzioni che Roll20 mette a disposizione degli sheet worker (e l'emulatore imita). Esistono solo lì:
// qui ci sono i tipi, per il controllo di TypeScript. Solo quelle che la scheda usa.
// https://wiki.roll20.net/Sheet_Worker_Scripts e https://wiki.roll20.net/Custom_Roll_Parsing

/** Valori letti con getAttrs: nome dell'attributo → valore (sempre testo). */
type Valori = Record<string, string>;

/** Informazioni sull'evento che ha fatto partire un gestore di on(). */
interface EventoRoll20 {
  /** Attributo o pulsante all'origine, in minuscolo; nelle righe: repeating_<sezione>_<id>_<campo>. */
  sourceAttribute?: string;
  /** "player" se l'ha cambiato il giocatore, "sheetworker" se l'ha cambiato uno script. */
  sourceType?: string;
  previousValue?: string;
  newValue?: string;
  triggerName?: string;
}

/** Un tiro in linea ([[…]]) del messaggio, nei risultati di startRoll. */
interface RisultatoTiro {
  result: number;
  dice?: number[];
  expression?: string;
  rolls?: { dice?: number; sides?: number; results?: number[] }[];
}

/** Risultati di startRoll: l'id del tiro e un risultato per ogni proprietà con un tiro in linea. */
interface RisultatiTiro {
  rollId: string;
  results: Record<string, RisultatoTiro>;
}

/** Registra un gestore per uno o più eventi separati da spazi (change:…, clicked:…, sheet:opened, remove:…). */
declare function on(eventi: string, gestore: (evento: EventoRoll20) => void): void;
declare function getAttrs(nomi: string[], callback: (valori: Valori) => void): void;
declare function setAttrs(valori: Record<string, string>, opzioni?: { silent?: boolean }, callback?: () => void): void;
declare function getSectionIDs(sezione: string, callback: (ids: string[]) => void): void;
declare function removeRepeatingRow(riga: string): void;
/** Id di una riga nuova (20 caratteri, comincia con "-"): setAttrs su repeating_<sezione>_<id>_<campo> la crea. */
declare function generateRowID(): string;
/** Custom Roll Parsing: tira il comando e passa i risultati; il messaggio esce in chat con finishRoll. */
declare function startRoll(comando: string, callback: (risultati: RisultatiTiro) => void): void;
/** Chiude il tiro di startRoll; i valori calcolati si leggono nel roll template con computed::nome. */
declare function finishRoll(rollId: string, calcolati?: Record<string, number>): void;
/** Testo di una chiave del file delle traduzioni (translation.json); false se la chiave non c'è. Nel Sheet Sandbox
 *  il worker riceve le traduzioni solo ricaricando la partita (prove del 01/10/2026). */
declare function getTranslationByKey(chiave: string): string | false;
