<#
.SYNOPSIS
  Builds the Rovatics Arcade apps and collects them in ONE folder using the repo's documented naming:
      <Game>-debug.apk   <Game>-release-TESTKEY.apk   <Game>-release-TESTKEY.aab
  (android/arcade/README.md, "Build outputs"). Then verifies each file (package id, label, version, signature).

.DESCRIPTION
  1. node android/arcade/sync-assets.js        copy + adapt the web games into the app (always re-run after editing a game)
  2. gradlew assemble<Flavor>Debug assemble<Flavor>Release bundle<Flavor>Release
  3. copy to -OutDir, then run aapt2 dump badging and apksigner verify on every file

  Release builds are signed only if android/arcade/keystore.properties exists (git-ignored). Without it this script
  builds the debug APK only and says so: an unsigned release APK cannot be installed.
  The "-TESTKEY" suffix is added when the signing key is a test key (default). Pass -KeyLabel '' once you build with
  the real upload key, so a test-signed file can never be mistaken for a Play-ready one.

.EXAMPLE
  .\Build-ArcadeApks.ps1 -Flavors sceneblocks
  .\Build-ArcadeApks.ps1                       # every flavor found in app\build.gradle
  .\Build-ArcadeApks.ps1 -SkipRelease          # debug only (no keystore needed)
#>
param(
  [string[]]$Flavors = @(),
  [string]$Root = 'C:\Android',           # where Setup-AndroidToolchain.ps1 installed the tools
  [string]$OutDir = '',                    # default: <Root>\arcade-builds
  [string]$KeyLabel = 'TESTKEY',
  [switch]$SkipDebug,
  [switch]$SkipRelease,
  [switch]$SkipSync
)

$ErrorActionPreference = 'Stop'
$arcade = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path 'android\arcade'
if (-not (Test-Path (Join-Path $arcade 'gradlew.bat'))) { throw "Cannot find the arcade project at $arcade" }
if (-not $OutDir) { $OutDir = Join-Path $Root 'arcade-builds' }
New-Item -ItemType Directory -Force $OutDir | Out-Null

$jdk = Join-Path $Root 'jdk-17'; $node = Join-Path $Root 'node'; $sdk = Join-Path $Root 'Sdk'
foreach ($p in @("$jdk\bin\java.exe", "$node\node.exe", "$sdk\platforms\android-35")) {
  if (-not (Test-Path $p)) { throw "Missing $p. Run Setup-AndroidToolchain.ps1 first." }
}
$env:JAVA_HOME = $jdk; $env:ANDROID_HOME = $sdk; $env:ANDROID_SDK_ROOT = $sdk
$env:PATH = "$jdk\bin;$node;$env:PATH"

# local.properties tells Gradle where the SDK is (git-ignored). Forward slashes: backslashes are escapes in .properties files.
$lp = Join-Path $arcade 'local.properties'
if (-not (Test-Path $lp)) { Set-Content $lp ("sdk.dir=" + ($sdk -replace '\\', '/')) -Encoding ascii }

# Flavors: take them from build.gradle so a newly added flavor needs no change here.
$gradleText = Get-Content (Join-Path $arcade 'app\build.gradle') -Raw
$all = [regex]::Matches($gradleText, "(?m)^\s+(\w+)\s*\{\s*dimension\s+'game'") | ForEach-Object { $_.Groups[1].Value }
if ($Flavors.Count -eq 0) { $Flavors = $all }
foreach ($f in $Flavors) { if ($all -notcontains $f) { throw "Unknown flavor '$f'. Known: $($all -join ', ')" } }

$names = @{ sudoku = 'Sudoku'; racers = 'Racers'; beambots = 'BeamBots'; cardclash = 'CardClash'; sceneblocks = 'SceneBlocks' }
function GameName($f) { if ($names.ContainsKey($f)) { $names[$f] } else { (Get-Culture).TextInfo.ToTitleCase($f) } }

$hasKey = Test-Path (Join-Path $arcade 'keystore.properties')
$doRelease = (-not $SkipRelease) -and $hasKey
if ((-not $SkipRelease) -and (-not $hasKey)) {
  Write-Warning "No android\arcade\keystore.properties: building DEBUG only. Create one (see keystore.properties.example) for release APK/AAB."
}

