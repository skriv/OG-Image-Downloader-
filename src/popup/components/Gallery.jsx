import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Disclosure,
  Tag,
  TagGroup,
  Tooltip
} from "@heroui/react";
import { FILTER_I18N, FILTER_ORDER } from "../preview.js";
import { useI18n } from "../i18n.jsx";
import { GalleryImageCell } from "./GalleryImageCell.jsx";

export function Gallery({
  pageImages,
  filter,
  onFilterChange,
  selected,
  onToggle,
  onSelectAll,
  onUnselectAll,
  onDownload,
  onDownloadZip,
  onOpenImage,
  onCopyLink,
  onCopySvg,
  busy
}) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const typeCounts = useMemo(() => {
    const counts = Object.create(null);
    pageImages.forEach((image) => {
      const type = image.type || "unknown";
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }, [pageImages]);
  const types = FILTER_ORDER.filter((type) => typeCounts[type] > 0);
  const activeFilter = filter !== "all" && types.indexOf(filter) === -1 ? "all" : filter;
  const filtered =
    activeFilter === "all"
      ? pageImages
      : pageImages.filter((image) => image.type === activeFilter);
  const selectedCount = filtered.filter((image) => selected[image.url]).length;
  const hasSelection = selectedCount > 0;
  const downloadLabel = selectedCount
    ? t("downloadCount", { count: selectedCount })
    : t("downloadAll");

  function handleSelectToggle() {
    if (busy) return;
    if (hasSelection) onUnselectAll(filtered);
    else onSelectAll(filtered);
  }

  function handleFilterChange(keys) {
    if (keys === "all") {
      onFilterChange("all");
      return;
    }
    const next = Array.from(keys)[0];
    if (next) onFilterChange(String(next));
  }

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <Disclosure isExpanded={isOpen} onExpandedChange={setIsOpen}>
        <Card.Header className="p-0">
          <Disclosure.Heading className="w-full">
            <Button
              slot="trigger"
              variant="ghost"
              className="h-auto w-full justify-between rounded-none px-3 py-2 font-medium shadow-none"
            >
              <Card.Title className="min-w-0 flex-1 truncate text-left text-sm leading-5">
                {t("allImages")}{" "}
                <span className="text-muted font-normal">({pageImages.length})</span>
              </Card.Title>
              <Disclosure.Indicator className="text-muted" />
            </Button>
          </Disclosure.Heading>
        </Card.Header>

        <Disclosure.Content>
          <Card.Content className="gap-3 border-t border-separator px-3 pb-3 pt-2.5">
            <Disclosure.Body className="flex flex-col gap-3 p-0">
              <div className="flex items-start gap-2">
                {types.length > 0 ? (
                  <TagGroup
                    size="sm"
                    selectionMode="single"
                    selectedKeys={new Set([activeFilter])}
                    onSelectionChange={handleFilterChange}
                    className="min-w-0 flex-1"
                    aria-label={t("allImages")}
                  >
                    <TagGroup.List>
                      <Tag id="all" textValue={t("filterAll")}>
                        <span>{t("filterAll")}</span>
                        <span className="text-muted tabular-nums">{pageImages.length}</span>
                      </Tag>
                      {types.map((type) => {
                        const label = t(FILTER_I18N[type]);
                        return (
                          <Tag key={type} id={type} textValue={label}>
                            <span>{label}</span>
                            <span className="text-muted tabular-nums">{typeCounts[type]}</span>
                          </Tag>
                        );
                      })}
                    </TagGroup.List>
                  </TagGroup>
                ) : (
                  <div className="flex-1" />
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 min-h-6 shrink-0 px-2 text-xs"
                  isDisabled={busy || filtered.length === 0}
                  onPress={handleSelectToggle}
                >
                  {hasSelection ? t("unselectAll") : t("selectAll")}
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {filtered.map((image) => (
                  <GalleryImageCell
                    key={image.url}
                    image={image}
                    checked={Boolean(selected[image.url])}
                    busy={busy}
                    onToggle={onToggle}
                    onOpenImage={onOpenImage}
                    onCopyLink={onCopyLink}
                    onCopySvg={onCopySvg}
                  />
                ))}
              </div>

              <div className="flex w-full items-center gap-2">
                <Button
                  fullWidth
                  size="md"
                  className="flex-1"
                  isDisabled={busy}
                  onPress={() => onDownload(filtered)}
                >
                  {downloadLabel}
                </Button>
                <Tooltip delay={300}>
                  <Button
                    size="md"
                    variant="secondary"
                    className="min-w-10 shrink-0 px-2"
                    isDisabled={busy}
                    aria-label={t("tooltipZip")}
                    onPress={() => onDownloadZip(filtered)}
                  >
                    <span className="text-xs font-semibold tracking-wide">{t("zipLabel")}</span>
                  </Button>
                  <Tooltip.Content>
                    {t("tooltipZip")}
                  </Tooltip.Content>
                </Tooltip>
              </div>
            </Disclosure.Body>
          </Card.Content>
        </Disclosure.Content>
      </Disclosure>
    </Card>
  );
}
