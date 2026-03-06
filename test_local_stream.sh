#!/bin/bash
# Test-Script für lokale Stream-Erreichbarkeit

echo "=== Test 1: Ping zum lokalen Server ==="
ping -c 3 10.0.0.168

echo ""
echo "=== Test 2: Port-Check ==="
nc -zv 10.0.0.168 61095 2>&1 || echo "Port nicht erreichbar!"

echo ""
echo "=== Test 3: HTTP-Request ==="
curl -I -m 5 "http://10.0.0.168:61095/" 2>&1

echo ""
echo "=== Test 4: ffmpeg Stream-Test (5 Sekunden) ==="
# Ersetze [stream_id] mit einer echten Stream-ID
STREAM_URL="http://10.0.0.168:61095/jexhammer/vmesa123/ce5b8b51beda46caae3f5dfe3b9395a7_1742.ts"
echo "Testing: $STREAM_URL"
timeout 10 ffmpeg -user_agent "VLC/3.0.14" -i "$STREAM_URL" -t 5 -f null - 2>&1 | tail -20

echo ""
echo "=== Test 5: Im Docker-Container ==="
docker exec streamflow-mod-stream-checker-1 ping -c 2 10.0.0.168 2>&1 || echo "Container kann 10.0.0.168 nicht erreichen!"

echo ""
echo "=== Diagnose ==="
echo "Wenn Test 1-4 funktionieren, aber Test 5 fehlschlägt:"
echo "  → Docker-Netzwerk-Problem: Verwende 'network_mode: host' in docker-compose.yml"
echo ""
echo "Wenn alle Tests fehlschlagen:"
echo "  → Server ist down oder Firewall blockiert"
echo ""
echo "Wenn ffmpeg sofort fehlschlägt mit Errors:"
echo "  → Aktiviere DEBUG_MODE=true und prüfe die Logs"
