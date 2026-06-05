import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  appShellMinSizeClass,
  appWindowSize,
  type AppWindowSize,
} from "./appLayout";

function readTauriWindowSize(): AppWindowSize {
  const configUrl = new URL("../../src-tauri/tauri.conf.json", import.meta.url);
  const config = JSON.parse(readFileSync(configUrl, "utf8")) as {
    app: {
      windows: AppWindowSize[];
    };
  };

  return config.app.windows[0]!;
}

describe("app layout sizing", () => {
  test("uses a wider and taller default desktop window", () => {
    expect(appWindowSize).toEqual({
      width: 1500,
      height: 960,
      minWidth: 1180,
      minHeight: 760,
    });
  });

  test("keeps the Tauri window config in sync with app layout constants", () => {
    expect(readTauriWindowSize()).toMatchObject(appWindowSize);
  });

  test("keeps the React shell minimum size in sync with the window minimum", () => {
    expect(appShellMinSizeClass).toContain(`min-w-[${appWindowSize.minWidth}px]`);
    expect(appShellMinSizeClass).toContain(`min-h-[${appWindowSize.minHeight}px]`);
  });
});
