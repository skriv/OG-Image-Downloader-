import { useEffect, useState } from "react";
import { fetchSvgPreview, resolvePreviewSrc } from "../preview.js";
import { useTheme } from "@heroui/react";

export function PreviewImage({ image, alt, className, onLoad, onError }) {
  const { resolvedTheme } = useTheme("system");
  const [src, setSrc] = useState(() => resolvePreviewSrc(image, resolvedTheme));

  useEffect(() => {
    if (!image) {
      setSrc("");
      return;
    }
    setSrc(resolvePreviewSrc(image, resolvedTheme));
    let cancelled = false;
    fetchSvgPreview(image, resolvedTheme).then((next) => {
      if (!cancelled) setSrc(next);
    });
    return () => {
      cancelled = true;
    };
  }, [image, image && image.url, resolvedTheme]);

  if (!src) return null;

  return (
    <img
      src={src}
      alt={alt || ""}
      className={className}
      referrerPolicy="no-referrer"
      onLoad={onLoad}
      onError={onError}
    />
  );
}
