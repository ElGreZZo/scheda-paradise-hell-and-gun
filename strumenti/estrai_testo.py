# -*- coding: utf-8 -*-
"""Testo del manuale e della scheda cartacea, dai docx di manuali/ a .cache/testo/<nome>.md.

Un paragrafo per riga; titoli come "## 3 - Azioni e abilita'" (dagli stili Titolo/Heading), elenchi con "- ",
tabelle fra <TABELLA> e </TABELLA> con le celle separate da " | ", immagini come [IMMAGINE media/imageN.png].
Le cartelle manuali/ e .cache/ sono escluse da git: il manuale non e' pubblicato, serve solo come base per
estrarre e verificare i dati (npm run controlla).

Legge i docx come zip + XML, senza dipendenze (niente pandoc, niente python-docx).

Uso:  npm run estrai-testo
"""
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

RADICE = Path(__file__).resolve().parents[1]
MANUALI = {
    "manuale": RADICE / "manuali" / "Pad 1.5.docx",
    "scheda": RADICE / "manuali" / "PHeG scheda 2.docx",
}
USCITA = RADICE / ".cache" / "testo"

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"


def testo_paragrafo(p):
    pezzi = []
    for el in p.iter():
        if el.tag == W + "t" and el.text:
            pezzi.append(el.text)
        elif el.tag == W + "tab":
            pezzi.append("\t")
        elif el.tag in (W + "br", W + "cr"):
            pezzi.append("\n")
        elif el.tag.endswith("}blip"):
            pezzi.append("[IMMAGINE %s]" % el.get(R + "embed"))
    return "".join(pezzi)


def stile(p):
    ppr = p.find(W + "pPr")
    if ppr is None:
        return "", False
    s = ppr.find(W + "pStyle")
    return (s.get(W + "val") if s is not None else ""), ppr.find(W + "numPr") is not None


def blocchi(corpo, uscita):
    for el in corpo:
        if el.tag == W + "p":
            testo = testo_paragrafo(el)
            if not testo.strip():
                continue
            nome_stile, elenco = stile(el)
            m = re.match(r"(?i)(heading|titolo)\s*(\d)", nome_stile)
            if m:
                prefisso = "#" * (int(m.group(2)) + 1) + " "
            elif nome_stile.lower() in ("title", "titolo"):
                prefisso = "# "
            elif elenco:
                prefisso = "- "
            else:
                prefisso = ""
            uscita.append(prefisso + testo)
        elif el.tag == W + "tbl":
            uscita.append("<TABELLA>")
            for riga in el.findall(W + "tr"):
                celle = []
                for cella in riga.findall(W + "tc"):
                    dentro = []
                    blocchi(cella, dentro)
                    celle.append(" / ".join(x.replace("\n", " ") for x in dentro))
                uscita.append("| " + " | ".join(celle) + " |")
            uscita.append("</TABELLA>")
        elif el.tag == W + "sdt":
            contenuto = el.find(W + "sdtContent")
            if contenuto is not None:
                blocchi(contenuto, uscita)


def converti(docx, destinazione):
    with zipfile.ZipFile(docx) as z:
        radice = ET.fromstring(z.read("word/document.xml"))
        relazioni = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("word/_rels/document.xml.rels"))}
    righe = []
    blocchi(radice.find(W + "body"), righe)
    testo = re.sub(r"\[IMMAGINE (rId\d+)\]", lambda m: "[IMMAGINE %s]" % relazioni.get(m.group(1), m.group(1)), "\n".join(righe))
    destinazione.write_text(testo + "\n", encoding="utf-8")
    print("%s: %d righe" % (destinazione.relative_to(RADICE).as_posix(), len(righe)))


def main():
    USCITA.mkdir(parents=True, exist_ok=True)
    mancanti = [str(p.relative_to(RADICE)) for p in MANUALI.values() if not p.exists()]
    if mancanti:
        sys.exit("mancano in manuali/: " + ", ".join(mancanti))
    for nome, docx in MANUALI.items():
        converti(docx, USCITA / (nome + ".md"))


if __name__ == "__main__":
    main()
