# P4 → P5 Handoff: Data Contract for Dashboard & Reports

Audience: P5 (dashboard, reports, QA).
Scope: what P4 (orders, POS sales, PDF) actually writes to the database and the exact semantics P5
must respect when aggregating. Everything below was read from the real code and
`prisma/schema.prisma` of branch `feature/p4-order-sales-completion` (baseline `e7f886b`), and the
behaviors marked **[verified]** are covered by guarded tests (see section 19).

P4 did **not** implement any report/dashboard query. Nothing here modifies P5 code.

---

## 1. What P4 produces for P5

| P4 flow | Writes | Counts as revenue? |
|---|---|---|
| Member/staff creates order | `orders`, `order_items`, audit | **No** |
| Staff confirms order | `orders.status`, `products.reserved_stock`, `stock_reservations`, audit | **No** |
| Order → `SELESAI` | `sales` (+`sale_items`), stock decrease, `stock_movements` (`ORDER_FULFILLED`), audit | **Yes** (the `sales` row) |
| POS direct sale | `sales` (+`sale_items`), `stock_movements` (`SALE`), audit | **Yes** |

**Rule: revenue/profit is computed from `sales` + `sale_items` only. Never sum `orders.total`.**

## 2. Source of truth

- Schema: `prisma/schema.prisma` (P4 changed nothing in it; no migration was added).
- Code: `src/services/orderService.ts`, `src/services/saleService.ts`,
  `src/services/documentNumber.ts`, `src/services/paymentFields.ts`.

## 3. Actual tables P5 will read (snake_case DB names)

All money is **integer rupiah** (ADR-002). No decimals.

**`sales`** (`Sale`): `id`, `sale_no` (unique), `order_id` (nullable, **unique**), `member_id` (nullable),
`total`, `discount`, `payment_method` (default `TUNAI`), `payment_status` (default `LUNAS`),
`status` (`SaleStatus`, default `COMPLETED`), `sold_at` (default `now()`), `created_by` (nullable),
`created_at`, `updated_at`. Indexes: `sold_at`, `member_id`, `status`.

**`sale_items`** (`SaleItem`): `id`, `sale_id`, `product_id`, `qty`, `unit_price`, `cost_price`, `created_at`.
(There is no `updated_at` and no per-line discount column.)

**`orders`** (`Order`): `id`, `order_no` (unique), `member_id`, `status` (`OrderStatus`), `note`,
`reject_reason`, `total`, `created_by`, `created_at`, `updated_at`; relations `order_items`,
`stock_reservations`, optional one-to-one `sale`.

**`order_items`**: `order_id`, `product_id`, `qty`, `unit_price`, timestamps.

**`products`**: `cost_price`, `sell_price`, `stock`, `reserved_stock`, `min_stock`, `is_active`,
`deleted_at` (soft delete — joins for historical reports must **not** filter `deleted_at IS NULL`).

**`stock_movements`**: `product_id`, `type`, `qty_change`, `stock_before`, `stock_after`,
`ref_type`, `ref_id`, `note`, `created_by`, `created_at`.

**`audit_logs`**: `user_id`, `action`, `entity`, `entity_id`, `detail_json`, `created_at`.

## 4. Enums (actual values)

- `OrderStatus`: `DIAJUKAN`, `DIKONFIRMASI`, `DISIAPKAN`, `SIAP_DIAMBIL`, `SELESAI`, `DIBATALKAN`, `DITOLAK`
- `PaymentMethod`: `TUNAI`, `TRANSFER`, `BON`, `LAINNYA` (the PRD word "dicatat" corresponds to `LAINNYA`)
- `PaymentStatus`: `LUNAS`, `BELUM_LUNAS`
- `SaleStatus`: `COMPLETED`, `CANCELLED`
- `StockMovementType`: `IMPORT`, `PURCHASE`, `SALE`, `ORDER_FULFILLED`, `ADJUSTMENT`, `RETURN`

## 5. Two paths that create a Sale

### 5a. POS direct sale — `saleService.createSale`
- Actor (`createdBy`) is required; member optional (anonymous "umum" sale has `member_id = NULL`).
- `order_id = NULL`.
- Per line, the product row is locked `FOR UPDATE`; `sale_items.unit_price` and `sale_items.cost_price`
  are both copied from the **product row at the moment of sale** (snapshot at sale time).
