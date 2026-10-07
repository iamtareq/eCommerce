@AGENTS.md

# Commits and pull requests

- Commit as the owner: `git config user.name "Tareq Hasan"` and `git config user.email "iamtareq1@gmail.com"` (set them in
  the repo before the first commit of a session).
- No AI attribution anywhere: no `Co-Authored-By: Claude`, `Claude-Session` or "Generated with Claude Code" lines in
  commit messages or pull request descriptions.
- Merge pull requests with **squash**. The resulting commit on `main` is signed by GitHub and shows as Verified; commits
  made in a cloud session carry its own signing key, which is not on the owner's GitHub account, so they show as
  Unverified if they reach `main` unsquashed.
- Never add a cloud session's signing key to the owner's GitHub account: it would let that service sign commits as them.
