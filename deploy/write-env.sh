#!/usr/bin/env bash
# Writes .env (next to docker-compose.yml) from the SSM parameters under
# /achiles/ that infra/ (Terraform) manages. Each parameter's last path segment
# is the variable name: /achiles/OPENAI_API_KEY -> OPENAI_API_KEY=...
#
# Runs on the instance, using its IAM role — no AWS keys involved. Re-run after
# changing a value with `terraform apply`, then `docker compose up -d`.
set -euo pipefail
cd "$(dirname "$0")/.."

# Region from instance metadata (IMDSv2), so nothing is hardcoded here.
TOKEN=$(curl -fsS -X PUT http://169.254.169.254/latest/api/token \
  -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')
REGION=$(curl -fsS -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/placement/region)

umask 077
tmp=$(mktemp)
aws ssm get-parameters-by-path --region "$REGION" --path /achiles/ --with-decryption \
  --query 'Parameters[].[Name,Value]' --output text |
  while IFS=$'\t' read -r name value; do
    printf '%s=%s\n' "${name##*/}" "$value"
  done > "$tmp"

if ! grep -q '^POSTGRES_PASSWORD=' "$tmp"; then
  echo "write-env: no /achiles/ parameters readable in $REGION" >&2
  rm -f "$tmp"
  exit 1
fi

mv "$tmp" .env
chown --reference=docker-compose.yml .env 2>/dev/null || true
echo "write-env: wrote $(wc -l < .env) settings to $(pwd)/.env"
