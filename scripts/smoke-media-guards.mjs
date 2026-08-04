import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

function sourceFilesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) return sourceFilesUnder(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

const protectedVideo = readFileSync("src/app/protected-video.tsx", "utf8");
const mediaInput = readFileSync("src/app/floating-composer.tsx", "utf8");
const metadata = readFileSync("src/lib/media/metadata.ts", "utf8");
const directVideoRenderers = sourceFilesUnder("src/app")
  .filter((path) => relative(".", path).replaceAll("\\", "/") !== "src/app/protected-video.tsx")
  .filter((path) => readFileSync(path, "utf8").includes("<video"));

const checks = [
  {
    label: "protected video hides download control",
    ok: protectedVideo.includes('controlsList="nodownload noplaybackrate noremoteplayback"'),
  },
  {
    label: "protected video blocks context menu",
    ok: protectedVideo.includes("onContextMenu={(event) => event.preventDefault()}"),
  },
  {
    label: "protected video disables picture in picture",
    ok: protectedVideo.includes("disablePictureInPicture"),
  },
  {
    label: "protected video disables remote playback",
    ok: protectedVideo.includes("disableRemotePlayback"),
  },
  {
    label: "protected video always primes a decoded first frame for native WebViews",
    ok:
      protectedVideo.includes("primeVideoPreview") &&
      protectedVideo.includes("videoPreviewTime") &&
      protectedVideo.includes("Math.min(0.1, duration / 2)") &&
      protectedVideo.includes("useRef<HTMLVideoElement>(null)") &&
      protectedVideo.includes(
        'video.addEventListener("loadedmetadata", handleLoadedMetadata)',
      ) &&
      protectedVideo.includes("primeVideoPreview(videoRef.current)") &&
      protectedVideo.includes(
        'video.removeEventListener("loadedmetadata", handleLoadedMetadata)',
      ) &&
      protectedVideo.includes("ref={videoRef}") &&
      protectedVideo.includes(
        "onLoadedMetadata={(event) => primeVideoPreview(event.currentTarget)}",
      ) &&
      protectedVideo.includes("if (!video || video.currentTime !== 0) return;") &&
      !protectedVideo.includes("video.readyState >= 2"),
  },
  {
    label: "all app video players use the shared native-safe renderer",
    ok: directVideoRenderers.length === 0,
  },
  {
    label: "shared video renderer preserves accessible player labels",
    ok:
      protectedVideo.includes("ariaLabel?: string") &&
      protectedVideo.includes("aria-label={ariaLabel}"),
  },
  {
    label: "composer launch video accept excludes webm",
    ok:
      mediaInput.includes("video/mp4,video/quicktime") &&
      !mediaInput.includes("video/webm"),
  },
  {
    label: "server launch video validation excludes webm",
    ok:
      metadata.includes('"video/mp4"') &&
      metadata.includes('"video/quicktime"') &&
      !metadata.includes('"video/webm"'),
  },
];

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}`);
}

if (failures.length) {
  console.error(`${failures.length} media guard smoke check(s) failed.`);
  process.exit(1);
}
