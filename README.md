# OG Downloader

Chrome extension that reads Open Graph and related meta tags on the current tab, previews the image, and downloads it.

## Install

1. Open Chrome → `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked**
4. Select the `OGDownloader` folder

The icon appears in the toolbar. Open any website and click it to see the OG image.

## Usage

- **Download** — saves to your Downloads folder as `{site}-{title}.{ext}`
- **Copy URL** — copies the raw image URL
- **Open** — opens the image in a new tab
- If there are several images, pick a thumbnail
- Right-click the page → **Download OG image**
- Shortcut **Alt+Shift+O** opens the popup (Option+Shift+O on macOS)

On `chrome://` pages, the Web Store, and PDFs the extension cannot run — that is a Chrome limit.

## Language

The UI defaults to English. Switch language in the popup: English, Français, Русский, 中文. The choice is saved.

To add another language, copy the `en` block in [`locales.js`](locales.js), use a BCP 47 code as the key (`de`, `es`, `ja`, …), set `name` to the native language name, and translate `strings`. Missing keys fall back to English. Reload the extension — the picker updates on its own.

## Tags we read

In priority order:

1. `og:image`, `og:image:url`, `og:image:secure_url`
2. `twitter:image`, `twitter:image:src`
3. `<link rel="image_src">`
4. `itemprop="image"`, `vk:image`
5. JSON-LD `image` on `WebPage` / `Article` / `NewsArticle`

Title, description, and dimensions are shown when present.

Local parser fixture: serve `test/fixture.html` over HTTP (not `file://`).

## Permissions

- **Current tab** — read meta tags when you click the icon
- **Downloads** — save the file
- **Host access** — fetch the image from a CDN if a direct download is blocked
- **Storage** — remember the selected language

The extension does not read history, cookies, or other tabs.

## Icons

Rebuild the PNGs in `icons/`:

```bash
python3 scripts/generate_icons.py
```
