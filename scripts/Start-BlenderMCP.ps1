$ErrorActionPreference = 'Stop'
$workspace = Split-Path $PSScriptRoot -Parent
$listener = Get-NetTCPConnection -LocalPort 9876 -State Listen -ErrorAction SilentlyContinue
if ($listener) {
    $owner = Get-Process -Id $listener[0].OwningProcess
    if ($owner.ProcessName -eq 'blender') { Write-Host 'Blender MCP 已在本機 9876 埠執行。'; exit 0 }
    throw '9876 埠由其他程式使用，未啟動新的 Blender。'
}
$blender = Get-ChildItem -LiteralPath "$env:ProgramFiles/Blender Foundation" -Filter blender.exe -Recurse | Sort-Object FullName -Descending | Select-Object -First 1
if (-not $blender) { throw '找不到已安裝的 Blender。' }
$bootstrap = Join-Path $PSScriptRoot 'blender-mcp-launch.py'
New-Item -ItemType Directory -Force (Join-Path $workspace 'artifacts') | Out-Null
$env:DISABLE_TELEMETRY = 'true'
Start-Process -FilePath $blender.FullName -ArgumentList @('--python', ('"{0}"' -f $bootstrap)) -WorkingDirectory $workspace -WindowStyle Hidden -RedirectStandardOutput (Join-Path $workspace 'artifacts/blender-mcp.log') -RedirectStandardError (Join-Path $workspace 'artifacts/blender-mcp-error.log')
Write-Host 'Blender 已啟動；等待外掛載入後即可使用 MCP。'
