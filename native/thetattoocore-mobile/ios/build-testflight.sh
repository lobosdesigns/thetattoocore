#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/App"

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
