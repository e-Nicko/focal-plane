# Agent rules for Focal Plane

The `.agents/` folder holds the working agreements for everyone who changes this repository, human or agent.
The entry point is [AGENTS.md](../AGENTS.md).

The skill that teaches agents to make films is a different thing:
[skills/focal-plane](../skills/focal-plane/SKILL.md).
The rules say how to change the repository, and the skill says how to use it.

## How to use

1. Always apply the rules marked `alwaysApply: true`; the table calls them "always".
2. Pick the others by the files you touch (`globs`) and by the `description` in the frontmatter.
3. Check the claims of a rule against the code, the configuration and the tools.
4. When the code disagrees with a rule, find out why:
   - an accidental regression, a leaked secret or a lost invariant — fix the code;
   - a deliberate change of decision — change the code, the docs in three languages and the rule in one commit.

A rule is never changed only to hide a violation that was found.
Provenance, privacy and the determinism contract come before convenience.

## The rules

| Rule | When to apply |
|---|---|
| [environment](rules/environment.mdc) | always: Bun, Chrome with a GPU, the shell on Windows, file encoding, processes |
| [git-conventions](rules/git-conventions.mdc) | always: who acts, authorship, commits, branches, what never goes in |
| [provenance](rules/provenance.mdc) | always: licences, fonts, media, data, research sources |
| [determinism](rules/determinism.mdc) | always: a frame is a function of time |
| [verification](rules/verification.mdc) | always: the checks that are different facts, before-and-after frames, what a report says |
| [typescript](rules/typescript.mdc) | `src/**/*.ts`, `tools/**/*.ts`: strict, erasable syntax, `.js` specifiers |
| [engine](rules/engine.mdc) | `src/engine/**`: the frozen texture path, presets, the capture API |
| [kit-and-shots](rules/kit-and-shots.mdc) | `src/kit/**`, `src/film/**`, the templates: primitives, the grammar of a shot |
| [tools](rules/tools.mdc) | `tools/**`: the Chrome client, the server, uploads, process hygiene |
| [skill](rules/skill.mdc) | `skills/**`: keeping the agent skill true and lean, testing it on a stranger |
| [documentation](rules/documentation.mdc) | `*.md`: shape, claims, style, the cascade of a change |
| [translations](rules/translations.mdc) | `docs/ru/**`, `docs/zh/**`, the translated READMEs: terms, typography, parity |
| [line-breaks](rules/line-breaks.mdc) | any text: docs, rules, pull request text, comments in code |

## How to keep the rules

- One file, one topic, and a short one.
  A rule that grows is split by area of application.
- A rule for specific files carries `globs`.
- A rule states lasting agreements.
  The state of a task, dates and interim decisions do not go into it.
- Every claim in a rule can be checked: it names a command, a file or a number that exists.
- A rule from another project comes over only after it was adapted to this one.
- When an agent proposes bad code, the rule may be imprecise.
  Fix the rule as well as the code.

## What is intentionally absent

- `.agents/skills/`.
  The product skill lives in `skills/focal-plane/`,
  and no procedure of working on the repository is repeatable enough yet to become a skill.
- Unit tests.
  The picture is verified with frames and decoded video — [verification](rules/verification.mdc).
  CI runs `bun run typecheck`, `bun run check:docs` and the build.
- A CHANGELOG.
  The history is the git log, and the docs describe the present state.
