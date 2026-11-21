<#
.SYNOPSIS
  Draws the Scene Blocks artwork (a descending staircase of glossy blocks) as a 432x432 transparent PNG.
  This is the per-game half of the icon pipeline: New-ArcadeIcons.ps1 turns the glyph into every icon size.
  Use it as a template for another game: keep the 432x432 canvas and the central ~66% safe zone, change the drawing.
#>
param([Parameter(Mandatory = $true)][string]$Out)

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

function C([string]$hex, [int]$a = 255) {
  $h = $hex.TrimStart('#')
  [System.Drawing.Color]::FromArgb($a, [Convert]::ToInt32($h.Substring(0, 2), 16), [Convert]::ToInt32($h.Substring(2, 2), 16), [Convert]::ToInt32($h.Substring(4, 2), 16))
}
function Tint($c, [double]$toward, [double]$t) {
  [System.Drawing.Color]::FromArgb(255, [int]($c.R + ($toward - $c.R) * $t), [int]($c.G + ($toward - $c.G) * $t), [int]($c.B + ($toward - $c.B) * $t))
}
function RoundPath([single]$x, [single]$y, [single]$w, [single]$h, [single]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath; $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90); $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90); $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90); $p.CloseFigure(); $p
}

$bmp = New-Object System.Drawing.Bitmap(432, 432, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'

# (column,row,colour): a descending staircase. The empty bottom-right corner is where the Rovatics badge sits.
$cells = @(
  @(0, 0, '#ff6b6b'), @(1, 0, '#ffc233'), @(2, 0, '#5fd97a'),
  @(0, 1, '#a97dff'), @(1, 1, '#4dabf7'),
  @(0, 2, '#ff9f43')
)
$s = 78; $gap = 8; $x0 = 84; $y0 = 84
foreach ($cell in $cells) {
  $x = $x0 + $cell[0] * ($s + $gap); $y = $y0 + $cell[1] * ($s + $gap); $col = C $cell[2]
  # soft drop shadow
  $g.FillPath((New-Object System.Drawing.SolidBrush((C '#000000' 55))), (RoundPath ($x + 1) ($y + 7) $s $s 18))
  # body: light top to darker bottom
  $rect = New-Object System.Drawing.RectangleF($x, $y, $s, $s)
  $br = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, (Tint $col 255 0.30), (Tint $col 0 0.28), 90.0)
  $g.FillPath($br, (RoundPath $x $y $s $s 18))
  # gloss strip
  $g.FillPath((New-Object System.Drawing.SolidBrush((C '#ffffff' 80))), (RoundPath ($x + 12) ($y + 8) ($s - 24) 14 7))
}
$g.Dispose()
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "wrote $Out"
