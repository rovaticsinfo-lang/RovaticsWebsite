<#
.SYNOPSIS
  One-time, per-user (no admin) toolchain for building the Rovatics Arcade APKs on Windows:
  JDK 17, Node.js LTS, and the Android SDK (platform 35 + build-tools 34 + platform-tools).

.DESCRIPTION
  Everything is downloaded from the official sources, CHECKSUM-VERIFIED, and unpacked under -Root (default C:\Android):
      <Root>\jdk-17   <Root>\node   <Root>\Sdk   <Root>\keys (created for you, empty)
  Safe to re-run: anything already present is skipped.

  Why zips and not winget/installers: winget's Temurin and Node packages are machine-wide MSIs
  ("No applicable installer" with --scope user) and would need an admin prompt.

  Why command-line tools 11076708 and not the newest: current cmdline-tools replace sdkmanager with a new
  "Android CLI" that downloads its own runtime and failed here ("Unable to load jimage library").
  11076708 (sdkmanager 12.0) is the last release with the classic, reliable sdkmanager.

  Running this means you ACCEPT the Android SDK licence (it answers "y" for you), so only run it if you do.
  Needs Windows PowerShell 5.1 or newer and internet access. ~700 MB download, ~3 GB on disk.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File Setup-AndroidToolchain.ps1
  powershell -ExecutionPolicy Bypass -File Setup-AndroidToolchain.ps1 -Root D:\Android -WriteLocalProperties
