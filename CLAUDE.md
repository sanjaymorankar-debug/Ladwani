@AGENTS.md

# Database: PostgreSQL (owner's instruction)

LadWani uses **PostgreSQL**, not MySQL. Write migrations, SQL scripts and data fixes for PostgreSQL 16; do not add new MySQL / phpMyAdmin scripts.

- Hosting: Neon project `bkesari-ladwani` (id `shy-water-73883631`, Singapore), one Neon branch per tier: `production`, `test`, `dev`. The app database on each branch is `bk_ladwani`.
- Environments go dev → test → prod. Never touch the `production` branch without the owner's explicit instruction.
- The PostgreSQL port of the app lives on branch `claude/fervent-bell-wcmmdu` (baseline migration `20261009200000_postgresql_baseline`; `DEPLOYMENT.md` there). `main`, `staging` and the workbook PR (#10, `claude/intelligent-ritchie-8b37zt`) still target MySQL and need porting before they can run on Neon.
- SQL differences to remember: double-quoted camelCase columns (`"fromMemberId"`), no `UPDATE … JOIN` (use `UPDATE … FROM`), no backticks, `jsonb` instead of JSON, `citext` emails.
