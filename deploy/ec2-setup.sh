#!/usr/bin/env bash
# One-time setup for a fresh Amazon Linux 2023 instance (t2.micro / t3.micro).
# Run as ec2-user:   bash deploy/ec2-setup.sh
# Then log out and back in so the docker group applies.
set -euo pipefail

COMPOSE_VERSION="v2.39.2"

# 1. Swap. A 1 GB instance cannot build the Go image or run the stack without
#    it — the build gets OOM-killed. 2 GB on the root EBS volume.
if ! swapon --show | grep -q /swapfile; then
  sudo dd if=/dev/zero of=/swapfile bs=1M count=2048 status=progress
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  # Prefer RAM; only spill to swap under real pressure.
  echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swappiness.conf
  sudo sysctl -p /etc/sysctl.d/99-swappiness.conf
fi

# 2. Docker + git.
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"

# 3. Compose v2 plugin (not packaged on AL2023).
PLUGIN_DIR=/usr/local/lib/docker/cli-plugins
if [ ! -x "$PLUGIN_DIR/docker-compose" ]; then
  sudo mkdir -p "$PLUGIN_DIR"
  sudo curl -fsSL \
    "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-$(uname -m)" \
    -o "$PLUGIN_DIR/docker-compose"
  sudo chmod +x "$PLUGIN_DIR/docker-compose"
fi

# 4. Keep container logs from filling the 8 GB disk.
sudo tee /etc/docker/daemon.json >/dev/null <<'JSON'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
JSON
sudo systemctl restart docker

echo
echo "Done. Log out and back in, then:"
echo "  cd achiles && cp deploy/.env.example .env && nano .env"
echo "  docker compose up -d --build"
