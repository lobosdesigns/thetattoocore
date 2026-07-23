#!/usr/bin/env bash
set -euo pipefail

export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

RELEASE_COMMIT="${TTC_IOS_RELEASE_COMMIT:-}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || true)"

if [[ ! "$RELEASE_COMMIT" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Set TTC_IOS_RELEASE_COMMIT to the full reviewed 40-character Git commit." >&2
  exit 1
fi

if [ -z "$REPO_ROOT" ] ||
  [ "$(git -C "$REPO_ROOT" rev-parse HEAD)" != "$RELEASE_COMMIT" ] ||
  ! git -C "$REPO_ROOT" diff --quiet ||
  ! git -C "$REPO_ROOT" diff --cached --quiet ||
  [ -n "$(git -C "$REPO_ROOT" ls-files --others --exclude-standard)" ]; then
  echo "The archive source does not match the clean reviewed commit." >&2
  exit 1
fi

cd "$SCRIPT_DIR/App"

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "xcodebuild is required. Run this on the Mac with Xcode installed." >&2
  exit 1
fi

if ! command -v pod >/dev/null 2>&1; then
  echo "CocoaPods is required. Install CocoaPods on the Mac, then retry." >&2
  exit 1
fi

pod install

ARCHIVE_PATH="../build/TheTattooCore.xcarchive"
EXPORT_PATH="../build/export"

mkdir -p "../build"

xcodebuild \
  -workspace App.xcworkspace \
  -scheme App \
  -configuration Release \
  -archivePath "$ARCHIVE_PATH" \
  -destination "generic/platform=iOS" \
  clean archive

xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist ../ExportOptions-AppStore.template.plist

echo "IPA ready at $EXPORT_PATH. Upload it from Xcode Organizer, Transporter, or App Store Connect."
