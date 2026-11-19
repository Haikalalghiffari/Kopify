# P4 → P1 Handoff: Review, Merge and Decisions

Audience: P1 (foundation, auth/RBAC, middleware, audit, integration owner) and reviewers.
Branch: `feature/p4-order-sales-completion` — baseline `e7f886b`
("Merge pull request #3 … feature/p4-pesanan-penjualan"). Nothing is committed yet.

P4 deliberately did **not** change P1/P2/P3/P5 code, `prisma/schema.prisma`, migrations, `.env`,
`stockService.ts` or `contracts.ts` (verified: 0 diffs on those paths).

---

## 1. What P4 delivers

**Member side**: catalog (search, category filter, pagination 12/page, stock availability, sold-out disabled),
client-side cart (localStorage), checkout with note, "Pesanan Saya" list and detail, cancel while `DIAJUKAN`,
download proof PDF.

**Staff side**: orders list (filters: status, WIB date range, search by order no / member name / member no),
new-order badge in the sidebar (`GET /api/orders/pending-count`), confirm / prepare / ready / complete /
reject (with reason) / cancel, create an order on behalf of a member, payment method + status on
completion, sales list, sale receipt page + PDF, POS (member optional, discount, payment method).

**Back end**: `orderService`, `saleService`, `documentNumber` (`ORD-` / `SLS-` numbers), `paymentFields`,
`p4Audit`, `catalogQuery`, `receiptAccess`, PDF generation (`pdfkit`), HTTP routes under `/api/orders`,
`/api/sales`. Everything business-critical runs in one DB transaction with row locks and writes its audit
row in the same transaction.

## 2. PRD coverage (FR-5.x orders, FR-6.x POS)

Status legend: **Complete+tested** · **Complete, partially tested** · **Complete with limitation** ·
**Blocked/Dependent** · **Out of P4 scope**.

