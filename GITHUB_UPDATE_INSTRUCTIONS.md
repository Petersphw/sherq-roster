# Apply the latest SHERQ roster fix

This patch changes only:

- `src/app/RosterApp.tsx`
- `src/app/api/members/route.ts`

It does not change `DATABASE_URL`, delete database tables, or reset roster data.

## Recommended method: Git command line

1. Download `GITHUB_UPDATE.patch` from this project.
2. Open a terminal inside your local `sherq-roster` repository.
3. Back up your current branch:

   `git checkout -b backup-before-member-fix`

4. Return to main:

   `git checkout main`

5. Copy `GITHUB_UPDATE.patch` into the repository root.
6. Check the patch without applying it:

   `git apply --check GITHUB_UPDATE.patch`

7. Apply it:

   `git apply GITHUB_UPDATE.patch`

8. Review the changed files:

   `git diff -- src/app/RosterApp.tsx src/app/api/members/route.ts`

9. Commit and push:

   `git add src/app/RosterApp.tsx src/app/api/members/route.ts`

   `git commit -m "Fix member removal and roster regeneration"`

   `git push origin main`

## GitHub website method

If you only use github.com:

1. Open `GITHUB_UPDATE.patch` from this project.
2. The patch has two sections beginning with:
   - `diff --git a/src/app/RosterApp.tsx ...`
   - `diff --git a/src/app/api/members/route.ts ...`
3. Open each matching file in GitHub and click the pencil icon.
4. Apply only the additions/removals shown in the patch.
5. Commit both changes to `main`.

The command-line method is safer because Git verifies the exact original lines before applying anything.

## Data safety

Before deploying, confirm Vercel still has the same `DATABASE_URL`. Do not press Reset Month or Reset Year. A source-code deployment does not delete PostgreSQL data.
