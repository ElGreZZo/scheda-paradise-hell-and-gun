# Istruzioni per gli agenti Claude

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

## Progetto

- **Dati solo dal manuale** (`manuali/`, fuori da git). Mai inventare valori o testi: se un dato manca o è incoerente, va in `docs/domande-per-il-master.md`.
- **File generati:** i file di `dati/` con `generato_da` li scrive `npm run estrai-dati`. Si corregge l'estrazione, non il JSON. Dopo ogni modifica ai dati: `npm run controlla`, poi `npm test`.
- **Prima si decide, poi si sviluppa.** Il disegno della scheda e i nomi degli attributi (`attr_…`) si decidono con l'utente prima di scrivere i template: un attributo rinominato fa perdere i dati nelle partite.
- **Un passo per volta.** A fine passo si riporta cosa è cambiato, le verifiche fatte e il messaggio di commit proposto. Il commit lo fa l'utente, salvo che lo chieda; niente push senza richiesta.
