import {
  defaultMatrixLayoutRules,
  type MatrixLayoutRules,
} from "./matrixLayout";

export interface MatrixViewport {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface MatrixViewportPoint {
  x: number;
  y: number;
}

export interface MatrixViewportCssPoint {
  xPercent: number;
  yPercent: number;
}

export interface MatrixViewportCssPosition {
  left: string;
  top: string;
}

export interface MatrixViewportLimits {
  minScale: number;
  maxScale: number;
  wheelSensitivity: number;
}

export const matrixViewportLimits: MatrixViewportLimits = {
  minScale: 0.6,
  maxScale: 3,
  wheelSensitivity: 0.0015,
};

export const defaultMatrixViewport: MatrixViewport = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

export function zoomMatrixViewportAt(
  viewport: MatrixViewport,
  screenPoint: MatrixViewportPoint,
  nextScale: number,
  limits: MatrixViewportLimits = matrixViewportLimits,
): MatrixViewport {
  const scale = clamp(nextScale, limits.minScale, limits.maxScale);
  const ratio = scale / viewport.scale;

  return {
    scale,
    offsetX: screenPoint.x - (screenPoint.x - viewport.offsetX) * ratio,
    offsetY: screenPoint.y - (screenPoint.y - viewport.offsetY) * ratio,
  };
}

export function zoomMatrixViewportByWheel(
  viewport: MatrixViewport,
  screenPoint: MatrixViewportPoint,
  deltaY: number,
  limits: MatrixViewportLimits = matrixViewportLimits,
): MatrixViewport {
  const nextScale =
    viewport.scale * Math.exp(-deltaY * limits.wheelSensitivity);

  return zoomMatrixViewportAt(viewport, screenPoint, nextScale, limits);
}

export function panMatrixViewport(
  viewport: MatrixViewport,
  delta: MatrixViewportPoint,
): MatrixViewport {
  return {
    ...viewport,
    offsetX: viewport.offsetX + delta.x,
    offsetY: viewport.offsetY + delta.y,
  };
}

export function resetMatrixViewport(): MatrixViewport {
  return defaultMatrixViewport;
}

export function getMatrixViewportCssPoint(
  viewport: MatrixViewport,
  point: MatrixViewportCssPoint,
): MatrixViewportCssPosition {
  return {
    left: `calc(${formatCssNumber(viewport.offsetX)}px + ${formatCssNumber(
      point.xPercent * viewport.scale,
    )}%)`,
    top: `calc(${formatCssNumber(viewport.offsetY)}px + ${formatCssNumber(
      point.yPercent * viewport.scale,
    )}%)`,
  };
}

export function getMatrixViewportCssLength(
  viewport: MatrixViewport,
  percent: number,
): string {
  return `${formatCssNumber(percent * viewport.scale)}%`;
}

export function getMatrixViewportCssPx(
  viewport: MatrixViewport,
  px: number,
): string {
  return `${formatCssNumber(px * viewport.scale)}px`;
}

export function getMatrixLayoutRulesForScale(
  scale: number,
  baseRules: MatrixLayoutRules = defaultMatrixLayoutRules,
): MatrixLayoutRules {
  const clampedScale = clamp(
    scale,
    matrixViewportLimits.minScale,
    matrixViewportLimits.maxScale,
  );
  const inverseScale = 1 / clampedScale;

  return {
    clusterRadius: clamp(
      baseRules.clusterRadius * Math.pow(inverseScale, 0.9),
      0.03,
      0.14,
    ),
    clusterMinSize: getClusterMinSize(clampedScale, baseRules.clusterMinSize),
    collisionOffset: clamp(
      baseRules.collisionOffset * Math.pow(clampedScale, 0.35),
      0.055,
      0.12,
    ),
  };
}

function getClusterMinSize(scale: number, baseMinSize: number): number {
  if (scale <= 0.8) {
    return Math.max(2, baseMinSize - 1);
  }

  if (scale >= 1.6) {
    return baseMinSize + 2;
  }

  return baseMinSize;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatCssNumber(value: number): string {
  const rounded = Math.round(value * 10_000) / 10_000;

  return `${Object.is(rounded, -0) ? 0 : rounded}`;
}