- Duplicate lines for the same product are merged.
- Stock decreases via P2 `adjustStock` with type `SALE`, `ref_type = 'SALE'`, `ref_id = sale.id`.
- Sale must fit in `available = stock - reserved_stock` (reserved stock cannot be sold) **[verified]**.

### 5b. Order completion — `orderService.completeOrder` (status → `SELESAI`)
- `sales.order_id = orders.id`, `member_id = orders.member_id`, `created_by` = staff actor.
- `sale_items.unit_price` is copied from **`order_items.unit_price`** — the price **snapshot taken when the
  order was created** (not the current product price) **[verified, Stage A]**.
- `sale_items.cost_price` is read from **`products.cost_price` at completion (fulfillment) time**, not at
  order time **[verified, Stage A]**. So for order sales, selling price and cost price are snapshotted at
  *different* moments. If a product's cost changes between order creation and completion, the sale uses the
  cost at completion.
- Stock decrease is performed by P2 `commitReservation` (movement type `ORDER_FULFILLED`,
  `ref_type = 'ORDER'`, `ref_id = order.id`).
- Completion is atomic and idempotent per order (unique `sales.order_id`; existing-sale guard)
  **[verified, Stage C/D]**.

## 6. `Sale.total` and `Sale.discount` semantics (important)

- **`sales.total` is NET** (after discount) in both flows.
  - POS: `total = Σ(qty × unit_price) − discount`.
  - Order sale: `total = orders.total`, `discount = 0`.
- **Gross** (pre-discount) revenue = `sales.total + sales.discount`.
- The discount exists **only at sale level** (POS). It is **not allocated to `sale_items`**.
  Validation: integer, ≥ 0, ≤ subtotal.
- Consistency identity implied by the code: `total + discount = Σ(sale_items.qty × sale_items.unit_price)`.
  Verified by a concrete integration case (4 × 10 000 − 1 000 discount = `total` 39 000, discount 1 000);
  not asserted as a generic property over randomized data.

## 7. Gross profit — decision needed from P5/P1

PRD FR-8.2 says gross profit = Σ(sell − cost snapshot) × qty. Literally computed from `sale_items`,
this **ignores `sales.discount`**, so it overstates profit for discounted POS sales.

Recommended (needs team confirmation):

```
gross_profit(sale) = Σ_items (unit_price − cost_price) × qty  −  sales.discount
```

Equivalent per-period: `SUM(sales.total) − SUM(Σ cost_price × qty)`. Both forms agree because
`total = Σ qty×unit_price − discount`. Pick one and document it in the report footer.

## 8. What to include / exclude

- Include only `sales.status = 'COMPLETED'` (PRD FR-8.3: cancelled not counted).
  **Note:** P4 never sets `CANCELLED` (see section 13), so currently every sale is `COMPLETED`, but the
  filter must stay for forward-compatibility.
- Orders in any status other than `SELESAI` have **no** sale row and must not appear in revenue.
- `DIBATALKAN` / `DITOLAK` orders: no sale, no stock effect (reservations released).

## 9. Avoiding double counting

- Count `sales` rows once. `orders` and `sales` are one-to-one only for completed orders
  (`sales.order_id` unique). Do **not** `UNION` orders and sales, and do **not** join `orders` and add
  `orders.total` on top of `sales.total`.
- Joining `sales → sale_items` multiplies rows by item count. Aggregate `sales.total` in a
  sub-query / separately from `sale_items` sums (or use `COUNT(DISTINCT sales.id)` for transaction count).
  Example of the hazard: `SUM(sales.total)` after joining `sale_items` is wrong.

## 10. Distinguishing POS vs order sales

- `sales.order_id IS NULL` → POS direct sale.
- `sales.order_id IS NOT NULL` → generated from a completed member order.
- Both live in the **same** `sales` table (FR-6.3) and share one `SLS-YYYYMMDD-NNNN` number sequence.
- Anonymous sales: `member_id IS NULL` (only POS; order sales always have a member).

## 11. Payments and receivables (BON)

