@echo off
title APP Financeiro Saulo (iOS PWA)
color 0B

echo ===================================================
echo         INICIANDO APP FINANCEIRO SAULO (iOS PWA)
echo ===================================================
echo.
echo Abrindo o painel no navegador...
timeout /t 2 /nobreak >nul
start http://localhost:3000
echo.
echo Servidor ativo!
echo Para acessar no seu iPhone pela mesma rede Wi-Fi, 
echo veja o IP do seu computador ou use o link da nuvem.
echo.
node src/server.js
pause
