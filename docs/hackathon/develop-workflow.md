# Development workflow: develop only

All development, documentation and commits must remain on `develop`. Do not create feature branches, open pull requests into `main`, or modify `main`.

1. Verify `git branch --show-current` returns `develop` and inspect the working tree.
2. Preserve existing changes and identify the exact scope of the next commit.
3. Implement one focused change, with regression tests for behavior fixes and updated documentation.
4. Review the diff, run relevant local checks and record results and limitations.
5. Stage explicit files and commit directly to `develop`. Use an existing issue code where applicable, otherwise a descriptive `docs:` or `fix:` prefix.
6. Push only `develop` when requested. Never force-push or deploy implicitly.

Current CI automatically runs on `main`, not `develop`. Run local validation; do not touch `main` to trigger CI. Manual CI dispatch publishes images and is a separate operation.

Keep hackathon documents in this folder. Use commit messages and verified diffs for weekly videos, distinguishing pre-existing functionality, new implementation, tests and deployments.

Production server instructions that read `main` describe release infrastructure only. They do not change this development policy or authorize a release.
