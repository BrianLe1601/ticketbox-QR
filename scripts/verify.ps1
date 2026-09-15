[CmdletBinding()]
param(
    [ValidateSet("all", "client", "server")]
    [string]$Scope = "all"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot

function Invoke-NpmCheck {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Directory,

        [Parameter(Mandatory = $true)]
        [string]$Label,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    Write-Host "`n[verify] $Label" -ForegroundColor Cyan
    Push-Location (Join-Path $repoRoot $Directory)
    try {
        & npm.cmd @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "$Label failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

if ($Scope -in @("all", "client")) {
    Invoke-NpmCheck -Directory "client" -Label "Client lint" -Arguments @("run", "lint")
    Invoke-NpmCheck -Directory "client" -Label "Client production build" -Arguments @("run", "build")
}

if ($Scope -in @("all", "server")) {
    Invoke-NpmCheck -Directory "server" -Label "Server typecheck" -Arguments @("run", "typecheck")
    Invoke-NpmCheck -Directory "server" -Label "Server build" -Arguments @("run", "build")
    Invoke-NpmCheck -Directory "server" -Label "Server tests" -Arguments @("test", "--", "--reporter=verbose")
}

Write-Host "`n[verify] Scope '$Scope' passed." -ForegroundColor Green
