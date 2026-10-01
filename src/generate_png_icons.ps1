Add-Type -AssemblyName System.Drawing

function Generate-Finance-Icon($size, $outputPath) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    # 1. Fundo Gradiente Escuro Luxo (Apple Style)
    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $colorTop = [System.Drawing.Color]::FromArgb(255, 15, 23, 42)    # #0f172a
    $colorBottom = [System.Drawing.Color]::FromArgb(255, 4, 7, 18)   # #040712
    $brushBg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $colorTop, $colorBottom, [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal)
    $g.FillRectangle($brushBg, $rect)

    # 2. Círculo Exterior de Brilho Sutil (Esmeralda / Ciano)
    $glowPad = [int]($size * 0.10)
    $glowSize = $size - (2 * $glowPad)
    $glowRect = New-Object System.Drawing.Rectangle($glowPad, $glowPad, $glowSize, $glowSize)
    $glowColor1 = [System.Drawing.Color]::FromArgb(80, 16, 185, 129)
    $glowColor2 = [System.Drawing.Color]::FromArgb(40, 59, 130, 246)
    $brushGlow = New-Object System.Drawing.Drawing2D.LinearGradientBrush($glowRect, $glowColor1, $glowColor2, 45)
    $penGlow = New-Object System.Drawing.Pen($brushGlow, [float]($size * 0.025))
    $g.DrawEllipse($penGlow, $glowRect)

    # 3. Moeda Central em Gradiente Dourado / Esmeralda
    $pad = [int]($size * 0.16)
    $innerSize = $size - (2 * $pad)
    $innerRect = New-Object System.Drawing.Rectangle($pad, $pad, $innerSize, $innerSize)
    
    $gold1 = [System.Drawing.Color]::FromArgb(255, 16, 185, 129) # Verde Esmeralda
    $gold2 = [System.Drawing.Color]::FromArgb(255, 5, 150, 105)  # Esmeralda escuro
    $brushCoin = New-Object System.Drawing.Drawing2D.LinearGradientBrush($innerRect, $gold1, $gold2, [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
    $g.FillEllipse($brushCoin, $innerRect)

    # Borda brilhante na moeda
    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(180, 52, 211, 153), [float]($size * 0.018))
    $g.DrawEllipse($borderPen, $innerRect)

    # 4. Cifrão Grande ($)
    $fontSize = [float]($size * 0.44)
    $font = New-Object System.Drawing.Font("Arial", $fontSize, [System.Drawing.FontStyle]::Bold)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

    # Sombra do Cifrão
    $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(90, 0, 0, 0))
    $shadowRect = New-Object System.Drawing.RectangleF(0, ($size * 0.02), $size, $size)
    $g.DrawString("$", $font, $shadowBrush, $shadowRect, $sf)

    # Cifrão Branco com alto contraste
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $textRect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
    $g.DrawString("$", $font, $textBrush, $textRect, $sf)

    # Salvar arquivo PNG
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Ícone gerado: $outputPath ($size x $size)"
}

$publicDir = "c:\Users\scava\OneDrive\Desktop\PROJETOS\APP financeiro\public"
Generate-Finance-Icon 512 "$publicDir\icon-512.png"
Generate-Finance-Icon 192 "$publicDir\icon-192.png"
Generate-Finance-Icon 180 "$publicDir\apple-touch-icon.png"
