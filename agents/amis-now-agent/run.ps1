$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (Test-Path ".\.env") {
  Get-Content ".\.env" | ForEach-Object {
    if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
      [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
    }
  }
}

npm run start
