"use strict";

/*
  Add a language:
  1. Copy the `en` block below.
  2. Use a BCP 47 code as the key (`de`, `es`, `ja`, …).
  3. Set `name` to the native language name (shown in the picker).
  4. Translate `strings`. Missing keys fall back to English.

  Then reload the extension. The language picker updates automatically.
*/

var I18N_LOCALES = {
  en: {
    name: "English",
    strings: {
      language: "Language",
      refresh: "Refresh",
      loading: "Reading page meta tags…",
      restrictedTitle: "Not available on this page",
      restrictedBody: "Open a regular HTTP or HTTPS site and try the icon again.",
      errorTitle: "Couldn’t read this page",
      errorRetry: "Try again",
      errorFallback: "Refresh the page and open the extension again.",
      errorNoMeta: "The page did not return any meta tags.",
      emptyTitle: "No OG image on this page",
      emptyBody:
        "No <code>og:image</code>, Twitter Card, or fallback tags. If this is an SPA, wait for it to load and press Refresh.",
      previewFailed: "Image failed to load",
      previewRetry: "Retry",
      previewAlt: "OG image preview",
      download: "Download",
      copyUrl: "Copy URL",
      open: "Open",
      otherImages: "Other images",
      downloading: "Downloading…",
      downloadFailed: "Couldn’t download",
      savedToDownloads: "Saved to Downloads",
      urlCopied: "URL copied",
      copyFailed: "Couldn’t copy URL",
      contextMenuDownload: "Download OG image",
      readFileFailed: "Couldn’t read the file",
      serverStatus: "Server returned {status}",
      pageRestricted: "The extension isn’t available on this page",
      noOgImage: "No OG image on this page"
    }
  },
  fr: {
    name: "Français",
    strings: {
      language: "Langue",
      refresh: "Actualiser",
      loading: "Lecture des balises meta…",
      restrictedTitle: "Indisponible sur cette page",
      restrictedBody: "Ouvrez un site HTTP ou HTTPS ordinaire, puis réessayez.",
      errorTitle: "Impossible de lire cette page",
      errorRetry: "Réessayer",
      errorFallback: "Actualisez la page et rouvrez l’extension.",
      errorNoMeta: "La page n’a renvoyé aucune balise meta.",
      emptyTitle: "Pas d’image OG sur cette page",
      emptyBody:
        "Pas de <code>og:image</code>, de Twitter Card ni de balises de repli. Si c’est une SPA, attendez le chargement et cliquez sur Actualiser.",
      previewFailed: "L’image n’a pas pu être chargée",
      previewRetry: "Réessayer",
      previewAlt: "Aperçu de l’image OG",
      download: "Télécharger",
      copyUrl: "Copier l’URL",
      open: "Ouvrir",
      otherImages: "Autres images",
      downloading: "Téléchargement…",
      downloadFailed: "Téléchargement impossible",
      savedToDownloads: "Enregistré dans Téléchargements",
      urlCopied: "URL copiée",
      copyFailed: "Impossible de copier l’URL",
      contextMenuDownload: "Télécharger l’image OG",
      readFileFailed: "Impossible de lire le fichier",
      serverStatus: "Le serveur a renvoyé {status}",
      pageRestricted: "L’extension n’est pas disponible sur cette page",
      noOgImage: "Pas d’image OG sur cette page"
    }
  },
  ru: {
    name: "Русский",
    strings: {
      language: "Язык",
      refresh: "Обновить",
      loading: "Читаю мета-теги страницы…",
      restrictedTitle: "Расширение здесь недоступно",
      restrictedBody: "Откройте обычный сайт по HTTP или HTTPS и нажмите иконку снова.",
      errorTitle: "Не удалось прочитать страницу",
      errorRetry: "Повторить",
      errorFallback: "Обновите страницу и откройте расширение снова.",
      errorNoMeta: "Страница не вернула мета-теги.",
      emptyTitle: "На этой странице нет OG-картинки",
      emptyBody:
        "Нет <code>og:image</code>, Twitter Card и запасных тегов. Если это SPA, дождитесь загрузки и нажмите «Обновить».",
      previewFailed: "Картинка не загрузилась",
      previewRetry: "Повторить",
      previewAlt: "Превью OG-картинки",
      download: "Скачать",
      copyUrl: "Копировать URL",
      open: "Открыть",
      otherImages: "Другие картинки",
      downloading: "Скачиваю…",
      downloadFailed: "Не удалось скачать",
      savedToDownloads: "Сохранено в Загрузки",
      urlCopied: "URL скопирован",
      copyFailed: "Не удалось скопировать URL",
      contextMenuDownload: "Скачать OG-картинку",
      readFileFailed: "Не удалось прочитать файл",
      serverStatus: "Сервер вернул {status}",
      pageRestricted: "На этой странице расширение недоступно",
      noOgImage: "На этой странице нет OG-картинки"
    }
  },
  zh: {
    name: "中文",
    strings: {
      language: "语言",
      refresh: "刷新",
      loading: "正在读取页面元标签…",
      restrictedTitle: "此页面无法使用",
      restrictedBody: "请打开普通的 HTTP 或 HTTPS 网站后再试。",
      errorTitle: "无法读取此页面",
      errorRetry: "重试",
      errorFallback: "请刷新页面后再次打开扩展。",
      errorNoMeta: "页面未返回任何元标签。",
      emptyTitle: "此页面没有 OG 图片",
      emptyBody:
        "未找到 <code>og:image</code>、Twitter Card 或其他备用标签。如果是 SPA，请等待加载完成后点击刷新。",
      previewFailed: "图片加载失败",
      previewRetry: "重试",
      previewAlt: "OG 图片预览",
      download: "下载",
      copyUrl: "复制链接",
      open: "打开",
      otherImages: "其他图片",
      downloading: "正在下载…",
      downloadFailed: "无法下载",
      savedToDownloads: "已保存到下载文件夹",
      urlCopied: "链接已复制",
      copyFailed: "无法复制链接",
      contextMenuDownload: "下载 OG 图片",
      readFileFailed: "无法读取文件",
      serverStatus: "服务器返回 {status}",
      pageRestricted: "此页面无法使用扩展",
      noOgImage: "此页面没有 OG 图片"
    }
  }
};