| ID | Requirement | Implementation | Test evidence | Status | Limitations | Owner |
|---|---|---|---|---|---|---|
| FR-5.1 | Member catalog: active products, search, category filter, price & stock | `src/app/(member)/catalog/page.tsx`, `src/services/catalogQuery.ts`, `CatalogFilters`, `CatalogPagination`, `loading.tsx` | unit `catalogQuery.test` (3); E2E `member-catalog` (search/filter/pagination/empty, sold-out) | Complete+tested | Shown stock = `stock − reserved_stock` | P4 |
| FR-5.2 | Cart, change qty, submit with note | `src/lib/cart.ts` (localStorage), `cart/page.tsx`, `AddToCartButton`, `POST /api/orders` | E2E `member-catalog` (add/qty/checkout/cap at stock/empty cart); integration HTTP E (member create, price tamper ignored) | Complete+tested | Cart is per browser (localStorage), not server-side | P4 |
| FR-5.3 | Own order history + status; cancel while `DIAJUKAN` | `my-orders/page.tsx`, `my-orders/[id]/page.tsx`, `CancelOrderButton`, `POST /api/orders/[id]/cancel`, `orderService.cancelOrder/listMemberOrders/getMemberOrder` | integration A (member cancel only own DIAJUKAN), E (cancel 400 after confirm, 404 foreign); E2E `order-flow` | Complete+tested | History list is **not paginated** | P4 |
| FR-5.4 | Qty ≤ available stock at submit | `orderService.createOrder` (`stock − reserved_stock`), merged lines | integration A (refuse over-available), E (400 for insufficient/inactive); unit `orderService.stock` | Complete+tested | Check at submit **and** again at confirm (reserve) | P4 (reserve call = P2) |
| FR-5.5 | Staff order list with filters status/date/member; badge for new orders | `(admin)/admin/orders/page.tsx`, `/api/orders/pending-count`, admin layout badge | integration E (badge +1/back after confirm, 401/403); E2E `order-flow`, `mobile-smoke` (badge) | Complete with limitation | List **not paginated**; "member" filter is a free-text search (name / member no), not a picker; date filter uses a local WIB parser (functionally correct) instead of `lib/date.ts` | P4 |
| FR-5.6 | Confirm, reject (reason), change status | `PATCH /api/orders/[id]`, `orderService.confirm/advance/reject/cancel` + state machine | integration A (full lifecycle, invalid jump, reject/cancel paths, state machine), E (PATCH 400/404/401/403), D (duplicate confirm once); E2E `order-flow` | Complete+tested | — | P4 |
| FR-5.7 | On `SELESAI`: decrease stock, create sale, record payment method + status | `orderService.completeOrder` → P2 `commitReservation` + `Sale`/`SaleItem` | integration A (exact stock accounting, snapshots), C (atomic rollback ×4), D (completion exactly once); E2E `order-flow` (Transfer/Lunas) | Complete with limitation | **BON⇒BELUM_LUNAS not enforced server-side** (see §6); PRD "dicatat" ↔ enum `LAINNYA`; no later settlement flow | P4 / P1 decision |
| FR-5.8 | Print/download receipt or proof (PDF) | `GET /api/orders/[id]/proof` (member, owner only), `GET /api/sales/[id]/pdf` (owner member or staff), `lib/pdf/documents.ts`, `receiptAccess.ts`, `DownloadPdfLink` | unit `pdfDocuments` (2), `receiptAccess` (4), `p4Routes.auth` (19); integration E (401/403/404/200 matrix); E2E `order-flow`, `access-control` | Complete with limitation | Order **proof PDF is member-only**; staff get the sale receipt only after completion (no staff-side proof for non-completed orders) | P4 |
| FR-5.9 | Cashier creates an order on behalf of a member | `/admin/orders/new`, `POST /api/orders` (staff must send `memberId`) | integration E (staff must name member → 400, then created); E2E `order-flow` (audit trail records cashier) | Complete+tested | — | P4 |
| AC | Reserve on `DIKONFIRMASI`, release on cancel/reject | `orderService` + P2 `reserve/release` | integration A, C, D; unit `orderService.stock` | Complete+tested | — | P4 / P2 |
| AC | Members see only own orders (403/404 cross-member) | `getMemberOrder`, route checks, `receiptAccess` | integration E (404 for other member), E2E `access-control` (B cannot view/download/cancel A's order) | Complete+tested | `/my-orders/[id]` returns a true HTTP 404 (streaming `loading.tsx` was removed so the status is not a 200 shell) | P4 |
| AC | Unique order no `ORD-YYYYMMDD-XXXX` | `documentNumber.ts` | unit `documentNumber` (7), integration D (parallel unique, gap-safe) | Complete+tested | WIB date; ≥4-digit suffix | P4 |
| FR-6.1 | POS sale, member or anonymous, no prior order | `saleService.createSale`, `PosClient`, `POST /api/sales` | integration B; E2E `pos` | Complete+tested | — | P4 |
| FR-6.2 | Items, qty, optional discount, payment method; stock decreases | `saleService.createSale` | integration B (movement, snapshots, discount validation, rollback), C (rollback ×5), D (no oversell/deadlock); E2E `pos` (discount, receipt, stock drop) | Complete+tested | Discount is sale-level only; BON rule open (§6) | P4 |
| FR-6.3 | Order sales and POS sales in one `sales` table | `Sale.orderId` nullable unique | integration D (shared SLS sequence), A/B | Complete+tested | — | P4 |
| Not requirement text, but expected | Sale cancel / void / refund / returns | — | — | **Out of P4 scope / not implemented** | `SaleStatus.CANCELLED` and `RETURN` exist but are never written | team decision |
| FR-8.x (P5) | Dashboard/reports | — | — | **Out of P4 scope** | See `P4-HANDOFF-P5.md` | P5 |

Items that are **not** claimed complete: staff-side proof for pending orders, pagination of order lists,
server-side BON rule, settlement of BON.

## 3. Test evidence — 261 P4 test executions across 3 layers

| Layer | Count | How it runs | Latest result |
|---|---|---|---|
| Safe unit/route tests | **154** (19 files) | `npm run test:p4:safe` — no DB | pass |
| Guarded PostgreSQL integration | **78** | opt-in, local `koperasi_test_db` only | pass (A 10, B 9, C 11, D 12, E 36) |
| Guarded Playwright E2E | **29** | opt-in, local `koperasi_test_db`, production build | pass (access-control 12, member-catalog 5, mobile-smoke 2, order-flow 7, pos 3) |

Safe suite files: `rbac` 5, `date` 6, `money` 4 (P1 tests, included because they are pure), `safeDb` 18,
`documentNumber` 7, `orderService.phase3` 5, `saleService.stock` 6, `orderService.stock` 11,
`orderPatch.auth` 6, `pdfDocuments` 2, `p4Routes.auth` 19, `pagination` 2, `receiptAccess` 4,
`catalogQuery` 3, `paymentLabels` 1, `paymentFields` 5, `ordersPost.validation` 18,
`salesPost.validation` 23, `salesPost.realService` 9 = 154.

Cart-line validation regressions (no database):
- `src/app/api/orders/__tests__/ordersPost.validation.test.ts` — `POST /api/orders` with malformed lines
  (`null`, primitives, arrays, missing/non-string/blank `productId`).
- `src/app/api/sales/__tests__/salesPost.validation.test.ts` — the same shapes for `POST /api/sales`
  (service mocked), plus unchanged auth/role/enum/BON/valid-request behavior.
- `src/app/api/sales/__tests__/salesPost.realService.test.ts` — `POST /api/sales` against the **real**
  `saleService` with a mocked database: malformed lines return 400 and the transaction, stock adjustment,
  document numbering and audit spies stay untouched. Without the route check, the real service throws a
  `TypeError` and the route answered 500 (confirmed by a negative control).

Each malformed line returns HTTP 400 `{"error":"Data keranjang tidak valid."}`, calls no service/DB code and
logs no server error; valid requests are unchanged. The PostgreSQL (78) and E2E (29) counts were last
executed *before* these two small route validations; the request shapes they send (string `productId`,
numeric `qty`) pass the new checks identically, but those suites were not re-run.

Also run and passing on the final tree: `npm run type-check`, `npm run lint` (no warnings/errors),
`npm run build`.

## 4. Commands

**Always safe (no database access):**

```powershell
npm run type-check
npm run lint
npm run build
npm run test:p4:safe
npm run test:p4:integration:list     # lists only; does not connect
npm run test:p4:e2e:list             # lists only; does not connect
```

**NEVER run bare `npm test` / `npx vitest run`.** See §5.

**Guarded integration (writes to the test DB — authorization required each time):**

```powershell
$env:RUN_P4_DB_INTEGRATION = "1"
$env:TEST_DATABASE_URL = "postgresql://<user>:<password>@localhost:5433/koperasi_test_db"
npm run test:p4:integration                       # all 5 files
npm run test:p4:integration -- src/tests/p4/concurrency.integration.ts   # one file
Remove-Item Env:RUN_P4_DB_INTEGRATION, Env:TEST_DATABASE_URL
```

**Guarded E2E (starts a production build + server on port 3100 against the test DB):**

```powershell
npx playwright install chromium      # once
$env:RUN_P4_E2E = "1"
$env:TEST_DATABASE_URL = "postgresql://<user>:<password>@localhost:5433/koperasi_test_db"
npm run test:p4:e2e
Remove-Item Env:RUN_P4_E2E, Env:TEST_DATABASE_URL
```

Notes: use `localhost` consistently (the harness is configured so; mixing `127.0.0.1` breaks cookies because
Next's middleware redirects to `localhost`). The runner sets `NODE_ENV=test`; the harness forces
`NODE_ENV=production` for the child server only.

## 5. Database-safety warnings

1. The guarded suites refuse to run unless: opt-in env var set, `TEST_DATABASE_URL` explicit, database name is
   exactly `koperasi_test_db`, host is local, no forbidden connection params, `NODE_ENV` is not `production`
   (for integration), the URL differs from the process `DATABASE_URL`, and a runtime `current_database()`
   check matches. Logic and its 18 tests: `src/tests/p4/support/safeDb.ts`, `safeDb.test.ts`.
2. All fixtures are tracked and cleaned **by id** (`FixtureTracker`). There is no `TRUNCATE` / unscoped
   `deleteMany` in P4 tests.
3. **Hazard — `src/services/__tests__/stockService.test.ts` (P2, not P4):** it contains unscoped cleanup and
   is picked up by default `vitest.config.ts` (`*.test.*`). Bare `npm test` therefore runs it against whatever
   `DATABASE_URL` is set. P4 never ran it. Recommend P2/P1 guard it like `safeDb` or exclude it from the
   default `test` script. (`test:p4:safe` lists directories/files explicitly and excludes it; a check of the
   latest run confirmed it is not executed.)
4. **Hazard — `scripts/smoke-orders.ts`** writes to whatever `DATABASE_URL` points to (pre-existing; P4 only
   adjusted call signatures). Do not run it against a shared/dev DB.
5. Do not point `DATABASE_URL` and `TEST_DATABASE_URL` at the same DB. Dev DB is `koperasi_db`; tests use
   `koperasi_test_db`.

## 6. Decisions required from P1 / the team

### 6.1 BON payment rule (business decision)

Exact code: `src/services/paymentFields.ts` → `resolveSalePaymentFields(method, status)`:
if `status !== undefined` it is accepted for **any** method (so `BON + LUNAS` is valid at API/service level);
if omitted, `BON → BELUM_LUNAS`, others → `LUNAS`. The UI (`PosClient.tsx`, `OrderActions.tsx`) forces
`BELUM_LUNAS` and disables the status select when BON is chosen. `saleService` requires a member for BON.
Locked-in behavior: integration test "[characterization] the service does not force BON to BELUM_LUNAS…".

PRD ambiguity: FR-5.7 lists methods "tunai/transfer/dicatat/bon" and status "lunas/belum" but never says whether
a BON sale can be `LUNAS`. Also "dicatat" maps to enum `LAINNYA`.

**Recommendation (not applied):** enforce server-side that `BON ⇒ BELUM_LUNAS` at creation; settlement to
`LUNAS` through a separate explicit "pelunasan" action (audited) — future scope. Changing it requires updating
the characterization test and `paymentFields.test`.

### 6.2 P1 middleware: tokenless `/unauthorized` redirect loop (P1-owned, not changed)

`src/middleware.ts`: the NextAuth `authorized` callback lets `/unauthorized` through for anonymous users, but the
middleware body then calls `isRouteAllowed(path, null)`, which returns `false` for a null role, and redirects to
`/unauthorized` again → `ERR_TOO_MANY_REDIRECTS` for any request to `/unauthorized` without a token (e.g. a
member whose cookie was lost after being redirected). Reproduced during E2E. Suggested fix: treat
`/unauthorized` (and other public paths) as allowed in the middleware body before the role check, or return
`NextResponse.next()` when no token. The E2E harness avoids it by using one host; no assertion was weakened.

### 6.3 P2: `commitReservation` writes no AuditLog (P2-owned, not changed)

P4 writes `COMPLETE_ORDER` itself in the same transaction, so there is no audit gap for orders. Other callers of
`commitReservation` would have none. Decide whether the P2 service should audit.

### 6.4 Gross-profit with discount (P5 interplay)

Sale-level `discount` is not allocated to items; see `P4-HANDOFF-P5.md` §7.

## 7. Missing routes seen from this worktree — not P4 defects

The shared navigation links to pages that do not exist in this branch:

| Link | Where referenced | Where the page actually exists |
|---|---|---|
| `/admin/import` | admin layout, `rbac.ts`, dashboard hint | branch `feature/p3-excel-import` (`src/app/(admin)/admin/import/page.tsx`) — P3, unmerged |
| `/admin/reports` | admin layout, `rbac.ts` | only old monolith `origin/p5` (`src/app/admin/reports/page.tsx`) — P5, not yet rebuilt on the current route layout |
| `/admin/users`, `/admin/audit` | admin layout, `rbac.ts` | only `origin/p5` (old layout) — P1 scope, not merged |
| `/profile` | member layout, `rbac.ts` | only `origin/p5` as `/member/profile` (different path) — P1 scope |

`origin/p5` is the earlier monolithic implementation with a different route layout (`src/app/admin/*`,
`src/app/member/*`); merging it blindly will conflict with the `(admin)` / `(member)` route groups. P4 created
**no** placeholder pages. Until these modules land, clicking those links yields a 404 (authenticated).

## 8. Integration dependencies (what P4 uses from others)

- **P1**: `next-auth` session (`id`, `role`, `memberId`), `src/lib/rbac.ts` (route permissions),
  `src/middleware.ts`, `src/lib/db.ts`, `src/lib/date.ts` (WIB helpers, ADR-005), `src/lib/money.ts`,
  `AuditLog` model. Unchanged.
- **P2**: `stockService` (`reserve`, `release`, `commitReservation`, `adjustStock`) with the `tx` parameter;
  invariant `stockAfter ≥ reservedStock`. Unchanged.
- **Schema**: existing `Order`, `OrderItem`, `Sale`, `SaleItem`, `StockReservation`, `StockMovement`.
  No migration was needed.

## 9. Changes P4 made outside pure feature code (review carefully)

- `package.json` / `package-lock.json`: scripts `test:p4:safe`, `test:p4:integration(:list)`,
  `test:p4:e2e(:list)`; dependency `pdfkit ^0.20.2`; devDependencies `@playwright/test ^1.65.1`,
  `@types/pdfkit ^0.17.7`. Lockfile: +22 packages, 0 removed (pdfkit/fontkit and Playwright transitive deps).
- New config: `playwright.config.ts` (inert unless `RUN_P4_E2E=1`), `vitest.integration.config.ts`
  (matches only `*.integration.ts`).
- Route relocation: `src/app/admin/{orders,sales}/…` (git shows deleted) → `src/app/(admin)/admin/…` (git shows
  untracked), to match the route-group layout adopted in the merge `d9b24ae`. Contents were moved/updated, not
  duplicated.
- `src/app/(member)/my-orders/[id]/` is entirely new (untracked).
- `scripts/smoke-orders.ts`: only updated for new service signatures.
- PDF note: `pdfkit` reads its font data at runtime; works with `next start` and full `node_modules` (the
  Dockerfile runner copies `node_modules` and runs `npm start`; there is no `next.config`). If
  `output: "standalone"` is ever enabled, add `experimental.serverComponentsExternalPackages: ["pdfkit"]`
  and verify tracing.

## 10. Known non-blocking limitations (for the reviewer's judgement)

1. ~~`POST /api/orders` and `POST /api/sales` returned 500 for a malformed cart line (e.g. `null`)~~ —
   **fixed** (shape validation → 400, regression-tested; see §3). Quantity, stock, discount and BON rules
   remain in the services.
   - Related, not changed (outside "cart lines"): `POST /api/sales` forwards a truthy non-string `memberId`
     to the service unchecked (`body?.memberId || null`). By code reading (not reproduced against a real
     database) this fails inside the transaction and is rolled back as a generic 500, so no partial write
     is expected. Staff-only route; suggest `typeof memberId === "string"` validation in a follow-up.
2. Order status label/style map is duplicated in 5 places (including P1's shared `StatusBadge.tsx`).
3. Admin orders date filter uses a local `+07:00` parser rather than `lib/date.ts`.
4. Admin orders list and member history are unpaginated.
5. Unused e2e helper `autoDismissDialogs` in `e2e/p4/support/helpers.ts`.
6. No sale cancel/void/refund/returns flow; no BON settlement.
7. `POST /api/sales` response includes `saleItems.costPrice`; the route is staff-only (ADMIN/KASIR), so this is
   not exposed to members.
8. Default `vitest.config.ts` does not collect `*.integration.ts` / `*.e2e.ts` (by design), but does collect
   `stockService.test.ts` (see §5.3).

## 11. Review / merge checklist

- [ ] Confirm base: branch is on top of `e7f886b` (`git log --oneline -1`), PR targets `develop`.
- [ ] Protected paths unchanged:
      `git diff e7f886b -- prisma src/services/stockService.ts src/services/contracts.ts src/middleware.ts src/lib/rbac.ts src/lib/auth.ts .env` → empty.
- [ ] `.env` is not tracked / not staged; no credentials in diff (only dummy fixture users in `safeDb.test.ts`).
- [ ] `npm ci` works from the lockfile; `npm run type-check`, `npm run lint`, `npm run build` pass.
- [ ] `npm run test:p4:safe` → 19 files / 154 tests pass. **Do not run bare `npm test`.**
- [ ] With explicit authorization only: guarded integration (78) and E2E (29) on `koperasi_test_db`.
- [ ] Decide BON rule (§6.1), middleware fix owner (§6.2), P2 audit question (§6.3).
- [ ] Verify nav links vs available modules before demo (§7).
- [ ] Review the relocated route files under `src/app/(admin)/admin/` as new files (git shows delete + add).
- [ ] Skim `src/services/orderService.ts` and `saleService.ts` for transaction/lock order (sorted product ids,
      `FOR UPDATE`) — this is what the concurrency suite exercises.
