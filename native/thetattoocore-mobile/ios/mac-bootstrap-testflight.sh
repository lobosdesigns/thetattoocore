#!/usr/bin/env bash
set -euo pipefail

export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

LOG="$HOME/Desktop/ttc-ios-build.log"
REPO_URL="https://github.com/lobosdesigns/thetattoocore.git"
WORKDIR="$HOME/Desktop/thetattoocore"
RELEASE_COMMIT="${TTC_IOS_RELEASE_COMMIT:-}"

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

if [[ ! "$RELEASE_COMMIT" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Set TTC_IOS_RELEASE_COMMIT to the full reviewed 40-character Git commit." >&2
  exit 1
fi

if [ -d "$WORKDIR/.git" ]; then
  echo "Using existing repo at $WORKDIR"
  cd "$WORKDIR"
  ORIGIN_URL="$(git remote get-url origin)"
  case "$ORIGIN_URL" in
    "$REPO_URL"|"git@github.com:lobosdesigns/thetattoocore.git")
      ;;
    *)
      echo "The existing checkout does not point to the expected repository." >&2
      exit 1
      ;;
  esac

  if ! git diff --quiet ||
    ! git diff --cached --quiet ||
    [ -n "$(git ls-files --others --exclude-standard)" ]; then
    echo "The existing checkout has unexpected source changes. Move them before building." >&2
    exit 1
  fi
else
  if [ -e "$WORKDIR" ]; then
    echo "$WORKDIR exists but is not the expected Git checkout. Move it aside before building." >&2
    exit 1
  fi

  echo "Cloning the release repository to $WORKDIR"
  git clone --no-checkout "$REPO_URL" "$WORKDIR"
  cd "$WORKDIR"
fi

git fetch --no-tags origin "$RELEASE_COMMIT"
git cat-file -e "$RELEASE_COMMIT^{commit}"
git checkout --detach "$RELEASE_COMMIT"

if [ "$(git rev-parse HEAD)" != "$RELEASE_COMMIT" ]; then
  echo "The checked-out source does not match TTC_IOS_RELEASE_COMMIT." >&2
  exit 1
fi

echo "Building reviewed commit $RELEASE_COMMIT"

cd "$WORKDIR/native/thetattoocore-mobile"

if [ ! -s "ios/App/App/GoogleService-Info.plist" ]; then
  echo "The private iOS app configuration is missing. Restore it outside Git before building." >&2
  exit 1
fi

npm ci
npm run sync

if [ "$(git rev-parse HEAD)" != "$RELEASE_COMMIT" ] ||
  ! git diff --quiet ||
  ! git diff --cached --quiet ||
  [ -n "$(git ls-files --others --exclude-standard)" ]; then
  echo "Dependency installation or native sync changed the reviewed source." >&2
  exit 1
fi

cd ios

if ! command -v pod >/dev/null 2>&1; then
  echo "CocoaPods is missing. Install CocoaPods on this Mac, then rerun this command." >&2
  exit 1
fi

bash ./build-testflight.sh

echo "Done. Check the IPA/export output under $WORKDIR/native/thetattoocore-mobile/ios/build/export"
