import { parseBackup } from "./model.js";
import { transferIds } from "./transfer-catalog.js";

const positions = new Map(transferIds.map((id, index) => [id, index]));

// Detect truncated/edited links. This is an integrity check, not encryption.
function checksum(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}

function encodeHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function positionOf(id) {
  const position = positions.get(id);
  if (position === undefined) throw new Error("Unmapped transfer ID");
  return position;
}

export function createTransferUrl(address, state) {
  if (
    !["ru", "en"].includes(state.language) ||
    !["light", "dark"].includes(state.theme)
  ) {
    throw new Error("Invalid transfer preferences");
  }
  // Preference flags, a two-byte current position (0 = none),
  // then one completion bit per permanent catalogue position, least significant first.
  const bytes = new Uint8Array(3 + Math.ceil(transferIds.length / 8));
  bytes[0] =
    (state.language === "en" ? 1 : 0) | (state.theme === "dark" ? 2 : 0);
  const current = state.currentItemId ? positionOf(state.currentItemId) + 1 : 0;
  bytes[1] = current >>> 8;
  bytes[2] = current & 255;
  for (const id of state.completed) {
    const position = positionOf(id);
    bytes[3 + (position >>> 3)] |= 1 << (position % 8);
  }

  const url = new URL(address);
  url.search = "";
  // Telegram can strip base64url underscores as text formatting. Version 2
  // uses hex so shared progress contains no formatting markers.
  url.hash = `progress=2.${encodeHex(bytes)}.${checksum(bytes)}`;
  return url.href;
}

export function parseTransferHash(hash, knownIds) {
  if (!hash.startsWith("#progress=")) return null;
  if (hash.length > 2048) throw new Error("Transfer too large");
  const match = /^#progress=2\.((?:[a-f0-9]{2})+)\.([a-f0-9]{8})$/.exec(hash);
  if (!match) throw new Error("Invalid transfer version or encoding");

  const [, payload, expectedChecksum] = match;
  const bytes = Uint8Array.from(payload.match(/.{2}/g), (pair) =>
    Number.parseInt(pair, 16),
  );
  if (
    bytes.length < 3 ||
    bytes[0] > 3 ||
    checksum(bytes) !== expectedChecksum
  ) {
    throw new Error("Damaged transfer");
  }

  const current = (bytes[1] << 8) | bytes[2];
  if (current > transferIds.length)
    throw new Error("Update required for this transfer");
  const completed = [];
  for (let position = 0; position < (bytes.length - 3) * 8; position++) {
    if (!(bytes[3 + (position >>> 3)] & (1 << (position % 8)))) continue;
    if (position >= transferIds.length)
      throw new Error("Update required for this transfer");
    completed.push(transferIds[position]);
  }

  return parseBackup(
    JSON.stringify({
      app: "hellisus-cheatsheet",
      version: 1,
      completed,
      currentItemId: current ? transferIds[current - 1] : undefined,
      language: bytes[0] & 1 ? "en" : "ru",
      theme: bytes[0] & 2 ? "dark" : "light",
    }),
    knownIds,
  );
}
