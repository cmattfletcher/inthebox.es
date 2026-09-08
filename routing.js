import { fingerprint } from './grammar.js';

export const ROUTE_EPSILON = 1e-9;
export const ROUTE_CLEARANCE_EPSILON = 0.08;
export const INTERIOR_BYPASS_OFFSET = ROUTE_CLEARANCE_EPSILON * 1.25;
export const OPENING_GAP_HALF_LENGTH = 1.4;
let contactRejectedEdges = 0;
export function resetRoutingAuditCounters() { contactRejectedEdges = 0; }
export function getRoutingAuditCounters() { return { contactRejectedEdges }; }

export function ancestry(state, id) {
  const boxes = new Map(state.boxes.map(b => [b.id, b]));
  const path = [], seen = new Set();
  while (id !== null && !seen.has(id)) {
    seen.add(id); path.unshift(id); id = boxes.get(id)?.parent ?? null;
  }
  return path;
}

export function orderedRequiredBoundaries(state, relation) {
  const a = state.objects.find(o => o.id === relation.from), b = state.objects.find(o => o.id === relation.to);
  if (!a || !b) return [];
  const ap = ancestry(state, a.parent), bp = ancestry(state, b.parent);
  let i = 0; while (i < Math.min(ap.length, bp.length) && ap[i] === bp[i]) i++;
  return [...ap.slice(i).reverse(), ...bp.slice(i)];
}

export function openingPoint(state, boundaryId) {
  const b = state.boxes.find(x => x.id === boundaryId), op = state.openings.find(x => x.box === boundaryId && x.open);
  if (!b || !op) return null;
  let x = b.x + b.w * op.at, y = b.y;
  if (op.side === 1) { x = b.x + b.w; y = b.y + b.h * op.at; }
  else if (op.side === 2) { x = b.x + b.w * op.at; y = b.y + b.h; }
  else if (op.side === 3) { x = b.x; y = b.y + b.h * op.at; }
  return { boundaryId, openingId: op.id, side: op.side, at: op.at, x, y };
}

const same = (a, b) => Math.abs(a.x - b.x) <= ROUTE_EPSILON && Math.abs(a.y - b.y) <= ROUTE_EPSILON;
const boxOf = (state, id) => state.boxes.find(b => b.id === id);

function lca(state, a, b) {
  const aa = ancestry(state, a), bb = ancestry(state, b); let out = aa[0] || null;
  for (let i = 0; i < Math.min(aa.length, bb.length); i++) { if (aa[i] !== bb[i]) break; out = aa[i]; }
  return out;
}

function cellSequence(state, relation) {
  const a = state.objects.find(o => o.id === relation.from), b = state.objects.find(o => o.id === relation.to);
  if (!a || !b) return { status: 'MISSING_ENDPOINT', anchors: [], cells: [], boundaries: [] };
  const ap = ancestry(state, a.parent), bp = ancestry(state, b.parent); let i = 0;
  while (i < Math.min(ap.length, bp.length) && ap[i] === bp[i]) i++;
  const up = ap.slice(i).reverse(), down = bp.slice(i);
  const boundaries = [...up, ...down];
  const anchors = [{ x: a.x, y: a.y, kind: 'endpoint', objectId: a.id }];
  for (const id of boundaries) { const p = openingPoint(state, id); if (!p) return { status: 'MISSING_REQUIRED_OPENING', anchors, cells: [], boundaries }; anchors.push({ ...p, kind: 'opening' }); }
  anchors.push({ x: b.x, y: b.y, kind: 'endpoint', objectId: b.id });
  const cells = [];
  if (!boundaries.length) cells.push(a.parent);
  else {
    cells.push(a.parent);
    for (let n = 0; n < boundaries.length - 1; n++) {
      const current = boundaries[n], next = boundaries[n + 1];
      const cb = boxOf(state, current), nb = boxOf(state, next);
      cells.push(cb?.parent === next ? next : nb?.parent === current ? current : lca(state, current, next));
    }
    cells.push(b.parent);
  }
  return { status: cells.every(Boolean) ? 'OK' : 'AMBIGUOUS_CELL', anchors, cells, boundaries };
}

function expandedObstacle(b) { const e = ROUTE_CLEARANCE_EPSILON; return { id: b.id, x: b.x - e, y: b.y - e, w: b.w + e * 2, h: b.h + e * 2 }; }

