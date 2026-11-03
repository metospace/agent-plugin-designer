# Graph runtime limits (contract v3)

Pass an optional `limits` object on the existing run input JSON. Old bundles and inputs remain valid. Example:

```json
{"limits":{"maxSteps":1000,"maxDispatches":100,"timeoutMs":1800000,"dispatchTimeoutMs":300000,"hostCheckTimeoutMs":10000,"cleanupTimeoutMs":5000}}
```

These are also the defaults. Values must be positive safe integers no greater than 2147483647. Unknown keys are rejected, including token or monetary caps: the runner cannot enforce model billing or token usage.

- `maxSteps` counts graph edge transitions, including automatic routing and fork branches.
- `maxDispatches` counts persisted dispatch intents, including failed/ambiguous starts. A parallel batch must fit before any child starts.
- `timeoutMs` is a persisted wall-clock budget from run creation, including downtime and human pauses.
- `dispatchTimeoutMs` bounds host start plus child result waiting for each dispatch.
- `hostCheckTimeoutMs` bounds host capability checks.
- `cleanupTimeoutMs` bounds each disposal attempt separately. Cleanup errors are persisted as warnings and do not erase completed evidence or the primary blocker.

Limits are pinned in task state. Resume without `limits` uses the saved limits; providing changed limits is rejected. Start a new task to change them. Older saved states are initialized once with limits and a new wall-clock start; their historical dispatch intents are counted, while historical step usage can only be estimated from recorded result events.

Timeouts abort the signal passed to `host.start`, stop waiting, and prevent new graph dispatches. On Unix, the Codex adapter creates a separate process group and sends SIGKILL to that group on cancellation/disposal, including ordinary shell/tool descendants and cancellation before identity publication. It never signals the runner’s own group. On Windows, only the direct Codex process is terminated; descendant termination is not implemented or verified, so inspect and stop remaining tools before recovery. Processes that deliberately detach into another group/session can escape group cancellation and also require host inspection; DeepSeek forwards the combined parent/dispatch signal to activation. They do not guarantee termination of remote work, preempt synchronous JavaScript, or stop charges. Inspect the recorded intent/session and actual host before explicitly retrying. A host start that resolves after timeout is disposed best effort; it never advances the blocked state. The runner never automatically retries ambiguous actions. Completed tasks may still have cleanup warnings requiring host inspection.

## Explicit recovery

Run `node scripts/human.mjs bundle.json /absolute/workspace/.apd/task.json` from an exported plugin (in this source checkout use `runtime/human.mjs`). For a blocked task it displays the blocker, persisted child IDs/intents, and budgets. Inspect actual sessions and stop unresolved work, then type `INSPECTED AND STOPPED` and give a reason. This prepares an explicit retry only; it does not run the task. Counters and the original deadline remain unchanged. Exhausted budgets or an expired deadline require a new task after host inspection; retry cannot reset them. Invalidated independent review cannot be bypassed through recovery. Existing paused-human decisions remain available in the same command. The command requires a real interactive terminal and refuses an existing task lock.

## Explicit Codex evaluation options

`codexHost(command, {model:'gpt-6.1-sol', ignoreUserConfig:true, ephemeral:true})` opts into a specific model, ignoring user configuration, and ephemeral execution. Options default to unset/false, so production invocations preserve the user's configuration. These options do not relax the pinned tested-version gate or host permission checks. The evaluator must report the selected options and actual host acceptance separately.
