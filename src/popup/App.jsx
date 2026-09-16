import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Chip,
  Spinner
} from "@heroui/react";
import {
  buildFilename,
  extractOpenGraph,
  extensionFromMime,
  extensionFromUrl,
  isRestrictedUrl,
  slugify
} from "../shared/extract.js";
import { useI18n } from "./i18n.jsx";
import { SettingsButton } from "./SettingsButton.jsx";
import { RefreshIcon } from "./icons.jsx";
import { PreviewImage } from "./components/PreviewImage.jsx";
import { Gallery } from "./components/Gallery.jsx";
import { buildBadgeText, sourceLabel } from "./preview.js";

function sendMessage(payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(payload, (result) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(result);
    });
  });
}

export default function App() {
  const { t, ready } = useI18n();
  const [view, setView] = useState("loading");
  const [host, setHost] = useState("—");
  const [data, setData] = useState(null);
  const [index, setIndex] = useState(0);
  const [probe, setProbe] = useState(null);
  const [natural, setNatural] = useState(null);
  const [previewBroken, setPreviewBroken] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [status, setStatus] = useState(null);
  const [errorText, setErrorText] = useState("");
  const [errorKey, setErrorKey] = useState(null);
  const [galleryFilter, setGalleryFilter] = useState("all");
  const [gallerySelected, setGallerySelected] = useState(() => Object.create(null));
  const [busy, setBusy] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);

  const locked = busy || batchBusy;
  const image = data && data.images && data.images.length ? data.images[index] || data.images[0] : null;
  const pageImages = (data && data.pageImages) || [];
  const showGallery = (view === "empty" || view === "content") && pageImages.length > 0;

  const badge = useMemo(
    () => buildBadgeText(image, probe, natural, extensionFromMime, extensionFromUrl),
    [image, probe, natural]
  );

  const setStatusMsg = useCallback((key, isError, vars) => {
    if (!key) {
      setStatus(null);
      return;
    }
    setStatus({ key, isError: Boolean(isError), vars: vars || null });
  }, []);

  const selectImage = useCallback((nextIndex, nextData) => {
    const source = nextData || data;
    if (!source || !source.images[nextIndex]) return;
    setIndex(nextIndex);
    setProbe(null);
    setNatural(null);
    setPreviewBroken(false);
    setPreviewKey((k) => k + 1);
  }, [data]);

  const probeSelected = useCallback((target) => {
    if (!target || !target.url) return;
    chrome.runtime.sendMessage({ type: "probe", url: target.url }, (info) => {
      if (chrome.runtime.lastError) return;
      setProbe(info || null);
    });
  }, []);

  useEffect(() => {
    if (view === "content" && image) probeSelected(image);
  }, [view, image && image.url, probeSelected]);

  const loadPage = useCallback(async () => {
    setStatusMsg("");
    setData(null);
    setIndex(0);
    setProbe(null);
    setNatural(null);
    setPreviewBroken(false);
    setErrorKey(null);
    setErrorText("");
    setGalleryFilter("all");
    setGallerySelected(Object.create(null));
    setView("loading");

    let tabs;
    try {
      tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    } catch (err) {
      setErrorKey(null);
      setErrorText(err.message);
      setView("error");
      return;
    }

    const tab = tabs && tabs[0];
    if (!tab || !tab.id || !tab.url) {
      setHost("—");
      setView("restricted");
      return;
    }

    try {
      setHost(new URL(tab.url).hostname.replace(/^www\./, "") || tab.url);
    } catch (err) {
      setHost(tab.url);
    }

    if (isRestrictedUrl(tab.url)) {
      setView("restricted");
      return;
    }

    let results;
    try {
      results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractOpenGraph
      });
    } catch (err) {
      setErrorKey(null);
      setErrorText(err.message);
      setView("error");
      return;
    }

    const next = results && results[0] && results[0].result;
    if (!next) {
      setErrorText("");
      setErrorKey("errorNoMeta");
      setView("error");
      return;
    }

    if (!next.pageImages) next.pageImages = [];
    setData(next);
    setErrorKey(null);
    if (!next.images || !next.images.length) {
      setView("empty");
      return;
    }

    setIndex(0);
    setView("content");
  }, [setStatusMsg]);

  useEffect(() => {
    if (!ready) return;
    loadPage();
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onMessage(message) {
      if (!message || message.type !== "downloadProgress") return;
      setStatusMsg("downloadingProgress", false, {
        current: message.current,
        total: message.total
      });
    }
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, [setStatusMsg]);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Enter" && view === "content") {
        event.preventDefault();
        downloadSelected();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  async function downloadSelected() {
    if (!image || !data) return;
    setBusy(true);
    setStatusMsg("downloading");
    const result = await sendMessage({
      type: "download",
      url: image.url,
      filename: buildFilename(data, image, probe && probe.type),
      mime: (probe && probe.type) || image.type || ""
    });
    setBusy(false);
    if (!result || !result.ok) {
      if (result && result.errorKey) {
        setStatusMsg(result.errorKey, true, result.errorVars);
      } else if (result && result.error) {
        setStatus({ key: null, isError: true, raw: result.error });
      } else {
        setStatusMsg("downloadFailed", true);
      }
      return;
    }
    setStatusMsg("savedToDownloads");
  }

  async function copySelected() {
    if (!image) return;
    try {
      await navigator.clipboard.writeText(image.url);
      setStatusMsg("urlCopied");
    } catch (err) {
      setStatusMsg("copyFailed", true);
    }
  }

  function openSelected() {
    if (!image) return;
    chrome.tabs.create({ url: image.url });
  }

  function zipName() {
    const slug = slugify((data && data.host) || "page") || "page";
    return slug + "-images.zip";
  }

  function toDownloadItems(images) {
    return images.map((item) => ({
      url: item.url,
      filename: buildFilename(data, item, item.type)
    }));
  }

  function galleryTargets(filtered) {
    const selectedItems = filtered.filter((item) => gallerySelected[item.url]);
    return selectedItems.length ? selectedItems : filtered;
  }

  async function downloadGalleryItems(filtered, zip) {
    const images = galleryTargets(filtered);
    if (!images.length) {
      setStatusMsg("noneSelected", true);
      return;
    }
    setBatchBusy(true);
    setStatusMsg("downloadingProgress", false, { current: 0, total: images.length });
    const result = await sendMessage({
      type: "downloadMany",
      items: toDownloadItems(images),
      zip: Boolean(zip),
      zipName: zipName()
    });
    setBatchBusy(false);
    if (!result || !result.ok) {
      setStatusMsg((result && result.errorKey) || "downloadFailed", true);
      if (result && result.error) {
        setStatus({ key: null, isError: true, raw: result.error });
      }
      return;
    }
    if (result.zip) {
      if (result.count < result.total) {
        setStatusMsg("partialDownload", false, { ok: result.count, total: result.total });
      } else {
        setStatusMsg("savedZip");
      }
      return;
    }
    if (result.count < result.total) {
      setStatusMsg("partialDownload", false, { ok: result.count, total: result.total });
    } else {
      setStatusMsg("savedCount", false, { count: result.count });
    }
  }

  function toggleSelected(url, isSelected) {
    setGallerySelected((prev) => {
      const next = Object.assign(Object.create(null), prev);
      if (isSelected) next[url] = true;
      else delete next[url];
      return next;
    });
  }

  function selectAll(filtered) {
    setGallerySelected((prev) => {
      const next = Object.assign(Object.create(null), prev);
      filtered.forEach((item) => {
        next[item.url] = true;
      });
      return next;
    });
  }

  if (!ready) {
    return (
      <div className="flex min-h-24 items-center justify-center p-3">
        <Spinner size="sm" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold">OG Downloader</div>
          <div className="text-muted text-sm break-all">{host}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={t("refresh")}
            onPress={loadPage}
          >
            <RefreshIcon className="size-4" />
          </Button>
          <SettingsButton />
        </div>
      </header>

      {view === "loading" ? (
        <Card>
          <Card.Content className="flex items-center gap-2 py-4">
            <Spinner size="sm" />
            <span className="text-muted">{t("loading")}</span>
          </Card.Content>
        </Card>
      ) : null}

      {view === "restricted" ? (
        <Card>
          <Card.Header>
            <Card.Title>{t("restrictedTitle")}</Card.Title>
            <Card.Description>{t("restrictedBody")}</Card.Description>
          </Card.Header>
        </Card>
      ) : null}

      {view === "error" ? (
        <Card>
          <Card.Header>
            <Card.Title>{t("errorTitle")}</Card.Title>
            <Card.Description>
              {errorKey ? t(errorKey) : errorText || t("errorFallback")}
            </Card.Description>
          </Card.Header>
          <Card.Footer>
            <Button size="sm" variant="secondary" onPress={loadPage}>
              {t("errorRetry")}
            </Button>
          </Card.Footer>
        </Card>
      ) : null}

      {view === "empty" ? (
        <Card>
          <Card.Header>
            <Card.Title>{t("emptyTitle")}</Card.Title>
            <Card.Description>
              <span dangerouslySetInnerHTML={{ __html: t("emptyBody") }} />
            </Card.Description>
          </Card.Header>
        </Card>
      ) : null}

      {view === "content" && image ? (
        <section className="flex flex-col gap-3">
          <Card>
            <Card.Content className="relative p-0 overflow-hidden">
              {!previewBroken ? (
                <PreviewImage
                  key={previewKey}
                  image={image}
                  alt={image.alt || (data && data.title) || t("previewAlt")}
                  className="max-h-52 w-full object-contain"
                  onLoad={(event) => {
                    setPreviewBroken(false);
                    if (event.currentTarget.naturalWidth) {
                      setNatural({
                        width: event.currentTarget.naturalWidth,
                        height: event.currentTarget.naturalHeight
                      });
                    }
                  }}
                  onError={() => setPreviewBroken(true)}
                />
              ) : (
                <div className="flex flex-col gap-2 p-4">
                  <p>{t("previewFailed")}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => {
                      setPreviewBroken(false);
                      setPreviewKey((k) => k + 1);
                    }}
                  >
                    {t("previewRetry")}
                  </Button>
                  <p className="text-muted text-sm break-all">{image.url}</p>
                </div>
              )}
              {badge ? (
                <Chip size="sm" variant="soft" className="absolute bottom-2 left-2 max-w-[90%]">
                  <Chip.Label className="truncate">{badge}</Chip.Label>
                </Chip>
              ) : null}
            </Card.Content>
          </Card>

          {data.title ? <h1 className="font-semibold leading-snug">{data.title}</h1> : null}
          {data.description ? (
            <p className="text-muted text-sm line-clamp-3">{data.description}</p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" isDisabled={locked} onPress={downloadSelected}>
              {t("download")}
            </Button>
            <Button size="sm" variant="secondary" isDisabled={locked} onPress={copySelected}>
              {t("copyUrl")}
            </Button>
            <Button size="sm" variant="secondary" isDisabled={locked} onPress={openSelected}>
              {t("open")}
            </Button>
          </div>

          {data.images.length > 1 ? (
            <div className="flex flex-col gap-2">
              <div className="text-muted text-sm">{t("otherImages")}</div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {data.images.map((item, i) => (
                  <Button
                    key={item.url + i}
                    isIconOnly
                    size="lg"
                    variant={i === index ? "primary" : "secondary"}
                    aria-label={sourceLabel(item.source)}
                    className="h-14 w-14 overflow-hidden p-0"
                    onPress={() => selectImage(i)}
                  >
                    <PreviewImage image={item} className="h-full w-full object-cover" />
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {showGallery ? (
        <Gallery
          pageImages={pageImages}
          filter={galleryFilter}
          onFilterChange={setGalleryFilter}
          selected={gallerySelected}
          onToggle={toggleSelected}
          onSelectAll={selectAll}
          onDownload={(filtered) => downloadGalleryItems(filtered, false)}
          onDownloadZip={(filtered) => downloadGalleryItems(filtered, true)}
          busy={locked}
        />
      ) : null}

      {status ? (
        <Alert
          status={
            status.isError
              ? "danger"
              : status.key === "downloading" || status.key === "downloadingProgress"
                ? "default"
                : "success"
          }
        >
          <Alert.Content>
            <Alert.Description>
              {status.raw || t(status.key, status.vars)}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
    </div>
  );
}
