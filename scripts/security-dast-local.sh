#!/usr/bin/env bash
set -euo pipefail

TARGET_URL="${1:-${ZAP_TARGET_URL:-https://proto.tvsg.ch}}"

echo "Running ZAP baseline scan against: ${TARGET_URL}"

docker run --rm -t \
  -v "$PWD:/zap/wrk" \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py \
  -t "${TARGET_URL}" \
  -m 1 \
  -r zap-baseline-report.html \
  -J zap-baseline-report.json \
  -w zap-baseline-report.md \
  -c .zap/rules.tsv
