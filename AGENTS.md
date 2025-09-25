# Repository Guidelines

## Project Structure & Module Organization
This repository hosts the Repo Crafter Probot app. TypeScript sources live in `src/`, with reusable helpers under `src/helpers/` and templated assets in `src/templates/`. The compiled JavaScript emitted by `npm run build` lands in `lib/`; do not hand-edit that directory. Automated tests reside in `test/` and rely on fixtures stored alongside them. Documentation and proposal notes are stored in `docs/`, while infrastructure definitions for ephemeral Azure environments live under `terraform/`.

## Build, Test, and Development Commands
Run `npm install` to sync dependencies. `npm run build` compiles the TypeScript into `lib/` using the root `tsconfig.json`. Use `npm start` to launch the Probot runner locally; it reads configuration from `app.yml` and requires the usual Probot environment (GitHub App credentials plus the optional Repo Crafter keys). Execute `npm test` to run the Vitest suite; add `--runInBand` when debugging flaky network mocks.

## Coding Style & Naming Conventions
The project targets Node.js 20 with native ES modules. Use TypeScript throughout and stick to the existing two-space indentation, camelCase for functions, and PascalCase for types/interfaces. Prefer named exports from helper modules, place related validation logic in `src/helpers/validation.ts`, and keep HTTP handlers slim by delegating to helpers. When adding files, mirror the folder naming already in use (e.g., `*.ts` for code, `*.test.ts` for unit tests).

## Testing Guidelines
Vitest powers the unit suite; place new specs beside peers in `test/` with filenames ending in `.test.ts`. Mock outbound GitHub calls with `nock` or Vitest spies instead of hitting the network. Ensure new features exercise both success and failure paths and update JSON fixtures when API payloads change. Run `npm test -- --coverage` before opening a pull request and document any intentional gaps.

## Commit & Pull Request Guidelines
Follow the Conventional Commits pattern visible in `git log` (`feat:`, `fix:`, `refactor:`) so automated changelog tools can parse history. Pull requests should describe the user-facing outcome, reference related issues, and include any manual verification steps (screenshots or command output) when behavior changes. Keep commits focused; prefer stacking logical steps over monolithic changes for easier review.

## Configuration & Security Notes
Local development needs `REPO_CRAFTER_API_KEY`, `REPO_CRAFTER_REQUIRE_AUTH`, and `REPO_CRAFTER_CREATE_SETUP_ISSUE` when exercising the HTTP API. Treat GitHub App private keys and API keys as secrets—load them via `.env` or your shell, never commit them. Review Terraform diffs carefully; changes there alter Azure resources and should be coordinated with the platform team.
