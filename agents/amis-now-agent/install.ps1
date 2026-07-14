$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".\config.json")) {
  Copy-Item ".\config.example.json" ".\config.json"
  Write-Host "config.json wurde aus config.example.json erstellt. Bitte AMIS-Selektoren und URLs pruefen."
}

npm install --omit=dev
Write-Host "Installation abgeschlossen. Token in .env oder als Windows-Umgebungsvariable setzen."
