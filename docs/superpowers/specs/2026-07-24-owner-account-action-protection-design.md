# Owner Account Action Protection Design

## Goal

Remove unavailable destructive account controls from Admin and enforce at the
database boundary that an owner profile cannot be deleted.

## Scope

This is a small beta-readiness change. It covers only destructive-control
visibility and owner-profile deletion protection.

It does not redesign the full account-deletion workflow. Storage cleanup,
durable deletion receipts, retained commerce records, and retryable deletion
jobs remain a separate project because they span media, authentication,
payments, moderation, and legal-retention policy.

## Approaches Considered

### Recommended: UI cleanup plus database guard

- Render the Admin delete-account disclosure only when the signed-in
  administrator is authorized to delete that exact target.
- Preserve all existing server-action authorization checks.
- Add a `BEFORE DELETE` trigger on `public.profiles` that rejects deletion when
  the target role is `owner`.

This closes both the confusing UI state and the defense-in-depth gap with a
small, reviewable change.

### UI cleanup only

This removes confusing disabled controls but leaves owner protection dependent
on application code. It is not sufficient for the explicit requirement that an
owner can never be deleted.

### Full verified-deletion pipeline

This would add storage cleanup, retained-record anonymization, retry states,
durable receipts, and completion handling for member deletion requests. It is
the correct long-term design, but it is too broad to combine with this release
slice safely.

## UI Behavior

- Owner targets show no delete, suspend, ban, or role-change controls.
- A signed-in administrator never sees a delete control for their own account.
- An admin sees delete controls for users and moderators only.
- An owner sees delete controls for users, moderators, and admins, but never for
  another owner.
- The delete form continues to require the existing typed confirmation.
- No member-facing copy names hosting, database, storage, authentication, or
  payment infrastructure.

The current role and moderation controls remain unchanged. Only the condition
that renders the delete disclosure changes from a broad admin-level capability
check to the already-computed target-specific `canDeleteUser` decision.

## Server And Database Behavior

The existing server action remains the primary authorization path:

- The actor must be an admin or owner.
- Self-deletion is rejected.
- Owner deletion is rejected.
- Admin deletion requires the actor to be the owner.
- The target role is re-read from trusted server data.

The new database trigger provides a final invariant:

- Any attempt to delete a `public.profiles` row whose existing role is `owner`
  raises an exception.
- The guard applies regardless of which privileged application path initiated
  the delete.
- Non-owner profile deletion behavior is unchanged.

The migration must be idempotent: it creates or replaces the guard function and
recreates the named trigger safely.

## Error Handling

Existing sanitized Admin error copy remains unchanged. Raw backend errors stay
in server logs and are not placed in redirects or member-visible text.

The database exception is intentionally generic and contains no provider or
infrastructure name.

## Verification

The focused Admin guard must prove:

- The owner-protection migration defines a `BEFORE DELETE` trigger.
- The trigger rejects `OLD.role = 'owner'`.
- The Admin page renders the delete disclosure only when `canDeleteUser` is
  true.
- Existing server-side owner, self, and admin-role deletion checks remain.

Required commands:

```powershell
npm.cmd run smoke:admin
npm.cmd run lint
npm.cmd run build
```

If all checks pass, push the commit. Because this changes web UI and database
behavior, deploy the web release, run live `smoke:public` and `smoke:mobile`,
and record the successful release in `docs/APP_STORE_READINESS.md`.

## Deferred Follow-Up

Before claiming that every non-owner account can always be fully erased, build
the separate verified-deletion pipeline. It must handle member-owned files,
retain only approved commerce and moderation records, preserve a minimal
deletion receipt, and support safe retry when external cleanup fails.
