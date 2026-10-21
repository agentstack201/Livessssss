const fs = require("fs");
const path = require("path");

const PUBLIC_DIR = path.join(__dirname, "..", "public");

// Resolves a path under public/ ignoring filename case, so an asset still loads
// when a copy to the server kept only one of two names differing in case
// (e.g. 1.png vs 1.PNG) or changed the extension's case.
function resolvePublicPath(relPath) {
  const clean = String(relPath).replace(/^\/?public\//i, "").replace(/^\//, "");
  const exact = path.join(PUBLIC_DIR, clean);
  if (fs.existsSync(exact)) return exact;

  let dir = PUBLIC_DIR;
  for (const part of clean.split(/[\\/]/).filter(Boolean)) {
    const match = fs.readdirSync(dir).find((n) => n.toLowerCase() === part.toLowerCase());
    if (!match) return exact;
    dir = path.join(dir, match);
  }
  return dir;
}

function readPublicFile(relPath) {
  return fs.readFileSync(resolvePublicPath(relPath));
}

module.exports = { PUBLIC_DIR, resolvePublicPath, readPublicFile };
