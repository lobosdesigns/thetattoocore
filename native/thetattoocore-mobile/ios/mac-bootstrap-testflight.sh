#!/usr/bin/env bash
set -euo pipefail

LOG="$HOME/Desktop/ttc-ios-build.log"
REPO_URL="https://github.com/lobosdesigns/thetattoocore.git"
WORKDIR="$HOME/Desktop/thetattoocore"

exec > >(tee "$LOG") 2>&1

echo "TheTattooCore iOS build bootstrap"
echo "Log: $LOG"
date

if ! command -v git >/dev/null 2>&1; then
  echo "Git is required on this Mac." >&2
  exit 1
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "Xcode command line tools are required on this Mac." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Node/npm are required on this Mac." >&2
  exit 1
fi

if [ -d "$WORKDIR/.git" ]; then
  echo "Updating existing repo at $WORKDIR"
  cd "$WORKDIR"
  git fetch origin main
  git checkout main
  git pull --ff-only origin main
else
  echo "Cloning repo to $WORKDIR"
  rm -rf "$WORKDIR"
  git clone "$REPO_URL" "$WORKDIR"
  cd "$WORKDIR"
fi

cd "$WORKDIR/native/thetattoocore-mobile"
npm install
npm run sync

cd ios
chmod +x build-testflight.sh

if ! command -v pod >/dev/null 2>&1; then
  echo "CocoaPods is missing. Install CocoaPods on this Mac, then rerun this command." >&2
  exit 1
fi

./build-testflight.sh

echo "Done. Check the IPA/export output under $WORKDIR/native/thetattoocore-mobile/ios/build/export"
