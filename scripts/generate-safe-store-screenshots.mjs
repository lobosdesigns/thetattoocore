import path from "node:path";
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const outDir = path.join(process.cwd(), "public", "screenshots");
const generatedDir = path.join(process.cwd(), "native", "store-metadata", "generated");
const shieldPath = path.join(process.cwd(), "public", "icons", "icon-512.png");

function esc(value) {
  return String(value).replace(/[&<>]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
  })[char]);
}

function text({
  body,
  color = "#14100d",
  extra = "",
  size,
  weight = 800,
  x,
  y,
}) {
  return `<text x="${x}" y="${y}" fill="${color}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" ${extra}>${esc(body)}</text>`;
}

function rounded({
  fill,
  h,
  r,
  stroke = "#d8d0c4",
  sw = 1,
  w,
  x,
  y,
}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
}

function tab({ active = false, label, w, x, y }) {
  return [
    rounded({
      fill: active ? "#14100d" : "#fffdf8",
      h: 40,
      r: 7,
      stroke: "#d8d0c4",
      w,
      x,
      y,
    }),
    text({
      body: label,
      color: active ? "#fffaf0" : "#14100d",
      extra: 'text-anchor="middle"',
      size: 15,
      x: x + w / 2,
      y: y + 26,
    }),
  ].join("");
}

function pill({ label, w, x, y }) {
  return [
    rounded({
      fill: "#f4ead8",
      h: 34,
      r: 7,
      stroke: "#e0c27a",
      w,
      x,
      y,
    }),
    text({
      body: label,
      color: "#7b5a15",
      extra: 'text-anchor="middle"',
      size: 12,
      x: x + w / 2,
      y: y + 22,
    }),
  ].join("");
}

async function shield(size) {
  return sharp(shieldPath).resize(size, size).png().toBuffer();
}

function header(content, subtitle = "The heart of the tattoo community.") {
  return `<svg width="540" height="960" xmlns="http://www.w3.org/2000/svg">
<defs><linearGradient id="goldFade" x1="0" x2="1"><stop offset="0" stop-color="#17120f"/><stop offset="1" stop-color="#d9a52f"/></linearGradient></defs>
<rect width="540" height="960" fill="#f6f2eb"/>
<rect width="540" height="82" fill="#14100d"/>
${text({ body: "The Tattoo Core", color: "#fffaf0", size: 25, weight: 900, x: 76, y: 40 })}
${text({ body: subtitle, color: "#e2c06b", size: 11, weight: 700, x: 76, y: 60 })}
${content}
</svg>`;
}

function bottomNav() {
  return [
    '<rect x="0" y="914" width="540" height="46" fill="#14100d"/>',
    ...["Search", "Saved", "Alerts", "DM", "Me"].map((label, index) =>
      text({
        body: label,
        color: "#fffaf0",
        extra: 'text-anchor="middle"',
        size: 12,
        x: 54 + index * 108,
        y: 944,
      }),
    ),
  ].join("");
}

function columns(active) {
  return ["4U", "Gossip", "Stuff", "Gigs", "Merch"]
    .map((label, index) =>
      tab({
        active: label === active,
        label,
        w: label === "Gossip" ? 94 : 92,
        x: 20 + index * 103,
        y: 100,
      }),
    )
    .join("");
}

