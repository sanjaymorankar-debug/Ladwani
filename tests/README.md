# Running the tests

These are not isolated unit tests. Every file imports `@/lib/prisma` and the
`tests/uat/` suite drives real route handlers, so the suite needs a **real MySQL
database it is allowed to truncate and re-seed**. Point it at your dev database
and it will overwrite what you were working on.

## First time

1. Start a local MySQL. The `kesari-devstack` compose puts one on port 3307 with
   a `ladwani_test` database already created; anything else works as long as you
   have an empty database and a user who can create tables in it.

2. Make your test env file — it is gitignored, so it is not in the repo:

   ```sh
   cp .env.test.example .env.test
   ```

   Edit `DATABASE_URL` only if your server is not on 3307. Read the comments
   before changing anything else; several of the values are load-bearing.

3. Prepare the database:

   ```sh
   npm run test:setup
   ```

## Every run after that

```sh
npm test
```

## The scripts, and what each is for

| script | does |
|---|---|
| `npm test` | `vitest run` against `.env.test`. Nothing else — fast and repeatable. |
| `npm run test:migrate` | `prisma migrate deploy` on the test database. |
| `npm run test:seed` | Reference data, roles, and the `example.test` accounts. |
| `npm run test:seed:uat` | The `UAT-*` members and the three UAT families. |
| `npm run test:setup` | All three, in order. What you run on an empty database. |

`test:seed` exists because `db:seed` has no env-file wrapper: run that for tests
and it seeds whatever `.env` points at, which is the database you develop in.

Both seeds are needed, and in that order. `tests/*.test.ts` look up accounts by
email (`test.member@example.test`), which `seed.ts` creates; `tests/uat/*` look
up members by number (`UAT-KARTA-01`) via `tests/uat/helpers.ts`, which
`uat-seed.ts` creates. Run only the first and the 10 UAT files fail in setup with
`NotFoundError: No Member found`. `uat-seed.ts` also resolves roles and
relationship types with `findUniqueOrThrow`, so it has to follow `seed.ts`.

## Why `SEED_TEST_ACCOUNTS=true` matters

Each test file opens with a `beforeAll` that does `findUniqueOrThrow` on fixture
accounts — `test.member@example.test`, `test.karta@example.test`,
`test.other-karta@example.test` and friends. They are created by
`prisma/seeds/seed.ts`, but **only** when `SEED_TEST_ACCOUNTS` is exactly
`"true"`; that gate is what keeps accounts sharing one published password out of
production (see `scripts/mysql/README.md`).

So without it every test file fails in setup, with a `findUniqueOrThrow` error
that says nothing about the real cause. `.env.test.example` sets it.

## When tests start failing for no reason

Test files share one database and run one at a time (`fileParallelism: false` in
`vitest.config.mts`). Rows one file leaves behind can make a later file fail, so
when a run goes strange, start the database over rather than guessing:

```sh
./devstack reset ladwani     # from the kesari-devstack directory
npm run test:setup
npm test
```

`reset` drops and recreates `ladwani_test` and leaves it schemaless on purpose,
so `test:setup` always tells you which migration state you are testing.
