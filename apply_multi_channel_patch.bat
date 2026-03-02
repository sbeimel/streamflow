@echo off
setlocal enabledelayedexpansion

REM Multi-Channel Parallel Processing Patch Application Script
REM Applies only the Multi-Channel Processing feature to StreamFlow

echo 🚀 Multi-Channel Parallel Processing Patch
echo ==========================================
echo.

set "SCRIPT_DIR=%~dp0"
set "PATCH_FILE=%SCRIPT_DIR%multi_channel_processing.patch"

REM Check if we're in the correct directory
if not exist "manage.py" (
    echo ❌ Error: This script must be run from the StreamFlow root directory
    echo    Current directory: %CD%
    pause
    exit /b 1
)

REM Check if patch file exists
if not exist "%PATCH_FILE%" (
    echo ❌ Error: Patch file not found at %PATCH_FILE%
    pause
    exit /b 1
)

echo 📁 Current directory: %CD%
echo 📄 Patch file: %PATCH_FILE%
echo.

REM Create backup
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "BACKUP_DIR=multi_channel_backup_%dt:~0,8%_%dt:~8,6%"
echo 💾 Creating backup in %BACKUP_DIR%...
mkdir "%BACKUP_DIR%" 2>nul

echo    Backing up files...
if exist "backend\stream_checker_service.py" (
    copy "backend\stream_checker_service.py" "%BACKUP_DIR%\" >nul 2>&1
)
if exist "frontend\src\pages\AutomationSettings.jsx" (
    copy "frontend\src\pages\AutomationSettings.jsx" "%BACKUP_DIR%\" >nul 2>&1
)

echo ✅ Backup created successfully
echo.

REM Apply the patch
echo 🔧 Applying Multi-Channel Processing patch...

git apply --check "%PATCH_FILE%" >nul 2>&1
if !errorlevel! equ 0 (
    git apply "%PATCH_FILE%"
    if !errorlevel! equ 0 (
        echo ✅ Patch applied successfully using git apply
        goto :success
    )
)

where patch >nul 2>&1
if !errorlevel! equ 0 (
    patch --dry-run -p1 < "%PATCH_FILE%" >nul 2>&1
    if !errorlevel! equ 0 (
        patch -p1 < "%PATCH_FILE%"
        if !errorlevel! equ 0 (
            echo ✅ Patch applied successfully using patch command
            goto :success
        )
    )
)

echo ❌ Error: Patch could not be applied cleanly
echo    Backup is available in: %BACKUP_DIR%
pause
exit /b 1

:success
echo.
echo 🎉 Multi-Channel Processing Applied Successfully!
echo ================================================
echo.
echo ✨ New Feature:
echo    • Check multiple channels simultaneously
echo    • Dynamic channel processing
echo    • Auto-calculate optimal channel count
echo    • Respects all limits ^(Global, Account, Profile^)
echo.
echo 🔄 Next Steps:
echo    1. Restart backend: docker-compose restart backend
echo    2. Rebuild frontend: docker-compose restart frontend
echo    3. Go to: Automation Settings → Stream Checker
echo    4. Find: Multi-Channel Parallel Processing card
echo    5. Toggle ON and click 'Auto' button
echo.
echo 📚 Documentation: MULTI_CHANNEL_PROCESSING_PATCH_README.md
echo 💾 Backup: %BACKUP_DIR%
echo.
echo 🎯 Enjoy faster channel checking!
echo.
pause