const pages = {
  "mobile-login-signup.png": header(`
${rounded({ fill: "#fffdf8", h: 500, r: 12, w: 460, x: 40, y: 150 })}
${text({ body: "Sign in", size: 34, weight: 900, x: 68, y: 205 })}
${text({ body: "Use your email and password.", color: "#6f5e4c", size: 17, weight: 600, x: 68, y: 238 })}
${rounded({ fill: "#f6f2eb", h: 54, r: 8, w: 404, x: 68, y: 284 })}
${text({ body: "Email", color: "#7b6a58", size: 15, weight: 700, x: 86, y: 318 })}
${rounded({ fill: "#f6f2eb", h: 54, r: 8, w: 404, x: 68, y: 362 })}
${text({ body: "Password", color: "#7b6a58", size: 15, weight: 700, x: 86, y: 396 })}
${rounded({ fill: "#14100d", h: 50, r: 8, stroke: "#14100d", w: 404, x: 68, y: 448 })}
${text({ body: "Sign in", color: "#fffaf0", extra: 'text-anchor="middle"', size: 17, weight: 900, x: 270, y: 480 })}
${rounded({ fill: "#f4ead8", h: 48, r: 8, stroke: "#e0c27a", w: 404, x: 68, y: 518 })}
${text({ body: "Create account", color: "#7b5a15", extra: 'text-anchor="middle"', size: 16, weight: 900, x: 270, y: 548 })}
${text({ body: "18+ community. Visible nudity is not allowed.", color: "#6f5e4c", size: 14, weight: 700, x: 68, y: 604 })}
`),
  "mobile-4u-safe.png": header(`
${columns("4U")}
${rounded({ fill: "#fffdf8", h: 628, r: 9, w: 500, x: 20, y: 158 })}
<rect x="20" y="158" width="500" height="390" rx="9" fill="url(#goldFade)"/>
${text({ body: "TTC", color: "#fffaf0", extra: 'text-anchor="middle"', size: 80, weight: 900, x: 270, y: 350 })}
${text({ body: "SampleArtist", size: 22, weight: 900, x: 34, y: 590 })}
${text({ body: "Clean blackwork progress, safe sample media.", color: "#6f5e4c", size: 15, weight: 600, x: 34, y: 620 })}
${pill({ label: "12 likes", w: 116, x: 34, y: 650 })}
${pill({ label: "4 comments", w: 142, x: 160, y: 650 })}
${pill({ label: "Save", w: 92, x: 312, y: 650 })}
${text({ body: "Comments stay collapsed until opened.", color: "#6f5e4c", size: 14, weight: 700, x: 34, y: 730 })}
${bottomNav()}
`),
  "mobile-stories-safe.png": header(`
${columns("4U")}
${text({ body: "Stories", size: 20, weight: 900, x: 28, y: 170 })}
${rounded({ fill: "#f4ead8", h: 116, r: 16, stroke: "#e0c27a", sw: 2, w: 116, x: 28, y: 196 })}
${text({ body: "+", color: "#d9a52f", extra: 'text-anchor="middle"', size: 36, weight: 900, x: 86, y: 243 })}
${text({ body: "Add", color: "#7b5a15", extra: 'text-anchor="middle"', size: 16, weight: 900, x: 86, y: 280 })}
${rounded({ fill: "#fffdf8", h: 116, r: 12, w: 330, x: 166, y: 196 })}
${text({ body: "24h photo, GIF, or short video", size: 18, weight: 900, x: 190, y: 243 })}
${text({ body: "Safe overlays show views and reactions.", color: "#6f5e4c", size: 14, weight: 600, x: 190, y: 273 })}
${rounded({ fill: "#14100d", h: 350, r: 14, stroke: "#14100d", w: 472, x: 34, y: 354 })}
${text({ body: "Story Preview", color: "#fffaf0", extra: 'text-anchor="middle"', size: 34, weight: 900, x: 270, y: 514 })}
${pill({ label: "12 views", w: 90, x: 54, y: 728 })}
${pill({ label: "6 reacts", w: 108, x: 154, y: 728 })}
${pill({ label: "Reply", w: 90, x: 272, y: 728 })}
${bottomNav()}
`),
  "mobile-gossip-safe.png": header(`
${columns("Gossip")}
${rounded({ fill: "#fffdf8", h: 590, r: 9, w: 500, x: 20, y: 158 })}
${text({ body: "Gossip thread", size: 24, weight: 900, x: 34, y: 210 })}
${text({ body: "Ask artists, talk shop, and start long-form", color: "#6f5e4c", size: 15, weight: 600, x: 34, y: 246 })}
${text({ body: "community conversations with safe sample posts.", color: "#6f5e4c", size: 15, weight: 600, x: 34, y: 268 })}
${rounded({ fill: "#f6f2eb", h: 166, r: 10, w: 472, x: 34, y: 314 })}
${text({ body: "Guest spot tips for a clean portfolio", size: 20, weight: 900, x: 58, y: 356 })}
${text({ body: "Longer posts live here with replies, likes,", color: "#6f5e4c", size: 14, weight: 600, x: 58, y: 390 })}
${text({ body: "reports, and moderation tools.", color: "#6f5e4c", size: 14, weight: 600, x: 58, y: 412 })}
${pill({ label: "8 replies", w: 108, x: 58, y: 446 })}
${pill({ label: "24 likes", w: 90, x: 176, y: 446 })}
${rounded({ fill: "#f4ead8", h: 96, r: 10, stroke: "#e0c27a", w: 472, x: 34, y: 514 })}
${text({ body: "Comments open when tapped to keep feeds fast.", color: "#7b5a15", size: 15, weight: 800, x: 58, y: 552 })}
${bottomNav()}
`),
  "mobile-profile-search.png": header(`
${rounded({ fill: "#fffdf8", h: 190, r: 12, w: 488, x: 26, y: 118 })}
<rect x="26" y="118" width="488" height="92" rx="12" fill="url(#goldFade)"/>
${rounded({ fill: "#14100d", h: 82, r: 14, stroke: "#14100d", w: 82, x: 50, y: 170 })}
${text({ body: "T", color: "#e2c06b", extra: 'text-anchor="middle"', size: 38, weight: 900, x: 91, y: 222 })}
${text({ body: "SampleArtist", size: 24, weight: 900, x: 154, y: 242 })}
${text({ body: "@sampleartist - Austin, TX", color: "#6f5e4c", size: 15, weight: 700, x: 154, y: 270 })}
${pill({ label: "Verified", w: 112, x: 154, y: 284 })}
${pill({ label: "No AI", w: 104, x: 276, y: 284 })}
${text({ body: "Search people and work", size: 24, weight: 900, x: 28, y: 360 })}
${rounded({ fill: "#fffdf8", h: 54, r: 10, w: 484, x: 28, y: 386 })}
${text({ body: "artist, shop, merch, booking...", color: "#7b6a58", size: 15, weight: 700, x: 54, y: 420 })}
${rounded({ fill: "#fffdf8", h: 82, r: 10, w: 484, x: 28, y: 470 })}
${text({ body: "Profiles rank by username, bio, location,", size: 15, weight: 800, x: 54, y: 506 })}
${text({ body: "and safe community connections.", color: "#6f5e4c", size: 15, weight: 600, x: 54, y: 530 })}
${bottomNav()}
`),
  "mobile-help-support.png": header(`
${rounded({ fill: "#fffdf8", h: 640, r: 12, w: 484, x: 28, y: 120 })}
${text({ body: "Help Center", size: 32, weight: 900, x: 52, y: 170 })}
${text({ body: "Self-serve guides before contacting support.", color: "#6f5e4c", size: 15, weight: 600, x: 52, y: 202 })}
${["Getting started", "Beta app testing", "Merch products and orders", "Booking appointments", "Verification documents", "Privacy and safety"].map((label, index) => `
${rounded({ fill: index === 1 ? "#f4ead8" : "#f6f2eb", h: 52, r: 8, stroke: index === 1 ? "#e0c27a" : "#d8d0c4", w: 436, x: 52, y: 242 + index * 70 })}
${text({ body: label, color: index === 1 ? "#7b5a15" : "#14100d", size: 16, weight: 900, x: 76, y: 276 + index * 70 })}
`).join("")}
${text({ body: "Use support for private account, safety,", color: "#6f5e4c", size: 14, weight: 700, x: 52, y: 700 })}
${text({ body: "payment, or verification questions.", color: "#6f5e4c", size: 14, weight: 700, x: 52, y: 722 })}
${bottomNav()}
`),
};

