param(
  [string]$InitialProcessed = $env:INITIAL_PROCESSED,
  [string]$CdpUrl = $(if ($env:CDP_URL) { $env:CDP_URL } else { "http://127.0.0.1:9222" }),
  [string]$Node = $(if ($env:CODEX_NODE_PATH) { $env:CODEX_NODE_PATH } else { "" }),
  [string]$WorkDir = "",
  [int]$MaxIterations = 20
)

$ErrorActionPreference = "Stop"

if (-not $Node) {
  $Node = "node"
}

if (-not $WorkDir) {
  $candidate = Join-Path (Get-Location).Path "work\browser-tools"
  if (Test-Path -LiteralPath $candidate) {
    $WorkDir = $candidate
  } else {
    $WorkDir = (Get-Location).Path
  }
}

$ScriptDir = $PSScriptRoot
$OpenScript = Join-Path $ScriptDir "open-next-unprocessed-draft.mjs"
$ProcessScript = Join-Path $ScriptDir "process-current-graphics-new-flow.mjs"
$LogDir = Join-Path $WorkDir "doudian-draft-graphics-run"
$LogPath = Join-Path $LogDir ("run-{0}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
$Processed = New-Object System.Collections.Generic.List[string]

if ($InitialProcessed) {
  foreach ($item in $InitialProcessed.Split(",")) {
    $trimmed = $item.Trim()
    if ($trimmed) { $Processed.Add($trimmed) }
  }
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Write-RunLog {
  param([string]$Message)
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
  Write-Output $line
}

Push-Location -LiteralPath $WorkDir
try {
  $env:CDP_URL = $CdpUrl
  $env:BROWSER_TOOLS_DIR = $WorkDir
  Write-RunLog "START Doudian draft graphics flow. Initial processed: $($Processed -join ',')"
  Write-RunLog "WORKDIR $WorkDir"
  Write-RunLog "CDP $CdpUrl"

  for ($i = 1; $i -le $MaxIterations; $i++) {
    $processedCsv = $Processed -join ","
    Write-RunLog "Looking for next product. Processed count: $($Processed.Count)"

    $env:PROCESSED = $processedCsv
    $openOutput = ""
    $openExit = 0
    try {
      $openOutput = & $Node $OpenScript 2>&1 | Out-String
      $openExit = $LASTEXITCODE
    } catch {
      $openOutput = $_ | Out-String
      $openExit = $LASTEXITCODE
    }
    Add-Content -LiteralPath $LogPath -Value $openOutput -Encoding UTF8

    if ($openExit -eq 3) {
      Write-RunLog "DONE no unprocessed visible products remain."
      break
    }
    if ($openExit -ne 0) {
      Write-RunLog "ERROR failed to open next product. Exit=$openExit"
      exit $openExit
    }

    $opened = $openOutput | ConvertFrom-Json
    if ($opened.done) {
      Write-RunLog "DONE open script reported completion."
      break
    }

    Write-RunLog "PROCESS product $($opened.id) from page $($opened.pageNumber), row $($opened.rowIndex): $($opened.rowText)"

    $processOutput = ""
    $processExit = 0
    try {
      $processOutput = & $Node $ProcessScript 0 2>&1 | Out-String
      $processExit = $LASTEXITCODE
    } catch {
      $processOutput = $_ | Out-String
      $processExit = $LASTEXITCODE
    }
    Add-Content -LiteralPath $LogPath -Value $processOutput -Encoding UTF8

    if ($processExit -ne 0) {
      Write-RunLog "ERROR product $($opened.id) failed. Exit=$processExit"
      exit $processExit
    }

    $Processed.Add([string]$opened.id)
    Write-RunLog "DONE product $($opened.id). Processed now: $($Processed -join ',')"
  }

  Write-RunLog "SUMMARY processed IDs: $($Processed -join ',')"
  Write-RunLog "LOG $LogPath"
} finally {
  Pop-Location
}
