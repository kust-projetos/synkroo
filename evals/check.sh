#!/usr/bin/env bash
# Roda os checks[] de um eval. Exit != 0 se algum falha.
set -u
[ $# -eq 1 ] || { echo "uso: check.sh <eval.json>"; exit 2; }
ok=0; fail=0
while IFS= read -r cmd; do
  if bash -c "$cmd" >/dev/null 2>&1; then ok=$((ok+1)); echo "PASS $cmd"; else fail=$((fail+1)); echo "FAIL $cmd"; fi
done < <(jq -r '.checks[]' "$1")
echo "$(jq -r .id "$1"): $ok pass, $fail fail"
[ "$fail" -eq 0 ]
