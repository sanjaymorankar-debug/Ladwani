@AGENTS.md

# Database: PostgreSQL (owner's instruction)

LadWani uses **PostgreSQL**, not MySQL. Write migrations, SQL scripts and data fixes for PostgreSQL 16; do not add new MySQL / phpMyAdmin scripts.

- Hosting: Neon project `bkesari-ladwani` (id `shy-water-73883631`, Singapore), one Neon branch per tier: `production`, `test`, `dev`. The app database on each branch is `bk_ladwani`.
- Environments go dev → test → prod. Never touch the `production` branch without the owner's explicit instruction.
- Migrations build on the PostgreSQL baseline `20261009200000_postgresql_baseline` (see `DEPLOYMENT.md`). The PostgreSQL line is `claude/fervent-bell-wcmmdu` (PR #15); the workbook PR (#10, `claude/intelligent-ritchie-8b37zt`) was ported onto it. `main` and `staging` still hold the old MySQL code.
- Local tests run against PostgreSQL 16 (`pg_ctlcluster 16 main start`; database `miladwani_test`, user/password `postgres`), as CI does.
- SQL differences from the old MySQL code to remember: double-quoted camelCase columns (`"fromMemberId"`), no `UPDATE … JOIN` (use `UPDATE … FROM`), no backticks, `jsonb` instead of JSON, `citext` emails, JSON paths as arrays (`path: ['familyId']`, not `'$.familyId'`).

## Testing agent

Every code change in this repository goes through its testing agent before the
work is reported as done. The agent runs the standard and full regression
suites from its spec, fixes the defects it finds, re-runs everything and writes
a report to `.claude/test-runs/`.

| Agent | Spec | Covers |
|---|---|---|
| `ladwani-tester` (`.claude/agents/ladwani-tester.md`) | `TEST_SPEC.md` | the whole repository |

- Launch it with the Agent tool and that `subagent_type`. If the type is not
  offered (a session started outside this repository), launch a general-purpose
  agent and tell it to read and follow the agent file.
- The Stop hook in `.claude/settings.json` (`.claude/hooks/test_gate.py`)
  holds the session until the agent has run on the changed code.
  `python3 .claude/hooks/test_gate.py status` shows what has been tested.
- When several agents are due, run them in parallel, then report each verdict.
- `next dev` rewrites only the managed block in `AGENTS.md`; this file keeps
  the section above.
