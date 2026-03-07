@echo off
echo === Test 1: GET current config ===
curl -s http://localhost:5000/api/stream-checker/config
echo.
echo.

echo === Test 2: UPDATE to legacy ===
curl -s -X PUT http://localhost:5000/api/stream-checker/config -H "Content-Type: application/json" -d "{\"scoring\": {\"method\": \"legacy\"}}"
echo.
echo.

echo === Test 3: GET updated config ===
curl -s http://localhost:5000/api/stream-checker/config
echo.
echo.

echo === Test 4: UPDATE to enhanced ===
curl -s -X PUT http://localhost:5000/api/stream-checker/config -H "Content-Type: application/json" -d "{\"scoring\": {\"method\": \"enhanced\"}}"
echo.
echo.

echo === Test 5: GET final config ===
curl -s http://localhost:5000/api/stream-checker/config
echo.
