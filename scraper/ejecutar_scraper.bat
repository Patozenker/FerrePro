@echo off
title FerrePro - Scraper Universal
cd /d "%~dp0"
echo ===================================================
echo     FERREPRO - EXTRACTOR DE PRODUCTOS
echo ===================================================
echo.
echo Selecciona el modo de ejecucion:
echo  [1] Abrir Interfaz Grafica (Ventana de escritorio)
echo  [2] Ejecutar en Consola (Modo rapido)
echo.
set /p modo="Ingresa 1 o 2 (Enter para 1): "

if "%modo%"=="2" (
    python scraper.py
) else (
    python gui.py
)
pause