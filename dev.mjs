// npm run dev: the page on http://localhost:8000/ (PORT= to change), rebuilt with `npm run build`
// whenever a file under web/, patch/ or images/ or release.json changes, then reloaded in the
// browser. Development only: the reload script is added to index.html as it is served, never to
// build/site/. Nothing is cached, so a reload always shows the latest build.
import { spawnSync } from "node:child_process";
import { readFileSync, statSync, watch } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const SITE = "build/site";
const PORT = Number(process.env.PORT ?? 8000);
const WATCHED = ["web", "patch", "images", "release.json"];
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
};
// A script file, not inline: the page's Content-Security-Policy allows only scripts from the site.
const RELOAD_JS = 'new EventSource("/dev-reload").onmessage = () => location.reload();\n';
const clients = new Set();

function build() {
  return spawnSync(process.execPath, ["build.mjs"], { stdio: "inherit" }).status === 0;
}

function serve(req, res) {
  const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (path === "/dev-reload") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store" });
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }
  if (path === "/dev-reload.js") {
    res.writeHead(200, { "content-type": TYPES[".js"], "cache-control": "no-store" });
    res.end(RELOAD_JS);
    return;
  }
  // normalize() resolves "..", and a path starting with "/" cannot climb out of SITE.
  let file = join(SITE, normalize(path));
  if (path.endsWith("/")) file = join(file, "index.html");
  let body;
  try {
    if (!statSync(file).isFile()) throw new Error();
    body = readFileSync(file);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found\n");
    return;
  }
  if (file.endsWith("index.html")) {
    body = body.toString().replace("</head>", '<script src="/dev-reload.js"></script>\n</head>');
  }
  res.writeHead(200, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    "cache-control": "no-store",
  });
  res.end(body);
}

if (!build()) process.exit(1);
let timer = null;
for (const target of WATCHED) {
  // Editors write a file in several steps: rebuild once they are done.
  watch(target, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (build()) for (const client of clients) client.write("data: reload\n\n");
    }, 150);
  });
}
createServer(serve).listen(PORT, "localhost", () =>
  console.log(`http://localhost:${PORT}/ (rebuilds and reloads on changes; Ctrl+C stops)`),
);
