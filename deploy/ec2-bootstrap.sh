#!/usr/bin/env bash
# One-time setup for a 512 MB Ubuntu host (Lightsail Nano / t3.nano / t4g.nano).
# Run as the default sudo user (usually ubuntu):
#   curl -fsSL ...  OR  bash deploy/ec2-bootstrap.sh
set -euo pipefail

if [ "$(id -u)" -eq 0 ]; then
  echo "Run this as a sudo user (ubuntu), not as root."
  exit 1
fi

echo "==> Creating 1 GB swap (required on 512 MB RAM)"
if ! swapon --show | grep -q '/swapfile'; then
  sudo fallocate -l 1G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  if ! grep -q '/swapfile' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  fi
fi
echo 'vm.swappiness=30' | sudo tee /etc/sysctl.d/99-swap.conf >/dev/null
sudo sysctl --system >/dev/null

echo "==> Installing Docker Engine + Compose plugin"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo usermod -aG docker "$USER"

echo "==> App directory"
mkdir -p "$HOME/sourcelab"
if [ ! -f "$HOME/sourcelab/server/.env.production" ]; then
  echo "Create $HOME/sourcelab/server/.env.production before the first GitHub Actions deploy."
fi

echo "==> Architecture: $(uname -m)"
echo "If this prints aarch64/arm64, change the GitHub workflow platforms to linux/arm64."
echo
echo "Log out and SSH back in so the docker group applies, then:"
echo "  docker run --rm hello-world"
