#!/usr/bin/env bash
# 轻记 API 冒烟：需先启动 uvicorn
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:8000}"

echo "== health =="
curl -sS "$BASE/health"
echo

echo "== login =="
LOGIN=$(curl -sS -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"code":"dev"}')
echo "$LOGIN"
TOKEN=$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['token'])" "$LOGIN")

echo "== books =="
curl -sS "$BASE/api/books" -H "Authorization: Bearer $TOKEN"
echo

BOOK_ID=$(curl -sS "$BASE/api/books" -H "Authorization: Bearer $TOKEN" | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['id'])")

echo "== categories =="
curl -sS "$BASE/api/categories?book_id=$BOOK_ID" -H "Authorization: Bearer $TOKEN" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d), 'categories')"
echo

echo "== summary =="
YM=$(date +%Y-%m)
curl -sS "$BASE/api/stats/summary?book_id=$BOOK_ID&year_month=$YM" -H "Authorization: Bearer $TOKEN"
echo
echo "OK"
