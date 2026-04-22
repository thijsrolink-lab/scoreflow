#!/bin/bash
# ScoreFlow - Draai alle tests
# Gebruik: ./tests/run-tests.sh  (vanuit de repo root)

set -e
cd "$(dirname "$0")/.."

echo "────────────────────────────────────────────────"
echo "STATISCHE VALIDATIE"
echo "────────────────────────────────────────────────"
node tests/validate.js
VALIDATE_EXIT=$?

echo ""
echo "────────────────────────────────────────────────"
echo "ENGINE TESTS"
echo "────────────────────────────────────────────────"
node tests/test-engines.js
ENGINE_EXIT=$?

echo ""
echo "────────────────────────────────────────────────"
if [ $VALIDATE_EXIT -eq 0 ] && [ $ENGINE_EXIT -eq 0 ]; then
  echo "✓ ALLE TESTS GESLAAGD"
  exit 0
else
  echo "✗ TESTS GEFAALD"
  exit 1
fi