- `payment_method` ∈ `TUNAI | TRANSFER | BON | LAINNYA`; `payment_status` ∈ `LUNAS | BELUM_LUNAS`.
- BON requires a member (service enforces).
- **Open business rule:** the UI forces `BON ⇒ BELUM_LUNAS`, but the API/service accepts `BON + LUNAS` when
  the status is passed explicitly (`resolveSalePaymentFields`; characterized by an integration test).
  Pending P1 decision (see `P4-HANDOFF-P1.md`). **P5 should treat receivables as
  `payment_status = 'BELUM_LUNAS'`**, not as `payment_method = 'BON'`, until the rule is fixed server-side.
- There is **no pelunasan (settlement) flow** in P4: nothing changes `BELUM_LUNAS → LUNAS` after creation.
  An outstanding-receivable report therefore reflects only creation-time status.
- Payment fields are not moved by order progress: an order sale takes the payment method/status the
  staff entered at completion.

## 12. Timezone (WIB) — mandatory

- `sold_at` / `created_at` are UTC instants (`timestamp`). Business days are **Asia/Jakarta (UTC+7)**.
- Use `src/lib/date.ts` (ADR-005): `TIMEZONE_WIB`, `startOfDayWIB`, `endOfDayWIB`, `startOfWeekWIB`,
  `startOfMonthWIB`, `startOfYearWIB`, `formatDateWIB`. Do not use `date_trunc` / `toISOString().slice(0,10)`
  on raw UTC values — a sale at 23:30 WIB on the 31st is the next day in UTC.
- Document numbers (`ORD-`/`SLS-`) embed the **WIB** date of creation, not the UTC date.
- Reports by day should group on `sold_at AT TIME ZONE 'Asia/Jakarta'` (raw SQL) or by WIB boundaries
  computed with the helpers (Prisma).

## 13. Not implemented in P4 (affects reports)

- **No sale cancel / void / refund.** `SaleStatus.CANCELLED` exists in the schema but is never written.
- **No returns flow.** `StockMovementType.RETURN` exists but P4 never writes it.
- **No sale editing** after creation.
- **No settlement of BON** (see section 11).
- No staff-side PDF for an order before completion (member-only proof; sale receipt after completion).

## 14. Stock movements & reservations

- Reserve (staff confirm) / release (cancel/reject from `DIKONFIRMASI`) change **`products.reserved_stock`**
  and `stock_reservations` only. They write **no** `stock_movements` row and do **not** change `stock`.
- Physical decrease happens at: POS sale (`SALE`) and order completion (`ORDER_FULFILLED`).
- Available stock shown to users = `stock − reserved_stock`. Dashboard "stok menipis" (`min_stock`) logic
  is P5's choice: decide whether to compare `stock` or `stock − reserved_stock`.
- Invariants checked after every guarded test: `0 ≤ reserved_stock ≤ stock`, and no orphan reservations
  **[verified]**.
- Per-sale reconciliation: `stock_movements` of type `SALE` (`ref_id = sales.id`) and `ORDER_FULFILLED`
  (`ref_id = orders.id`) match `sale_items.qty`.

## 15. Document numbers

- `ORD-YYYYMMDD-NNNN`, `SLS-YYYYMMDD-NNNN` (WIB date). Per-day sequence from `MAX(suffix)+1` under
  `pg_advisory_xact_lock(hashtext(prefix))`; unique constraints on `order_no`, `sale_no`.
- Gap-safe and concurrency-safe **[verified, Stage D]**. Do not assume numbers are contiguous or sortable
  across days beyond lexicographic order.

## 16. Audit log actions written by P4

Same transaction as the business change; `entity` / actions:
`Order`: `CREATE_ORDER`, `CONFIRM_ORDER`, `ADVANCE_ORDER`, `REJECT_ORDER`, `CANCEL_ORDER`, `COMPLETE_ORDER`;
`Sale`: `CREATE_SALE`. `user_id` is the acting session user (staff, or the member's user for member
cancel/create). P2's `commitReservation` itself writes no audit; P4 writes `COMPLETE_ORDER`.

## 17. Recommended read-only query patterns (illustrative; adapt and test)

Revenue per WIB day, no double counting:

```sql
SELECT (s.sold_at AT TIME ZONE 'Asia/Jakarta')::date AS day,
       COUNT(*)                         AS transactions,
       SUM(s.total)                     AS net_revenue,
       SUM(s.total + s.discount)        AS gross_revenue
FROM   sales s
WHERE  s.status = 'COMPLETED'
GROUP  BY 1 ORDER BY 1;
```

