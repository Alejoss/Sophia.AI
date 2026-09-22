# HOW TO COLLABORATE

You can collaborate creating issues or solving them.

## How to create an issue

- Go to GitHub project, "Issues" section and click "New issue" button.
- Complete title and description.
- Title follows this convention: ${ISSUE-CODE}: ${short explanation}
- Explanation should be short, since it is a title.
- Issue code is a first word (DOCS, FRONT, BACK, OTHER), a middle slash and a four digit number.
  - DOCS means the issue is related to documentaion.
  - FRONT means the issue is related to frontend.
  - BACK means the issue is related to backend.
  - OTHER means the issue is related to otro tema.
- You can look at other issues, to use them as a reference.

## How to solve an issue

- Work directly on `develop`; verify the branch before editing or committing.
- Do not create feature branches, modify `main`, or open pull requests into `main`.
- Make focused changes, update documentation, review the diff and run relevant local tests.
- Commit to `develop`, using the real issue code if one exists.
- Push only `develop` when requested. Releases and deployments are separate.
- See [workflow](../../docs/hackathon/develop-workflow.md).