#>
param(
  [string]$Root = 'C:\Android',
  [string]$NodeMajor = '22',
  [string]$CmdlineToolsBuild = '11076708',
  [switch]$WriteLocalProperties   # also write android\arcade\local.properties (sdk.dir) in the repo this script lives in
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'     # Invoke-WebRequest is ~10x faster without the progress bar

$dl = Join-Path $Root '_dl'
New-Item -ItemType Directory -Force $Root, $dl, (Join-Path $Root 'keys') | Out-Null

function Download([string]$url, [string]$file) {
  if (Test-Path $file) { Remove-Item $file -Force }
  Write-Host "  downloading $url"
  Invoke-WebRequest -Uri $url -OutFile $file -UseBasicParsing
}
function Check([string]$what, [string]$expected, [string]$actual) {
  if (-not $expected) { throw "No official checksum found for $what - refusing to install an unverified download." }
  if ($expected.ToLower() -ne $actual.ToLower()) { throw "$what checksum MISMATCH (expected $expected, got $actual). Not installing." }
  Write-Host "  $what checksum OK"
}
function Unzip([string]$zip, [string]$intoDir, [string]$expectedTopFolderPattern, [string]$finalName) {
  $tmp = Join-Path $Root '_x'
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $top = Get-ChildItem $tmp -Directory | Where-Object { $_.Name -like $expectedTopFolderPattern } | Select-Object -First 1
  if (-not $top) { throw "Unexpected archive layout in $zip" }
  Move-Item $top.FullName (Join-Path $intoDir $finalName)
  Remove-Item $tmp -Recurse -Force
}

# ------------------------------------------------------------------ JDK 17 (Eclipse Temurin)
$jdk = Join-Path $Root 'jdk-17'
if (Test-Path "$jdk\bin\java.exe") { Write-Host "[1/4] JDK 17 already present" }
else {
  Write-Host '[1/4] JDK 17 (Eclipse Temurin)'
  $meta = Invoke-RestMethod 'https://api.adoptium.net/v3/assets/latest/17/hotspot?architecture=x64&image_type=jdk&os=windows&vendor=eclipse'
  $pkg = $meta[0].binary.package                  # the .zip package (binary.installer is the .msi - do not use its checksum)
  $zip = Join-Path $dl 'jdk17.zip'
  Download $pkg.link $zip
  Check 'JDK' $pkg.checksum (Get-FileHash $zip -Algorithm SHA256).Hash
  Unzip $zip $Root 'jdk-17*' 'jdk-17'
}

# ------------------------------------------------------------------ Node.js LTS (needed by sync-assets.js and the tests)
$node = Join-Path $Root 'node'
if (Test-Path "$node\node.exe") { Write-Host "[2/4] Node already present" }
else {
  Write-Host "[2/4] Node.js v$NodeMajor LTS"
  $idx = Invoke-RestMethod 'https://nodejs.org/dist/index.json'
  $ver = ($idx | Where-Object { $_.version -like "v$NodeMajor.*" -and $_.lts } | Select-Object -First 1).version
  if (-not $ver) { throw "No LTS release found for Node $NodeMajor" }
  $name = "node-$ver-win-x64.zip"
  $zip = Join-Path $dl 'node.zip'
  Download "https://nodejs.org/dist/$ver/$name" $zip
  $sums = (Invoke-WebRequest "https://nodejs.org/dist/$ver/SHASUMS256.txt" -UseBasicParsing).Content -split "`n"
  $line = $sums | Where-Object { $_ -match [regex]::Escape($name) } | Select-Object -First 1
  Check 'Node' ($line -split '\s+')[0] (Get-FileHash $zip -Algorithm SHA256).Hash
  Unzip $zip $Root 'node-v*' 'node'
}

# ------------------------------------------------------------------ Android command-line tools
$sdk = Join-Path $Root 'Sdk'
$sdkmgr = Join-Path $sdk 'cmdline-tools\latest\bin\sdkmanager.bat'
if (Test-Path $sdkmgr) { Write-Host "[3/4] Android command-line tools already present" }
else {
  Write-Host "[3/4] Android command-line tools $CmdlineToolsBuild"
  $repoXml = Join-Path $dl 'repository2-3.xml'
  Download 'https://dl.google.com/android/repository/repository2-3.xml' $repoXml
  [xml]$x = Get-Content $repoXml -Raw
  $file = "commandlinetools-win-${CmdlineToolsBuild}_latest.zip"
  $archive = $x.SelectNodes('//archive') | Where-Object { $_.complete.url -eq $file } | Select-Object -First 1
  if (-not $archive) { throw "$file is not listed in Google's repository manifest any more; pick another -CmdlineToolsBuild." }
  $zip = Join-Path $dl 'cmdtools.zip'
  Download "https://dl.google.com/android/repository/$file" $zip
  Check 'cmdline-tools' $archive.complete.checksum.'#text' (Get-FileHash $zip -Algorithm SHA1).Hash
  New-Item -ItemType Directory -Force (Join-Path $sdk 'cmdline-tools') | Out-Null
  $tmp = Join-Path $Root '_x'; if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  Expand-Archive $zip -DestinationPath $tmp -Force
  Move-Item (Join-Path $tmp 'cmdline-tools') (Join-Path $sdk 'cmdline-tools\latest')
  Remove-Item $tmp -Recurse -Force
}

# ------------------------------------------------------------------ SDK packages + licences
$env:JAVA_HOME = $jdk
$have = (Test-Path "$sdk\platforms\android-35") -and (Test-Path "$sdk\build-tools\34.0.0") -and (Test-Path "$sdk\platform-tools\adb.exe")
if ($have) { Write-Host "[4/4] SDK packages already present" }
else {
  Write-Host '[4/4] SDK packages (accepting the Android SDK licence)'
  # Piping "y" into the .bat does not reach the prompt; redirecting a file through cmd does.
  $yes = Join-Path $dl 'yes.txt'
  (1..40 | ForEach-Object { 'y' }) | Set-Content -Path $yes -Encoding ascii
  cmd /c "`"$sdkmgr`" --sdk_root=`"$sdk`" --licenses < `"$yes`"" | Out-Null
  cmd /c "`"$sdkmgr`" --sdk_root=`"$sdk`" platform-tools `"platforms;android-35`" `"build-tools;34.0.0`"" | Select-Object -Last 3
}

# ------------------------------------------------------------------ verify
Write-Host ''
# java -version prints to stderr; under $ErrorActionPreference='Stop' PowerShell would treat that as a failure, so go through cmd.
Write-Host ((cmd /c "`"$jdk\bin\java.exe`" -version 2>&1") | Select-Object -First 1)
Write-Host ("node " + (& "$node\node.exe" --version))
foreach ($p in @("$sdk\platforms\android-35", "$sdk\build-tools\34.0.0\aapt2.exe", "$sdk\platform-tools\adb.exe")) {
  if (-not (Test-Path $p)) { throw "Missing after install: $p" }
}
Write-Host "Android SDK OK at $sdk"

if ($WriteLocalProperties) {
  $arcade = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path 'android\arcade'
  $sdkFwd = $sdk -replace '\\', '/'        # forward slashes: backslashes are escape characters in .properties files
  Set-Content -Path (Join-Path $arcade 'local.properties') -Value "sdk.dir=$sdkFwd" -Encoding ascii
  Write-Host "wrote $arcade\local.properties"
}
Write-Host ''
Write-Host "Next: Build-ArcadeApks.ps1 -Root $Root"