Gross profit for the same filter (cost aggregated separately from sale-level totals):

```sql
WITH cost AS (
  SELECT sale_id, SUM(cost_price * qty) AS cogs
  FROM   sale_items GROUP BY sale_id
)
SELECT SUM(s.total - c.cogs) AS gross_profit            -- total is already net of discount
FROM   sales s JOIN cost c ON c.sale_id = s.id
WHERE  s.status = 'COMPLETED';
```

Best sellers (units and revenue before sale-level discount):

```sql
SELECT si.product_id, SUM(si.qty) AS units, SUM(si.qty * si.unit_price) AS line_revenue
FROM   sale_items si JOIN sales s ON s.id = si.sale_id
WHERE  s.status = 'COMPLETED'
GROUP  BY si.product_id ORDER BY units DESC;
```

Channel split: add `CASE WHEN s.order_id IS NULL THEN 'POS' ELSE 'ORDER' END`.
Receivables (creation-time): `WHERE s.payment_status = 'BELUM_LUNAS' AND s.status = 'COMPLETED'`.

Rules for any query: parameterize, read-only, never touch `koperasi_db`/test DB for testing writes,
and do not rely on `products.cost_price` for historic cost (use `sale_items.cost_price`).

## 18. Dependencies and open decisions for P5

1. Gross-profit-with-discount formula (section 7).
2. `BON ⇒ BELUM_LUNAS` server-side rule and meaning of "receivable" (section 11).
3. Low-stock definition vs reserved stock (section 14).
4. Whether order-level `orders.total` counts as "pipeline" metric (pending orders value) — allowed as a
   **separate** non-revenue widget; the staff badge uses `GET /api/orders/pending-count` (count of `DIAJUKAN`).
5. P5 pages are not present in this worktree (`/admin/reports`); they live on other branches. The nav entry
   already exists in the admin layout and `rbac.ts`.
6. List/history screens in P4 are **not paginated** for admin orders and member history (admin orders list
   supports filters: status, WIB date range, search by order no / member name / member no). P5 reports must
   do their own aggregation in SQL, not reuse these screens.

### 18a. Cross-team issues P5 will run into (details in `P4-HANDOFF-P1.md` §6–§7)

- **P1 middleware loop:** an anonymous request to `/unauthorized` redirects to itself
  (`ERR_TOO_MANY_REDIRECTS`). Matters for P5's own E2E/QA: always use a single host (`localhost`) and a
  valid session; do not treat it as a P4 or P5 regression. P1-owned, unchanged.
- **Unmerged modules:** `/admin/import` exists only on `feature/p3-excel-import` (P3);
  `/admin/reports`, `/admin/users`, `/admin/audit` and the profile page exist only on the old monolithic
  `origin/p5` branch with a different route layout (`src/app/admin/*`, `/member/profile`). The current
  `(admin)` / `(member)` route groups do **not** contain them, so the nav links 404 until they are rebuilt or
  merged. P5's report pages should be created under `src/app/(admin)/admin/reports/`.
- **Read-only interface for P5:** query `sales`, `sale_items` (and `products`/`members` for names) as in §17;
  do not call P4 service functions (`createSale`, `completeOrder`, …) from reports — they write.

## 19. Test evidence for the above (P4 only)

| Layer | Count | What it proves for P5 |
|---|---|---|
| Safe unit/route tests (`npm run test:p4:safe`) | 154 (19 files; 15 of them are P1 rbac/date/money) | numbering, payment fields, receipt access, PDF, route auth |
| Guarded PostgreSQL integration | 78 | A lifecycle 10 (price/cost snapshots, movements); B POS 9 (SALE movement, snapshots, reservations); C atomic rollback 11; D concurrency 12 (no oversell, unique numbers, single Sale per order); E HTTP auth 36 |
| Guarded Playwright E2E | 29 | member, cashier, POS (discount, BON, reservation) journeys on a production build |

Total P4 evidence runs: 261 (154 + 78 + 29). Guarded suites need explicit opt-in env vars and a dedicated
`koperasi_test_db`; see `P4-HANDOFF-P1.md` for the exact commands and safety rules. P5 should reuse the same
guard (`src/tests/p4/support/safeDb.ts`) for any DB-backed report test, and must **never** run bare
`npm test` (it executes `stockService.test.ts`, which has unscoped cleanup).
