# Owner Account Action Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove unavailable Admin account-deletion controls and enforce that an owner profile cannot be deleted.

**Architecture:** Keep the existing server action and role hierarchy as the primary authorization layer. Tighten the Admin render condition to the existing target-specific permission, then add an idempotent `BEFORE DELETE` profile trigger as the final owner invariant.

**Tech Stack:** Next.js 16 Server Components, TypeScript, Node smoke guards, PostgreSQL migration, Supabase CLI/MCP, Sites deployment.

## Global Constraints

- The owner account cannot be deleted, banned, suspended, or demoted.
- Admins can delete users and moderators; only the owner can delete admins.
- Do not expose infrastructure or provider details in member-facing copy.
- Use `npm.cmd` for npm scripts on Windows.
- Use the Supabase skill and current official documentation before schema, Auth, or Storage work.
- Keep the implementation limited to destructive-control visibility and owner-profile deletion protection.
- Do not expand this task into the deferred storage, retention, or deletion-job project.

---

### Task 1: Protect Owner Deletion At UI And Database Boundaries

**Files:**
- Modify: `scripts/smoke-admin-guards.mjs`
- Modify: `src/app/admin/users/page.tsx`
- Modify: `supabase/migrations/20260724134050_protect_owner_profile_deletion.sql`

**Interfaces:**
- Consumes: `canDeleteUser: boolean` from the existing Admin user-card permission calculation.
- Produces: `public.protect_owner_profile_deletion() returns trigger`.
- Produces: trigger `protect_owner_profile_deletion` on `public.profiles`.

- [ ] **Step 1: Add the failing Admin guard**

Add this migration fixture beside the other migration reads:

```js
const ownerProfileDeletionMigration = readFileSync(
  "supabase/migrations/20260724134050_protect_owner_profile_deletion.sql",
  "utf8",
);
```

Extend the account-deletion guard to require target-specific rendering and the
database invariant:

```js
adminUsers.includes("{canDeleteUser ? (") &&
!adminUsers.includes("canDeleteAccounts && !isOwnerAccount ? (") &&
!adminUsers.includes("disabled={!canDeleteUser}") &&
ownerProfileDeletionMigration.includes(
  "create or replace function public.protect_owner_profile_deletion()",
) &&
ownerProfileDeletionMigration.includes("if old.role = 'owner' then") &&
ownerProfileDeletionMigration.includes(
  "raise exception 'Owner accounts cannot be deleted.'",
) &&
ownerProfileDeletionMigration.includes(
  "drop trigger if exists protect_owner_profile_deletion on public.profiles",
) &&
ownerProfileDeletionMigration.includes(
  "before delete on public.profiles",
) &&
ownerProfileDeletionMigration.includes(
  "execute function public.protect_owner_profile_deletion()",
)
```

- [ ] **Step 2: Run the focused guard and verify the expected failure**

Run:

```powershell
npm.cmd run smoke:admin
```

Expected: the account-deletion guard fails because the UI still renders the
broader disabled disclosure and the CLI-created migration file is empty.

- [ ] **Step 3: Implement the minimal database guard**

Write this migration:

```sql
-- Keep the owner profile outside every account-deletion path.

create or replace function public.protect_owner_profile_deletion()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.role = 'owner' then
    raise exception 'Owner accounts cannot be deleted.';
  end if;

  return old;
end;
$$;

revoke all on function public.protect_owner_profile_deletion() from public;

drop trigger if exists protect_owner_profile_deletion on public.profiles;

create trigger protect_owner_profile_deletion
before delete on public.profiles
for each row
execute function public.protect_owner_profile_deletion();
```

- [ ] **Step 4: Implement the minimal Admin UI change**

Change the delete disclosure condition from:

```tsx
{canDeleteAccounts && !isOwnerAccount ? (
```

to:

```tsx
{canDeleteUser ? (
```

Remove `disabled={!canDeleteUser}` from the confirmation input and submit
button. Remove the now-unreachable unauthorized-message branch and retain this
single explanation below the form:

```tsx
<p className="mt-2 text-xs font-medium text-[var(--muted-strong)]">
  This removes the login and account data connected by account policy.
</p>
```

- [ ] **Step 5: Re-run the focused guard**

Run:

```powershell
npm.cmd run smoke:admin
```

Expected: all Admin guard checks pass.

- [ ] **Step 6: Review the scoped diff**

Run:

```powershell
git diff --check
git diff -- scripts/smoke-admin-guards.mjs src/app/admin/users/page.tsx supabase/migrations/20260724134050_protect_owner_profile_deletion.sql
```

Expected: no whitespace errors and only the planned guard, UI, and migration
changes.

- [ ] **Step 7: Commit the implementation**

Run:

```powershell
git add -- scripts/smoke-admin-guards.mjs src/app/admin/users/page.tsx supabase/migrations/20260724134050_protect_owner_profile_deletion.sql
git commit -m "Protect owner account deletion"
```

Expected: one focused implementation commit.

---

### Task 2: Verify, Release, And Record

**Files:**
- Modify after successful production deployment: `docs/APP_STORE_READINESS.md`

**Interfaces:**
- Consumes: the Task 1 commit and migration SQL.
- Produces: verified live database trigger, deployed web version, live smoke evidence, and a readiness-history entry.

- [ ] **Step 1: Run the required local verification**

Run:

```powershell
npm.cmd run smoke:admin
npm.cmd run lint
npm.cmd run build
```

Expected: all commands exit successfully. Existing documented Next.js warnings
may remain, but no new errors are accepted.

- [ ] **Step 2: Apply the reviewed migration**

Use the Supabase MCP `apply_migration` tool with:

```text
name: protect_owner_profile_deletion
query: exact contents of supabase/migrations/20260724134050_protect_owner_profile_deletion.sql
```

Expected: one successful migration-history entry.

- [ ] **Step 3: Verify the live invariant with read-only SQL**

Use the Supabase MCP `execute_sql` tool to query `pg_trigger`, `pg_proc`, and
`public.profiles`. Verify:

```text
protect_owner_profile_deletion is enabled on public.profiles
protect_owner_profile_deletion() remains SECURITY INVOKER
at least one owner profile still exists
```

Do not return profile IDs, usernames, email addresses, or other member data.

- [ ] **Step 4: Push the implementation commit**

Run:

```powershell
git push
```

Expected: the current branch is synchronized with its upstream.

- [ ] **Step 5: Deploy the exact pushed source**

Read `.openai/hosting.json`, prepare the source state required by the Sites
workflow, save a version whose `commit_sha` is the pushed Task 1 commit, and
deploy only that saved version.

Expected: the deployment reaches a terminal success state.

- [ ] **Step 6: Run live smoke verification**

Run:

```powershell
npm.cmd run smoke:public
npm.cmd run smoke:mobile
```

Expected: both live smoke commands pass against production.

- [ ] **Step 7: Record and commit the production release**

Append one dated entry to the existing deployment history in
`docs/APP_STORE_READINESS.md` using its current format. Record the exact pushed
commit, the exact Sites version identifier returned by deployment, successful
`smoke:public` and `smoke:mobile` results, and that the owner-deletion invariant
was verified without exposing member or infrastructure secrets.

Run:

```powershell
npm.cmd run smoke:docs
git add -- docs/APP_STORE_READINESS.md
git commit -m "Record owner deletion protection deploy"
git push
```

Expected: readiness docs guard passes and the deployment record is pushed.
