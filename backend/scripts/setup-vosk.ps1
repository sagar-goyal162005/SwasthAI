$ErrorActionPreference = 'Stop'

function Set-DotEnvValue {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string]$Key,
        [Parameter(Mandatory = $true)][string]$Value
    )

    if (-not (Test-Path -LiteralPath $FilePath)) {
        New-Item -ItemType File -Path $FilePath -Force | Out-Null
    }

    $lines = Get-Content -LiteralPath $FilePath -Encoding UTF8 -ErrorAction SilentlyContinue
    if ($null -eq $lines) { $lines = @() }

    $pattern = "^(\s*${Key}\s*=).*$"
    $replaced = $false

    $newLines = @()
    foreach ($line in $lines) {
        if ($line -match $pattern) {
            $newLines += ("$Key=$Value")
            $replaced = $true
        } else {
            $newLines += $line
        }
    }

    if (-not $replaced) {
        if ($newLines.Count -gt 0 -and $newLines[-1] -ne '') {
            $newLines += ''
        }
        $newLines += ("$Key=$Value")
    }

    Set-Content -LiteralPath $FilePath -Value $newLines -Encoding UTF8
}

$backendDir = Resolve-Path (Join-Path $PSScriptRoot '..')
$voskRoot = Join-Path $backendDir '.vosk'
$downloadsDir = Join-Path $voskRoot 'downloads'
$modelsDir = Join-Path $voskRoot 'models'

New-Item -ItemType Directory -Path $downloadsDir -Force | Out-Null
New-Item -ItemType Directory -Path $modelsDir -Force | Out-Null

$enZipUrl = 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip'
$hiZipUrl = 'https://alphacephei.com/vosk/models/vosk-model-small-hi-0.22.zip'

$enZipPath = Join-Path $downloadsDir 'vosk-model-small-en-us-0.15.zip'
$hiZipPath = Join-Path $downloadsDir 'vosk-model-small-hi-0.22.zip'

if (-not (Test-Path -LiteralPath $enZipPath)) {
    Write-Host "Downloading English model..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $enZipUrl -OutFile $enZipPath
}

if (-not (Test-Path -LiteralPath $hiZipPath)) {
    Write-Host "Downloading Hindi model..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $hiZipUrl -OutFile $hiZipPath
}

Write-Host "Extracting models..." -ForegroundColor Cyan

$enModelDir = Join-Path $modelsDir 'vosk-model-small-en-us-0.15'
$hiModelDir = Join-Path $modelsDir 'vosk-model-small-hi-0.22'

if (-not (Test-Path -LiteralPath $enModelDir)) {
    Expand-Archive -LiteralPath $enZipPath -DestinationPath $modelsDir -Force
}

if (-not (Test-Path -LiteralPath $hiModelDir)) {
    Expand-Archive -LiteralPath $hiZipPath -DestinationPath $modelsDir -Force
}

if (-not (Test-Path -LiteralPath $enModelDir)) {
    throw "English model folder not found after extraction: $enModelDir"
}
if (-not (Test-Path -LiteralPath $hiModelDir)) {
    throw "Hindi model folder not found after extraction: $hiModelDir"
}

$envPath = Join-Path $backendDir '.env'
Set-DotEnvValue -FilePath $envPath -Key 'VOSK_MODEL_PATH_EN' -Value $enModelDir
Set-DotEnvValue -FilePath $envPath -Key 'VOSK_MODEL_PATH_HI' -Value $hiModelDir

Write-Host ''
Write-Host "Configured VOSK model paths in: $envPath" -ForegroundColor Green
Write-Host "VOSK_MODEL_PATH_EN=$enModelDir" -ForegroundColor Green
Write-Host "VOSK_MODEL_PATH_HI=$hiModelDir" -ForegroundColor Green
Write-Host ''
Write-Host 'Next: restart backend (uvicorn) and try the mic again.' -ForegroundColor Yellow
