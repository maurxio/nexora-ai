#!/usr/bin/env bash
API=http://localhost:3000/api/v1
S=$(date +%s)
json() { node -pe "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));$1"; }
code() { # método ruta token cuerpo
  local args=(-s -o /tmp/out.json -w "%{http_code}" -X "$1" "$API$2" -H "Content-Type: application/json")
  [ -n "$3" ] && args+=(-H "Authorization: Bearer $3")
  [ -n "$4" ] && args+=(-d "$4")
  curl "${args[@]}"
}
check() { [ "$2" = "$3" ] && echo "OK    $1 ($3)" || { echo "FALLA $1: esperado $2, obtenido $3"; cat /tmp/out.json; echo; }; }
eq()    { [ "$2" = "$3" ] && echo "OK    $1" || echo "FALLA $1: esperado $2, obtenido $3"; }
reg() { curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$1$S@test.com\",\"name\":\"$1\",\"password\":\"12345678\"}"; }

TA=$(reg admin | json d.accessToken); TB=$(reg otro | json d.accessToken); TC=$(reg auditor | json d.accessToken)
code POST /organizations "$TA" '{"name":"Org Uno"}' >/dev/null; ORG=$(json d.id </tmp/out.json)
code POST /organizations "$TB" '{"name":"Org Dos"}' >/dev/null; ORG2=$(json d.id </tmp/out.json)
code POST /organizations/$ORG/members "$TA" "{\"email\":\"auditor$S@test.com\",\"role\":\"AUDITOR\"}" >/dev/null
W=/orgs/$ORG/workflows

mkwf() { # nombre draft -> id (crea y publica)
  code POST $W "$TA" "{\"name\":\"$1-$S\",\"draft\":$2}" >/dev/null
  local id; id=$(json d.id </tmp/out.json)
  code POST $W/$id/publish "$TA" >/dev/null; echo "$id"
}
final() { # id de ejecución -> estado final
  for i in $(seq 1 40); do
    code GET /orgs/$ORG/executions/$1 "$TA" >/dev/null
    st=$(json d.status </tmp/out.json)
    case $st in SUCCEEDED|FAILED|CANCELLED) echo "$st"; return;; esac
    sleep 0.5
  done; echo TIMEOUT
}
steps() { code GET /orgs/$ORG/executions/$1/steps "$TA" >/dev/null; }

RAMA='{"nodes":[{"id":"t1","type":"trigger","config":{}},{"id":"x1","type":"transform","config":{"set":{"total":"{{input.total}}"}}},{"id":"c1","type":"condition","config":{"expression":"nodes.x1.total > 1000"}},{"id":"a1","type":"notification","config":{"message":"alto"}},{"id":"b1","type":"transform","config":{"set":{"nivel":"bajo"}}}],"edges":[{"from":"t1","to":"x1"},{"from":"x1","to":"c1"},{"from":"c1","to":"a1","condition":"true"},{"from":"c1","to":"b1","condition":"false"}]}'
REINT='{"nodes":[{"id":"t1","type":"trigger","config":{}},{"id":"h1","type":"http","config":{"url":"http://localhost:1/","retries":2,"timeoutMs":2000}}],"edges":[{"from":"t1","to":"h1"}]}'
SSRF='{"nodes":[{"id":"t1","type":"trigger","config":{}},{"id":"h1","type":"http","config":{"url":"http://169.254.169.254/latest/meta-data","retries":2}}],"edges":[{"from":"t1","to":"h1"}]}'
LENTO='{"nodes":[{"id":"t1","type":"trigger","config":{}},{"id":"s1","type":"transform","config":{"set":{"a":"1"},"simulateDelayMs":8000}},{"id":"s2","type":"transform","config":{"set":{"b":"2"}}}],"edges":[{"from":"t1","to":"s1"},{"from":"s1","to":"s2"}]}'

echo "--- Pruebas del motor de ejecución ---"
F1=$(mkwf rama "$RAMA"); FR=$(mkwf reint "$REINT"); FS=$(mkwf ssrf "$SSRF"); FL=$(mkwf lento "$LENTO")

check "1. Ejecutar (total 5000)" 202 "$(code POST $W/$F1/execute "$TA" '{"input":{"total":5000}}')"; E1=$(json d.executionId </tmp/out.json)
eq    "1b. termina SUCCEEDED" SUCCEEDED "$(final $E1)"
steps $E1
eq    "1c. rama true ejecutó a1" SUCCEEDED "$(json "d.find(s=>s.nodeId==='a1').status" </tmp/out.json)"
eq    "1d. rama false omitió b1" SKIPPED "$(json "d.find(s=>s.nodeId==='b1').status" </tmp/out.json)"

