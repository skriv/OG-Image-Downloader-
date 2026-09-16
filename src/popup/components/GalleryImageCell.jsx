import { Button, Checkbox, Chip, Dropdown, Label, Surface } from "@heroui/react";
import { Ellipsis } from "../icons.jsx";
import { isSvgImage } from "../preview.js";
import { PreviewImage } from "./PreviewImage.jsx";
import { useI18n } from "../i18n.jsx";

export function GalleryImageCell({
  image,
  checked,
  busy,
  onToggle,
  onOpenImage,
  onCopyLink,
  onCopySvg
}) {
  const { t } = useI18n();
  const isSvg = isSvgImage(image);

  return (
    <Surface
      variant="secondary"
      role="button"
      tabIndex={0}
      className={
        "group relative aspect-square cursor-pointer overflow-hidden rounded-lg " +
        (checked ? "outline outline-2 outline-accent" : "")
      }
      onClick={() => onToggle(image.url, !checked)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle(image.url, !checked);
        }
      }}
    >
      <div
        className="absolute left-1 top-1 z-10"
        onClick={(event) => event.stopPropagation()}
      >
        <Checkbox
          aria-label={image.alt || image.url}
          isSelected={checked}
          isDisabled={busy}
          onChange={(isSelected) => onToggle(image.url, isSelected)}
        >
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
          </Checkbox.Content>
        </Checkbox>
      </div>

      <div
        className="absolute right-0.5 top-0.5 z-20 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        onClick={(event) => event.stopPropagation()}
      >
        <Dropdown>
          <Button
            isIconOnly
            size="sm"
            variant="tertiary"
            aria-label="More options"
            isDisabled={busy}
            className="h-6 min-w-6"
          >
            <Ellipsis className="size-3.5" />
          </Button>
          <Dropdown.Popover placement="bottom end">
            <Dropdown.Menu
              onAction={(key) => {
                if (key === "open") onOpenImage(image.url);
                if (key === "copy") onCopyLink(image.url);
                if (key === "copy-svg") onCopySvg(image);
              }}
            >
              <Dropdown.Item id="open" textValue={t("open")}>
                <Label>{t("open")}</Label>
              </Dropdown.Item>
              <Dropdown.Item id="copy" textValue={t("copyLink")}>
                <Label>{t("copyLink")}</Label>
              </Dropdown.Item>
              {isSvg ? (
                <Dropdown.Item id="copy-svg" textValue={t("copySvg")}>
                  <Label>{t("copySvg")}</Label>
                </Dropdown.Item>
              ) : null}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>

      <PreviewImage
        image={image}
        className="pointer-events-none h-full w-full object-cover"
      />

      {image.isOg ? (
        <Chip
          size="sm"
          variant="primary"
          className="absolute right-1 top-1 group-hover:opacity-0 group-focus-within:opacity-0"
        >
          <Chip.Label>OG</Chip.Label>
        </Chip>
      ) : null}

      <Chip size="sm" variant="secondary" className="absolute bottom-1 right-1">
        <Chip.Label>
          {(image.type && image.type !== "unknown" ? image.type : "img").toUpperCase()}
        </Chip.Label>
      </Chip>
    </Surface>
  );
}
