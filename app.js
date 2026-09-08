import { RULES, genesis, nextState, fingerprint, diagnostics } from './grammar.js';
import { routeForRelation, pathData, routeSignature } from './routing.js';

const MAX_GENERATION = 5000;
const CHECKPOINT_INTERVAL = 100;
const RECENT_WINDOW_SIZE = 8;
const $ = id => document.getElementById(id), svg = $('world'), range = $('history');
const recentStates = new Map(), checkpoints = new Map();
let currentState = null, pendingTarget = 80, pointerDragging = false;

function el(name, attrs = {}) { const n = document.createElementNS('http://www.w3.org/2000/svg', name); for (const [key, value] of Object.entries(attrs)) n.setAttribute(key, value); return n; }
function rememberRecent(state) { recentStates.delete(state.generation); recentStates.set(state.generation, state); while (recentStates.size > RECENT_WINDOW_SIZE) recentStates.delete(recentStates.keys().next().value); }
function rememberCheckpoint(state) { if (state.generation === 0 || state.generation % CHECKPOINT_INTERVAL === 0) checkpoints.set(state.generation, state); }
function clampGeneration(value) { return Math.max(0, Math.min(MAX_GENERATION, Number(value))); }

function stateAt(target) {
  if (recentStates.has(target)) return recentStates.get(target);
  let state = null;
  for (const [generation, candidate] of checkpoints) if (generation <= target && (!state || generation > state.generation)) state = candidate;
  if (!state) state = genesis();
  rememberRecent(state);
  while (state.generation < target) { state = nextState(state); rememberCheckpoint(state); rememberRecent(state); }
  return state;
}

function render(state) {
  $('generation-label').textContent = `GEN ${String(state.generation).padStart(3, '0')}`;
  $('history-value').value = `GEN ${String(state.generation).padStart(3, '0')}`;
  svg.replaceChildren(svg.querySelector('title'), svg.querySelector('desc'));
  for (const trace of state.traces) {
    if (trace.kind === 'BOX' && [trace.x, trace.y, trace.w, trace.h].every(Number.isFinite)) svg.append(el('rect', { class: 'trace', x: trace.x, y: trace.y, width: trace.w, height: trace.h }));
    if (trace.kind === 'OBJECT' && [trace.x, trace.y].every(Number.isFinite)) svg.append(el('circle', { class: 'trace trace-object', cx: trace.x, cy: trace.y, r: .65, 'aria-label': `historical object ${trace.sourceObject || trace.id}`, 'data-source-object': trace.sourceObject || '' }));
  }
  for (const box of state.boxes) {
    const rect = el('rect', { class: box.depth ? 'nested' : 'boundary', x: box.x, y: box.y, width: box.w, height: box.h, rx: .3 });
    rect.dataset.id = box.id; rect.setAttribute('tabindex', '0'); rect.setAttribute('aria-label', `${box.id}, depth ${box.depth}, pressure ${box.pressure.toFixed(2)}`); svg.append(rect);
    if (box.depth === 0) { const label = el('text', { class: 'label', x: box.x + 1, y: box.y - 1 }); label.textContent = 'ROOT'; svg.append(label); }
  }
  for (const opening of state.openings) {
    if (!opening.open) continue;
    const box = state.boxes.find(candidate => candidate.id === opening.box); if (!box) continue;
    let x = box.x + box.w * opening.at, y = box.y;
    if (opening.side === 1) { x = box.x + box.w; y = box.y + box.h * opening.at; } else if (opening.side === 2) { x = box.x + box.w * opening.at; y = box.y + box.h; } else if (opening.side === 3) { x = box.x; y = box.y + box.h * opening.at; }
    const attrs = opening.side % 2 === 0 ? { x1: x - 1.4, y1: y, x2: x + 1.4, y2: y } : { x1: x, y1: y - 1.4, x2: x, y2: y + 1.4 }; svg.append(el('line', { class: 'opening', ...attrs }));
  }
  for (const relation of state.relations) {
    const from = state.objects.find(object => object.id === relation.from), to = state.objects.find(object => object.id === relation.to); if (!from || !to) continue;
    const route = routeForRelation(state, relation); svg.append(el('path', { class: 'relation', d: pathData(route), 'data-relation-id': relation.id, 'data-from': relation.from, 'data-to': relation.to, 'data-required-boundaries': (route.boundaryOrder || []).join(','), 'aria-label': `relation from ${relation.from} to ${relation.to}` }));
  }
  for (const object of state.objects) if (object.lifecycle !== 'RETIRED') svg.append(el('circle', { class: object.lifecycle === 'DORMANT' ? 'object dormant' : 'object', cx: object.x, cy: object.y, r: Math.max(.7, object.mass * .45), tabindex: '0', 'aria-label': `${object.id}, ${object.lifecycle.toLowerCase()}, parent ${object.parent}` }));
  const info = diagnostics(state); $('stat-generation').textContent = state.generation; $('stat-fingerprint').textContent = fingerprint(state); $('stat-boxes').textContent = state.boxes.length; $('stat-objects').textContent = `${info.currentObjects} current / ${info.retiredRecords} retired`; $('stat-openings').textContent = `${info.openBoundaries} open / ${info.closedBoundaries} closed`; $('stat-relations').textContent = info.activeRelations; $('stat-traces').textContent = info.currentTraces; $('stat-depth').textContent = info.maxDepth;
  $('events').textContent = `ACTIVE ${info.activeObjects} / DORMANT ${info.dormantObjects} / CURRENT ${info.currentObjects}\nCREATED ${info.objectsCreated} / RETIRED ${info.objectsRetired} / ERASED ${info.tracesErased}\nROUTED ${state.relations.length} relations / SIGNATURE ${routeSignature(state).hash}\n` + (state.events.length ? state.events.map(event => `› ${event}`).join('\n') : '› no transitions recorded');
}

function showTarget(target) { $('history-value').value = `TARGET GEN ${String(target).padStart(3, '0')}`; }
function commit(target) {
  target = clampGeneration(target); if (currentState?.generation === target) { $('history-value').value = `GEN ${String(target).padStart(3, '0')}`; return; }
  const state = currentState && target === currentState.generation + 1 ? nextState(currentState) : stateAt(target);
  rememberRecent(state); rememberCheckpoint(state); currentState = state; range.value = target; render(state);
}
function navigate(target) { pendingTarget = clampGeneration(target); commit(pendingTarget); }

checkpoints.set(0, genesis()); rememberRecent(checkpoints.get(0));
range.addEventListener('pointerdown', () => { pointerDragging = true; });
range.addEventListener('input', event => { pendingTarget = clampGeneration(event.target.value); if (pointerDragging) showTarget(pendingTarget); else commit(pendingTarget); });
range.addEventListener('pointerup', () => { if (pointerDragging) { pointerDragging = false; commit(pendingTarget); } });
range.addEventListener('pointercancel', () => { if (pointerDragging) { pointerDragging = false; commit(pendingTarget); } });
range.addEventListener('change', () => { if (!pointerDragging) commit(pendingTarget); });
range.addEventListener('keydown', event => {
  let delta = 0;
  if (event.key === 'ArrowRight' || event.key === 'ArrowUp') delta = 1;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') delta = -1;
  if (!delta) return;
  event.preventDefault();
  navigate((currentState?.generation ?? Number(range.value)) + delta);
});
$('back').onclick = () => navigate(Number(range.value) - 1); $('forward').onclick = () => navigate(Number(range.value) + 1);
for (const [name, description] of RULES) { const li = document.createElement('li'); li.innerHTML = `<span>${name}</span><em>${description}</em>`; $('rule-list').append(li); }
commit(80);
