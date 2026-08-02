#!/usr/bin/env bash
# Install Docker (if needed) and pull the OWASP ZAP stable image on the droplet.
# Docs: https://www.zaproxy.org/docs/docker/about/
set -euo pipefail

ZAP_IMAGE="${ZAP_DOCKER_IMAGE:-ghcr.io/zaproxy/zaproxy:stable}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker not found — installing Docker Engine..."
  if command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
      curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
      chmod a+r /etc/apt/keyrings/docker.asc
    fi
    . /etc/os-release
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
      > /etc/apt/sources.list.d/docker.list
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable --now docker
  else
    echo "Unsupported OS for automatic Docker install. Install Docker manually, then re-run."
    exit 1
  fi
fi

systemctl enable --now docker >/dev/null 2>&1 || true

echo "Pulling OWASP ZAP image: ${ZAP_IMAGE}"
docker pull "${ZAP_IMAGE}"

echo "ZAP ready. Smoke test (optional):"
echo "  docker run --rm -t ${ZAP_IMAGE} zap-baseline.py -h | head"
