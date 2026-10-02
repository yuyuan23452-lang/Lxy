param(
  [ValidateSet('doudian-draft-graphics','doudian-draft-publisher','desktop-character-pack-factory','all')]
  [string]$Skill = 'doudian-draft-graphics',
  [string]$Destination = (Join-Path $env:USERPROFILE '.agents\skills')
)
$ErrorActionPreference = 'Stop'
$repoPath = Split-Path -Parent $PSScriptRoot
$names = @($Skill)
if ($Skill -eq 'all') {
  $names = @('doudian-draft-graphics','doudian-draft-publisher','desktop-character-pack-factory')
}
foreach ($name in $names) {
  $targetPath = Join-Path $Destination $name
  if (Test-Path -LiteralPath $targetPath) { throw "Target already exists; no files copied: $targetPath" }
  if (-not (Test-Path -LiteralPath (Join-Path $repoPath "skills\$name\SKILL.md"))) { throw "Missing skill: $name" }
}
New-Item -ItemType Directory -Path $Destination -Force | Out-Null
foreach ($name in $names) {
  $targetPath = Join-Path $Destination $name
  Copy-Item -LiteralPath (Join-Path $repoPath "skills\$name") -Destination $targetPath -Recurse
  Write-Output "Installed: $name"
  Write-Output "Location: $targetPath"
}
Write-Output 'Installation complete. No store workflow was executed.'
