# JZB Decoder - Agent Guide

Canonical instructions for AI coding agents. `CLAUDE.md` and `GEMINI.md` point here; edit this file only.

## Project

DevTools extension for decoding jzb URL payloads in Chrome, Edge, and Firefox.

## Commands

- Install: `npm ci`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Test: `npm run test`
- Coverage: `npm run test:coverage` (100% lines, functions, branches, statements; mandatory on push and in
  CI)
- Build: `npm run package`

## Rules

- Never commit with `--no-verify`. Fix the cause when a hook fails.
- This repository uses GitHub issues for ticketing.
- Do not use Jira tools, issue keys, or ticket-derived branch and commit naming.
- Linters are strict (ESLint, Stylelint, html-validate, markdownlint). Do not weaken rules to pass.
- New UI work uses the tokens and components in `/design-system`. Migrate existing values when modifying their UI.
- Pin Node via `.nvmrc`; package manager is `npm`. Keep `package-lock.json` committed.
- Every PR updates `CHANGELOG.md` and bumps the version (one SemVer bump per PR), except Dependabot PRs.
  Merged PRs that change shipped extension files are submitted to the Chrome Web Store automatically.
- Track open work in `TODO.md`.

## Layout

- `design-system/` - tokens, components, showcase
- `.husky/` - git hooks (pre-commit fast, pre-push broad)
- `.github/` - CI, release, Dependabot, templates
