#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "kb");
const MAX_CHUNK_BYTES = 150 * 1024; // ~150 KB per .md

const EXCLUDE_DIRS = new Set([
  "node_modules",".git",".next","build","dist","out","coverage",".turbo",".vercel",
  ".vscode",".idea",".yarn",".expo",".pnpm-store",".cache"
]);

const ALLOW_EXT = new Set([
  ".ts",".tsx",".js",".jsx",".mjs",".cjs",".md",".json",".yml",".yaml",".sql",
  ".py",".sh",".bash",".zsh",".toml",".ini",".env.example",".css",".scss"
]);

const MAX_FILE_BYTES = 1 * 1024 * 1024; // 1 MB per sicurezza
const BINARY_EXT = new Set([
  ".png",".jpg",".jpeg",".gif",".webp",".svg",".ico",".pdf",".zip",".rar",".7z",
  ".mp3",".mp4",".mov",".woff",".woff2",".ttf",".otf",".eot",".wasm"
]);

function langFromExt(ext) {
  switch (ext) {
    case ".ts": return "ts";
    case ".tsx": return "tsx";
    case ".js": return "js";
    case ".jsx": return "jsx";
    case ".mjs":
    case ".cjs": return "js";
    case ".md": return "md";
    case ".json": return "json";
    case ".yml":
    case ".yaml": return "yaml";
    case ".sql": return "sql";
    case ".py": return "python";
    case ".sh":
    case ".bash":
    case ".zsh": return "bash";
    case ".toml": return "toml";
    case ".ini": return "ini";
    case ".css": return "css";
    case ".scss": return "scss";
    default: return ""; // testo generico
  }
}

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(ROOT, full);
    if (e.isDirectory()) {
      if (EXCLUDE_DIRS.has(e.name)) continue;
      yield* walk(full);
    } else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (BINARY_EXT.has(ext)) continue;
      if (!ALLOW_EXT.has(ext)) continue;
      yield { full, rel, ext };
    }
  }
}

function headerBlock(relPath) {
  return `\n\n## File: ${relPath}\n\n`;
}

function fenced(content, lang) {
  // Se è già markdown, non lo racchiudo in fence per evitare effetti strani
  if (lang === "md") return content.endsWith("\n") ? content : content + "\n";
  return "```" + (lang || "") + "\n" + content + "\n```\n";
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const collected = [];
  for await (const f of walk(ROOT)) {
    try {
      const stat = await fs.stat(f.full);
      if (stat.size > MAX_FILE_BYTES) {
        console.warn(`[skip >1MB] ${f.rel}`);
        continue;
      }
      const buf = await fs.readFile(f.full);
      const text = buf.toString("utf8");
      collected.push({ ...f, size: stat.size, text });
    } catch (err) {
      console.warn(`[skip error] ${f.rel}: ${err.message}`);
    }
  }

  // Ordina per path per stabilità
  collected.sort((a, b) => a.rel.localeCompare(b.rel));

  // Scrivi indice
  const indexLines = [
    "# Knowledge Base Index",
    "",
    "| File | Bytes |",
    "|---|---:|",
    ...collected.map(f => `| \`${f.rel}\` | ${f.size} |`)
  ];
  await fs.writeFile(path.join(OUT_DIR, "_INDEX.md"), indexLines.join("\n"), "utf8");

  // Chunking in più markdown
  let chunkIndex = 1;
  let current = `# Repository Knowledge Base (chunk ${String(chunkIndex).padStart(4,"0")})\n`;
  let currentBytes = Buffer.byteLength(current, "utf8");

  async function flush() {
    const outPath = path.join(OUT_DIR, `${String(chunkIndex).padStart(4,"0")}.md`);
    await fs.writeFile(outPath, current, "utf8");
    chunkIndex++;
    current = `# Repository Knowledge Base (chunk ${String(chunkIndex).padStart(4,"0")})\n`;
    currentBytes = Buffer.byteLength(current, "utf8");
  }

  for (const f of collected) {
    const lang = langFromExt(f.ext);
    const block = headerBlock(f.rel) + fenced(f.text, lang);
    const blockBytes = Buffer.byteLength(block, "utf8");
    if (currentBytes + blockBytes > MAX_CHUNK_BYTES && currentBytes > 0) {
      await flush();
    }
    current += block;
    currentBytes += blockBytes;
  }

  if (currentBytes > 0) {
    const outPath = path.join(OUT_DIR, `${String(chunkIndex).padStart(4,"0")}.md`);
    await fs.writeFile(outPath, current, "utf8");
  }

  console.log(`✅ Esportazione completata. Vedi cartella: ${OUT_DIR}`);
  console.log(`- Indice: kb/_INDEX.md`);
  console.log(`- Chunks: kb/0001.md, kb/0002.md, ...`);
  console.log(`Suggerimento: condividi con me i chunk rilevanti al problema che vuoi analizzare.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
