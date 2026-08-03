# Sanitized Seller-Link Rollout Evidence Fixture

<!-- TTC_SANITIZED_SELLER_LINK_ROLLOUT_FIXTURE -->

This fixture contains aliases only. It is not release evidence and cannot
approve a live seller link, deployment, configuration change, or store action.

## Release Candidate

| Field | Value |
| --- | --- |
| Web deploy version | fixture-seller-link-release |

## Current Console Blockers To Clear

| Platform | Blocker | Current handoff value | Result | Private proof filename or location |
| --- | --- | --- | --- | --- |
| Merch | Seller-link rollout | Fixture only | passed | fixture-proof |

## Seller-Owned Merch Rollout Evidence

| Step | Required private evidence | Expected state | Result | Private proof filename or location | Proof date |
| --- | --- | --- | --- | --- | --- |
| 1. Approved migration | Sanitized fixture | No public seller link | passed | fixture-migration-proof | 2026-08-02 |
| 2. First inactive Worker upload | Sanitized fixture | All release gates false | passed | fixture-first-upload-proof | 2026-08-02 |
| 3. Deploy while disabled | Sanitized fixture | Seller link hidden | passed | fixture-disabled-deploy-proof | 2026-08-02 |
| 4. Private seller link review | Sanitized fixture | Gate still false | passed | fixture-link-review-proof | 2026-08-02 |
| 5. Second inactive upload and approval | Sanitized fixture | Only seller-link gate may change | passed | fixture-second-upload-proof | 2026-08-02 |
| 6. Cross-platform QA | Sanitized fixture | Seller handles purchase support | passed | fixture-device-qa-proof | 2026-08-02 |
| 7. Rollback | Sanitized fixture | Gate false | passed | fixture-rollback-proof | 2026-08-02 |

## Seller-Link Rollout Log

| Attempt date/time | Area | Required proof | Result | Private proof filename or location | Next owner |
| --- | --- | --- | --- | --- | --- |
| 2026-08-02 | Fixture | Sanitized fixture | passed | fixture-proof | fixture-owner |
