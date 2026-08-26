@echo off
title Ferreteria Pro v6.2
color 0A
echo.
echo  ====================================
echo    FERRETERIA PRO - v6.2  by Zencio
echo    SQLite Database Edition
echo  ====================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js no esta instalado — https://nodejs.org
    pause & exit /b 1
)

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Python no esta instalado — https://python.org
    pause & exit /b 1
)

cd /d "%~dp0"

if not exist "node_modules" (
    echo  [OK] Instalando dependencias de Node.js...
    call npm install
    echo.
)

if not exist "scraper\venv" (
    echo  [OK] Creando entorno virtual de Python...
    python -m venv scraper\venv
    echo.
)

echo  [OK] Instalando dependencias del scraper...
call scraper\venv\Scripts\pip install -r scraper\requirements.txt >nul 2>&1
echo.

if not exist "src\data\db" mkdir "src\data\db"

echo  [OK] Iniciando base de datos SQLite en puerto 3001...
start "Ferreteria DB" /min cmd /c "node server.js"
timeout /t 1 /nobreak >nul

echo  [OK] Iniciando servidor de scraping en puerto 8005...
start "Scraper" /min cmd /c "cd /d "%~dp0scraper" && venv\Scripts\python -m uvicorn app:app --host 127.0.0.1 --port 8005"
timeout /t 1 /nobreak >nul

echo.
echo  [OK] Iniciando Ferreteria Pro...
echo  Abre en:  http://localhost:5173
echo  Base de datos: src\data\db\ferreteria.db
echo  Scraper:      http://127.0.0.1:8005
echo.

start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5173"
call npm run dev
