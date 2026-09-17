# OG Downloader

Chrome extension that reads Open Graph tags on the current tab, downloads the OG image, and can save other pictures from the page.

The popup UI is built with [HeroUI](https://github.com/heroui-inc/heroui) (React + Tailwind) and supports light, dark, and system themes.

## Install (development)

1. Install dependencies and build:

```bash
npm install
npm run build
```

2. Open Chrome → `chrome://extensions`
3. Turn on **Developer mode**
4. Click **Load unpacked**
5. Select the `dist` folder inside this repo

For iterative UI work, keep a watch build running:

```bash
npm run dev
```

Then click **Reload** on the extension card in `chrome://extensions`.

The toolbar icon opens the popup on any website.

## Usage

- **Download** — saves the OG image to Downloads as `{site}-{title}.{ext}`
- **Copy URL** / **Open** — raw OG image URL
- If there are several OG candidates, pick a thumbnail
- **All images (N)** — collapsed list of pictures on the page (`img`, srcset, CSS backgrounds, inline SVG). Filter by format, select, then download
- **Download ▾** — main button saves files one by one; the caret opens **Download ZIP** for a single archive
- Right-click the page → **Download OG image**
- Shortcut **Alt+Shift+O** opens the popup (Option+Shift+O on macOS)
- Theme and language live under **Settings** (gear) in the popup header; the choices are saved
- **Refresh** is the circular arrow icon in the header

On `chrome://` pages, the Web Store, and PDFs the extension cannot run — that is a Chrome limit.

## Language

The UI defaults to English. Switch language in the popup: English, Français, Русский, 中文. The choice is saved.

To add another language, copy the `en` block in [`src/shared/locales.js`](src/shared/locales.js), use a BCP 47 code as the key (`de`, `es`, `ja`, …), set `name` to the native language name, and translate `strings`. Missing keys fall back to English. Rebuild and reload the extension — the picker updates on its own.

## Tags we read

In priority order:

1. `og:image`, `og:image:url`, `og:image:secure_url`
2. `twitter:image`, `twitter:image:src`
3. `<link rel="image_src">`
4. `itemprop="image"`, `vk:image`
5. JSON-LD `image` on `WebPage` / `Article` / `NewsArticle`

Title, description, and dimensions are shown when present.

Local parser fixture: `test/fixture.html`. Run the suite with:

```bash
npm test
```

## Permissions

- **Current tab** — read meta tags when you click the icon
- **Downloads** — save the file
- **Host access** — fetch the image from a CDN if a direct download is blocked
- **Storage** — remember language and theme

The extension does not read history, cookies, or other tabs.

## Icons

Rebuild the PNGs (writes to both `icons/` and `public/icons/`):

```bash
python3 scripts/generate_icons.py
```
