/**
 * Capture real OG Downloader UI against live Apple / DJI pages.
 * Renders the production popup build with chrome.* mocked to the live extract result.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import {
  readFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  unlinkSync
} from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { extractOpenGraph } from "../src/shared/extract.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const STORE = join(ROOT, "store");
const OUT = join(STORE, "captures");
const PYTHON = join(STORE, ".venv/bin/python");

const SITES = [
  {
    id: "alexkrivov",
    url: "https://www.alexkrivov.com/",
    scenes: [
      { scene: "main", out: "screenshot-1.png", theme: "light" },
      { scene: "gallery", out: "screenshot-2.png", theme: "light" },
      { scene: "gallery", out: "screenshot-3.png", theme: "dark", galleryFilter: "all" }
    ]
  }
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".woff": "font/woff"
};

function startStaticServer(root) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      let filePath = join(root, decodeURIComponent(url.pathname));
      if (url.pathname === "/" || url.pathname.endsWith("/")) {
        filePath = join(filePath, "index.html");
      }
      if (!filePath.startsWith(root) || !existsSync(filePath)) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": MIME[extname(filePath)] || "application/octet-stream",
        "Cache-Control": "no-store"
      });
      res.end(readFileSync(filePath));
    });
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function buildHarnessHtml() {
  const popupHtml = readFileSync(join(DIST, "popup.html"), "utf8");
  const inject = `
<script>
(() => {
  const shot = JSON.parse(sessionStorage.getItem("og-shot") || "{}");
  window.__SHOT__ = shot;
  window.chrome = {
    runtime: {
      lastError: null,
      sendMessage(payload, cb) {
        const respond = (value) => {
          if (typeof cb === "function") cb(value);
          return value;
        };
        if (!payload || !payload.type) return respond({ ok: false });
        if (payload.type === "probe") {
          return respond({
            ok: true,
            type: shot.probeType || "image/jpeg",
            size: shot.probeSize || 240000
          });
        }
        if (payload.type === "download" || payload.type === "downloadMany") {
          return respond({
            ok: true,
            count: (payload.items && payload.items.length) || 1,
            total: (payload.items && payload.items.length) || 1,
            zip: Boolean(payload.zip)
          });
        }
        return respond({ ok: false });
      },
      onMessage: {
        addListener() {},
        removeListener() {}
      }
    },
    storage: {
      local: {
        get(defaults, cb) {
          const data = Object.assign({}, defaults || {}, shot.storage || {});
          if (typeof cb === "function") cb(data);
          return Promise.resolve(data);
        },
        set(values, cb) {
          shot.storage = Object.assign({}, shot.storage || {}, values || {});
          sessionStorage.setItem("og-shot", JSON.stringify(shot));
          if (typeof cb === "function") cb();
          return Promise.resolve();
        }
      }
    },
    tabs: {
      query() {
        return Promise.resolve([
          { id: 1, url: shot.tabUrl, active: true, currentWindow: true }
        ]);
      },
      create() {
        return Promise.resolve({});
      }
    },
    scripting: {
      executeScript() {
        return Promise.resolve([{ result: shot.data }]);
      }
    }
  };
})();
</script>`;

  return popupHtml
    .replace(
      /<div id="boot-loader"[\s\S]*?<\/div>\s*<div id="root"><\/div>/,
      '<div id="root"></div>'
    )
    .replace(/src="\.\/assets\//g, 'src="/assets/')
    .replace(/href="\.\/assets\//g, 'href="/assets/')
    .replace("<head>", "<head>" + inject);
}

async function prepareScene(popup, scene, opts = {}) {
  await popup.waitForSelector("text=OG Downloader", { timeout: 30000 });
  await popup
    .waitForFunction(() => {
      const text = document.body?.innerText || "";
      return (
        !/Reading page meta tags|Scanning images|Читаю|正在读取/i.test(text) &&
        (/Download|All images|Settings|Скачать|下载/i.test(text) ||
          /No OG|Not available|Couldn’t read|нет OG/i.test(text))
      );
    }, null, { timeout: 30000 })
    .catch(() => {});

  await popup.waitForTimeout(800);

  if (scene === "gallery") {
    const allImages = popup.getByText(/All images\s*\(/i).first();
    if (await allImages.count()) {
      await allImages.click();
      await popup.waitForTimeout(800);

      const preferAll = opts.galleryFilter === "all";
      if (!preferAll) {
        // Prefer a compact filter so header + grid + download fit in one frame
        const compact = popup
          .locator("span, button, div")
          .filter({ hasText: /^(PNG|GIF|AVIF)\s*\d+$/i });
        if (await compact.count()) {
          await compact.first().click().catch(() => {});
          await popup.waitForTimeout(400);
        }
      } else {
        // Keep All selected — show many thumbnails
        const allTag = popup
          .locator("span, button, div")
          .filter({ hasText: /^All\s*\d+$/i })
          .first();
        if (await allTag.count()) {
          await allTag.click().catch(() => {});
          await popup.waitForTimeout(300);
        }
      }

      const cells = popup.locator('[class*="aspect-square"]');
      const count = await cells.count();
      const selectCount = preferAll ? Math.min(count, 6) : Math.min(count, 3);
      for (let i = 0; i < selectCount; i++) {
        await cells.nth(i).click({ force: true }).catch(() => {});
        await popup.waitForTimeout(80);
      }

      if (!preferAll) {
        const more = cells.first().locator("button").first();
        if (await more.count()) {
          await cells.first().hover().catch(() => {});
          await more.click({ force: true }).catch(() => {});
          await popup.waitForTimeout(300);
        }
      }

      const zipTrigger = popup.getByLabel(/More download options/i);
      if (await zipTrigger.count()) {
        await zipTrigger.click();
        await popup.waitForTimeout(400);
        await popup.getByText(/Download ZIP/i).waitFor({ timeout: 3000 }).catch(() => {});
      }

      await popup.evaluate(() => window.scrollTo(0, 0));
    }
  }

  if (scene === "settings") {
    await popup.getByLabel(/Settings/i).click();
    await popup.waitForTimeout(600);
    const dialog = popup.locator("[role='dialog']");
    await dialog.waitFor({ timeout: 10000 });
    // Language field is the first labeled select — open its trigger
    const langLabel = dialog.getByText(/^Language$/i);
    if (await langLabel.count()) {
      const field = langLabel.locator("xpath=ancestor::div[contains(@class,'flex')][1]");
      const trigger = field.locator("button").first();
      if (await trigger.count()) await trigger.click();
      else await dialog.locator("button").filter({ hasText: /English/i }).first().click();
    } else {
      await dialog.locator("button").filter({ hasText: /English/i }).first().click();
    }
    await popup.waitForTimeout(500);
    await popup.locator("[role='listbox'], [role='option']").first().waitFor({ timeout: 4000 }).catch(() => {});
  }
}

function compose(pageShot, popupShot, outPath, opts = {}) {
  const result = spawnSync(
    PYTHON,
    [join(STORE, "recompose_one.py"), pageShot, popupShot, outPath, String(opts.center ? 1 : 0)],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    console.error(result.stdout, result.stderr);
    throw new Error("compose failed for " + outPath);
  }
  console.log(result.stdout.trim());
}

async function main() {
  if (!existsSync(PYTHON)) {
    throw new Error("Missing store/.venv with Pillow. Create it first.");
  }
  mkdirSync(OUT, { recursive: true });
  const harnessPath = join(DIST, "index.html");
  writeFileSync(harnessPath, buildHarnessHtml());

  const { server, port } = await startStaticServer(DIST);
  const harness = `http://127.0.0.1:${port}/`;
  console.log("harness", harness);

  const browser = await chromium.launch({
    channel: "chrome",
    headless: true
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
  });

  const outputs = [];

  try {
    for (const site of SITES) {
      console.log("→", site.url);
      const page = await context.newPage();
      await page.goto(site.url, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForTimeout(4000);

      const data = await page.evaluate(extractOpenGraph);
      if (!data.pageImages) data.pageImages = [];
      if (!data.images) data.images = [];
      console.log(
        `  host=${data.host} og=${data.images.length} page=${data.pageImages.length} title=${(data.title || "").slice(0, 60)}`
      );

      const pageShot = join(OUT, `${site.id}-page.png`);
      await page.screenshot({ path: pageShot, type: "png", animations: "disabled" });

      for (const cfg of site.scenes) {
        const popup = await context.newPage();
        await popup.setViewportSize({
          width: 360,
          height: cfg.scene === "gallery" ? 920 : 740
        });

        const payload = {
          tabUrl: site.url,
          data,
          probeType: "image/jpeg",
          probeSize: 220000,
          storage: { theme: cfg.theme }
        };
        await popup.addInitScript((shot) => {
          sessionStorage.setItem("og-shot", JSON.stringify(shot));
        }, payload);

        await popup.goto(harness, { waitUntil: "networkidle", timeout: 90000 });
        await prepareScene(popup, cfg.scene, cfg);

        // Wait for preview image if present
        const img = popup.locator("img").first();
        if (await img.count()) {
          await img
            .evaluate((el) =>
              el.complete && el.naturalWidth
                ? true
                : new Promise((resolve) => {
                    el.onload = () => resolve(true);
                    el.onerror = () => resolve(false);
                    setTimeout(() => resolve(false), 4000);
                  })
            )
            .catch(() => {});
        }
        await popup.waitForTimeout(500);

        if (cfg.scene === "gallery") {
          const showMany = cfg.galleryFilter === "all";
          await popup.evaluate(() => window.scrollTo(0, 0));
          if (showMany) {
            // Shrink OG block so the grid of thumbnails dominates the frame
            await popup.evaluate(() => {
              document.querySelectorAll(".og-preview-frame").forEach((el) => {
                el.style.maxHeight = "56px";
                el.style.overflow = "hidden";
              });
              document
                .querySelectorAll("h1, [class*='line-clamp'], .line-clamp-2")
                .forEach((el) => {
                  el.style.display = "none";
                });
            });
            await popup.waitForTimeout(200);
            // Wait for several thumbnails to load
            await popup
              .waitForFunction(() => {
                const imgs = [...document.querySelectorAll('[class*="aspect-square"] img')];
                const ready = imgs.filter((i) => i.complete && i.naturalWidth > 0).length;
                return ready >= Math.min(9, imgs.length);
              }, null, { timeout: 8000 })
              .catch(() => {});
          }
          let bottom = await popup.evaluate(() => {
            const downloadBtns = [...document.querySelectorAll("button")].filter((b) =>
              /Download/i.test(b.textContent || "")
            );
            const dl = downloadBtns[downloadBtns.length - 1];
            return dl ? dl.getBoundingClientRect().bottom + 24 : 820;
          });
          if (bottom > 860 && !showMany) {
            await popup.evaluate(() => {
              document.querySelectorAll(".og-preview-frame").forEach((el) => {
                el.style.maxHeight = "72px";
                el.style.overflow = "hidden";
              });
              document.querySelectorAll("h1, [class*='Card.Title'], .line-clamp-2").forEach((el) => {
                if ((el.textContent || "").length > 40) el.style.display = "none";
              });
            });
            await popup.waitForTimeout(100);
            bottom = await popup.evaluate(() => {
              const downloadBtns = [...document.querySelectorAll("button")].filter((b) =>
                /Download/i.test(b.textContent || "")
              );
              const dl = downloadBtns[downloadBtns.length - 1];
              return dl ? dl.getBoundingClientRect().bottom + 24 : 820;
            });
          }
          const height = showMany
            ? Math.ceil(Math.min(Math.max(bottom, 720), 900))
            : Math.ceil(Math.min(Math.max(bottom, 560), 860));
          await popup.setViewportSize({ width: 360, height });
          await popup.waitForTimeout(200);
          await popup.evaluate(() => window.scrollTo(0, 0));
          const shotPath = join(OUT, `${site.id}-${cfg.out.replace(".png", "")}-popup.png`);
          await popup.screenshot({ path: shotPath, type: "png", animations: "disabled" });
          compose(pageShot, shotPath, join(STORE, cfg.out), { center: false });
          outputs.push(cfg.out);
          await popup.close();
          continue;
        }

        if (cfg.scene === "settings") {
          await popup.evaluate(() => window.scrollTo(0, 0));
          const contentH = await popup.evaluate(() => {
            const root = document.getElementById("root") || document.body;
            return Math.ceil(
              Math.max(root.scrollHeight, document.documentElement.scrollHeight, 240)
            );
          });
          await popup.setViewportSize({
            width: 360,
            height: Math.min(Math.max(contentH + 4, 420), 800)
          });
        } else {
          await popup.evaluate(() => window.scrollTo(0, 0));
          const contentH = await popup.evaluate(() => {
            const root = document.getElementById("root") || document.body;
            return Math.ceil(
              Math.max(root.scrollHeight, document.documentElement.scrollHeight, 240)
            );
          });
          await popup.setViewportSize({
            width: 360,
            height: Math.min(Math.max(contentH + 4, 240), 820)
          });
        }
        await popup.waitForTimeout(250);

        const popupShot = join(OUT, `${site.id}-${cfg.scene}-popup.png`);
        await popup.screenshot({ path: popupShot, type: "png", animations: "disabled" });

        const outPath = join(STORE, cfg.out);
        const opts =
          cfg.scene === "settings"
            ? { scale: 1.4, center: true }
            : cfg.scene === "gallery"
              ? { scale: 0.9, top: 16, right: 22 }
              : { scale: 1, top: 20, right: 24 };
        compose(pageShot, popupShot, outPath, opts);
        outputs.push(cfg.out);
        await popup.close();
      }

      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
    try {
      unlinkSync(harnessPath);
    } catch {}
  }

  console.log("Done:", outputs.join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
