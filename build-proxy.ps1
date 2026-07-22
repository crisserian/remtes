# Builds tesla-http-proxy.exe locally from Tesla's own source, instead of
# trusting a precompiled binary. Requires Go (https://go.dev/dl/) and git.
#
# Usage: powershell -ExecutionPolicy Bypass -File build-proxy.ps1

$ErrorActionPreference = "Stop"

$RepoUrl = "https://github.com/teslamotors/vehicle-command.git"
$Tag = "v0.4.1"
$CommitSha = "49977a18fd68567501d59e16a6c9e4a8b9348544"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "git is required and was not found on PATH."
}
if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    Write-Error "Go is required and was not found on PATH. Install from https://go.dev/dl/"
}

$CloneDir = Join-Path $env:TEMP "vehicle-command-$Tag"
if (Test-Path $CloneDir) { Remove-Item -Recurse -Force $CloneDir }

Write-Host "Cloning teslamotors/vehicle-command @ $Tag..."
git clone --branch $Tag --depth 1 $RepoUrl $CloneDir

Push-Location $CloneDir
try {
    $ActualSha = (git rev-parse HEAD).Trim()
    if ($ActualSha -ne $CommitSha) {
        Write-Error "Tag $Tag resolved to $ActualSha, expected $CommitSha. Refusing to build from an unexpected commit - update `$CommitSha in this script if the tag was intentionally moved, or investigate otherwise."
    }

    Write-Host "Building cmd/tesla-http-proxy..."
    go build ./cmd/tesla-http-proxy
} finally {
    Pop-Location
}

$Built = Join-Path $CloneDir "tesla-http-proxy.exe"
$Dest = Join-Path $PSScriptRoot "tesla-http-proxy.exe"
Copy-Item $Built $Dest -Force

$Hash = (Get-FileHash $Dest -Algorithm SHA256).Hash
Write-Host ""
Write-Host "Built tesla-http-proxy.exe from $RepoUrl @ $Tag ($CommitSha)"
Write-Host "SHA256: $Hash"
Write-Host "Compare this hash against README.md if you're verifying a release."

Remove-Item -Recurse -Force $CloneDir
