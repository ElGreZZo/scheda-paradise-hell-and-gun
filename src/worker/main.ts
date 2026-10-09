// Script della scheda (sheet worker). La build (strumenti/build.mjs) lo unisce con esbuild, da questo file in giù,
// in un solo blocco dentro <script type="text/worker">. Qui solo le registrazioni dei moduli (registraX() di
// ogni modulo, con i calcoli puri separati dagli eventi), nell'ordine in cui i gestori vanno aggiunti.
//
// Nessun modulo per ora: la scheda è in attesa del disegno.
export {};
