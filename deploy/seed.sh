#!/usr/bin/env bash
# Loads the plan catalog (training_plans + templates) into a fresh database.
# Run once, after `docker compose up` — the API creates the tables on boot, so
# they must exist before this runs. Safe to re-run: every insert is
# ON CONFLICT DO NOTHING.
set -euo pipefail
cd "$(dirname "$0")/.."

until docker compose exec -T postgres psql -U postgres -d achiles -tAc \
  "SELECT 1 FROM information_schema.tables WHERE table_name = 'workout_exercises'" | grep -q 1; do
  echo "waiting for the API to create the schema..."
  sleep 3
done

docker compose exec -T postgres psql -U postgres -d achiles -v ON_ERROR_STOP=1 < deploy/seed-plans.sql
echo "Plan catalog loaded."
