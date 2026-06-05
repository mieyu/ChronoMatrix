export interface AppWindowSize {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
}

export const appWindowSize: AppWindowSize = {
  width: 1500,
  height: 960,
  minWidth: 1180,
  minHeight: 760,
};

export const appShellMinSizeClass = "min-h-[760px] min-w-[1180px]";
