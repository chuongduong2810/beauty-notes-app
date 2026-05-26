# Context

<!-- Pull all local issues dynamically -->
!`find .issues -type f \( -name "*.md" -o -name "*.txt" -o -name "*.json" \) \
  ! -path ".issues/completed/*" \
  ! -path ".issues/blocked/*" \
  -print`

<!-- Show issue contents -->
!`for f in $(find .issues -type f \( -name "*.md" -o -name "*.txt" -o -name "*.json" \) \
  ! -path ".issues/completed/*" \
  ! -path ".issues/blocked/*"); do
  echo "===== ISSUE: $f =====";
  cat "$f";
  echo;
done`

<!-- Project state -->
!`git status --short`

<!-- Recent commits -->
!`git log --oneline -10`

<!-- Detect package manager -->
!`ls | grep -E "package-lock.json|pnpm-lock.yaml|yarn.lock|bun.lockb"`

<!-- Read package.json if exists -->
!`[ -f package.json ] && cat package.json`

<!-- Find test scripts -->
!`[ -f package.json ] && jq '.scripts' package.json`

<!-- Current failing tests if possible -->
!`npm test -- --runInBand 2>/dev/null || pnpm test 2>/dev/null || yarn test 2>/dev/null || true`

<!-- Current typecheck -->
!`npm run typecheck 2>/dev/null || pnpm typecheck 2>/dev/null || yarn typecheck 2>/dev/null || true`

<!-- Current lint -->
!`npm run lint 2>/dev/null || pnpm lint 2>/dev/null || yarn lint 2>/dev/null || true`

# Task

You are an autonomous senior software engineer.

Your job is to process issues from the `.issues/` directory.

For each issue:

1. Read and understand the issue completely
2. Determine priority and dependencies
3. Implement the required fix or feature
4. Modify code safely and minimally
5. Preserve existing architecture and conventions
6. Add or update tests when appropriate
7. Run:
   - tests
   - lint
   - typecheck
8. Fix any failures introduced
9. Commit completed work with a clear commit message
10. Move completed issue files to:
    `.issues/completed/`
11. Move blocked/unresolved issues to:
    `.issues/blocked/`
12. Create a short implementation summary in:
    `.issues/logs/`

Rules:

- Never delete unrelated code
- Never ignore failing tests
- Never fake completion
- Prefer small safe iterations
- If multiple issues exist:
  - solve highest impact first
  - continue until context window or execution budget is exhausted

When an issue is ambiguous:
- inspect the codebase
- infer intended behavior
- implement the most conservative correct solution

If the repository uses:
- pnpm → use pnpm
- yarn → use yarn
- bun → use bun
- otherwise use npm

If Docker exists:
- prefer existing docker workflows

If CI configs exist:
- follow CI expectations exactly

Before completion:
- ensure git diff only contains intentional changes
- ensure repository is in working state

# Done

When ALL processable issues are completed, output:

<promise>COMPLETE</promise>