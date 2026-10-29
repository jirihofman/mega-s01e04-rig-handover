---
name: plan-to-issues
description: Split this repo's plan.md into GitHub issues with gh, one per unit of work, after a human has reviewed the split. Use when a plan is ready and has no issues yet.
---

# plan-to-issues

Turns `plan.md` into GitHub issues that workers can pick up cold. Easiest with `gh`, authenticated,
in a shell this agent can run.

## Steps

1. Read `plan.md`, `AGENTS.md` and `docs/adr/`.
2. Draft the split as a table: title · plan section · scope · done when · blocked by.
   One issue per unit of work.
3. **Stop and show the table to the human.** Publish nothing until they approve it.
4. Use the approved format below. Ask only about requirements not already recorded or
   changes the human wants; do not ask them to approve the same fields again.
5. Create each issue in dependency order, so blocked-by can cite real numbers:

   ```sh
   gh issue create --title "<title>" --label "plan:<plan-name>" --body-file <tmp.md>
   ```

6. Record every issue URL from gh's output (not from memory) and reply with the list.

## Approved issue format

The human approved this format during S01E04. Each issue has a concrete title, the label
`plan:<plan-name>` (`plan:morning-digest` for that plan), and this body:

```markdown
Source: plan.md § <n>

## Scope
<The bounded change, constraints, and interfaces this worker needs.>

## Done when
<Observable completion conditions and the check that proves them.>

## Blocked by
<Actual issue numbers or URLs and the milestone required from each; or None.>
```

Preserve section identifiers such as `1`, `2a`, and `2d`. Create the plan label if absent,
within the authorized issue work. Record returned URLs, not guessed numbers.

Distinguish starting work from finishing it: a committed type contract may unblock page,
API, board, and test workers while integrated validation still waits for the reader and routes.

For a public preview, completion includes the reviewer confirming they have seen it.
Sending the link is not completion, even if an older plan says “sent.” Make that dependency
explicit in the proposed split. Cleanup is blocked by review confirmation and the human's
replacement approval. Keep the review issue open while waiting; follow the reviewer's retry
interval. Do not add `closes #n` to a commit until every completion condition holds, because
pushing it to the default branch can close the issue automatically.

Closing one, with the closing comment from AGENTS.md:

```sh
gh issue close <n> -c "<closing comment>"
```

## No `gh`

Steps 1–4 hold either way. GitHub reachable another way (a connector, the REST API, the web UI):
the same issues, made that way. GitHub issues out of reach altogether: write them as files in
`docs/issues/`, format in ADR 0004, then commit and push.

## Don'ts

- Don't paste the whole plan into one issue, and don't keep issues only in chat.
- Don't invent sections the plan doesn't have. If the plan is unclear, ask.
