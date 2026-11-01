# The Chrome Web Store package: only what the extension runs (its manifest, pages, scripts, styles, icons and fonts,
# with the fonts' licences), every developer comment taken out and the code written compactly (strip.mjs). Notes,
# READMEs, the store's own files and the tests stay out. Writes "Memoir for Chrome <version>.zip" to -Out.
# Needs Node and node_modules here (npm install in store\pack once).
param([string]$Out = (Join-Path $PSScriptRoot 'out'))
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (!(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules\terser'))) { throw 'Run npm install in store\pack first.' }
$version = (Get-Content -LiteralPath (Join-Path $root 'manifest.json') -Raw | ConvertFrom-Json).version
$stage = Join-Path ([IO.Path]::GetTempPath()) ('memoir-pack-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$plain = Join-Path $stage 'plain'; $packed = Join-Path $stage 'packed'
New-Item -ItemType Directory -Force -Path $plain | Out-Null
try {
    # what the extension is made of: the manifest, its pages, scripts and styles, and the icons, fonts and shared code
    Get-ChildItem -LiteralPath $root -File | Where-Object { $_.Extension -in '.html', '.js', '.css' -or $_.Name -eq 'manifest.json' } | Copy-Item -Destination $plain
    # and Memoir's own licence (the GPL), which goes with every copy
    Copy-Item -LiteralPath (Join-Path $root 'LICENSE') -Destination $plain
    foreach ($folder in @('icons', 'fonts', 'shared')) { Copy-Item -LiteralPath (Join-Path $root $folder) -Destination $plain -Recurse }
    & node (Join-Path $PSScriptRoot 'strip.mjs') $plain $packed
    if ($LASTEXITCODE -ne 0) { throw 'Stripping the extension failed.' }
    New-Item -ItemType Directory -Force -Path $Out | Out-Null
    $zip = Join-Path $Out "Memoir for Chrome $version.zip"
    Remove-Item -LiteralPath $zip -ErrorAction SilentlyContinue
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::CreateFromDirectory($packed, $zip, [IO.Compression.CompressionLevel]::Optimal, $false)
    $size = [math]::Round((Get-Item -LiteralPath $zip).Length / 1KB)
    Write-Output "Packed $zip ($size KB)"
} finally { Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue }
