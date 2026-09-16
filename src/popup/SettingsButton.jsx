import { useEffect } from "react";
import {
  Button,
  FieldGroup,
  Fieldset,
  Label,
  ListBox,
  Modal,
  Select,
  useTheme
} from "@heroui/react";
import { useI18n } from "./i18n.jsx";
import { SettingsIcon } from "./icons.jsx";

const THEME_KEY = "theme";

export function SettingsButton() {
  const { t, locale, setLocale, locales } = useI18n();
  const { theme, setTheme } = useTheme("system");

  useEffect(() => {
    chrome.storage.local.get({ [THEME_KEY]: null }, (data) => {
      if (data && data[THEME_KEY]) setTheme(data[THEME_KEY]);
    });
  }, [setTheme]);

  function chooseTheme(next) {
    setTheme(next);
    chrome.storage.local.set({ [THEME_KEY]: next });
  }

  return (
    <Modal>
      <Button isIconOnly size="sm" variant="ghost" aria-label={t("settings")}>
        <SettingsIcon className="size-4" />
      </Button>
      <Modal.Backdrop>
        <Modal.Container className="p-3">
          <Modal.Dialog className="w-full gap-3 rounded-xl p-3">
            <Modal.CloseTrigger className="end-3 top-3" />
            <Modal.Header>
              <Modal.Heading>{t("settings")}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <Fieldset>
                <FieldGroup className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>{t("language")}</Label>
                    <Select
                      aria-label={t("language")}
                      selectedKey={locale}
                      onSelectionChange={(key) => {
                        if (key) setLocale(String(key));
                      }}
                    >
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {locales.map((item) => (
                            <ListBox.Item key={item.code} id={item.code} textValue={item.name}>
                              {item.name}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label>{t("theme")}</Label>
                    <Select
                      aria-label={t("theme")}
                      selectedKey={theme}
                      onSelectionChange={(key) => {
                        if (key) chooseTheme(String(key));
                      }}
                    >
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id="light" textValue={t("themeLight")}>
                            {t("themeLight")}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                          <ListBox.Item id="dark" textValue={t("themeDark")}>
                            {t("themeDark")}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                          <ListBox.Item id="system" textValue={t("themeSystem")}>
                            {t("themeSystem")}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>
                </FieldGroup>
              </Fieldset>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export { useTheme };
