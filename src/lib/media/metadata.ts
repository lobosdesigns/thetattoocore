export type MediaType = "image" | "video";

export type MediaMetadata = {
  detectedMimeType: string | null;
  durationSeconds: number | null;
  fileSizeBytes: number;
  height: number | null;
  mediaType: MediaType;
  mimeType: string;
  originalFilename: string | null;
  width: number | null;
};

const IMAGE_MIME_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function uint16Le(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function uint16Be(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function uint24Le(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function uint32Le(bytes: Uint8Array, offset: number) {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function uint32Be(bytes: Uint8Array, offset: number) {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function uint64Be(bytes: Uint8Array, offset: number) {
  const high = uint32Be(bytes, offset);
  const low = uint32Be(bytes, offset + 4);

  return high * 2 ** 32 + low;
}

function detectMimeType(bytes: Uint8Array) {
  if (
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    bytes[0] === 0x89 &&
    ascii(bytes, 1, 3) === "PNG" &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a
  ) {
    return "image/png";
  }

  if (ascii(bytes, 0, 3) === "GIF") return "image/gif";

  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "image/webp";
  }

  if (ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4).trim();
    return brand === "qt" ? "video/quicktime" : "video/mp4";
  }

  if (
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    return "video/webm";
  }

  return null;
}

function mp4DurationSeconds(bytes: Uint8Array) {
  let offset = 0;

  while (offset + 8 <= bytes.length) {
    const size = uint32Be(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    const headerSize = size === 1 ? 16 : 8;
    const boxSize = size === 1 ? uint64Be(bytes, offset + 8) : size;

    if (boxSize < headerSize || offset + boxSize > bytes.length) return null;

    if (type === "moov") {
      return movieBoxDurationSeconds(
        bytes.subarray(offset + headerSize, offset + boxSize),
      );
    }

    offset += boxSize;
  }

  return null;
}

function movieBoxDurationSeconds(bytes: Uint8Array) {
  let offset = 0;

  while (offset + 8 <= bytes.length) {
    const size = uint32Be(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    const headerSize = size === 1 ? 16 : 8;
    const boxSize = size === 1 ? uint64Be(bytes, offset + 8) : size;

    if (boxSize < headerSize || offset + boxSize > bytes.length) return null;

    if (type === "mvhd") {
      return movieHeaderDurationSeconds(
        bytes.subarray(offset + headerSize, offset + boxSize),
      );
    }

    offset += boxSize;
  }

  return null;
}

function movieHeaderDurationSeconds(bytes: Uint8Array) {
  if (bytes.length < 20) return null;

  const version = bytes[0];
  const timescaleOffset = version === 1 ? 20 : 12;
  const durationOffset = version === 1 ? 24 : 16;

  if (bytes.length < durationOffset + (version === 1 ? 8 : 4)) return null;

  const timescale = uint32Be(bytes, timescaleOffset);
  const duration =
    version === 1
      ? uint64Be(bytes, durationOffset)
      : uint32Be(bytes, durationOffset);

  if (!timescale || !Number.isFinite(duration)) return null;

  return Math.round((duration / timescale) * 100) / 100;
}

function pngDimensions(bytes: Uint8Array) {
  if (bytes.length < 24) return null;

  return {
    height: uint32Be(bytes, 20),
    width: uint32Be(bytes, 16),
  };
}

function gifDimensions(bytes: Uint8Array) {
  if (bytes.length < 10) return null;

  return {
    height: uint16Le(bytes, 8),
    width: uint16Le(bytes, 6),
  };
}

function jpegDimensions(bytes: Uint8Array) {
  let offset = 2;

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;

    const marker = bytes[offset + 1];
    const length = uint16Be(bytes, offset + 2);
    const isStartOfFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      ![0xc4, 0xc8, 0xcc].includes(marker);

    if (isStartOfFrame) {
      return {
        height: uint16Be(bytes, offset + 5),
        width: uint16Be(bytes, offset + 7),
      };
    }

    offset += 2 + length;
  }

  return null;
}

function webpDimensions(bytes: Uint8Array) {
  const chunkType = ascii(bytes, 12, 4);

  if (chunkType === "VP8X" && bytes.length >= 30) {
    return {
      height: uint24Le(bytes, 27) + 1,
      width: uint24Le(bytes, 24) + 1,
    };
  }

  if (chunkType === "VP8L" && bytes.length >= 25) {
    const bits = uint32Le(bytes, 21);

    return {
      height: ((bits >> 14) & 0x3fff) + 1,
      width: (bits & 0x3fff) + 1,
    };
  }

  if (chunkType === "VP8 " && bytes.length >= 30) {
    return {
      height: uint16Le(bytes, 28) & 0x3fff,
      width: uint16Le(bytes, 26) & 0x3fff,
    };
  }

  return null;
}

function imageDimensions(mimeType: string, bytes: Uint8Array) {
  if (mimeType === "image/gif") return gifDimensions(bytes);
  if (mimeType === "image/jpeg") return jpegDimensions(bytes);
  if (mimeType === "image/png") return pngDimensions(bytes);
  if (mimeType === "image/webp") return webpDimensions(bytes);

  return null;
}

function mediaDurationSeconds(mimeType: string, bytes: Uint8Array) {
  if (mimeType === "video/mp4" || mimeType === "video/quicktime") {
    return mp4DurationSeconds(bytes);
  }

  return null;
}

function cleanFilename(name: string) {
  const trimmed = name.trim();

  return trimmed ? trimmed.slice(0, 180) : null;
}

export async function inspectMediaFile(file: File): Promise<MediaMetadata> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detectedMimeType = detectMimeType(bytes);
  const mimeType = detectedMimeType ?? file.type;
  const mediaType = VIDEO_MIME_TYPES.has(mimeType) ? "video" : "image";
  const dimensions = IMAGE_MIME_TYPES.has(mimeType)
    ? imageDimensions(mimeType, bytes)
    : null;
  const durationSeconds = VIDEO_MIME_TYPES.has(mimeType)
    ? mediaDurationSeconds(mimeType, bytes)
    : null;

  return {
    detectedMimeType,
    durationSeconds,
    fileSizeBytes: file.size,
    height: dimensions?.height ?? null,
    mediaType,
    mimeType,
    originalFilename: cleanFilename(file.name),
    width: dimensions?.width ?? null,
  };
}

export function validateMediaMetadata(metadata: MediaMetadata) {
  if (
    !IMAGE_MIME_TYPES.has(metadata.mimeType) &&
    !VIDEO_MIME_TYPES.has(metadata.mimeType)
  ) {
    return "Use a JPG, PNG, WebP, GIF, MP4, MOV, or WebM file.";
  }

  if (metadata.mediaType === "image" && metadata.fileSizeBytes > 10 * 1024 * 1024) {
    return "Images can be up to 10 MB right now.";
  }

  if (metadata.mediaType === "video" && metadata.fileSizeBytes > 50 * 1024 * 1024) {
    return "Videos can be up to 50 MB right now.";
  }

  if (
    metadata.mediaType === "video" &&
    metadata.durationSeconds != null &&
    metadata.durationSeconds > 60
  ) {
    return "Video clips can be up to 60 seconds right now.";
  }

  return null;
}
