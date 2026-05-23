$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

Write-Host ""
Write-Host "Online PostgreSQL Migration" -ForegroundColor Cyan
Write-Host "Paste the Neon/Supabase DATABASE_URL when prompted. It is used only for this session."
Write-Host ""

$secureUrl = Read-Host "DATABASE_URL" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureUrl)

try {
  $databaseUrl = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

if (-not $databaseUrl -or $databaseUrl.Trim().Length -lt 20) {
  throw "DATABASE_URL was not provided."
}

$env:DB_CLIENT = "postgres"
$env:DATABASE_URL = $databaseUrl.Trim()
$env:PGSSL = "true"

Write-Host ""
Write-Host "Running migration..." -ForegroundColor Cyan
npm run postgres:migrate

Write-Host ""
Write-Host "Checking migrated data..." -ForegroundColor Cyan
npm run postgres:check

Write-Host ""
Write-Host "Refreshing analytics..." -ForegroundColor Cyan
npm run postgres:refresh-analytics

Write-Host ""
Write-Host "Online PostgreSQL migration completed." -ForegroundColor Green
