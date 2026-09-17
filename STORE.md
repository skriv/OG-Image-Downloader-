# Chrome Web Store listing

Living notes for the public listing. Write in **English**. The agent updates this file on each push: keep **Version** in sync, refresh **Current features** when something ships, and maintain **Planned / upcoming** when new work is agreed or deferred.

## Identity

- **Name:** OG Downloader
- **Version:** 1.3.0
- **Category:** Productivity / Developer tools (draft)

## Short description

Download Open Graph and other images from the current page.

## Detailed description

OG Downloader reads Open Graph and related meta tags on the active tab, previews the image, and saves it to Downloads. It can also list other pictures found on the page, filter by format, and download them one by one or as a ZIP.

Supports English, Français, Русский, and 中文. Theme: light, dark, or system.

## Current features

- Preview and download the primary OG image (`og:image`, Twitter Card, and common fallbacks)
- Multiple OG candidates with thumbnail picker
- Page gallery: `img`, srcset, CSS backgrounds, inline SVG
- Format filter, multi-select, sequential download or ZIP
- Context menu: Download OG image
- Keyboard shortcut: Alt+Shift+O (Option+Shift+O on macOS)
- Language and theme settings (persisted)
- CDN-aware download fallback (candidate URLs, image sniffing, correct file extension)
- Automated unit tests for extract, filename, download, zip, and i18n helpers

## Planned / upcoming

_Agent maintains this list. Move items to **Current features** when they ship._

- Keep Chrome Web Store listing copy and screenshots aligned with each release
- Expand language coverage beyond en / fr / ru / zh when requested

## Store assets

- Screenshots: `store/screenshot-1.png` … `store/screenshot-3.png`
- Listing mock / capture helpers: `store/listing.html`, `store/capture-real.mjs`
- Privacy policy: `store/privacy.html`