if (-not $SkipSync) {
  Write-Host '== sync-assets =='
  Push-Location $arcade; try { & "$node\node.exe" sync-assets.js; if ($LASTEXITCODE) { throw 'sync-assets.js failed' } } finally { Pop-Location }
}

$tasks = @()
foreach ($f in $Flavors) {
  $F = $f.Substring(0, 1).ToUpper() + $f.Substring(1)
  if (-not $SkipDebug) { $tasks += "assemble${F}Debug" }
  if ($doRelease) { $tasks += "assemble${F}Release"; $tasks += "bundle${F}Release" }
}
if ($tasks.Count -eq 0) { throw 'Nothing to build.' }

Write-Host "== gradle: $($tasks -join ' ') =="
$log = Join-Path $OutDir 'last-build.log'
# Start-Process: real working directory + real exit code, and Gradle's stderr cannot be mistaken for a PowerShell error.
# (cmd /c "cd /d ... && gradlew.bat" does NOT work: cmd's quote stripping mangles it. Push-Location does not
# change the directory a child process inherits either.)
$errLog = "$log.err"
$p = Start-Process -FilePath (Join-Path $arcade 'gradlew.bat') -WorkingDirectory $arcade `
  -ArgumentList ($tasks + '--console=plain') -NoNewWindow -Wait -PassThru `
  -RedirectStandardOutput $log -RedirectStandardError $errLog
$code = $p.ExitCode
Get-Content $errLog -ErrorAction SilentlyContinue | Add-Content $log
Remove-Item $errLog -ErrorAction SilentlyContinue
if ($code -ne 0) { Get-Content $log -Tail 40; throw "Gradle failed (exit $code). Full log: $log" }
Write-Host ((Get-Content $log -Tail 3) -join "`n")

# ---------------------------------------------------------------- collect + verify
$suffix = if ($KeyLabel) { "-$KeyLabel" } else { '' }
$aapt = Join-Path $sdk 'build-tools\34.0.0\aapt2.exe'
$apksigner = Join-Path $sdk 'build-tools\34.0.0\apksigner.bat'
$out = @()
foreach ($f in $Flavors) {
  $g = GameName $f; $o = Join-Path $arcade "app\build\outputs"
  $map = @()
  if (-not $SkipDebug) { $map += , @("$o\apk\$f\debug\app-$f-debug.apk", "$g-debug.apk") }
  if ($doRelease) {
    $map += , @("$o\apk\$f\release\app-$f-release.apk", "$g-release$suffix.apk")
    $map += , @("$o\bundle\${f}Release\app-$f-release.aab", "$g-release$suffix.aab")
  }
  foreach ($m in $map) {
    if (-not (Test-Path $m[0])) { throw "Expected build output not found: $($m[0])" }
    Copy-Item $m[0] (Join-Path $OutDir $m[1]) -Force
    $out += (Join-Path $OutDir $m[1])
  }
}

Write-Host "`n== verification =="
foreach ($p in $out) {
  $item = Get-Item $p
  if ($p -like '*.apk') {
    $b = (& $aapt dump badging $p 2>&1) -join "`n"
    $pkg = [regex]::Match($b, "package: name='([^']+)' versionCode='(\d+)' versionName='([^']*)'")
    $lbl = [regex]::Match($b, "application-label:'([^']*)'")
    $sig = (cmd /c "`"$apksigner`" verify --print-certs `"$p`" 2>&1") -join ' '
    $signed = if ($sig -match 'Verifies' -or $sig -match 'certificate DN') { 'signature OK' } else { "SIGNATURE PROBLEM: $sig" }
    '{0,-34} {1,6:N1} MB  {2} v{3}  "{4}"  {5}' -f $item.Name, ($item.Length / 1MB), $pkg.Groups[1].Value, $pkg.Groups[3].Value, $lbl.Groups[1].Value, $signed
  } else {
    '{0,-34} {1,6:N1} MB  (Play bundle)' -f $item.Name, ($item.Length / 1MB)
  }
}
Write-Host "`nOutput folder: $OutDir"
