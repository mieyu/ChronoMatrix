import {
  defaultMatrixRules,
  getPlanMatrixPlacement,
  type MatrixQuadrant,
  type MatrixRules,
  type Plan,
  type PlanMatrixPlacement,
} from "./plan";

type MatrixPlacement = Extract<PlanMatrixPlacement, { bucket: "matrix" }>;

interface MatrixLayoutCandidate {
  plan: Plan;
  placement: MatrixPlacement;
  targetX: number;
  targetY: number;
}

export interface MatrixLayoutRules {
  clusterRadius: number;
  clusterMinSize: number;
  collisionOffset: number;
  /**
   * Half of a card's width/height expressed in normalized matrix units
   * (1 unit == 42% of the canvas). When greater than zero, a relaxation pass
   * pushes overlapping cards apart so none occlude each other. Defaults to 0,
   * which keeps the layout a pure target-driven placement (used by tests).
   */
  cardHalfWidth?: number;
  cardHalfHeight?: number;
  relaxIterations?: number;
}

export interface MatrixPlanLayoutItem {
  kind: "plan";
  id: string;
  plan: Plan;
  placement: MatrixPlacement;
  quadrant: MatrixQuadrant;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
}

export interface MatrixClusterLayoutItem {
  kind: "cluster";
  id: string;
  plans: Plan[];
  placements: MatrixPlacement[];
  quadrant: MatrixQuadrant;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
}

export type MatrixLayoutItem = MatrixPlanLayoutItem | MatrixClusterLayoutItem;

export const defaultMatrixLayoutRules: MatrixLayoutRules = {
  clusterRadius: 0.08,
  clusterMinSize: 3,
  collisionOffset: 0.075,
};

const quadrants: MatrixQuadrant[] = [
  "important-not-urgent",
  "important-urgent",
  "not-important-not-urgent",
  "not-important-urgent",
];

export function buildMatrixLayoutItems(
  plans: Plan[],
  now: Date = new Date(),
  matrixRules: MatrixRules = defaultMatrixRules,
  layoutRules: MatrixLayoutRules = defaultMatrixLayoutRules,
): MatrixLayoutItem[] {
  const candidates = plans.flatMap((plan): MatrixLayoutCandidate[] => {
    const placement = getPlanMatrixPlacement(plan, now, matrixRules);

    if (placement.bucket !== "matrix") {
      return [];
    }

    return [
      {
        plan,
        placement,
        targetX: placement.x,
        targetY: placement.y,
      },
    ];
  });

  return quadrants.flatMap((quadrant) =>
    layoutQuadrant(
      candidates.filter((candidate) => candidate.placement.quadrant === quadrant),
      layoutRules,
    ),
  );
}

function layoutQuadrant(
  candidates: MatrixLayoutCandidate[],
  rules: MatrixLayoutRules,
): MatrixLayoutItem[] {
  const groups = collectNearbyGroups(candidates, rules.clusterRadius);

  const items = groups.flatMap<MatrixLayoutItem>((group) => {
    if (group.length >= rules.clusterMinSize) {
      return [createClusterItem(group)];
    }

    return spreadPlanItems(group, rules.collisionOffset);
  });

  return relaxOverlaps(items, rules);
}

/**
 * Iteratively separates overlapping cards so the matrix can be read at a
 * glance. Each card is treated as an axis-aligned box; overlapping pairs are
 * pushed apart along the axis of least penetration, while a weak spring keeps
 * every card drifting back toward its meaningful position. No-op when the
 * caller did not provide a card footprint.
 */
function relaxOverlaps(
  items: MatrixLayoutItem[],
  rules: MatrixLayoutRules,
): MatrixLayoutItem[] {
  const halfWidth = rules.cardHalfWidth ?? 0;
  const halfHeight = rules.cardHalfHeight ?? 0;

  if (halfWidth <= 0 || halfHeight <= 0 || items.length < 2) {
    return items;
  }

  const minGapX = halfWidth * 2;
  const minGapY = halfHeight * 2;
  const iterations = rules.relaxIterations ?? 60;
  const home = items.map((item) => ({
    x: item.x,
    y: item.y,
    quadrant: item.quadrant,
  }));
  const positions = items.map((item) => ({ x: item.x, y: item.y }));

  function separateOverlaps() {
    for (let i = 0; i < positions.length; i += 1) {
      for (let j = i + 1; j < positions.length; j += 1) {
        const dx = positions[j].x - positions[i].x;
        const dy = positions[j].y - positions[i].y;
        const penetrationX = minGapX - Math.abs(dx);
        const penetrationY = minGapY - Math.abs(dy);

        if (penetrationX <= 0 || penetrationY <= 0) {
          continue;
        }

        if (penetrationX <= penetrationY) {
          const shift = (penetrationX / 2) * (dx === 0 ? -1 : Math.sign(dx));
          positions[i].x -= shift;
          positions[j].x += shift;
        } else {
          const shift = (penetrationY / 2) * (dy === 0 ? -1 : Math.sign(dy));
          positions[i].y -= shift;
          positions[j].y += shift;
        }
      }
    }
  }

  function clampAll() {
    for (let i = 0; i < positions.length; i += 1) {
      const clamped = clampToQuadrant(
        positions[i].x,
        positions[i].y,
        home[i].quadrant,
      );
      positions[i].x = clamped.x;
      positions[i].y = clamped.y;
    }
  }

  // Main pass: push cards apart while a weak spring keeps them near their
  // meaningful position.
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    separateOverlaps();

    for (let i = 0; i < positions.length; i += 1) {
      positions[i].x += (home[i].x - positions[i].x) * 0.03;
      positions[i].y += (home[i].y - positions[i].y) * 0.03;
    }

    clampAll();
  }

  // Settle pass: pure separation (no spring) so the final layout actually
  // honors the no-overlap invariant rather than ending mid-spring.
  for (let iteration = 0; iteration < 12; iteration += 1) {
    separateOverlaps();
    clampAll();
  }

  items.forEach((item, index) => {
    item.x = positions[index].x;
    item.y = positions[index].y;
  });

  return items;
}

