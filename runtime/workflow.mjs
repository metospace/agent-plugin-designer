import {createGraphRun,advanceGraph} from './graph.mjs';
/** Deterministic, host-neutral contract. Hosts dispatch independent agents; this module never impersonates them. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
export const digest = value => createHash('sha256').update(typeof value === 'string' || value instanceof Uint8Array ? value : JSON.stringify(value)).digest('hex');
const terminals = new Set(['passed', 'accepted_with_risk', 'failed', 'cancelled']);
const ensure = (condition, message) => { if (!condition) throw Error(message); };
const text = value => typeof value === 'string' && value.trim().length > 0;
export function createRun(bundle, input) {
 if(bundle.schemaVersion===3)return createGraphRun(bundle,input);
 ensure(bundle.schemaVersion === 2 && bundle.maxReworks === 3 && bundle.predicates?.pass?.code === 'QA_PASSED_BOUND' && bundle.predicates?.rework?.code === 'QA_FAILED_REWORK_LT_3' && bundle.predicates?.human?.code === 'QA_FAILED_REWORK_EQ_3', 'unsupported contract/predicate codes');
 ensure(text(input.taskId) && text(input.task) && Array.isArray(input.criteria) && input.criteria.length && input.criteria.every(text), 'original task and acceptance criteria required');
 ensure(text(input.mainSession), 'main host session required');
 return { schemaVersion: 2, plugin: bundle.plugin, bundleHash: digest(bundle), taskId: input.taskId, task: input.task, criteria: input.criteria, criteriaHash: digest(input.criteria), mainSession: input.mainSession, status: 'developer_pending', reworks: 0, candidate: null, qa: null, dispatch: null, events: [], processed: [] };
}
export function advance(bundle, state, event) {
 if(bundle.schemaVersion===3)return advanceGraph(bundle,state,event);
 ensure(state.schemaVersion === 2 && state.bundleHash === digest(bundle), 'task/plugin/version/bundle changed');
 ensure(text(event.id), 'idempotency key required');
 if (state.processed.includes(event.id)) return state;
 ensure(!terminals.has(state.status) || (['passed','accepted_with_risk'].includes(state.status) && event.type === 'candidate_changed'), 'terminal task cannot transition');
 const s = structuredClone(state);
 const record = () => { s.processed.push(event.id); s.events.push({ ...event, at: event.at ?? new Date().toISOString() }); return s; };
 if (event.type === 'cancel') { s.status = 'cancelled'; return record(); }
 if (event.type === 'dispatch') {
  const role = s.status === 'developer_pending' ? 'developer' : s.status === 'qa_pending' ? 'qa' : null;
  ensure(role && event.role === role, 'wrong dispatch phase');
  ensure(text(event.sessionId) && event.sessionId !== s.mainSession, 'independent host session required');
  ensure(!s.events.some(e => e.type === 'dispatch' && e.sessionId === event.sessionId), 'fresh session required for each dispatch');
  if (role === 'qa') ensure(event.sessionId !== s.candidate.sessionId, 'QA must be independent of developer');
  s.dispatch = { role, sessionId: event.sessionId }; s.status = role === 'qa' ? 'qa_running' : 'developer_running'; return record();
 }
 if (event.type === 'blocked') { s.blockedFrom = s.status; s.status = 'blocked'; s.reason = String(event.reason || 'independent agent unavailable'); return record(); }
 if (event.type === 'retry_dispatch') { ensure(s.status === 'blocked', 'not blocked'); s.status = ['qa_pending','qa_running'].includes(s.blockedFrom) ? 'qa_pending' : 'developer_pending'; return record(); }
 if (event.type === 'developer_result') {
  ensure(s.status === 'developer_running' && event.sessionId === s.dispatch?.sessionId, 'unbound developer result');
  ensure(event.status === 'completed' && text(event.candidate) && text(event.evidence), 'malformed/interrupted developer result');
  // Candidate is the exact commit SHA or artifact SHA256, supplied by host inspection, never a prose summary.
  ensure(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(event.candidate), 'exact commit/artifact hash required');
  s.candidate = { hash: event.candidate, sessionId: event.sessionId, evidence: event.evidence }; s.qa = null; s.dispatch = null; s.status = 'qa_pending'; return record();
 }
 if (event.type === 'candidate_changed') {
  ensure(s.candidate && event.candidate !== s.candidate.hash, 'candidate did not change');
  s.candidate = null; s.qa = null; s.human = null; s.dispatch = null; s.status = 'developer_pending'; return record();
 }
 if (event.type === 'qa_result') {
  ensure(s.status === 'qa_running' && event.sessionId === s.dispatch?.sessionId && event.sessionId !== s.candidate.sessionId, 'unbound QA session');
  ensure(event.candidate === s.candidate.hash && event.criteriaHash === s.criteriaHash, 'stale candidate/acceptance criteria');
  ensure(['passed', 'failed'].includes(event.verdict) && text(event.evidence), 'malformed/interrupted QA output');
  ensure(Array.isArray(event.checks) && event.checks.length === s.criteria.length && event.checks.every((x, i) => x.criterion === s.criteria[i] && typeof x.passed === 'boolean' && text(x.evidence)), 'all original criteria need evidence');
  ensure(event.verdict === (event.checks.every(x => x.passed) ? 'passed' : 'failed'), 'verdict contradicts predicates');
  s.qa = { ...event }; s.dispatch = null;
  if (event.verdict === 'passed') s.status = 'passed';
  else if (s.reworks < 3) { s.reworks++; s.status = 'developer_pending'; }
  else s.status = 'human_paused';
  return record();
 }
 if (event.type === 'human') {
  ensure(s.status === 'human_paused' && event.actor === 'human' && text(event.reason), 'real human pause and reason required');
  ensure(['accepted_with_risk', 'failed', 'cancelled'].includes(event.outcome), 'human cannot manufacture QA passed');
  s.status = event.outcome; s.human = { outcome: event.outcome, reason: event.reason }; return record();
 }
 throw Error('unsupported event');
}
export function loadState(path) { return JSON.parse(readFileSync(path, 'utf8')); }
export function persist(path, state) {
 mkdirSync(dirname(path), { recursive: true });
 if (existsSync(path)) copyFileSync(path, path + '.backup');
 const temp = path + '.next'; writeFileSync(temp, JSON.stringify(state, null, 2), { mode: 0o600 }); renameSync(temp, path);
}
// Explicit paths only; no shell execution or permission configuration. Frozen bundle and original state are always checked.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
 try {
  const [command, bundlePath, statePath, inputPath] = process.argv.slice(2);
  ensure(['init', 'apply', 'status'].includes(command), 'usage: workflow.mjs init|apply|status bundle.json state.json [input.json]');
  const bundle = loadState(bundlePath);
  const input = command === 'status' ? null : loadState(inputPath);
  ensure(input?.type !== 'human', 'Human events require interactive human.mjs or the native host human command');
  const current = existsSync(statePath) ? loadState(statePath) : null;
  const next = command === 'init' ? (current ?? createRun(bundle, input)) : command === 'apply' ? advance(bundle, current, input) : current;
  ensure(next && next.bundleHash === digest(bundle), 'state belongs to another bundle');
  if (command === 'init') ensure(next.taskId === input.taskId && next.criteriaHash === digest(input.criteria) && next.task === input.task, 'existing task inputs changed');
  if (command !== 'status') persist(statePath, next);
  process.stdout.write(JSON.stringify(next) + '\n');
 } catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
}
