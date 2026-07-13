# BlessERP Modular Architecture — Migration Plan

## Goal
Self-contained modules (one per business entity), zero cross-module imports, shared infrastructure in `shared/`.

## Current State (before migration)
**25 module folders** under `src/modules/` — only 5 structured (accounting, crm, hrms, inventory, purchases); remaining 20 are flat component files.

**21 standalone services** under `src/services/` (customers.service.ts, invoices.service.ts, etc.) — the real API logic.

**110 page files** under `src/pages/` (26 page directories).

**5 hooks** under `src/hooks/`.

## Target Structure
```
src/
 ├── modules/
 │   ├── customers/
 │   │   ├── pages/        ← CustomerList, CustomerDetail, NewCustomer, EditCustomer
 │   │   ├── components/   ← CustomerForm, CustomerTable, CustomerSearch
 │   │   ├── services/     ← API calls (moved from src/services/)
 │   │   ├── hooks/        ← useCustomers, etc.
 │   │   └── types/        ← Customer, CustomerFormData, etc.
 │   │
 │   ├── invoices/         (same structure)
 │   ├── products/         (same structure)
 │   ├── payments/         (same structure)
 │   ├── expenses/         (same structure)
 │   ├── bills/            (same structure)
 │   ├── suppliers/        (same structure)
 │   ├── contacts/         (same structure)
 │   ├── opportunities/    (same structure)
 │   ├── quotations/       (same structure)
 │   ├── sales-orders/     (same structure)
 │   ├── bank_accounts/    (same structure)
 │   ├── journal_entries/  (same structure)
 │   ├── purchases/        (same structure)
 │   ├── leads/            (same structure)
 │   ├── followups/        (same structure)
 │   ├── vendors/          (same structure)
 │   ├── taxes/            (same structure)
 │   ├── settings/         (same structure)
 │   ├── dashboard/        (same structure)
 │   ├── reports/          (same structure)
 │   ├── accounting/       (structured)
 │   ├── crm/              (structured)
 │   ├── hrms/             (structured)
 │   ├── inventory/        (structured)
 │   └── products/         (same structure)
 │
 ├── shared/
 │   ├── components/ui/    ← DataTable, FormField, Button, Badge, etc.
 │   ├── components/layout/← AppLayout, Sidebar, Topbar
 │   ├── services/         ← api-client.ts, auth.service.ts
 │   ├── hooks/            ← useAuth, useTheme (cross-cutting only)
 │   ├── context/          ← AuthContext, ThemeContext
 │   ├── config/           ← api.config, tax.config
 │   ├── utils/            ← formatCurrency, formatDate, cn, validators
 │   └── types/            ← PaginationParams, ApiResponse, SortDirection
 │
 ├── App.tsx
 └── main.tsx
```

## Phases

### Phase A — Create missing folder structures
For each of the 20 flat modules, create `pages/`, `hooks/`, `services/`, `types/` directories. These start empty.

### Phase B — Move services into modules
Move each `src/services/<entity>.service.ts` → `modules/<entity>/services/index.ts`. Same code, no renames. Update `src/services/index.ts` to re-export from module paths instead.

### Phase C — Extract types into module types/
Split types out of service files into `modules/<entity>/types/index.ts`, re-import them in the service. Keeps types co-located.

### Phase D — Move hooks into modules
Move `src/hooks/use<Entity>.ts` → `modules/<entity>/hooks/use<Entity>.ts`. Update imports.

### Phase E — Move pages into modules
Move each `src/pages/<entity>/` → `modules/<entity>/pages/`. Create/update `modules/<entity>/pages/index.ts` barrel.

### Phase F — Update App.tsx routes + cleanup
- Change all page imports in `App.tsx` from `@/pages/...` to `@/modules/.../pages`
- Change all hook imports in pages from `@/hooks/...` to `@/modules/.../hooks`
- Change all service imports in hooks/pages from `@/services/...` to `@/modules/.../services`
- Delete `src/pages/` directory
- Delete `src/hooks/` directory
- Prune `src/services/index.ts` to only re-export infrastructure (`api-client`, `auth.service`)
- Rename `src/services/` → `src/shared/services/`
- Verify with `npx tsc --noEmit`

## Key Rules
1. A module's pages/hooks/services/components/types import only from:
   - Their own module's other subdirectories `./`
   - `shared/` (infrastructure, UI primitives)
2. Modules NEVER import from other modules
3. `shared/` is the only bridge between modules
4. One folder per ERPNext doctype — no domain grouping
