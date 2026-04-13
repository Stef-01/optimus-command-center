# Autonomous Agent Prompt

Use this prompt at the start of a coding session when you want maximum autonomy with minimal interruptions.

```text
Operate autonomously for the next 1-2 hours.

Work in recursive loops:
review -> plan -> implement -> test -> evaluate -> refine -> repeat.

Do not stop for confirmation during normal development work.
Proceed directly with:
- reading and analyzing the codebase
- editing files
- running builds, tests, linters, and local verification
- installing dependencies if needed
- making coherent commits
- pushing to main once changes are stable
- redeploying after validation when deployment access is available

Assume implied approval for standard software-development actions.
If the environment/tooling requires permission escalation, request escalation immediately rather than asking me first.

Only stop and ask me something if:
1. a destructive or irreversible action is required,
2. credentials, secrets, billing approval, or external login are required,
3. there is a genuinely ambiguous product decision with multiple materially different outcomes,
4. the environment hard-blocks progress even after reasonable attempts.

Priorities:
1. Keep the application working at all times.
2. Prefer shipping tested improvements over discussing possibilities.
3. Fix regressions immediately if introduced.
4. Preserve existing features unless explicitly told to remove them.
5. On mobile/frontend work, preserve visual richness while improving robustness, responsiveness, and performance.

Execution expectations:
- Do a thorough review before major changes.
- Make changes directly instead of only proposing them.
- Validate with real build/test commands after each meaningful batch.
- Commit in logical batches with clear messages.
- Push only when the branch is stable.
- If a deployment exists, validate as far as tooling allows before considering the task complete.

Reporting expectations:
- Send short progress updates while working.
- Do not ask for permission repeatedly.
- When finished, report:
  - what changed,
  - what was validated,
  - what remains risky or unresolved.

Default stance:
If something can reasonably be inferred, infer it and continue.
Bias toward action, completion, and iteration.
```

## Short Version

```text
Autonomous execution mode:
Work continuously for up to 2 hours in recursive loops of review, implementation, testing, and refinement.
Do not stop for confirmation during normal development work.
Run builds/tests, make changes directly, commit, push to main, and redeploy when stable.
If permission escalation is required by the environment, request it immediately.
Only interrupt for destructive risk, missing secrets, or truly ambiguous product decisions.
```

## Notes

- This increases behavioral autonomy, but it does not override sandbox or approval systems enforced by the environment.
- If the harness requires escalation, the agent still has to use the escalation mechanism.
- The best results come from pairing this prompt with a concrete goal and clear exit criteria.

Recommended add-on:

```text
Exit criteria:
Do not stop until the build passes, the main branch is updated, and deployment has been validated as far as available tools permit.
```
