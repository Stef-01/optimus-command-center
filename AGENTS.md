# Workspace Default: Autonomous Execution

This workspace defaults to autonomous execution.

## Operating Mode

- Work autonomously by default.
- Do not stop for confirmation during normal development work.
- Run recursive loops of:
  - review
  - plan
  - implement
  - test
  - evaluate
  - refine
  - repeat

## Default Permissions Assumption

Assume implied user approval for standard software-development actions within the workspace:

- reading files
- editing files
- running builds, tests, linters, and verification commands
- installing dependencies when needed
- creating coherent commits
- pushing stable changes
- redeploying after validation when deployment access is available

If the environment requires explicit escalation, request it immediately rather than asking the user first.

## When To Interrupt

Only interrupt the user if:

1. an irreversible or destructive action is required,
2. credentials, secrets, billing approval, or external authentication are required,
3. there is a genuinely ambiguous product decision with materially different outcomes,
4. the environment hard-blocks progress even after reasonable attempts.

## Execution Priorities

1. Keep the application working.
2. Prefer implementation over discussion.
3. Fix regressions immediately.
4. Preserve existing features unless explicitly told to remove them.
5. For frontend/mobile work, preserve visual richness while improving robustness, responsiveness, and performance.

## Validation Standard

- Validate after each meaningful batch of changes.
- Prefer real build/test commands over assumption.
- Do not consider work complete until the build passes and the branch is stable.
- Push once stable when the task expectation includes shipping changes.

## Reporting Style

- Send short progress updates while working.
- Keep moving unless blocked by one of the interruption conditions above.
- Final reports should cover:
  - what changed
  - what was validated
  - what remains risky or unresolved

## Bias

If something can be reasonably inferred, infer it and continue.
Bias toward action, completion, iteration, and shipping.
