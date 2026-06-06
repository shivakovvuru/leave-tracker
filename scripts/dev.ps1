#requires -Version 5.0
<#
.SYNOPSIS
  Windows-friendly dev runner for Leave Tracker.

.DESCRIPTION
  Equivalent to `npm run dev` but uses PowerShell so colors and Ctrl+C work
  the way Windows users expect. Spawns the Express server and the React
  dev server in two background jobs, prefixes their output, and shuts both
  down cleanly on Ctrl+C.

  Requires Node 18+ to be on PATH.
#>

$ErrorActionPreference = 'Stop'

$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot   = Resolve-Path (Join-Path $scriptDir '..')
$serverDir  = Join-Path $repoRoot 'server'
$clientDir  = Join-Path $repoRoot 'client'

function Write-Step($msg) {
  Write-Host "==> $msg" -ForegroundColor Cyan
}

# --- 1. install dependencies on first run --------------------------------
$needInstall = -not (Test-Path (Join-Path $serverDir 'node_modules')) -or
               -not (Test-Path (Join-Path $clientDir 'node_modules'))
if ($needInstall) {
  Write-Step "Installing client + server dependencies (first run only)..."
  Push-Location $repoRoot
  try { npm run install:all } finally { Pop-Location }
}

# --- 2. start the two processes as background jobs -----------------------
Write-Step "Starting API (port 5000) and React dev server (port 3000)..."
Write-Host "    Press Ctrl+C in this window to stop both." -ForegroundColor DarkGray

$serverJob = Start-Job -Name 'lt-server' -ScriptBlock {
  Set-Location $using:repoRoot
  npm run server
} | Out-Null

$clientJob = Start-Job -Name 'lt-client' -ScriptBlock {
  Set-Location $using:repoRoot
  npm run client
} | Out-Null

# --- 3. stream both jobs' output into this console ----------------------
function Receive-JobOutput {
  while (($serverJob.State -eq 'Running') -or ($clientJob.State -eq 'Running')) {
    if ($serverJob.State -eq 'Running') {
      $out = Receive-Job -Job $serverJob -Keep
      if ($out) { foreach ($line in $out) { Write-Host "[server] $line" -ForegroundColor Cyan } }
    }
    if ($clientJob.State -eq 'Running') {
      $out = Receive-Job -Job $clientJob -Keep
      if ($out) { foreach ($line in $out) { Write-Host "[client] $line" -ForegroundColor Magenta } }
    }
    Start-Sleep -Milliseconds 200
  }
}

# --- 4. handle Ctrl+C and termination cleanly -----------------------------
$null = [Console]::TreatControlCAsInput = $true
$cancel = {
  Write-Step "Stopping..."
  Stop-Job -Job $serverJob -PassThru | Remove-Job -Force
  Stop-Job -Job $clientJob -PassThru | Remove-Job -Force
  exit 0
}
try {
  while (($serverJob.State -eq 'Running') -or ($clientJob.State -eq 'Running')) {
    if ([Console]::KeyAvailable) {
      $key = [Console]::ReadKey($true)
      if ($key.Key -eq 'C' -and $key.Modifiers -band [ConsoleModifiers]::Control) { & $cancel }
    }
    Receive-JobOutput
  }
}
finally {
  if ($serverJob.State -eq 'Running') { Stop-Job -Job $serverJob | Remove-Job -Force }
  if ($clientJob.State -eq 'Running') { Stop-Job -Job $clientJob | Remove-Job -Force }
}

Write-Step "Done."
