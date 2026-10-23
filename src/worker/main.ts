// Script della scheda (sheet worker). La build (strumenti/build.mjs) lo unisce con esbuild, da questo file in giù,
// in un solo blocco dentro <script type="text/worker">. Qui solo le registrazioni dei moduli (registraX() di
// ogni modulo, con i calcoli puri separati dagli eventi), nell'ordine in cui i gestori vanno aggiunti.
import { registraArchetipo } from "./personaggio/archetipo";
import { registraDerivati } from "./personaggio/derivati";
import { registraInterfaccia } from "./personaggio/interfaccia";
import { registraPallini } from "./personaggio/pallini";
import { registraRisorse } from "./personaggio/risorse";
import { registraProve } from "./tiri/prove";

registraInterfaccia();
registraArchetipo();
registraDerivati();
registraPallini();
registraRisorse();
registraProve();
