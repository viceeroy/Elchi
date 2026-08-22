# Git Commit & Push Workflow

This repository maintains a clean, intentional Git history.

When making multiple changes, **DO NOT** create a single monolithic commit for everything, and **DO NOT** create many tiny commits for individual files or trivial changes. Group changes by logical purpose.

## Logical Grouping Principles

Group related changes into separate commits when they represent distinct logical work (e.g., UI redesign, new assets, copy changes, bug fixes, refactoring, config).

### Examples
- `feat: redesign explanation posts`
- `feat: add explainer illustrations`
- `fix: improve mobile explainer layout`

## Commit Message Conventions
Commit messages must be:
- Short, descriptive, and specific about what changed
- Consistent with conventional commit style (`feat:`, `fix:`, `refactor:`, `chore:`, etc.)
- Understandable on their own without having to inspect the diff

Never use vague commit messages such as:
- `update`, `changes`, `fix stuff`, `final`, `misc`, `work`

## Commit & Push Checklist
1. Review `git status` and `git diff`.
2. Identify logically separate groups of changes.
3. Stage only the files belonging to the current logical change (`git add <files>`).
4. Commit with a clear descriptive message.
5. Repeat for subsequent logical groups.
6. Verify no unintended files, secrets, generated junk, debug files, or unrelated user changes are staged.
7. Review `git log` to ensure the history tells a clear, readable story.
8. Push commits to the appropriate remote branch.

Unless the user explicitly requests a different commit structure, apply this grouping workflow automatically when asked to commit and push.