function pointInRect(p, r, strict = false) {
  return strict ? p.x > r.x + ROUTE_EPSILON && p.x < r.x + r.w - ROUTE_EPSILON && p.y > r.y + ROUTE_EPSILON && p.y < r.y + r.h - ROUTE_EPSILON : p.x >= r.x - ROUTE_EPSILON && p.x <= r.x + r.w + ROUTE_EPSILON && p.y >= r.y - ROUTE_EPSILON && p.y <= r.y + r.h + ROUTE_EPSILON;
}

function segmentIntersections(a, b, r) {
  const out = [], dx = b.x - a.x, dy = b.y - a.y;
  const add = t => { if (t > ROUTE_EPSILON && t < 1 - ROUTE_EPSILON) out.push(t); };
  if (Math.abs(dx) > ROUTE_EPSILON) { add((r.x - a.x) / dx); add((r.x + r.w - a.x) / dx); }
  if (Math.abs(dy) > ROUTE_EPSILON) { add((r.y - a.y) / dy); add((r.y + r.h - a.y) / dy); }
  return [...new Set(out.filter(t => t > 0 && t < 1))].sort((x, y) => x - y);
}

function boundaryContactAtInterior(a, b, r) {
  const cross = (u, v) => u.x * v.y - u.y * v.x;
  const direction = { x: b.x - a.x, y: b.y - a.y };
  const edges = [
    [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }],
    [{ x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }],
    [{ x: r.x, y: r.y + r.h }, { x: r.x + r.w, y: r.y + r.h }],
    [{ x: r.x, y: r.y }, { x: r.x, y: r.y + r.h }]
  ];
  for (const [u, v] of edges) {
    const edge = { x: v.x - u.x, y: v.y - u.y }, offset = { x: u.x - a.x, y: u.y - a.y }, den = cross(direction, edge);
    if (Math.abs(den) > ROUTE_EPSILON) {
      const t = cross(offset, edge) / den, q = cross(offset, direction) / den;
      if (t > ROUTE_EPSILON && t < 1 - ROUTE_EPSILON && q > -ROUTE_EPSILON && q < 1 + ROUTE_EPSILON) return true;
      continue;
    }
    if (Math.abs(cross(offset, direction)) > ROUTE_EPSILON) continue;
    const params = [0, 1, Math.abs(direction.x) >= Math.abs(direction.y) ? (u.x - a.x) / (direction.x || 1) : (u.y - a.y) / (direction.y || 1), Math.abs(direction.x) >= Math.abs(direction.y) ? (v.x - a.x) / (direction.x || 1) : (v.y - a.y) / (direction.y || 1)].sort((x, y) => x - y);
    const lo = Math.max(0, params[0]), hi = Math.min(1, params[params.length - 1]);
    if (hi - lo > ROUTE_EPSILON || (lo > ROUTE_EPSILON && lo < 1 - ROUTE_EPSILON)) return true;
  }
  return false;
}

function segmentAllowed(a, b, outer, obstacles) {
  const ts = [0, 1];
  for (const r of [outer, ...obstacles]) ts.push(...segmentIntersections(a, b, r));
  ts.sort((x, y) => x - y);
  for (let i = 0; i < ts.length - 1; i++) {
    const lo = ts[i], hi = ts[i + 1];
    for (let sample = 1; sample <= 8; sample++) {
      const t = lo + (hi - lo) * (sample - .5) / 8;
      const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      if (!pointInRect(p, outer, true) || obstacles.some(r => pointInRect(p, r, true))) return false;
    }
  }
  if (boundaryContactAtInterior(a, b, outer) || obstacles.some(r => boundaryContactAtInterior(a, b, r))) { contactRejectedEdges++; return false; }
  return true;
}

function nodesForCell(state, cellId, entry, exit) {
  const cell = boxOf(state, cellId); if (!cell) return { cell: null, obstacles: [], nodes: [] };
  const children = state.boxes.filter(b => b.parent === cellId).map(b => ({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h }));
  const nodes = [{ id: 'entry', ...entry }, { id: 'exit', ...exit }];
  const expanded = children.map(expandedObstacle);
  for (const o of children) for (const [sx, sy, corner] of [[-1, -1, 'nw'], [1, -1, 'ne'], [1, 1, 'se'], [-1, 1, 'sw']]) {
    const cx = o.x + (sx < 0 ? 0 : o.w), cy = o.y + (sy < 0 ? 0 : o.h);
    for (const [qx, qy, quadrant] of [[-1, -1, 'nw'], [1, -1, 'ne'], [1, 1, 'se'], [-1, 1, 'sw']]) {
      const point = { x: cx + qx * INTERIOR_BYPASS_OFFSET, y: cy + qy * INTERIOR_BYPASS_OFFSET };
      if (!pointInRect(point, cell, true) || expanded.some(r => pointInRect(point, r, false))) continue;
      const id = `${o.id}:${corner}:${quadrant}`;
      if (!nodes.some(n => Math.abs(n.x - point.x) <= ROUTE_EPSILON && Math.abs(n.y - point.y) <= ROUTE_EPSILON)) nodes.push({ id, ...point, kind: 'interior-bypass', obstacleId: o.id, sourceCorner: corner, quadrant });
    }
  }
  return { cell, obstacles: children, nodes };
}