for (const [name, svg] of Object.entries(pages)) {
  await sharp(Buffer.from(svg))
    .composite([{ input: await shield(42), left: 24, top: 20 }])
    .flatten({ background: "#f6f2eb" })
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, name));
}

async function exportDerivative({ destDir, height, sourceName, suffix, width }) {
  mkdirSync(destDir, { recursive: true });
  const baseName = sourceName.replace(/\.png$/, "");
  await sharp(path.join(outDir, sourceName))
    .resize(width, height, {
      background: "#f6f2eb",
      fit: "contain",
      withoutEnlargement: false,
    })
    .flatten({ background: "#f6f2eb" })
    .png({ compressionLevel: 9 })
    .toFile(path.join(destDir, `${baseName}-${suffix}.png`));
}

const mobileSources = ["mobile-home.png", ...Object.keys(pages)].sort();
const ipadSources = ["mobile-4u-safe.png", "mobile-home.png", "mobile-login-signup.png"];

for (const sourceName of mobileSources) {
  await exportDerivative({
    destDir: path.join(generatedDir, "google-play", "phone-screenshots"),
    height: 1920,
    sourceName,
    suffix: "1080x1920",
    width: 1080,
  });
  await exportDerivative({
    destDir: path.join(generatedDir, "apple-app-store", "iphone-6-5"),
    height: 2688,
    sourceName,
    suffix: "1242x2688",
    width: 1242,
  });
}

for (const sourceName of ipadSources) {
  await exportDerivative({
    destDir: path.join(generatedDir, "apple-app-store", "ipad-13"),
    height: 2732,
    sourceName,
    suffix: "2048x2732",
    width: 2048,
  });
}
