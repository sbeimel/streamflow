@echo off
setlocal enabledelayedexpansion

REM StreamFlow Enhancements Application Script
REM This script applies all StreamFlow enhancements including:
REM - HTTP Proxy Support for M3U Accounts
REM - Channel Quality Preferences
REM - Account Stream Limits for Channel Assignment

echo 🚀 StreamFlow Enhancements Application Script
echo ==============================================
echo.

REM Get script directory
set "SCRIPT_DIR=%~dp0"
set "PATCH_FILE=%SCRIPT_DIR%streamflow_enhancements.patch"

REM Check if we're in the correct directory
if not exist "manage.py" (
    echo ❌ Error: This script must be run from the StreamFlow root directory ^(where manage.py is located^)
    echo    Current directory: %CD%
    echo    Please navigate to your StreamFlow installation directory and run:
    echo    streamflow-dev\apply_streamflow_enhancements.bat
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
set "BACKUP_DIR=streamflow_backup_%dt:~0,8%_%dt:~8,6%"
echo 💾 Creating backup in %BACKUP_DIR%...
mkdir "%BACKUP_DIR%" 2>nul

REM Backup files that will be modified
echo    Backing up files...
if exist "backend" (
    xcopy "backend" "%BACKUP_DIR%\backend\" /E /I /Q >nul 2>&1
) else (
    echo    - backend directory not found, skipping
)

if exist "frontend" (
    xcopy "frontend" "%BACKUP_DIR%\frontend\" /E /I /Q >nul 2>&1
) else (
    echo    - frontend directory not found, skipping
)

echo ✅ Backup created successfully
echo.

REM Apply the patch
echo 🔧 Applying StreamFlow enhancements patch...

REM Try git apply first
git apply --check "%PATCH_FILE%" >nul 2>&1
if !errorlevel! equ 0 (
    git apply "%PATCH_FILE%"
    if !errorlevel! equ 0 (
        echo ✅ Patch applied successfully using git apply
        goto :success
    )
)

REM Try patch command if available
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

REM If we get here, patch failed
echo ❌ Error: Patch could not be applied cleanly
echo    This might be due to:
echo    - Files already modified
echo    - Different StreamFlow version
echo    - Conflicting changes
echo.
echo    Manual application may be required.
echo    Backup is available in: %BACKUP_DIR%
pause
exit /b 1

:success
echo.
echo 🎉 StreamFlow Enhancements Applied Successfully!
echo ===============================================
echo.
echo 📋 Applied Features:
echo    ✅ HTTP Proxy Support for M3U Accounts
echo    ✅ Channel Quality Preferences ^(4K control per channel^)
echo    ✅ Account Stream Limits for Channel Assignment
echo.
echo 🔄 Next Steps:
echo    1. Restart your StreamFlow backend service
echo    2. Rebuild your frontend ^(if using a build process^)
echo    3. Check the new features in:
echo       - M3U Accounts: HTTP Proxy field
echo       - Channel Configuration: Quality Preference dropdown
echo       - Stream Checker: Account Limits tab
echo.
echo 📚 Documentation:
echo    - HTTP Proxy: streamflow-dev\STREAMFLOW_HTTP_PROXY_PATCH_README.md
echo    - Quality Preferences: streamflow-dev\CHANNEL_QUALITY_PREFERENCES_README.md
echo    - Account Limits: streamflow-dev\ACCOUNT_STREAM_LIMITS_README.md
echo.
echo 💾 Backup Location: %BACKUP_DIR%
echo.
echo 🎯 Enjoy your enhanced StreamFlow experience!
echo.
pause