function solveCell(state, cellId, entry, exit) {
  const { cell, obstacles, nodes } = nodesForCell(state, cellId, entry, exit);
  if (!cell) return { status: 'AMBIGUOUS_CELL', points: [] };
  const edges = new Map(nodes.map(n => [n.id, []]));
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j]; if (!segmentAllowed(a, b, cell, obstacles)) continue;
    const weight = Math.hypot(b.x - a.x, b.y - a.y);
    edges.get(a.id).push({ to: b.id, weight }); edges.get(b.id).push({ to: a.id, weight });
  }
  for (const list of edges.values()) list.sort((a, b) => a.weight - b.weight || a.to.localeCompare(b.to));
  const dist = new Map(nodes.map(n => [n.id, Infinity])), paths = new Map(nodes.map(n => [n.id, []])); dist.set('entry', 0); paths.set('entry', ['entry']);
  const open = new Set(nodes.map(n => n.id));
  while (open.size) {
    const u = [...open].sort((a, b) => dist.get(a) - dist.get(b) || paths.get(a).join('|').localeCompare(paths.get(b).join('|')))[0]; open.delete(u);
    if (u === 'exit') break;
    for (const edge of edges.get(u) || []) { const candidate = dist.get(u) + edge.weight, path = [...paths.get(u), edge.to]; const better = candidate < dist.get(edge.to) - ROUTE_EPSILON || Math.abs(candidate - dist.get(edge.to)) <= ROUTE_EPSILON && path.join('|') < paths.get(edge.to).join('|'); if (better) { dist.set(edge.to, candidate); paths.set(edge.to, path); } }
  }
  if (!Number.isFinite(dist.get('exit'))) return { status: 'NO_PROJECTION_ROUTE_FOUND', points: [] };
  const byId = new Map(nodes.map(n => [n.id, n])); return { status: 'OK', points: paths.get('exit').map(id => byId.get(id)), nodes: nodes.length, edges: [...edges.values()].reduce((n, x) => n + x.length, 0) / 2, length: dist.get('exit'), boundaryFallback: false, bypassNodes: paths.get('exit').map(id => byId.get(id)).filter(n => n.kind === 'interior-bypass') };
}

export function routeForRelation(state, relation) {
  const sequence = cellSequence(state, relation); if (sequence.status !== 'OK') return { status: sequence.status, points: [], boundaryOrder: sequence.boundaries, cells: sequence.cells };
  const points = [], stages = []; let totalNodes = 0, totalEdges = 0;
  for (let i = 0; i < sequence.cells.length; i++) {
    const result = solveCell(state, sequence.cells[i], sequence.anchors[i], sequence.anchors[i + 1]);
    if (result.status !== 'OK') return { status: result.status, points: [], boundaryOrder: sequence.boundaries, cells: sequence.cells, stages };
    totalNodes += result.nodes || 0; totalEdges += result.edges || 0; stages.push({ cell: sequence.cells[i], status: result.status, nodes: result.nodes, edges: result.edges, length: result.length, bypassNodes: result.bypassNodes || [] });
    for (const p of result.points) if (!points.length || !same(points.at(-1), p)) points.push(p);
  }
  return { status: 'OK', points, boundaryOrder: sequence.boundaries, cells: sequence.cells, stages, graphNodes: totalNodes, graphEdges: totalEdges };
}

export function pathData(route) { return route.points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' '); }

export function routeSignature(state) {
  const rows = state.relations.map(r => { const route = routeForRelation(state, r); return { id: r.id, from: r.from, to: r.to, status: route.status, boundaries: route.boundaryOrder, cells: route.cells, points: route.points.map(p => [p.x, p.y]) }; });
  return { value: JSON.stringify(rows), hash: fingerprint(rows), rows };
}

export function routeCellSequence(state, relation) { return cellSequence(state, relation); }
export { solveCell, nodesForCell, segmentAllowed };
