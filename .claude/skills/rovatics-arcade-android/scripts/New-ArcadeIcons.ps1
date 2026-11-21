<#
.SYNOPSIS
  Generates every icon/graphic a new Rovatics Arcade flavor needs from ONE glyph image.

.DESCRIPTION
  Input : a 432x432 transparent PNG with the game's artwork inside the central ~66% (the adaptive-icon safe zone).
  Output (matching what the existing sudoku/racers/beambots/cardclash flavors ship):
    android/arcade/app/src/<flavor>/res/drawable/ic_launcher_foreground.png        432x432  (glyph + Rovatics badge)
    android/arcade/app/src/<flavor>/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher.png        48..192
    android/arcade/app/src/<flavor>/res/mipmap-{...}/ic_launcher_round.png                             circle, alpha
    android/arcade/app/src/<flavor>/res/mipmap-anydpi-v26/ic_launcher.xml + ic_launcher_round.xml      adaptive
    android/arcade/play-assets/<flavor>/icon-512.png                                512x512
    android/arcade/play-assets/<flavor>/feature-graphic-1024x500.png

  It does NOT write colors.xml: set  ic_launcher_background  there to the same value as -Bg1.

  Needs Windows PowerShell 5.1 (System.Drawing). Keep this file ASCII-only: PowerShell 5.1 misreads
  BOM-less UTF-8, so non-ASCII characters are built with [char] codes below.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File New-ArcadeIcons.ps1 -Flavor sceneblocks -Glyph glyph.png `
     -Title "Scene Blocks" -Tagline "1000 puzzle levels in living worlds" -Bg1 "#0f6f86" -Bg2 "#19b5c9" -Accent "#7CF5C8"
#>
param(
  [Parameter(Mandatory = $true)][string]$Flavor,
  [Parameter(Mandatory = $true)][string]$Glyph,
  [Parameter(Mandatory = $true)][string]$Title,
  [Parameter(Mandatory = $true)][string]$Tagline,
  [string]$Bg1 = '#0f6f86',     # darker corner of the icon gradient; also the adaptive-icon background colour
  [string]$Bg2 = '#19b5c9',     # lighter corner
  [string]$Accent = '#42E8F5',  # tagline colour and glow on the feature graphic
  [string]$ArcadeDir = ''
)

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

if (-not $ArcadeDir) {
  # <repo>/.claude/skills/rovatics-arcade-android/scripts  ->  <repo>/android/arcade
  $ArcadeDir = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path 'android\arcade'
}
if (-not (Test-Path (Join-Path $ArcadeDir 'app'))) { throw "Not an arcade project folder: $ArcadeDir" }

$resDir  = Join-Path $ArcadeDir "app\src\$Flavor\res"
$playDir = Join-Path $ArcadeDir "play-assets\$Flavor"
$logoPng = Join-Path $ArcadeDir 'web-overrides\vendor\logo.png'
foreach ($p in @($Glyph, $logoPng)) { if (-not (Test-Path $p)) { throw "Missing input: $p" } }
foreach ($d in @("$resDir\drawable", "$resDir\mipmap-anydpi-v26", $playDir)) { New-Item -ItemType Directory -Force $d | Out-Null }

# ---------------------------------------------------------------- helpers
function C([string]$hex, [int]$a = 255) {
  $h = $hex.TrimStart('#')
  [System.Drawing.Color]::FromArgb($a, [Convert]::ToInt32($h.Substring(0, 2), 16), [Convert]::ToInt32($h.Substring(2, 2), 16), [Convert]::ToInt32($h.Substring(4, 2), 16))
}
function MixC($c, [double]$toward, [double]$t) {      # blend colour $c toward grey level $toward (0=black,255=white)
  [System.Drawing.Color]::FromArgb(255, [int]($c.R + ($toward - $c.R) * $t), [int]($c.G + ($toward - $c.G) * $t), [int]($c.B + ($toward - $c.B) * $t))
}
function NewBmp([int]$w, [int]$h, [bool]$alpha) {
  $fmt = if ($alpha) { [System.Drawing.Imaging.PixelFormat]::Format32bppArgb } else { [System.Drawing.Imaging.PixelFormat]::Format24bppRgb }
  New-Object System.Drawing.Bitmap($w, $h, $fmt)
}
function Gfx($bmp) {
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = 'HighQualityBicubic'
  $g.PixelOffsetMode = 'HighQuality'; $g.CompositingQuality = 'HighQuality'; $g.TextRenderingHint = 'AntiAliasGridFit'
  $g
}
function RoundPath([single]$x, [single]$y, [single]$w, [single]$h, [single]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath; $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90); $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90); $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90); $p.CloseFigure(); $p
}
function SavePng($bmp, [string]$path) { $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png); Write-Host ('  wrote ' + $path.Replace($ArcadeDir + '\', '')) }
function Fit([System.Drawing.Graphics]$g, [string]$text, [string]$family, $style, [single]$maxPx, [single]$maxW) {
  for ($s = $maxPx; $s -ge 12; $s -= 1) {
    $f = New-Object System.Drawing.Font($family, [single]$s, $style, [System.Drawing.GraphicsUnit]::Pixel)
    if ($g.MeasureString($text, $f).Width -le $maxW) { return $f }
    $f.Dispose()
  }
  New-Object System.Drawing.Font($family, 12.0, $style, [System.Drawing.GraphicsUnit]::Pixel)
}

$c1 = C $Bg1; $c2 = C $Bg2
$glyphImg = [System.Drawing.Image]::FromFile((Resolve-Path $Glyph).Path)
$logoImg  = [System.Drawing.Image]::FromFile($logoPng)

# ---------------------------------------------------------------- adaptive foreground: glyph + Rovatics badge
$fg = NewBmp 432 432 $true
$g = Gfx $fg
$g.DrawImage($glyphImg, 0, 0, 432, 432)
$D = 88; $ring = 5; $cx = 298; $cy = 318                         # badge diameter, white ring, centre (inside the safe zone)
$shadow = New-Object System.Drawing.SolidBrush((C '#000000' 70))
$g.FillEllipse($shadow, $cx - $D / 2 - $ring + 2, $cy - $D / 2 - $ring + 4, $D + 2 * $ring, $D + 2 * $ring)
$g.FillEllipse([System.Drawing.Brushes]::White, $cx - $D / 2 - $ring, $cy - $D / 2 - $ring, $D + 2 * $ring, $D + 2 * $ring)
$g.DrawImage($logoImg, $cx - $D / 2, $cy - $D / 2, $D, $D)
$g.Dispose()
SavePng $fg "$resDir\drawable\ic_launcher_foreground.png"

# ---------------------------------------------------------------- legacy square icon (gradient + foreground scaled up)
function LegacyMaster([int]$size) {
  $b = NewBmp $size $size $false; $gg = Gfx $b
  $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
  $br = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 45.0)
  $gg.FillRectangle($br, $rect)
  # 1.08 keeps the artwork AND the Rovatics badge inside the circle the round icon is cropped to
  # (1.3 looked bigger but pushed the artwork to the edge and the round crop cut the badge off).
  $s = $size * 1.08; $o = ($size - $s) / 2
  $gg.DrawImage($fg, [single]$o, [single]$o, [single]$s, [single]$s)
  $gg.Dispose(); $b
}
$master = LegacyMaster 512
SavePng $master "$playDir\icon-512.png"

$dens = [ordered]@{ mdpi = 48; hdpi = 72; xhdpi = 96; xxhdpi = 144; xxxhdpi = 192 }
foreach ($k in $dens.Keys) {
  $px = $dens[$k]; $dir = "$resDir\mipmap-$k"; New-Item -ItemType Directory -Force $dir | Out-Null
  $sq = NewBmp $px $px $false; $gs = Gfx $sq; $gs.DrawImage($master, 0, 0, $px, $px); $gs.Dispose()
  SavePng $sq "$dir\ic_launcher.png"
  $rd = NewBmp $px $px $true; $gr = Gfx $rd
  $clip = New-Object System.Drawing.Drawing2D.GraphicsPath; $clip.AddEllipse(0, 0, $px - 1, $px - 1)
  $gr.SetClip($clip); $gr.DrawImage($master, 0, 0, $px, $px); $gr.Dispose()
  SavePng $rd "$dir\ic_launcher_round.png"
  $sq.Dispose(); $rd.Dispose()
}

# adaptive icon xml (identical for every flavor; the colour comes from the flavor's colors.xml)
$xml = @'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
    <monochrome android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>
'@
foreach ($n in 'ic_launcher.xml', 'ic_launcher_round.xml') {
  [System.IO.File]::WriteAllText("$resDir\mipmap-anydpi-v26\$n", ($xml -replace "`r?`n", "`r`n"), (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "  wrote app\src\$Flavor\res\mipmap-anydpi-v26\$n"
}

# ---------------------------------------------------------------- Play feature graphic 1024x500
$fgb = NewBmp 1024 500 $false; $gf = Gfx $fgb
$dark = MixC $c1 0 0.80; $mid = MixC $c1 0 0.55
$rect = New-Object System.Drawing.Rectangle(0, 0, 1024, 500)
$bgBr = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $dark, $mid, 0.0)
$gf.FillRectangle($bgBr, $rect)
$gp = New-Object System.Drawing.Drawing2D.GraphicsPath; $gp.AddEllipse(540, -250, 900, 760)
$pg = New-Object System.Drawing.Drawing2D.PathGradientBrush($gp)
$pg.CenterColor = C $Accent 70; $pg.SurroundColors = @((C $Accent 0))
$gf.FillPath($pg, $gp)
# rounded icon tile on the left
$tile = RoundPath 82 126 248 248 56
$gf.SetClip($tile); $gf.DrawImage($master, 82, 126, 248, 248); $gf.ResetClip()
$white = [System.Drawing.Brushes]::White
$bold = [System.Drawing.FontStyle]::Bold
$maxW = 1024 - 375 - 40
$fTitle = Fit $gf $Title 'Segoe UI' $bold 76 $maxW
$fTag   = Fit $gf $Tagline 'Segoe UI' $bold 30 $maxW
$dot    = [string][char]0x00B7
$line3  = "Free  $dot  No ads  $dot  Works offline"
$f3     = Fit $gf $line3 'Segoe UI' $bold 30 $maxW
$f4     = Fit $gf 'by Rovatics' 'Segoe UI' $bold 30 $maxW
$gf.DrawString($Title, $fTitle, $white, 372, 138)
$gf.DrawString($Tagline, $fTag, (New-Object System.Drawing.SolidBrush((C $Accent))), 375, 244)
$gf.DrawString($line3, $f3, (New-Object System.Drawing.SolidBrush((C '#aec3ea'))), 375, 310)
$gf.DrawString('by Rovatics', $f4, (New-Object System.Drawing.SolidBrush((C '#8fa8d8'))), 375, 372)
$gf.Dispose()
SavePng $fgb "$playDir\feature-graphic-1024x500.png"

foreach ($o in @($fg, $master, $fgb, $glyphImg, $logoImg)) { $o.Dispose() }
Write-Host ''
Write-Host "Done. Now set  <color name=""ic_launcher_background"">$Bg1</color>  in app\src\$Flavor\res\values\colors.xml"
