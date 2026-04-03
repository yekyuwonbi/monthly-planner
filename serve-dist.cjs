const http = require("http");
const fs = require("fs");
const path = require("path");

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 4173);
const root = path.join(__dirname, "dist");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
};

function sendFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("파일을 읽지 못했어요.");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const requestPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const targetPath = path.normalize(path.join(root, safePath));

  if (!targetPath.startsWith(root)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("접근할 수 없어요.");
    return;
  }

  fs.stat(targetPath, (err, stats) => {
    if (!err && stats.isFile()) {
      sendFile(targetPath, res);
      return;
    }
    sendFile(path.join(root, "index.html"), res);
  });
});

server.listen(port, host, () => {
  console.log(`Weekly Planner local server running at http://${host}:${port}`);
});
