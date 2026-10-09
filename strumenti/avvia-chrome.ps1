# Avvia Chrome con finestra visibile e porta di debug locale, per il server MCP Playwright (.mcp.json).
# Usa un profilo dedicato: il login a Roll20 resta salvato tra una sessione e l'altra
# e il profilo Chrome personale non viene toccato. Il profilo e' lo stesso della scheda di Farsight
# (farsight-roll20-chrome, copiato da farsight-companion/Roll20/strumenti/): stesso login, stesso Chrome.
#
# Uso:  powershell -ExecutionPolicy Bypass -File strumenti/avvia-chrome.ps1 [-Url <indirizzo>]
# Se Chrome di debug e' gia' aperto non fa niente.

param(
    [int]$Porta = 9222,
    [string]$Url = "https://app.roll20.net/sessions/new"
)

$chrome = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
$profilo = Join-Path $env:LOCALAPPDATA "farsight-roll20-chrome"

try {
    Invoke-RestMethod "http://127.0.0.1:$Porta/json/version" -TimeoutSec 2 | Out-Null
    Write-Output "Chrome di debug gia' attivo sulla porta $Porta."
    exit 0
} catch {}

Start-Process $chrome -ArgumentList @(
    "--remote-debugging-port=$Porta",
    "--user-data-dir=`"$profilo`"",
    "--no-first-run",
    "--no-default-browser-check",
    $Url
)
Write-Output "Chrome avviato sulla porta $Porta con il profilo $profilo."
