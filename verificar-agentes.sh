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

echo "--- Pruebas del módulo de agentes ---"
A=/orgs/$ORG/agents
BODY='{"name":"Agente Facturas","systemInstructions":"Eres un asistente"}'

check "1. Crear agente (ADMIN)"        201 "$(code POST $A "$TA" "$BODY")"; AG=$(json d.id </tmp/out.json)
check "2. Nombre repetido"             409 "$(code POST $A "$TA" "$BODY")"
check "3. Listar agentes"              200 "$(code GET $A "$TA")"
grep -q "Agente Facturas" /tmp/out.json && echo "OK    3b. el agente aparece en la lista" || echo "FALLA 3b. no aparece en la lista"
check "4a. Herramienta válida"         200 "$(code PUT $A/$AG/tools "$TA" '{"tools":["suppliers.lookup"]}')"
check "4b. Herramienta inexistente"    400 "$(code PUT $A/$AG/tools "$TA" '{"tools":["no.existe"]}')"
check "5. Catálogo de herramientas"    200 "$(code GET $A/tools/catalog "$TA")"
N=$(grep -o 'suppliers.lookup\|report.summarize' /tmp/out.json | sort -u | wc -l)
[ "$N" = "2" ] && echo "OK    5b. el catálogo tiene 2 herramientas" || echo "FALLA 5b. herramientas encontradas: $N"
check "6. Agente de otra org (404)"    404 "$(code GET /orgs/$ORG2/agents/$AG "$TB")"
check "7a. AUDITOR crea agente"        403 "$(code POST $A "$TC" '{"name":"X","systemInstructions":"y"}')"
check "7b. AUDITOR puede listar"       200 "$(code GET $A "$TC")"
check "8a. OPERATOR borra"             403 "$(code DELETE $A/$AG "$TO")"
check "9. :id que no es UUID"          404 "$(code GET $A/abc "$TA")"
check "10. run sigue pendiente"        501 "$(code POST $A/$AG/run "$TA" '{}')"
check "8b. ADMIN borra"                204 "$(code DELETE $A/$AG "$TA")"
