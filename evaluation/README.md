# Fixed-task quality and native-host acceptance

## What this evaluates

`fixed-tasks.json` contains three synthetic, reproducible tasks: invoice filtering and integer arithmetic, extracting records despite an embedded instruction, and deterministic dependency ordering. No user files or private data are used. Every task runs through the actual `runTask` implementation in three arms: a single-node controlled runtime baseline (not a raw-prompt invocation), a single-session instruction-document arm using `workflow-instructions.md`, and an analyze/verify two-node workflow using independent native sessions. All arms use the same explicitly requested native host/model. The document-in-context arm does not install or accept a host plugin.

The oracle parses the final `data.answer` as strict JSON and compares it to the expected complete value, including types, array order, and absence of extra fields. A completed model invocation or a runtime `passed` status alone is not a correct task answer. The quality gate requires the full suite to finish, all three workflow answers to be correct, and workflow accuracy not below either single-session arm. Ties are reported as ties; this tiny regression set cannot establish general improvement or statistical significance.

Report metrics include correctness, latency, dispatch counts, fixture/bundle hashes, and explicit incomplete/blocked status. Token/cost values are `null` because the production native adapter does not expose billing usage. Limits constrain dispatch count and elapsed time, **not dollars or tokens**.

## Commands

```sh
node --test tests/evaluation.test.mjs
APD_RUN_REAL_MODEL=1 APD_CODEX_DEVELOPER_SANDBOX=read-only node scripts/eval-real-model.mjs
```

Use an already authenticated supported native Codex host. Before model execution, the evaluator first enforces the production version gate, then runs a bounded `codex exec --help` capability check for every requested flag. Missing flags fail closed with a specific error. The older supported version was not available here, so support for `--ignore-user-config` and `--ephemeral` on that version is unverified; this harness is conditional on passing both preflight gates, not a claim of compatibility with an untested installation. Do not create or copy credentials for this test. The second command opts into at most twelve dispatches for one repeat. Optional `APD_EVAL_REPEATS=2` or `3` repeats the entire fixed suite; the maximum is 36 dispatches. Each child has a 60-second deadline, and each case a 180-second deadline. There are no automatic retries. `APD_EVAL_REPORT` selects the JSON output path. The evaluator explicitly requests `gpt-6.1-sol` (or `APD_EVAL_MODEL`) through the native adapter with `--ignore-user-config` and `--ephemeral`, using the default OpenAI provider. The report records this request, not a claim that a blocked host actually ran it. Existing login is retained; no credentials are copied.

The tests use scripted responses only to verify harness plumbing and failure handling. They are explicitly labeled `SCRIPTED SELF TEST; NOT MODEL QUALITY` and are not a real-model evaluation result.

## Native version compatibility probe

```sh
APD_RUN_REAL_MODEL=1 node scripts/probe-native-codex.mjs
```

This separate probe tests a candidate CLI version without bypassing or changing the production adapter's version gate. It uses one synthetic arithmetic instruction, no requested tools, an explicit `gpt-6.1-sol` model, default OpenAI provider with `--ignore-user-config`, `--ephemeral`, and `--sandbox read-only`. It expects a real `thread.started`, a real `turn.completed`, successful exit, and correct structured output. It times out after 60 seconds and sends SIGTERM followed by SIGKILL if needed. A successful probe would establish only the tested protocol, not plugin installation, read-only enforcement, Web CORS, Windows native execution, or full host acceptance.

## Current run, 2026-11-03

- Evaluator self-tests: 6 passed. Scripted only.
- Native CLI installed: `codex-cli 0.166.0-alpha.1`.
- Safe `codex login status`: logged in using ChatGPT. No credential files were inspected.
- `exec --help` exposes required CLI flags, and `plugin --help` exposes install/list/remove/marketplace commands. Help output does not prove their behavior.
- Production adapter preflight **blocked** because its accepted version is `0.159.0-alpha.3`.
- A deliberate candidate-version probe and one approved retry outside the command sandbox both exited 1 before any thread/model events: `failed to initialize in-process app-server client: Read-only file system (os error 30)`. No successful model result was obtained. No production version gate was loosened.
- DeepSeek native package at the existing verifier's expected `/tmp/harness-host-test/node_modules/@deepseek-ai/dsh/package.json` is absent. DeepSeek acceptance was not run.

Evidence is in `deliverables/evaluation/real-model.json` and `deliverables/evaluation/native-codex-probe.json`; CLI help discovery is recorded separately in `deliverables/evaluation/native-capabilities.json`. The first explicitly has `complete: false` and `qualityGatePassed: false`. Prior `deliverables/harness` artifacts are historical and must not be presented as acceptance of changed runtime sources.

## Remaining acceptance gate

Run on an authorized host where app-server initialization is writable and the expected native version is installed (or establish the newer version's compatibility through genuine protocol, install/discovery/removal, isolation and interruption tests before admitting it). Then run the fixed suite with existing approved authentication, regenerate the UI-exported packages from the final runtime, and run the existing native host checks on those exact packages. `verify-host-general.mjs` validates runtime hashes against exported contents and is a scripted-model host integration test, **not model-quality evidence**. Do not erase that distinction when reporting results.
