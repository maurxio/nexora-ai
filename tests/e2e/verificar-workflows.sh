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
check() {
  if [ "$2" = "$3" ]; then echo "OK    $1 ($3)"
  else echo "FALLA $1: esperado $2, obtenido $3"; cat /tmp/out.json; echo; fi
}
has() { grep -q "$2" /tmp/out.json && echo "OK    $1" || { echo "FALLA $1"; cat /tmp/out.json; echo; }; }
reg() { curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$1$S@test.com\",\"name\":\"$1\",\"password\":\"12345678\"}"; }

TA=$(reg admin | json d.accessToken)
TB=$(reg otro | json d.accessToken)
TC=$(reg auditor | json d.accessToken)
TO=$(reg operador | json d.accessToken)

code POST /organizations "$TA" '{"name":"Org Uno"}' >/dev/null; ORG=$(json d.id </tmp/out.json)
code POST /organizations "$TB" '{"name":"Org Dos"}' >/dev/null; ORG2=$(json d.id </tmp/out.json)
code POST /organizations/$ORG/members "$TA" "{\"email\":\"auditor$S@test.com\",\"role\":\"AUDITOR\"}" >/dev/null
code POST /organizations/$ORG/members "$TA" "{\"email\":\"operador$S@test.com\",\"role\":\"OPERATOR\"}" >/dev/null

W=/orgs/$ORG/workflows
V1='{"nodes":[{"id":"t1","type":"trigger","config":{"kind":"webhook"}},{"id":"c1","type":"condition","config":{"expression":"total > 1000000"}},{"id":"n1","type":"notification","config":{"channel":"email"}}],"edges":[{"from":"t1","to":"c1"},{"from":"c1","to":"n1","condition":"true"}]}'
V2='{"nodes":[{"id":"t1","type":"trigger","config":{"kind":"schedule"}},{"id":"c1","type":"condition","config":{"expression":"total > 1000000"}},{"id":"n1","type":"notification","config":{"channel":"email"}}],"edges":[{"from":"t1","to":"c1"},{"from":"c1","to":"n1","condition":"true"}]}'
CICLO='{"nodes":[{"id":"t1","type":"trigger","config":{}},{"id":"a","type":"transform","config":{}},{"id":"b","type":"transform","config":{}}],"edges":[{"from":"t1","to":"a"},{"from":"a","to":"b"},{"from":"b","to":"a"}]}'
TIPO='{"nodes":[{"id":"t1","type":"magia","config":{}}],"edges":[]}'

echo "--- Pruebas del módulo de workflows ---"
check "1. Crear workflow"               201 "$(code POST $W "$TA" "{\"name\":\"Facturas\",\"draft\":$V1}")"; WF=$(json d.id </tmp/out.json)
check "2. Nombre repetido"              409 "$(code POST $W "$TA" '{"name":"Facturas"}')"
check "3. Obtener workflow"             200 "$(code GET $W/$WF "$TA")"
check "4. Borrador con tipo inválido"   400 "$(code PATCH $W/$WF "$TA" "{\"draft\":$TIPO}")"
check "5. Campo desconocido en body"    400 "$(code PATCH $W/$WF "$TA" '{"hack":true}')"
check "6. Publicar grafo válido"        201 "$(code POST $W/$WF/publish "$TA")"
has   "6b. es la versión 1" '"version":1'
check "7. Cambiar borrador"             200 "$(code PATCH $W/$WF "$TA" "{\"draft\":$V2}")"
check "7b. Publicar de nuevo"           201 "$(code POST $W/$WF/publish "$TA")"
has   "7c. es la versión 2" '"version":2'
check "8. Listar versiones"             200 "$(code GET $W/$WF/versions "$TA")"
has   "8b. aparecen ambas versiones" '"version":1'
check "9. Versión 1 sigue intacta"      200 "$(code GET $W/$WF/versions/1 "$TA")"
has   "9b. conserva webhook" 'webhook'
check "9c. Versión 2 tiene schedule"    200 "$(code GET $W/$WF/versions/2 "$TA")"
has   "9d. conserva schedule" 'schedule'
check "9e. Versión inexistente (404)"   404 "$(code GET $W/$WF/versions/99 "$TA")"
check "10. Crear workflow vacío"        201 "$(code POST $W "$TA" '{"name":"Vacio"}')"; WV=$(json d.id </tmp/out.json)
check "10b. Publicar borrador vacío"    400 "$(code POST $W/$WV/publish "$TA")"
has   "10c. trae problems" 'problems'
check "11. Grafo con ciclo"             201 "$(code POST $W "$TA" "{\"name\":\"Ciclo\",\"draft\":$CICLO}")"; WC=$(json d.id </tmp/out.json)
check "11b. Publicar ciclo"             400 "$(code POST $W/$WC/publish "$TA")"
check "12. Workflow de otra org (404)"  404 "$(code GET /orgs/$ORG2/workflows/$WF "$TB")"
check "13a. AUDITOR crea"               403 "$(code POST $W "$TC" '{"name":"X"}')"
check "13b. AUDITOR lista"              200 "$(code GET $W "$TC")"
check "14. OPERATOR borra"              403 "$(code DELETE $W/$WF "$TO")"
check "15. :id no UUID"                 404 "$(code GET $W/abc "$TA")"
check "16. execute pendiente"           501 "$(code POST $W/$WF/execute "$TA" '{}')"
check "17. ADMIN borra"                 204 "$(code DELETE $W/$WF "$TA")"