code POST $W/$F1/execute "$TA" '{"input":{"total":10}}' >/dev/null; E2=$(json d.executionId </tmp/out.json)
eq    "2. total 10 termina SUCCEEDED" SUCCEEDED "$(final $E2)"
steps $E2
eq    "2b. ahora a1 omitido" SKIPPED "$(json "d.find(s=>s.nodeId==='a1').status" </tmp/out.json)"
eq    "2c. y b1 ejecutado" SUCCEEDED "$(json "d.find(s=>s.nodeId==='b1').status" </tmp/out.json)"

R1=$(curl -s -o /tmp/o1.json -w "%{http_code}" -X POST "$API$W/$F1/execute" -H "Authorization: Bearer $TA" -H "Content-Type: application/json" -H "Idempotency-Key: k-$S" -d '{"input":{"total":1}}')
R2=$(curl -s -o /tmp/o2.json -w "%{http_code}" -X POST "$API$W/$F1/execute" -H "Authorization: Bearer $TA" -H "Content-Type: application/json" -H "Idempotency-Key: k-$S" -d '{"input":{"total":1}}')
eq    "3. idempotencia: primera 202" 202 "$R1"
eq    "3b. idempotencia: segunda 200" 200 "$R2"
eq    "3c. misma ejecución" "$(json d.executionId </tmp/o1.json)" "$(json d.executionId </tmp/o2.json)"

code POST $W "$TA" "{\"name\":\"sinpublicar-$S\"}" >/dev/null; WN=$(json d.id </tmp/out.json)
check "4. Sin versión publicada" 409 "$(code POST $W/$WN/execute "$TA" '{}')"

code POST $W/$FR/execute "$TA" '{}' >/dev/null; ER=$(json d.executionId </tmp/out.json)
eq    "5. reintentos: termina FAILED" FAILED "$(final $ER)"
steps $ER
eq    "5b. 3 intentos del nodo h1" 3 "$(json "d.filter(s=>s.nodeId==='h1').length" </tmp/out.json)"

code POST $W/$FS/execute "$TA" '{}' >/dev/null; ES=$(json d.executionId </tmp/out.json)
eq    "6. SSRF: termina FAILED" FAILED "$(final $ES)"
steps $ES
eq    "6b. bloqueado sin reintentos (1 intento)" 1 "$(json "d.filter(s=>s.nodeId==='h1').length" </tmp/out.json)"

check "7. Retry de ejecución fallida" 202 "$(code POST /orgs/$ORG/executions/$ER/retry "$TA")"
[ "$(json d.executionId </tmp/out.json)" != "$ER" ] && echo "OK    7b. crea una ejecución nueva" || echo "FALLA 7b. reutilizó el id"
check "7c. Retry de una exitosa" 409 "$(code POST /orgs/$ORG/executions/$E1/retry "$TA")"

code POST $W/$FL/execute "$TA" '{}' >/dev/null; EL=$(json d.executionId </tmp/out.json)
sleep 1.5
check "8. Cancelar en curso" 200 "$(code POST /orgs/$ORG/executions/$EL/cancel "$TA")"
eq    "8b. estado CANCELLED" CANCELLED "$(final $EL)"
sleep 10
steps $EL
eq    "8c. el último nodo nunca se ejecutó" 0 "$(json "d.filter(s=>s.nodeId==='s2'&&s.status==='SUCCEEDED').length" </tmp/out.json)"
code GET /orgs/$ORG/executions/$EL "$TA" >/dev/null
eq    "8d. sigue CANCELLED (no fue pisada)" CANCELLED "$(json d.status </tmp/out.json)"
check "8e. Cancelar una ya terminada" 409 "$(code POST /orgs/$ORG/executions/$E1/cancel "$TA")"

check "9. Listar ejecuciones" 200 "$(code GET "/orgs/$ORG/executions?status=FAILED" "$TA")"
check "10. Ejecución de otra org (404)" 404 "$(code GET /orgs/$ORG2/executions/$E1 "$TB")"
check "11a. AUDITOR ejecuta" 403 "$(code POST $W/$F1/execute "$TC" '{}')"
check "11b. AUDITOR lista" 200 "$(code GET /orgs/$ORG/executions "$TC")"
check "12. :id no UUID" 404 "$(code GET /orgs/$ORG/executions/abc "$TA")"
check "13. aprobaciones aún pendientes" 501 "$(code GET /orgs/$ORG/executions/approvals/pending "$TA")"
