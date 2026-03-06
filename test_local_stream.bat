@echo off
REM Test-Script für lokale Stream-Erreichbarkeit (Windows)

echo === Test 1: Ping zum lokalen Server ===
ping -n 3 10.0.0.168

echo.
echo === Test 2: Port-Check ===
powershell -Command "Test-NetConnection -ComputerName 10.0.0.168 -Port 61095"

echo.
echo === Test 3: HTTP-Request ===
curl -I -m 5 "http://10.0.0.168:61095/"

echo.
echo === Test 4: Im Docker-Container ===
docker exec streamflow-mod-stream-checker-1 ping -c 2 10.0.0.168

echo.
echo === Diagnose ===
echo Wenn Test 1-3 funktionieren, aber Test 4 fehlschlägt:
echo   -^> Docker-Netzwerk-Problem: Verwende 'network_mode: host' in docker-compose.yml
echo.
echo Wenn alle Tests fehlschlagen:
echo   -^> Server ist down oder Firewall blockiert
echo.
echo Wenn ffmpeg sofort fehlschlägt mit Errors:
echo   -^> Aktiviere DEBUG_MODE=true und prüfe die Logs

pause
