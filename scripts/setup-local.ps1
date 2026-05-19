[CmdletBinding()]
param(
    [string]$DbHost = "localhost",
    [int]$DbPort = 5432,
    [string]$DbName = "lab-5.v2",
    [string]$DbUser = "postgres",
    [string]$DbPassword,
    [switch]$ReimportDump
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Path $PSScriptRoot -Parent
$envFile = Join-Path $repoRoot ".env"
$envExampleFile = Join-Path $repoRoot ".env.example"
$dumpFile = Join-Path $repoRoot "neon-import.sql"

function Assert-CommandExists {
    param([string]$CommandName)

    if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
        throw "Не знайдено команду '$CommandName'. Встановіть її перед запуском setup."
    }
}

function Set-EnvValue {
    param(
        [string]$Path,
        [string]$Key,
        [string]$Value
    )

    if (-not (Test-Path $Path)) {
        throw "Файл $Path не знайдено."
    }

    $content = Get-Content $Path -Raw -Encoding UTF8
    $escapedKey = [Regex]::Escape($Key)
    $lineValue = "$Key=$Value"

    if ($content -match "(?m)^$escapedKey=") {
        $content = [Regex]::Replace($content, "(?m)^$escapedKey=.*$", $lineValue)
    }
    else {
        if ($content.Length -gt 0 -and -not $content.EndsWith([Environment]::NewLine)) {
            $content += [Environment]::NewLine
        }
        $content += $lineValue + [Environment]::NewLine
    }

    Set-Content -Path $Path -Value $content -Encoding UTF8
}

function Invoke-Psql {
    param(
        [string]$Database,
        [string]$Sql,
        [string]$FilePath
    )

    $arguments = @(
        "-h", $DbHost,
        "-p", "$DbPort",
        "-U", $DbUser,
        "-d", $Database,
        "-v", "ON_ERROR_STOP=1"
    )

    if ($Sql) {
        $arguments += @("-c", $Sql)
    }

    if ($FilePath) {
        $arguments += @("-f", $FilePath)
    }

    & psql @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Команда psql завершилася з кодом $LASTEXITCODE."
    }
}

Write-Host ""
Write-Host "=== Volunteering Website Local Setup ===" -ForegroundColor Cyan

Assert-CommandExists "node"
Assert-CommandExists "npm"
Assert-CommandExists "psql"

if (-not $DbPassword) {
    $DbPassword = Read-Host "Введіть пароль PostgreSQL для користувача '$DbUser'"
}

if (-not $DbPassword) {
    throw "Пароль PostgreSQL не задано."
}

$env:PGPASSWORD = $DbPassword

Push-Location $repoRoot
try {
    Write-Host ""
    Write-Host "1. Встановлюю npm-залежності..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        throw "npm install завершився з кодом $LASTEXITCODE."
    }

    Write-Host ""
    Write-Host "2. Підготовлюю .env..." -ForegroundColor Yellow
    if (-not (Test-Path $envFile)) {
        Copy-Item $envExampleFile $envFile
        Write-Host "   Створено .env на основі .env.example"
    }

    Set-EnvValue -Path $envFile -Key "DATABASE_URL" -Value ""
    Set-EnvValue -Path $envFile -Key "DB_HOST" -Value $DbHost
    Set-EnvValue -Path $envFile -Key "DB_PORT" -Value "$DbPort"
    Set-EnvValue -Path $envFile -Key "DB_NAME" -Value $DbName
    Set-EnvValue -Path $envFile -Key "DB_USER" -Value $DbUser
    Set-EnvValue -Path $envFile -Key "DB_PASSWORD" -Value $DbPassword
    Set-EnvValue -Path $envFile -Key "APP_BASE_URL" -Value "http://localhost:3000"
    Set-EnvValue -Path $envFile -Key "PORT" -Value "3000"

    Write-Host ""
    Write-Host "3. Перевіряю локальну базу даних..." -ForegroundColor Yellow
    $dbExistsQuery = "SELECT 1 FROM pg_database WHERE datname = '$DbName';"
    $dbExists = & psql -h $DbHost -p $DbPort -U $DbUser -d postgres -t -A -c $dbExistsQuery
    if ($LASTEXITCODE -ne 0) {
        throw "Не вдалося перевірити існування бази даних."
    }

    if (-not $dbExists.Trim()) {
        Write-Host "   База '$DbName' не існує. Створюю..." -ForegroundColor DarkYellow
        Invoke-Psql -Database "postgres" -Sql "CREATE DATABASE `"$DbName`";"
    }
    else {
        Write-Host "   База '$DbName' вже існує."
    }

    $hasAppUserTableQuery = "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_user');"
    $hasAppUserTable = & psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -t -A -c $hasAppUserTableQuery
    if ($LASTEXITCODE -ne 0) {
        throw "Не вдалося перевірити структуру бази."
    }

    $shouldImportDump = $ReimportDump.IsPresent -or ($hasAppUserTable.Trim() -ne "t")

    Write-Host ""
    Write-Host "4. Підготовка структури та даних..." -ForegroundColor Yellow
    if ($shouldImportDump) {
        if (-not (Test-Path $dumpFile)) {
            throw "Файл дампу $dumpFile не знайдено."
        }

        Write-Host "   Імпортую $dumpFile ..." -ForegroundColor DarkYellow
        Invoke-Psql -Database $DbName -FilePath $dumpFile
    }
    else {
        Write-Host "   Таблиці вже існують, імпорт дампу пропущено."
        Write-Host "   Якщо потрібен повний переімпорт, запустіть setup із параметром -ReimportDump."
    }

    Write-Host ""
    Write-Host "Setup завершено успішно." -ForegroundColor Green
    Write-Host ""
    Write-Host "Наступні команди для запуску сайту:"
    Write-Host "  npm start"
    Write-Host ""
    Write-Host "Після запуску відкрий:"
    Write-Host "  http://localhost:3000"
    Write-Host "  http://localhost:3000/health"
}
finally {
    Pop-Location
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
