param([ValidateSet("all","client","server")][string]$Scope="all")
$ErrorActionPreference="Stop"
$ProjectRoot=(Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")).Path
function Invoke-NpmCheck([string]$Directory,[string[]]$Scripts){
  Push-Location (Join-Path $ProjectRoot $Directory)
  try{foreach($Script in $Scripts){& npm run $Script;if($LASTEXITCODE -ne 0){throw "$Directory npm run $Script failed"}}}
  finally{Pop-Location}
}
if($Scope -in @("all","server")){Invoke-NpmCheck "server" @("typecheck","build")}
if($Scope -in @("all","client")){Invoke-NpmCheck "client" @("lint","build")}
Write-Host "TicketBoxQR verification completed for scope: $Scope" -ForegroundColor Green
