const frontend = process.env.DEV_STACK_FRONTEND_URL || "http://127.0.0.1:5173";
const backend = process.env.DEV_STACK_BACKEND_URL || "http://127.0.0.1:8787";

const page = await fetch(`${frontend}/`);
if (!page.ok || !page.headers.get("content-type")?.includes("text/html")) {
  throw new Error(`Frontend check failed with ${page.status}.`);
}

const health = await fetch(`${backend}/api/health`);
const healthBody = await health.json();
if (!health.ok || healthBody.ok !== true) throw new Error(`Backend health check failed with ${health.status}.`);

const media = await fetch(`${backend}/media/not-found.jpg`);
const mediaBody = await media.json();
if (media.status !== 404 || mediaBody.reasonCode !== "media_not_found") {
  throw new Error(`Media fallback check failed with ${media.status}.`);
}

console.log("Development stack verified: frontend 5173, backend 8787, JSON media 404.");