function collectNearbyGroups(
  candidates: MatrixLayoutCandidate[],
  clusterRadius: number,
): MatrixLayoutCandidate[][] {
  const visited = new Set<string>();
  const groups: MatrixLayoutCandidate[][] = [];

  for (const candidate of candidates) {
    if (visited.has(candidate.plan.id)) {
      continue;
    }

    const group: MatrixLayoutCandidate[] = [];
    const queue = [candidate];
    visited.add(candidate.plan.id);

    while (queue.length > 0) {
      const current = queue.shift();

      if (!current) {
        continue;
      }

      group.push(current);

      for (const next of candidates) {
        if (visited.has(next.plan.id)) {
          continue;
        }

        if (distance(current, next) <= clusterRadius) {
          visited.add(next.plan.id);
          queue.push(next);
        }
      }
    }

    groups.push(group);
  }

  return groups;
}

function createClusterItem(group: MatrixLayoutCandidate[]): MatrixClusterLayoutItem {
  const quadrant = group[0].placement.quadrant;
  const center = averagePoint(group);
  const clamped = clampToQuadrant(center.x, center.y, quadrant);

  return {
    kind: "cluster",
    id: `cluster-${quadrant}-${group.map((candidate) => candidate.plan.id).join("-")}`,
    plans: group.map((candidate) => candidate.plan),
    placements: group.map((candidate) => candidate.placement),
    quadrant,
    x: clamped.x,
    y: clamped.y,
    targetX: center.x,
    targetY: center.y,
  };
}

function spreadPlanItems(
  group: MatrixLayoutCandidate[],
  collisionOffset: number,
): MatrixPlanLayoutItem[] {
  if (group.length === 1) {
    const candidate = group[0];
    const point = clampToQuadrant(
      candidate.targetX,
      candidate.targetY,
      candidate.placement.quadrant,
    );

    return [createPlanItem(candidate, point.x, point.y)];
  }

  const center = averagePoint(group);
  const spreadAngle = Math.atan2(center.y, center.x) + Math.PI / 2;
  const midpoint = (group.length - 1) / 2;

  return group.map((candidate, index) => {
    const offset = (index - midpoint) * collisionOffset;
    const point = clampToQuadrant(
      candidate.targetX + Math.cos(spreadAngle) * offset,
      candidate.targetY + Math.sin(spreadAngle) * offset,
      candidate.placement.quadrant,
    );

    return createPlanItem(candidate, point.x, point.y);
  });
}

function createPlanItem(
  candidate: MatrixLayoutCandidate,
  x: number,
  y: number,
): MatrixPlanLayoutItem {
  return {
    kind: "plan",
    id: candidate.plan.id,
    plan: candidate.plan,
    placement: candidate.placement,
    quadrant: candidate.placement.quadrant,
    x,
    y,
    targetX: candidate.targetX,
    targetY: candidate.targetY,
  };
}

function averagePoint(group: MatrixLayoutCandidate[]): { x: number; y: number } {
  const total = group.reduce(
    (sum, candidate) => ({
      x: sum.x + candidate.targetX,
      y: sum.y + candidate.targetY,
    }),
    { x: 0, y: 0 },
  );

  return {
    x: total.x / group.length,
    y: total.y / group.length,
  };
}

function distance(
  first: Pick<MatrixLayoutCandidate, "targetX" | "targetY">,
  second: Pick<MatrixLayoutCandidate, "targetX" | "targetY">,
): number {
  return Math.hypot(first.targetX - second.targetX, first.targetY - second.targetY);
}

function clampToQuadrant(
  x: number,
  y: number,
  quadrant: MatrixQuadrant,
): { x: number; y: number } {
  const xSign =
    quadrant === "important-urgent" || quadrant === "not-important-urgent"
      ? 1
      : -1;
  const ySign =
    quadrant === "important-urgent" || quadrant === "important-not-urgent"
      ? 1
      : -1;

  return {
    x: clampSigned(x, xSign),
    y: clampSigned(y, ySign),
  };
}

function clampSigned(value: number, sign: 1 | -1): number {
  const magnitude = Math.min(Math.max(Math.abs(value), 0.06), 0.95);
  return magnitude * sign;
}
