import {
  Accordion,
  Button,
  ButtonGroup,
  Checkbox,
  Chip,
  Dropdown,
  Label
} from "@heroui/react";
import { PreviewImage } from "./PreviewImage.jsx";
import { FILTER_I18N, FILTER_ORDER } from "../preview.js";
import { useI18n } from "../i18n.jsx";

export function Gallery({
  pageImages,
  filter,
  onFilterChange,
  selected,
  onToggle,
  onSelectAll,
  onDownload,
  onDownloadZip,
  busy
}) {
  const { t } = useI18n();
  const types = FILTER_ORDER.filter((type) =>
    pageImages.some((image) => image.type === type)
  );
  const activeFilter = filter !== "all" && types.indexOf(filter) === -1 ? "all" : filter;
  const filtered =
    activeFilter === "all"
      ? pageImages
      : pageImages.filter((image) => image.type === activeFilter);
  const selectedCount = filtered.filter((image) => selected[image.url]).length;
  const downloadLabel = selectedCount
    ? t("downloadCount", { count: selectedCount })
    : t("downloadAll");

  return (
    <Accordion className="w-full" variant="surface">
      <Accordion.Item id="gallery">
        <Accordion.Heading>
          <Accordion.Trigger>
            <span className="flex-1 text-left">
              {t("allImages")}{" "}
              <span className="text-muted">({pageImages.length})</span>
            </span>
            <Accordion.Indicator />
          </Accordion.Trigger>
        </Accordion.Heading>
        <Accordion.Panel>
          <Accordion.Body className="flex flex-col gap-3">
            <div className="flex items-center justify-end">
              <Button
                size="sm"
                variant="ghost"
                isDisabled={busy}
                onPress={() => onSelectAll(filtered)}
              >
                {t("selectAll")}
              </Button>
            </div>

            {types.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                <Chip
                  size="sm"
                  variant={activeFilter === "all" ? "primary" : "secondary"}
                  className="cursor-pointer"
                  onClick={() => onFilterChange("all")}
                >
                  <Chip.Label>{t("filterAll")}</Chip.Label>
                </Chip>
                {types.map((type) => (
                  <Chip
                    key={type}
                    size="sm"
                    variant={activeFilter === type ? "primary" : "secondary"}
                    className="cursor-pointer"
                    onClick={() => onFilterChange(type)}
                  >
                    <Chip.Label>{t(FILTER_I18N[type])}</Chip.Label>
                  </Chip>
                ))}
              </div>
            ) : null}

            <div className="grid grid-cols-3 gap-2">
              {filtered.map((image) => {
                const checked = Boolean(selected[image.url]);
                return (
                  <div
                    key={image.url}
                    role="button"
                    tabIndex={0}
                    className={
                      "relative aspect-square overflow-hidden rounded-lg bg-surface-secondary cursor-pointer " +
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
                    <PreviewImage
                      image={image}
                      className="pointer-events-none h-full w-full object-cover"
                    />
                    {image.isOg ? (
                      <Chip size="sm" variant="primary" className="absolute right-1 top-1">
                        <Chip.Label>OG</Chip.Label>
                      </Chip>
                    ) : null}
                    <Chip size="sm" variant="secondary" className="absolute bottom-1 right-1">
                      <Chip.Label>
                        {(image.type && image.type !== "unknown" ? image.type : "img").toUpperCase()}
                      </Chip.Label>
                    </Chip>
                  </div>
                );
              })}
            </div>

            <ButtonGroup className="w-full">
              <Button
                className="flex-1"
                size="sm"
                isDisabled={busy}
                onPress={() => onDownload(filtered)}
              >
                {downloadLabel}
              </Button>
              <Dropdown>
                <Button
                  size="sm"
                  isDisabled={busy}
                  aria-label={t("downloadMenu")}
                >
                  ▾
                </Button>
                <Dropdown.Popover placement="top end">
                  <Dropdown.Menu
                    onAction={(key) => {
                      if (key === "zip") onDownloadZip(filtered);
                    }}
                  >
                    <Dropdown.Item id="zip" textValue={t("downloadZip")}>
                      <Label>{t("downloadZip")}</Label>
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </ButtonGroup>
          </Accordion.Body>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
