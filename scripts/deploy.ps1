# Redeploy the static site to GitHub Pages (gh-pages branch).
#   pwsh scripts/deploy.ps1
# Always does a CLEAN full build so a stale Next cache can't ship an old bundle,
# and never pipes the build through Select-Object -First (which kills it early).
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$name = (git config user.name)
$email = (git config user.email)

Remove-Item -Recurse -Force .next, out -ErrorAction SilentlyContinue
$env:BASE_PATH = '/nas-spin-the-wheel'
npm run build
Remove-Item Env:\BASE_PATH

if (-not (Test-Path out\index.html)) { throw 'Build failed: out/index.html missing' }

Set-Location out
git init -q
git checkout -q -b gh-pages
git add -A
git -c user.name="$name" -c user.email="$email" commit -q -m 'Deploy'
git push -f https://github.com/dinhcodes/nas-spin-the-wheel.git gh-pages
Set-Location $root
Write-Output 'Deployed -> https://dinhcodes.github.io/nas-spin-the-wheel/'
