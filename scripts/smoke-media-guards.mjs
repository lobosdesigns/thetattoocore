import { readFileSync } from "node:fs";

const protectedVideo = readFileSync("src/app/protected-video.tsx", "utf8");
const mediaInput = readFileSync("src/app/floating-composer.tsx", "utf8");
const metadata = readFileSync("src/lib/media/metadata.ts", "utf8");

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
