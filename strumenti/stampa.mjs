// Scheda stampabile A4: stampa docs/stampa/scheda-a4.html in PDF con Chrome (senza finestra) e ci mette sopra i
// campi compilabili, uno per ogni elemento .f della pagina (data-n = nome del campo; .t testo, .a testo su piu
// righe, .c casella tonda, .q casella quadrata). Due elementi con lo stesso nome diventano lo stesso campo, con lo
// stesso valore (il nome del personaggio sui due fogli).
//
// Uso:  npm run stampa      ->  docs/stampa/scheda-phag-a4.pdf
import { spawn } from "node:child_process";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PDFDocument, PDFName, StandardFonts, TextAlignment, rgb, drawEllipse, drawRectangle } from "pdf-lib";

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGINA = path.join(RADICE, "docs", "stampa", "scheda-a4.html");
const USCITA = path.join(RADICE, "docs", "stampa", "scheda-phag-a4.pdf");
const CHROME = process.env.CHROME ?? path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe");
const PORTA = 9334;
const PT_PER_PX = 72 / 96;
const INCHIOSTRO = rgb(0.17, 0.14, 0.13);

const aspetta = ms => new Promise(r => setTimeout(r, ms));

// ------------------------------------------------------------------------------------------- Chrome via CDP
async function stampa() {
  const profilo = await mkdtemp(path.join(tmpdir(), "phag-stampa-"));
  const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORTA}`, `--user-data-dir=${profilo}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
  try {
    let bersagli;
    for (let i = 0; i < 50 && !bersagli; i++) {
      try { bersagli = await (await fetch(`http://127.0.0.1:${PORTA}/json/list`)).json(); } catch { await aspetta(200); }
    }
    const pagina = bersagli?.find(b => b.type === "page");
    if (!pagina) throw new Error("Chrome non risponde sulla porta " + PORTA);

    const ws = new WebSocket(pagina.webSocketDebuggerUrl);
    await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko; });
    let prossimo = 0;
    const attesi = new Map(), eventi = new Map();
    ws.onmessage = m => {
      const d = JSON.parse(m.data);
      if (d.id && attesi.has(d.id)) { const { ok, ko } = attesi.get(d.id); attesi.delete(d.id); d.error ? ko(new Error(d.error.message)) : ok(d.result); }
      else if (d.method && eventi.has(d.method)) eventi.get(d.method)();
    };
    const cdp = (method, params = {}) => new Promise((ok, ko) => { const id = ++prossimo; attesi.set(id, { ok, ko }); ws.send(JSON.stringify({ id, method, params })); });
    const evento = nome => new Promise(ok => eventi.set(nome, ok));

    await cdp("Page.enable");
    await cdp("Emulation.setEmulatedMedia", { media: "print" });
    const caricata = evento("Page.loadEventFired");
    await cdp("Page.navigate", { url: pathToFileURL(PAGINA).href });
    await caricata;
    const valuta = async espr => (await cdp("Runtime.evaluate", { expression: espr, awaitPromise: true, returnByValue: true })).result.value;
    await valuta("document.fonts.ready.then(() => true)");

    // Posizione di ogni campo, in px CSS, rispetto al suo foglio.
    const campi = await valuta(`[...document.querySelectorAll(".foglio")].flatMap((foglio, pagina) => {
      const f = foglio.getBoundingClientRect();
      return [...foglio.querySelectorAll(".f")].map(el => {
        const r = el.getBoundingClientRect(), s = getComputedStyle(el);
        const bordo = parseFloat(s.borderBottomWidth) || 0;
        const tipo = ["t", "a", "c", "q"].find(c => el.classList.contains(c));
        return { nome: el.dataset.n, tipo, num: el.classList.contains("num"), pagina, x: r.left - f.left, y: r.top - f.top, w: r.width, h: r.height - (tipo === "t" ? bordo : 0) };
      });
    })`);
    const pdf = await cdp("Page.printToPDF", { preferCSSPageSize: true, printBackground: true, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 });
    ws.close();
    return { pdf: Buffer.from(pdf.data, "base64"), campi };
  } finally {
    chrome.kill();
    await aspetta(300);
    await rm(profilo, { recursive: true, force: true }).catch(() => {});
  }
}

// ------------------------------------------------------------------------------------------- campi del PDF
// Casella: piena = pallino (o quadratino) d'inchiostro, vuota = niente (il contorno e' gia' stampato).
const aspettoCasella = forma => (_campo, widget) => {
  const { width: w, height: h } = widget.getRectangle();
  const pieno = forma === "c"
    ? drawEllipse({ x: w / 2, y: h / 2, xScale: w * 0.32, yScale: h * 0.32, color: INCHIOSTRO, borderWidth: 0 })
    : drawRectangle({ x: w * 0.2, y: h * 0.2, width: w * 0.6, height: h * 0.6, color: INCHIOSTRO, borderWidth: 0, rotate: { type: "degrees", angle: 0 }, xSkew: { type: "degrees", angle: 0 }, ySkew: { type: "degrees", angle: 0 } });
  return { normal: { on: pieno, off: [] }, down: { on: pieno, off: [] } };
};

// Niente sfondo ne' bordo: si vede la grafica stampata sotto.
function trasparente(campo) {
  for (const w of campo.acroField.getWidgets()) {
    const mk = w.getAppearanceCharacteristics();
    if (mk) { mk.dict.delete(PDFName.of("BG")); mk.dict.delete(PDFName.of("BC")); }
  }
}

async function main() {
  const { pdf, campi } = await stampa();
  const doc = await PDFDocument.load(pdf);
  const form = doc.getForm();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pagine = doc.getPages();
  const fatti = new Map();

  for (const c of campi) {
    const pagina = pagine[c.pagina];
    const altezza = pagina.getHeight();
    const r = { x: c.x * PT_PER_PX, y: altezza - (c.y + c.h) * PT_PER_PX, width: c.w * PT_PER_PX, height: c.h * PT_PER_PX };
    const opzioni = { ...r, borderWidth: 0, textColor: INCHIOSTRO, font };
    if (c.tipo === "c" || c.tipo === "q") {
      const casella = fatti.get(c.nome) ?? form.createCheckBox(c.nome);
      casella.addToPage(pagina, opzioni);
      casella.updateAppearances(aspettoCasella(c.tipo));
      fatti.set(c.nome, casella);
    } else {
      const nuovo = !fatti.has(c.nome);
      const testo = fatti.get(c.nome) ?? form.createTextField(c.nome);
      testo.addToPage(pagina, opzioni);
      if (nuovo) {
        if (c.tipo === "a") testo.enableMultiline();
        testo.setFontSize(c.tipo === "a" ? 8 : c.num ? 12 : 9);
        if (c.num) testo.setAlignment(TextAlignment.Center);
      }
      fatti.set(c.nome, testo);
    }
  }
  for (const campo of fatti.values()) trasparente(campo);
  // Le caselle hanno gia' il loro aspetto: si rigenerano solo i campi di testo.
  for (const campo of fatti.values()) if (campo.constructor.name === "PDFTextField") campo.defaultUpdateAppearances(font);

  doc.setTitle("Paradise, Hell and Guns - scheda del personaggio");
  await writeFile(USCITA, await doc.save({ updateFieldAppearances: false }));
  console.log(`${path.relative(RADICE, USCITA)}: ${pagine.length} pagine, ${fatti.size} campi (${campi.length} riquadri)`);
}

main().catch(e => { console.error(e); process.exit(1); });
