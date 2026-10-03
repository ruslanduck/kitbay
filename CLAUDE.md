# CLAUDE.md — Kitbay

> ## ⚠️ Current state (V2 — 2026-07-25). This supersedes the V1 plan below.
>
> The app has grown past the V1 localStorage demo into a real product. **Architecture now:**
> - **Backend:** Supabase (Postgres + Auth). Schema in `supabase/migrations/*`. Apply with
>   `set -a; . ./.env.local; set +a; echo y | npx supabase db push`. Project ref `bowtxtapuxfohdhhakvg`.
> - **Data layer:** `src/data/repository.js` is source-agnostic, switched by `VITE_DATA_SOURCE`
>   (`local` = localStorage seeds; `supabase` = the DB). Zustand `src/store.js` hydrates from it.
> - **Auth:** individual email/password logins (`src/components/Login.jsx`, store `initAuth/signIn/signUp/signOut`);
>   every action attributed (`created_by`, etc.). One flat role **Equipment Team** behind a capability
>   layer — `src/lib/permissions.js` + `useCan()`; **never hardcode role checks**.
> - **Responsive:** desktop / iPad / iPhone (sidebar→drawer, master-detail inventory).
> - **English-only UI:** don't use native `<input type=date/time>` (locale-bound); use `DateField`.
>   (`TimeField` is gone — nothing in the app collects a time any more; a shoot is a range of whole days.)
> - **Secrets:** `.env.local` (gitignored) holds Supabase keys + DB password + service_role. Public
>   URL+anon are in committed `.env.production` for the prod build. service_role = local seeding only.
> - **Deploy:** push to `main` → **Vercel** (~1–2 min). Live at **kitbay.vercel.app** — that is the ONE
>   address now. GitHub Pages served it before; `duck-agency.com/kitbay/` REDIRECTS there (and
>   `/studio-demo/` is a 404 from the repo rename). Confirm via the **CDN**, not the rate-limited GitHub
>   API. Usually the served `index-*.js` hash equals the local `dist/`
>   one, but it CAN legitimately differ (CI runs its own `npm ci`, so the bundle isn't byte-identical) — when
>   it does, don't assume the deploy failed: fetch the served bundle and grep it for a string unique to the new
>   code (e.g. `curl -s .../assets/index-<hash>.js | grep -c "Coming soon"`). Content is the real check.
> - **Seed:** `npm run seed:supabase` (wipes+reseeds). Demo logins: ann/marcus/sofia @anntaylor.demo — the password is `DEMO_USER_PASSWORD` in `.env.local`, never in the repo (it was, until the 3 Oct security audit: rotate it).
>
> **Progress:** Build order #1 (V2 foundation) DONE. **Build order #2 (inventory) COMPLETE:** 2.1 types,
> 2.2 fields, 2.3 categories, 2.4 CRUD, 2.5 search + filters, 2.6 repair log (per-unit send/return +
> history; open repair → unit unavailable), 2.7 work history (per-item usage log + aggregate counters
> for all types — the analytics base; e.g. "N J-hooks used this year").
> **Build order #3 (kits & predefined lists) IN PROGRESS:** 3.1 kit entry type DONE (Items/Kits toggle;
> `kits.category` + `kit_slots`, `20260726120000_kits.sql`). 3.2 staging window DONE (adding a kit to a
> booking opens KitStagingModal: auto-resolves each slot to an available unit, add/remove/replace-from-
> stock before final add, missing slot blocks confirm; edits affect only THIS add, not the kit template;
> frontend-only, no migration). 3.3 FIXED/GENERIC slot types + scan-to-assign DONE (slot definition vs
> slot fill: FIXED pins one unit `fixed_unit_id` — auto-filled, conflict if taken, "Replace for this
> pull" override; GENERIC starts empty, assigned by barcode scan (onKeyDown) or "use available", with
> validation; confirm blocked while any slot unfilled. `20260727120000_kit_slot_types.sql` adds
> `slot_type` + `fixed_unit_id` to kit_slots; `getKits` falls back to the pre-3.3 shape if columns
> absent). 3.4 barcode scan/edit when filling slots DONE (in KitStagingModal: unknown scan → offer to
> register the barcode onto a free unit; pencil-edit an assigned unit's barcode inline, both persisting
> via new `setUnitBarcode` store action + `units.barcode` update, guarded against duplicates. Replace a
> filled unit with a reason — "Return to stock" (back to pool) or "Broken → send to repair" (reuses 2.6
> `sendToRepair`, unit → in_repair, out of the pool everywhere). No migration — uses existing columns.
> These are real inventory writes, unlike this-add-only slot edits). 3.5 predefined scenario lists DONE
> (a list = named preset pull list for a *type of shoot* mixing whole KITS and a-la-carte ITEMS with
> quantities — `scenario_lists` + `scenario_list_entries`, `20260728120000_scenario_lists.sql`. In the
> booking modal "Start from a scenario list…" replaces adding every line by hand: `src/lib/scenarios.js`
> resolves kit entries first (their slots need specific units), then item quantities from what's left,
> and returns a normal editable selection. Unsatisfiable lines are reported, never silently dropped —
> shortfalls ("2 of 4 available") and non-unit-tracked consumables ("take from stock") show in a banner.
> Applying never mutates the list. Third Inventory tab "Lists" shows each list's pull list with live
> availability; kit/item lines jump to their entry). 3.6 kit + scenario-list AUTHORING DONE — closes the
> last acceptance criterion ("создаётся кит и сценарный список"): until now presets were read-only, only
> creatable via seed/SQL. `KitEditorModal` (name/category/notes + slot rows: pick component, label,
> FIXED↔GENERIC toggle, unit picker for FIXED, reorder, remove; save blocked if a FIXED slot names no
> unit, and a unit already pinned by another slot is hidden) and `ScenarioEditorModal` (lines mixing kits
> and items with quantities; kit lines forced qty 1). Reached from the Inventory header — the primary
> button follows the active tab (Add inventory / New kit / New list) — plus Edit in each detail header.
> New caps `KIT_MANAGE`/`SCENARIO_MANAGE`; repository writes replace slots/entries wholesale (simpler
> than diffing, and slot ids aren't referenced elsewhere) honouring both check constraints. NO migration —
> the 3.1/3.3/3.5 tables already allow authenticated writes. Local mode mirrors the DB's cascade
> (deleting a kit drops list lines that point at it) and re-resolves presets after a kit/item rename so
> denormalized labels never go stale. **Build order #3 COMPLETE** (all 6 features + all 4 acceptance
> criteria).
> **Build order #4 (people & company databases) IN PROGRESS:** 4.1 people DB + company hyperlink and
> 4.2 categories + profile DONE (`20260729120000_people_profiles.sql`). The `contacts` table already
> existed as the roster lookup, so 4.1/4.2 grew it rather than adding a table: `category`/`subcategory`
> (free text — the freelancer taxonomy in `PEOPLE_CATEGORIES`, extensible without a migration), plus
> `website`/`instagram`/`cv_url`/`cv_filename` — a person may have any, all or none of the three, nothing
> forced. `companies` gained free-text `company_type` (rental company / modeling agency / messenger
> service …; its option list becomes user-editable in 4.3) alongside the coarse `kind` check column.
> CVs upload to a public `cvs` storage bucket created by the same migration; local mode has nowhere to
> put bytes so it files the filename only and the card says so. New sidebar view **People**
> (`src/components/People.jsx`) — master-detail like Inventory, tabs People/Companies, search + category
> filter. Person card: contact info, company hyperlink, profile chips (website/IG/CV with normalized
> URLs), work history. Company card (minimal until 4.3 adds address/hours/editable types): type badge,
> its contacts as hyperlinks back to People, aggregated job history. Hyperlinks work **both ways** —
> one of #4's acceptance criteria already met. Work history comes from `roster_entries`→`sets` in
> Supabase mode; locally it's derived from the bookings that name the person. A person on ≥1 job can't
> be deleted (roster_entries is ON DELETE RESTRICT) — the editor explains instead of failing. New caps
> `PERSON_MANAGE`/`COMPANY_MANAGE`; persist bumped to v2 with a `migrate` that reseeds pre-4.1 snapshots.
> Prod was backfilled non-destructively (match by name → UPDATE, insert missing) — not a wipe.
> 4.3 company fields + 4.4 editable Types + 4.5 work-history views DONE
> (`20260730120000_company_details_types.sql`, `20260730130000_order_kind.sql`). 4.3: `companies` gained
> `address`, `opening_hours` (free text — how the crew writes them), `website`, `email`, `phone`, all shown
> in a Details block on the card with website/email/phone as live links; full company CRUD via
> `CompanyEditorModal` ("New company" on the Companies tab, Edit in the card header). Deleting a company
> detaches its people/orders (FKs are ON DELETE SET NULL) instead of destroying them. 4.4: the Type option
> list lives in a `company_types` table, not a check constraint — "Manage" in the editor adds/renames/
> removes options. `companies.company_type` stays TEXT, so renaming a type relabels every company using it
> and removing one leaves existing labels intact (the card still shows it, marked "(removed)" in the
> dropdown). 4.5: `orders.kind` ('client' = they ordered from us, 'sub_rental' = we rented from them)
> drives an Order history block with status pills, the linked job and line items; `units.sub_rental_vendor_id`
> powers a "Sub-rented from them" block. ORDER_SEED (`src/data/orders.js`) supplies the history because the
> Orders MODULE is epic #5 — only mapped items get a vendor, the rest stay unattributed on purpose so a
> lighting house isn't shown renting us keyboards. Person work history stays roster-based (`roster_entries`
> → `sets`), and a person card now also lists the ORDERS attached to those jobs (person → roster → set →
> `sets.order_id`) — a direct person↔order link still needs epic #5. The sub-rental vendor is chosen in the
> Inventory units table: a new Vendor column offers companies with `kind` vendor/both and writes through
> `setUnitVendor`; toggling a unit back to Owned clears the vendor. Prod backfilled non-destructively (companies
> UPDATEd by name, orders upserted by order_number, `sets.order_id` linked). **Build order #4 COMPLETE** (12/12 spec bullets + all 3 acceptance criteria).
> **Epic #5 (Orders / Estimates) IN PROGRESS:** 5.1 creation form + 5.2 PO / created-by DONE
> (`20260731120000_orders_epic5.sql`). Terminology agreed with Clay and used throughout the code:
> **Job** = what we shoot (free-text job name), **Set** = the shoot itself (≤5 per studio per day, own
> roster + gear), **Order** = the equipment list for a set (NOT an e-commerce order). The `orders` stub
> (company/number/status, read-only in 4.5) became real: `job_name`, `studio_id`, `starts_on`/`ends_on`
> (⚠️ a shoot is ALWAYS one day, agreed later: the form shows a single **Set date** and writes
> `ends_on` = `starts_on`. The column stays because availability, billable days and the order search
> all read a window, and legacy rows may still span days),
> `photographer_contact_id` → contacts, `po_number`, `created_by` (defaults to `auth.uid()` like the other
> attribution columns), and the status check now allows `hold` alongside the legacy values. New sidebar
> view **Orders** (`src/components/Orders.jsx`): list with job search across PO / job name / dates /
> photographer + status filter, detail card, and `OrderEditorModal` for create/edit/delete. An order
> starts on **HOLD (yellow)** → **CONFIRMED (green)** via a toggle in the editor; those pill colours are
> what epic #7 pulls into the calendar. Creating an order also creates the Set it equips (so the job lands
> on the studio calendar) and refuses the 6th set on a studio/day with an explicit message —
> `MAX_SETS_PER_DAY` in the store. 5.2's PO is a hand-typed text field, deliberately NOT generated: it
> must match the number accounting issued (this overrides the client outline's "generate automatic PO",
> per the last call); `order_number` stays as our own internal reference.
> ⚠️ `DateField` hands the raw DOM event to `onChange` — read `e.target.value`; treating it as a plain
> string puts an event object in state and crashes the render.
> STILL TO COME in #5: EQ entry into an order (incl. kits), the zero-availability block with the
> sub-rental prompt, in-house/sub-rental marking per line with the vendor from #4, and the costed
> estimate + PDF. Prod backfilled non-destructively: all 8 orders carry job/PO/studio/status; 5 have no
> working dates because their shoots don't exist on prod (8 sets there vs 11 in the seed) and dates
> weren't invented — a full `npm run seed:supabase` would align them.
> 5.3 EQ entry + 5.4 estimate/PDF DONE (`20260801120000_order_eq_estimate.sql`). 5.3: `order_lines` gained
> `kit_id` / `unit_id` / `slot_label`, so a line remembers where it came from. `OrderEquipmentModal` holds
> state exactly like the booking modal — `selected` (itemId→qty) + `stagedUnits` — which lets kits come in
> through the **unchanged epic-3 KitStagingModal** and `applyScenarioList` (3.5) work as-is. A kit's
> composition stays editable after adding: each staged unit can be swapped for another free unit or
> removed, and the whole kit dropped. 5.4: `inventory_items.day_rate` is the rental rate (seeded per item
> with a category fallback in `src/data/inventory.js`; consumables stay null and are listed but excluded
> from the total, stated out loud). `src/lib/estimate.js` is a PURE builder (billable days inclusive,
> kit/a-la-carte grouping, roster, totals) and `src/lib/estimatePdf.js` turns it into a jsPDF doc —
> neither touches a browser API, so both run under plain Node and that is how the PDF is tested.
> ⚠️ jsPDF's Helvetica is WinAnsi: an arrow or em dash either vanishes or flips the whole string into
> s p a c e d   o u t letters. Everything the PDF writes goes through `pdfSafe()`; both defects were
> caught by extracting text from the generated bytes, not by eyeballing. Persist bumped to v3 (older
> snapshots lack day rates and would total $0.00). Prod backfilled: 42/44 items have a day rate.
> 5.5 Hold→Confirmed + 5.6 sub-rental/vendor/zero-availability DONE
> (`20260802120000_order_line_sub_rental.sql`). 5.5: the status vocabulary moved to `src/data/orderStatus.js`
> — label, meaning, pill classes AND a `calendar` hex, so the list pill, the card pill and epic #7's
> calendar chip all read one definition. The card carries an explicit **Confirm order** / **Back to hold**
> action with what the state means ("this is what goes to packing and scanning" — epic #6). 5.6:
> `order_lines` gained `source` ('in_house' | 'sub_rental') + `vendor_company_id`, with a DB check that an
> in-house line can't name a vendor (a sub-rental line without one stays legal so a half-picked row isn't a
> DB error; the UI blocks saving it). Each a-la-carte line has an In-house/Sub-rental switch, and a
> sub-rental line takes a vendor from #4 (`kind` vendor/both) and consumes NO in-house availability — that's
> what makes the block a real choice. Adding an item with 0 available is refused with
> "pick a different item, or raise it as a sub-rental" plus **Add as sub-rental** / **Choose another**.
> ⚠️ **Availability now has exactly one implementation**: `src/lib/availability.js`. KitStagingModal,
> `lib/scenarios.js`, BookingModal and the order editor all call it. The subtle part is
> `resolveUnitsForQuantities`: loose a-la-carte lines only carry a quantity, so they must be resolved to
> real unit ids and fed back as `claimed` before staging a kit — without that a kit slot and a loose line
> both take the last free unit (found in testing: the staging window said "1 free" for a unit an order line
> already held). LOGIN: self-registration removed on request — sign-in only, accounts are issued by the
> studio. `store.signUp` still exists for provisioning but nothing in the UI calls it.
> 5.7 order search DONE (no migration). Matching moved out of the component into the pure
> `src/lib/orderSearch.js` (25 assertions in Node): free text takes SEVERAL terms and requires ALL of
> them, each matching any of PO / job name / photographer / order ref / dates / client, so "nike 4490"
> works without a field picker. Dates filter by OVERLAP against the order's working window, not string
> prefix, so "everything shooting that week" is answerable and a multi-day job is found from any day
> inside it. Explicit dropdowns for status / studio / photographer, a sort (newest / oldest / job A-Z),
> an "N of M orders" count and Clear all. Rows sharing a PO show an "N x PO" chip — one job's PO covers
> every order raised against it, and that grouping IS the job history the spec asks for.
> ⚠️ Studio is a dropdown, NOT a free-text field: it used to be in the haystack as its label, which made
> short numeric terms useless ("studio 2" matched nearly everything, because "2" is a substring of every
> 2026 date). Caught by the test suite.
> **Epic #5 COMPLETE** (5.1-5.7, all 4 acceptance criteria).
> **Epic #6 (packing / scanning) IN PROGRESS:** 6.1 packing list generation (post-confirm) DONE —
> `src/lib/packingListPdf.js` builds a printable pull sheet from a CONFIRMED order's assigned EQ. It
> reuses `buildEstimate`'s kit/a-la-carte grouping + `estimatePdf`'s jsPDF setup + `pdfSafe`, but drops
> money and adds three initial boxes per line (OUT / OUT / RET — two at sign-out, one at return) plus a
> detail cell (slot label · #barcode · sub-rental vendor). In the Orders detail a new "Packing list"
> section shows a Download button ONLY when `status==='confirmed'`, else "confirm to generate its packing
> list". Frontend-only, NO migration (generates from existing order lines). Verified headless (2-page
> pagination, empty-order safe), PDF-byte content grep (all sections/sign columns/vendor present), and
> browser UI gating (hold→hint, confirmed→button, click→no error).
> 6.3 vendor assignment on line items — ALREADY DELIVERED by 5.6 (per-line in-house/sub-rental switch +
> vendor picker in OrderEquipmentModal, shown in the order detail and on the 6.1 packing PDF). Nothing new.
> 6.2 sign-off initials + 6.5 PDF/digital checklist DONE (built together as the digital packing checklist)
> — `20260803120000_packing_signoffs.sql` adds `packing_signoffs` (one row per line: two sign-out + one
> return, each initials+timestamp). Keyed by a STABLE line signature `itemId::slotLabel::barcode`
> (`src/lib/packing.js` `packingLineKey`) — NOT the order_line id, which is replaced wholesale on EQ edit.
> `PackingChecklistModal` is the iPad/digital form beside the 6.1 PDF: per-line initial boxes (green when
> signed, tooltip shows who+when), live "N/N signed out · N/N returned" progress, opened from the Orders
> "Packing list" section (Digital checklist + Print PDF buttons, confirmed only). Store actions
> `signPackingLine`/`clearPackingSignoff` are OPTIMISTIC (instant, background Supabase upsert — a packing
> station shouldn't wait; the partial upsert leaves the other two slots untouched). `getOrders` attaches
> `order.packing` from a separate try/caught fetch, so orders still load if the table is absent. No seed
> (checklist starts empty; you sign live). Verified local: sign records initials+time, box greens,
> persists, progress updates, clear un-signs others untouched, 0 console errors.
> ⚠️ jsPDF was missing from node_modules (added in 5.4 after an older `npm ci`) → `npm install` after syncing.
> 6.4 Add-On packing lists DONE — `20260804120000_order_addons.sql` adds `order_addons` + `addon_lines`
> (addon_lines mirror order_lines). An add-on is a labelled supplementary list on an order; the main
> `order_lines` are NEVER touched. Heavy reuse: the add-on equipment editor is the SAME OrderEquipmentModal
> (fed an order-like `{id, lines, startsOn, endsOn}`, onSave→`setAddonLines`), the PDF is `packingListPdf`
> with `opts.docTitle='ADD-ON PACKING LIST'` + `opts.addonLabel`, and the digital checklist is the SAME
> `PackingChecklistModal` with a `keyPrefix='addon:<id>::'` so its sign-offs live in the same
> `packing_signoffs` table (order_id = parent) without colliding with the main list's line keys
> (`packingLineKey`/`packingProgress` now take a prefix arg). Repository `getAddonsByOrder` attaches
> `order.addons` via a separate try/caught fetch; store `createAddon`/`setAddonLines`/`deleteAddon`.
> Orders detail gains an "Add-ons" section (confirmed only): New-add-on label input → opens the eq editor;
> each add-on row has Edit EQ / Checklist / Print PDF / Delete + a pcs + out/ret progress line. No seed.
> Verified local: create→eq→save (main untouched), namespaced checklist sign-off, add-on PDF, delete;
> 0 console errors. Note: add-on availability reuses the shared rule but doesn't subtract the main list's
> reservations (minor demo edge — a day-of add could in theory re-pick a unit the main list holds).
> **FIX — "Orders drive reservations" (reservation model).** Inventory used to show a unit checked out to
> a job whose order didn't list it (reported: Canon #0960 "checked out to Wedding Editorial", absent from
> that order). Root cause: a Set's gear was seeded on the booking (`BOOKING_TEMPLATES.reserve`) INDEPENDENTLY
> of `ORDER_SEED`, so the two could disagree. Now a Set's reserved units DERIVE from its **CONFIRMED**
> order's in-house lines — one source of truth. Hold orders reserve nothing; sub-rental lines are vendor gear
> and consume no in-house stock; FIXED kit units are pre-claimed so a loose line never grabs a unit pinned to
> a kit. `src/lib/availability.js` `reservedUnitsForOrder(order, inventory, claimed)` is the resolver; the
> store adds `reservationsFromOrders` + `fixedUnitIdsOf` (resolve against a RAW repairs-only view, NOT the
> live projection being recomputed; a shared `claimed` set stops double-booking) — called from `buildSeedData`
> AND live from `createOrder`/`updateOrder`/`setOrderLines`/`deleteOrder` so confirming/holding an order moves
> inventory instantly (LOCAL mode). `src/data/bookings.js` no longer carries `reserve` (calendar-only);
> `src/data/orders.js` ORDER_SEED rewritten to per-shoot client orders (Wedding = the visible HOLD) + 3 past
> sub-rental history orders, line form `[itemId, qty]` (in-house) / `[itemId, qty, vendorId]` (sub-rental).
> **Supabase/prod is fixed by a RESEED**, not by this frontend change: supabase mode reads reservations from
> `set_units`, and `scripts/seed-supabase.mjs` now writes set_units from each CONFIRMED order's in-house lines
> (same pre-claim/skip-repair rule); the store's live-reservation logic is LOCAL-mode only. NO migration
> (`order_lines.source`/`vendor_company_id` already exist from 5.6). Verified local: Canon 0960→Apple Product
> Shoot (order-backed) with 0959 still in repair, Wedding hold reserves nothing, Astera 3/3 checked out (Vogue's
> 2 sub-rental Asteras excluded), hold↔confirm toggles inventory live, build clean, 0 console errors.
> Note: supabase LIVE confirm→reserve (writing set_units on confirm in prod) is still a gap — the reseed makes
> the initial prod state coherent, which is what the demo needs.
> **FIX — filters reset on tab refocus (supabase mode).** Switching away from the tab and back reloaded the
> app and wiped in-view filters. Cause: `supabase.auth.onAuthStateChange` fires on token-refresh / tab-focus
> re-validation too, and the handler re-fetched the profile + `hydrate()` every time; `hydrate` sets
> `loading:true`, and App.jsx swaps the whole view for a full-screen loader — unmounting Inventory/Orders/People
> and destroying their local `useState` filters. Fix (`store.js` `initAuth`): only (re)load when the signed-in
> user actually changed (first load / real sign-in / sign-out); a refresh for the already-loaded user is a no-op
> (guarded by comparing `prev.session.user.id` to the new one + `get().profile`). Frontend-only, no migration.
> Verified: reproduced (Canon filter wiped on tab switch), then after the fix the filter survives repeated
> tab switches with no loader flash, 0 console errors. NOTE: an explicit mutation (e.g. edit order → hydrate)
> still flashes the loader and would reset filters — that's a deliberate refetch, left as-is.
> **FEATURE — drill into any item's history from anywhere it's shown.** New store action `focusInventory
> ({ itemId, unitId? })` sets a transient `inventoryFocus` (+ `activeView:'inventory'`); Inventory.jsx
> consumes it in an effect (selects the item, resets filters so it's visible, and if a unit was named opens
> that unit's history). Wired the read-only inventory surfaces: an order's EQUIPMENT lines (Orders.jsx —
> a-la-carte + kit-unit lines; the item name is now a link, unit-specific lines jump straight to the unit's
> history) and the company card's "Sub-rented from them" gear (People.jsx). Kit-detail slots and scenario-list
> lines already jumped to the item (within Inventory). Editing/workflow surfaces (BookingModal,
> OrderEquipmentModal, KitStagingModal, PackingChecklistModal) are deliberately NOT linked — navigating away
> mid-edit would lose work. `inventoryFocus` is not persisted (whitelist partialize). Frontend-only, no
> migration. Verified in supabase mode: order line → item history, vendor card → item history, 0 console errors.
> **CHANGE — the calendar is order-centric (a shoot IS its order).** The Studio Calendar used to create/edit
> its own bare bookings via BookingModal, separate from Orders — so you could make a calendar entry with no
> order (the stray "TEST" shoot). Now: the "New booking" button is **"New order"** and clicking it (or an empty
> cell) opens the SAME `OrderEditorModal` in place on the calendar — `createOrder` builds the Set, so the shoot
> lands on the grid (new Sets default to 09:00–18:00). Clicking a shoot **opens its order** in the Orders view
> (store `openOrder` → transient `orderFocus`, consumed by Orders.jsx like `focusInventory`). A legacy
> order-less shoot still opens in BookingModal (kept only as the fallback) so it can be edited/deleted.
> `getBookings` now selects `order_id` → `booking.orderId` (was missing in supabase mode, so chips couldn't
> find their order). ⚠️ Fixed a latent crash surfaced by this: `createSetForOrder` never set
> `start_time`/`end_time`, so an order-created Set had null times and the calendar's `a.startTime.localeCompare`
> threw — added default times + made the sort null-safe (`(a.startTime||'')`). Frontend-only, no migration.
> Verified in supabase mode: New order from calendar → Hold order + shoot on grid; chip → its order; order-less
> fallback → BookingModal; 0 console errors. NOTE: deleting an order leaves its shoot on the calendar
> (`sets.order_id` ON DELETE SET NULL) as an order-less booking — existing "the shoot stays booked" behaviour.
> **FEATURE — back navigation for drill-ins.** Drilling in was one-way: you landed in another view with no
> idea where you came from ("непонятно что выходит"). Every drill-in now takes an optional `from`
> ({ view, label, focus }) which the store pushes onto `navStack`; the shell (App.jsx) renders a
> "← Back to <label>" bar whenever the stack isn't empty, and `goBack()` pops it and restores that view's
> selection. Each push ALSO adds a `history.pushState` entry and App.jsx listens for `popstate`, so the
> BROWSER's own back arrow walks the same trail (the in-app button calls `history.back()` when there's an
> entry to consume, keeping the two in step). Store: `navStack` + `pushNav`/`goBack`, focus payloads per view
> (`inventoryFocus` {itemId|kitId|listId, unitId}, `orderFocus` {orderId}, `peopleFocus` {personId|companyId}).
> Restoring never re-opens a modal (a returning `unitId` is dropped). `setActiveView` (sidebar) CLEARS the
> trail — a deliberate jump has nothing to return up to. Wired: order EQ line → item, vendor card gear → item,
> calendar shoot → its order, and the in-Inventory kit/list → item/kit jumps (which now route through
> `focusInventory` instead of setting local state, so they're tracked too). People gained a `peopleFocus`
> consumer; Inventory's effect handles kit/list targets. Frontend-only, no migration. Verified in supabase
> mode: calendar → order → item, two-level trail rewinds correctly, browser back arrow does the same,
> vendor → item → back restores the company card, kit → component → back restores the kit; 0 console errors.
> **REBRAND — the product is now Kitbay.** `src/lib/brand.js` holds `BRAND_NAME` and is the single source;
> it is deliberately JSX/icon-free so the PDF builders (which run under plain Node — that's how they're
> tested) can import it. `src/components/Logo.jsx` is the visual MARK (placeholder violet square + icon)
> and re-exports the name for UI code, so dropping in the real logo is a one-file change. Applied to: the
> sidebar brand ("AT / AnnTaylor" → mark + Kitbay), the login screen, the browser tab title, and the
> letterhead of BOTH PDFs (estimate + packing list). The top bar's "AnnTaylor Rental System" title is GONE;
> below lg (sidebar off-canvas) a compact mark + name stands in so mobile isn't a bare bar. The demo's own
> studio company row was renamed too — name/website/email → Kitbay — in the SEED (`data/people.js`, slug
> `anntaylor-rental` kept: it's an internal key referenced by 3 people and never shown) and on prod via a
> targeted UPDATE by name (no wipe, no reseed). NOT renamed: the demo LOGIN accounts and people's display
> emails stay `@anntaylor.demo` — the logins are real Supabase users and renaming them would break sign-in.
> Verified: PDF letterhead checked by extracting strings from the generated bytes under Node (Kitbay present,
> "AnnTaylor" absent in both docs), then in-browser — no "AnnTaylor" anywhere in the DOM, vendor dropdown
> offers Kitbay, company card consistent (contacts + job history intact), PDF download fires clean,
> 0 console errors.
> **FEATURE — per-UNIT CRUD (the asset register).** Reported gap: "Add inventory" creates an item TYPE, and
> there was no way to register one more physical copy with its own serial, nor to correct or remove a unit —
> units only ever came from the quantity typed at item creation. Now, on a barcoded item's card:
> a primary **+ Add unit** button (modal: ONE ROW PER COPY — see the naming/rows fix at the end of this file —
> empty row = generated next free number + deterministic serial, so receiving a batch is one field), and a new
> **UNIT** column with a pencil (correct barcode/serial) and a trash (write off, inline "Write off? Delete /
> Keep" confirm). The header's "Edit" is now **"Edit item"** so item-level vs unit-level is unmistakable.
> Store: `nextBarcode` / `addUnits` / `updateUnit` / `deleteUnit` (local + supabase); repository `addUnits` /
> `updateUnit` / `deleteUnit`. Barcodes are unique across the WHOLE register, checked before write in both
> modes. Delete is REFUSED with the reason when the unit is on a job ("#0960 is out on 'Apple Product Shoot —
> Studio L'. Free it from that job first."), out for repair, or pinned to a kit's FIXED slot (that last one the
> DB would refuse anyway — `kit_slots.fixed_unit_id` is RESTRICT); the reason shows in a dismissible banner
> above the table. Otherwise it clears the unit's `set_units` rows first (RESTRICT) and deletes — same policy
> as the existing item-level write-off. Caps: add/edit use `INVENTORY_EDIT`, delete uses the previously
> unused `UNIT_WRITE_OFF`. NO migration.
> ⚠️ Verified on the real DB with a throwaway unit that `events.unit_id` does NOT block deleting a unit —
> its FK was dropped in `20260724120000_events_soft_refs.sql` (soft reference), so the audit trail survives
> and must NOT be touched. An earlier attempt to null it out was reverted: it would have destroyed history the
> migration deliberately keeps. `deleteInventoryItem` was likewise fine as it stood.
> Verified in supabase mode end-to-end: add a unit with a typed barcode/serial (314→315, searchable by both),
> duplicate-barcode refused on add AND edit, edit persisted, delete of a checked-out unit refused with the
> reason, delete of a free unit succeeded (315→314), prod left with 0 test leftovers, 0 console errors.
> **CLARITY PASS on the person / company cards.** Three reported confusions, all fixed rather than explained
> away. (1) Work history wasn't clickable — now every row opens that job's ORDER (via `openOrder` + the back
> trail); a shoot with no order opens the calendar on its date instead (new store action `openCalendarOn`,
> which bypasses `setActiveView` so the trail survives), so no row is a dead end. (2) The bare `MODEL` /
> `PHOTOGRAPHER` tag read as a duplicate of the person's profile category — it is actually their role ON THAT
> JOB (`roster_entries.role`), so it now reads "as model" inline with date · studio. (3) "Work history" vs
> "Orders on those jobs" were two sections describing the same shoots from different ends; the second is GONE
> and its order is folded into the job row (PO/ref + status pill), which is what made the difference
> unexplainable. Also: the `CLIENT` badge is gone from person cards entirely and, on the company card, the
> direction badge is now worded — "Rented to us" / "For their job" instead of "Sub-rental" / "Client" (a bare
> noun read like a customer segment). Company order rows became clickable too, and `OrderList` now takes its
> status colours from `orderStatusMeta` — it had a local map painting CONFIRMED amber while the rest of the app
> paints it green — and lost the stale "the Orders module lands in the next epic" empty text (it shipped).
> Frontend-only, no migration. Verified in supabase mode: Ava Morgan's card (work history rows with "as model"
> + PO + green Confirmed, no duplicate section), row → its order with "← Back to Ava Morgan" and back again,
> vendor card shows "Rented to us", agency card shows "For their job". NOTE the console keeps a stale parse
> error from a mid-edit HMR attempt (15:52:58) — later HMR updates and both prod builds are clean.
> **FEATURE — layered peek cards (related data is clickable everywhere, without leaving the page).**
> Requested: "в любой точке системы связанные данные должны быть кликабельны … чтобы нас не перекидывало на
> другую страницу, а открывало карточку в рамках текущей". `src/components/PeekPanel.jsx` is a right-side
> drawer over the current view driven by a STACK in the store (`peekStack` + `peek`/`peekBack`/`peekClose`):
> click related data → a card layers on top; click inside it → another card stacks (header shows "N deep" +
> Back; Esc pops one; the X or the backdrop drops the whole stack and you're exactly where you started).
> Five card types, each read-only and each with its own links: **order** (job block with clickable
> photographer/company/shoot, equipment lines, estimate), **item** (units with where each one is, plus every
> order using it), **person** (contact, work history), **company** (details, contacts, orders, gear held),
> **job/set** (crew, its order, the gear that went out with barcodes). Every card carries "Open full view",
> which hands off to the real screen (with its editing tools) and clears the stack. Cards are purpose-built,
> NOT the view components reused — those own edit state, permissions and their own modals, and nesting them
> would put dialogs inside dialogs. Wired: order equipment lines + photographer/company/shoot rows, People
> person work-history rows and company contacts/orders/gear, calendar chips (a shoot opens in place instead of
> jumping to Orders), and the unit-history dialog's sets + roster names (that one CLOSES first — a card
> stacked over a modal has no clean escape). Any cross-view navigation (`focusInventory`/`openOrder`/
> `focusPeople`/`openCalendarOn`/`goBack`/`setActiveView`) clears the stack so a card can't float over the
> wrong page. Frontend-only, no migration. Verified in supabase mode: person → shoot → order → item → the job
> holding that unit (4 deep), Back unwinds one level at a time, X returns to the untouched starting card,
> calendar chip peeks in place. NOTE the JobPeek for Wedding Editorial honestly shows "No units reserved"
> while its order reads Confirmed — that's the known supabase live confirm→`set_units` gap, not a card bug.
> **GAP CLOSED — live confirm→reserve in Supabase mode.** Until now "orders drive reservations" was only true
> at SEED time on prod: confirming an order in the UI wrote no `set_units`, so a confirmed order could show
> "No units reserved" (visible in the new JobPeek). New store action `syncReservationsForOrder(orderId)` +
> repository `setReservationsForSet(setId, unitIds, {from,to})`: CONFIRMED resolves the order's in-house lines
> to concrete units and writes them; HOLD (or any other status) clears that set's rows. Called from
> `updateOrder` (the Hold↔Confirmed toggle), `setOrderLines` (editing a confirmed order's gear changes what it
> holds) and `deleteOrder` (scrapping an order releases its gear — the shoot stays booked). Only the ONE set is
> touched; a global recompute would rewrite every set on each click. Resolution reuses the SAME
> `reservedUnitsForOrder` as local mode, against a projection where a unit counts as free unless it's out for
> repair or held by ANOTHER set (units this set already holds count as free, or re-confirming would find its
> own gear taken); fixed kit units stay pinned unless a kit line names one. The action returns
> `{reserved, short}` and the order card SAYS SO — "5 piece(s) reserved · 1 could not be — nothing free for
> those lines" — rather than letting the pull sheet imply gear that isn't held.
> ⚠️ **`hydrate()` now takes `{quiet}`** and every post-write refetch uses it (36 call sites; only the initial
> sign-in load and "Reset demo data" still raise `loading`). Raising `loading` swaps the whole view for a
> full-screen spinner, which UNMOUNTS the active screen and discards its local state — the filter you typed,
> the row you had open, and the just-happened message. That's why confirming used to throw you back to the
> orders list, and it's the same root cause as the tab-refocus filter reset.
> Frontend-only, no migration (set_units already exists). Verified on prod: Wedding Editorial CL-26058 was
> confirmed with 0 reservations → Back to hold (0, "released") → Confirm → **5 rows written** (69→74 set_units;
> Rode #1009, Sandbags #0779/#0780, C-Stands #0767/#0768) with the Canon correctly SHORT (0959 in repair, 0960
> held by Apple Product Shoot — no double-booking), JobPeek now lists the gear, view stayed put through both
> toggles, 0 console errors. Order left Confirmed as it was found.
> **LAYOUT — navigation moved into the top bar; the permanent sidebar is gone.** The top menus
> (Admin / View / Generate / Inventory) were decorative — three did nothing and the fourth duplicated a nav
> item's name — while the 256px sidebar column cost every view width the tables actually need. Now: the top bar
> carries the brand + the workspace tabs (`src/data/nav.js` `WORKSPACE_NAV` is the one definition, shared by
> the bar and the drawer), the only real action (Reset demo data) sits under a gear, and `Sidebar` is an
> off-canvas DRAWER only (`fixed`, no `lg:static`), used below lg via the hamburger. Measured at 1024px: main
> went 768 → **1024px** and the inventory units table **no longer needs horizontal scrolling**
> (scrollWidth 960 < 1024) — before, HISTORY/REPAIR/UNIT sat off-screen. Also gave the drawer Esc-to-close,
> which it never had. Frontend-only, no migration. Verified: desktop tabs switch views and highlight the
> active one, below lg the tabs collapse to the hamburger and the drawer still navigates, gear → Reset demo
> data, no page-level horizontal overflow, 0 console errors.
> **FEATURE — activity log / attribution ("who added what to which order").** Reported: no way to see who put
> inventory into an order. The audit found the foundation existed and was INVISIBLE: `events` was written on
> every reservation (with an actor) and read by **zero lines of code**; `repairs.created_by`/`returned_by`,
> `item_usage.created_by`, `order_addons.created_by` were stored and dropped on read; and the key action —
> `setOrderLines` — left **no trace at all** (`order_lines` has no actor and no `created_at`).
> `20260805120000_activity_log.sql`: FK `events.actor_id → profiles` (PostgREST can't embed a name without it;
> verified 0 orphans first), an INSERT policy `with check (actor_id = auth.uid())` — the table was SELECT-only,
> so the app literally could not append — an `(actor_id, occurred_at desc)` index, and denormalised
> `orders.eq_updated_by/eq_updated_at` for the headline (the full trail stays in `events`).
> `src/lib/activity.js` is PURE (Node-assertable, 9 assertions): the `EVENT` vocabulary, `describeEvent` →
> sentences, `orderFeed` (hides reservation churn), and **`diffOrderLines`** — lines are replaced wholesale, so
> without a diff a save that bumped one quantity would log "removed everything, added everything"; it now reads
> "Arri 2K Open Face 2 → 3". Repository `logEvent`/`getEvents`/`getEventsForUnits`/`touchOrderEquipment`, all
> try/caught so a missing migration degrades to "no history" and never fails the user's action; `getOrders`
> gained a `fullNoEq` fallback layer so a pre-migration DB doesn't silently lose `creator`/`created_at` (that
> was an existing bug behind "unknown"). Store `logActivity`/`activityFor`/`fetchActivity` + `activityVersion`
> (bumped per write so open cards refetch, NOT keyed on `orders` which churns on every quiet hydrate); local
> mode keeps the same events in a persisted `activity` array (**persist v4**, added to the `partialize`
> whitelist). ~15 write paths instrumented incl. packing sign-off — the initials stay hand-typed but the ACT is
> now tied to an account. UI: `ActivityList` + `lib/useActivity` on the order card (Attribution block gains
> "Equipment by X · when"; null renders "seed data", not "unknown") and the item card (inside the units table's
> scroll container), plus both peek cards and sent-by/returned-by in RepairModal.
> ⚠️ Added a NO-OP GUARD to `setReservationsForSet`: it deletes+reinserts every row, and each fires the
> set_units trigger, so one confirm toggle sprayed ~10 reserved/released events. It now returns early when the
> set already holds exactly those units.
> Fixed while here: a rules-of-hooks violation in `JobPeek` (useMemo after an early return — would mismatch
> state if the booking vanished mid-view) and moved the hook out of `ActivityList` (fast-refresh warning).
> `scripts/backfill-attribution.mjs` (`npm run backfill:attribution`) is **idempotent** (verified: a second run
> changed nothing) and is imported by `seed-supabase.mjs` so a reseed stays as rich: it filled 13 orders,
> 11 sets, 4 repairs, 235 usage rows, 71 anonymous events, and narrated 12 orders (36 events) with the raiser
> and the gear-puller deliberately DIFFERENT people. Verified in both modes: supabase (real DB rows carry
> `actor_id`, "Equipment by Ann Taylor" flips on edit, feed shows the diff) and local (persist v4, "Demo user"
> entry survives reload); lint clean except one pre-existing `KitStagingModal` hooks error; build clean.
> **CHANGE — over capacity is allowed, but never silent.** Reported: an item with 0 free was greyed out in the
> booking modal's inventory search, a dead end ("должна быть возможность добавить, даже если 0, просто должен
> быть об этом сигнал"). The crew has to be able to write a job down before the gear is back. Both pickers now
> let it through and SAY SO instead of refusing the click:
> `BookingModal` — the search row stays clickable and reads "0 free · add anyway" in amber; `addItem`/`setQty`
> lost their `Math.min(…, availCount)` caps; the selected line goes amber with "/N free · N short"; the header
> reads "X of Y units reserved · N over capacity"; and a banner spells out the consequence — over-capacity
> pieces stay on the list but **no unit is held for them** (`resolveUnitsForQuantities` only ever picks free
> units, so previously a request beyond stock would have been silently under-reserved).
> `OrderEquipmentModal` — the 5.6 zero-availability block gained a third choice, **"Add anyway"**, beside
> "Add as sub-rental" / "Choose another"; the line then shows "N over capacity" instead of "N left" and the
> footer totals it. `blocked` now carries an `intent` ('add' | 'switch') + index, because the same dialog is
> raised by `switchSource`: forcing there must MOVE the line in-house ("Switch anyway"), not bolt an extra
> quantity onto the order. Over-capacity is computed per ITEM, not per line (two lines of one item share a
> stock pool), and only for `barcoded` stock — consumables aren't unit-reserved at all.
> Frontend-only, no migration. Verified in supabase mode: order editor → Canon EOS R5 (0 available: one in
> repair, one held by Apple) → "Add anyway" → line "1 over capacity" + footer "· 1 over capacity"; booking
> modal → "0 free · add anyway" → header "10 of 11 units reserved · 1 over capacity" + amber banner + line
> "/0 free · 1 short". Both cancelled, so prod data is unchanged. Build + lint clean.
> **FIX — creating an order now leads straight into adding equipment.** Reported: "при создании ордер
> невозможно добавить инвентарь. Раньше это было под созданием букинга" — the old BookingModal had the
> inventory picker inline, but `OrderEditorModal` only collects job/studio/dates/PO, so gear needed a second,
> undiscoverable trip through the card's "Edit equipment". Now saving a NEW order opens `OrderEquipmentModal`
> on it immediately, from BOTH entry points: the Orders view (`onCreate` → `setPendingEqId`) and the CALENDAR
> (`createOrder` → `openOrder(id, from, { equipment: true })` → `orderFocus.openEquipment` → the same pending
> flag). A new `pendingEqId` + effect waits for the created order to appear in `orders` after the refetch
> instead of opening the picker on a half-known record. Button relabelled **"Create & add equipment"** and the
> banner now promises it ("items, kits and scenario lists"), so the two steps read as one flow.
> Deliberately NOT embedded inline: `OrderEquipmentModal` owns kit staging (`KitStagingModal`), scenario
> lists, the in-house/sub-rental switch and the over-capacity rule — inlining it would either duplicate all of
> that or nest a dialog inside a dialog. Chaining reuses it whole. Cancelling the picker leaves an empty HOLD
> order, which is honest (the studio slot IS booked) and matches the banner.
> Frontend-only, no migration. Verified on prod end-to-end: empty calendar cell → "Create & add equipment" →
> landed in the Orders view with the picker open → added Sandbag 25lb → saved → card shows EQUIPMENT · 1 PCS
> with "Created by Ann Taylor · Equipment by Ann Taylor" (the new activity log picked the flow up for free) and
> a working "← Back to Studio Calendar" trail. Test order + its shoot removed afterwards; prod back to 13
> orders / 11 sets, 0 leftovers, 0 console errors.
> ⚠️ `window.confirm` (BookingModal's delete) is auto-dismissed in the preview pane — deletes that go through
> it can't be exercised from the browser tool; verify those against the DB instead.
> **FEATURE — per-unit storage location (`units.placement`).** Reported: barcode and serial are editable but
> LOCATION isn't. LOCATION is **derived on read** (`repository.js` getInventory: "Available" /
> "In repair — <vendor>" / "<job> — <studio>" from set_units + open repairs) — there is no `units.location`
> column, and after "orders drive reservations" hand-editing where a unit IS would be recomputed away or would
> lie about gear that's out. What was genuinely missing is the OTHER location: the shelf a copy returns to.
> `20260806120000_unit_placement.sql` adds `units.placement` (item-level `inventory_items.placement` says where
> the TYPE lives; this says where THIS copy lives, because copies drift — one body in the van, one in the cage).
> **Null = inherit the item's placement**, so nothing is entered twice. UI: a "Storage location" field in
> `UnitEditorModal` (add + edit; empty clears the override) and the LOCATION column now shows — in priority
> order — the job/repair it's out on (derived, not typed), else the unit's own placement, else the item's in
> grey with a tooltip saying it's inherited, else "—". Repository reads it via a new fallback layer in
> getInventory and accepts it in `addUnits` (retries without the column on a pre-migration DB) / `updateUnit`
> (`placement: ''` clears). `describeEvent` for `unit.updated` now names WHICH field moved, so a relocation
> reads "**moved a unit** · stored: item default → Grip room · Shelf B3" while a barcode fix stays "corrected a
> unit" (7 Node assertions, incl. legacy events that predate the key).
> Verified on prod: set unit #0734 of Applebox Full to "Grip room · Shelf B3" → shows in the LOCATION column,
> `units.placement` written in the DB, and the item's Activity logged it as a MOVE by Ann Taylor. Build + lint
> clean (only the pre-existing KitStagingModal hooks error remains).
> ℹ️ Prod is at **317 units** (not 314): the activity log shows Ruslan added 4 units to Applebox Full and wrote
> one off while testing 6.x — real user data, deliberately left in place. Unit #0734 keeps the demo placement.
> **CLARITY — one name for "where it's kept", and one ROW PER COPY when adding units.** Two reports, both
> about the same modals. (1) "негде ввести локацию при создании" — the field existed in all three places but
> under three names: "Placement" in the item modal, "Storage location" in the unit modal, "Location" as the
> column. Now **Storage location** everywhere (item modal + its helper line, item card, peek card); the column
> keeps the name **Location** with a tooltip saying it shows the job/repair the unit is out on, otherwise its
> storage location. The DB column stays `placement` — no migration. (2) "не понимаю как создать больше одного
> юнита, если данные ввожу только по одному" — the old modal took a count PLUS one barcode/serial that applied
> to the FIRST unit only, so asking for 4 produced 1 typed + 3 generated with no way to enter the other three.
> `UnitEditorModal` (add mode) now renders **a row per copy**: "How many?" grows/shrinks the rows, each row has
> its own barcode + serial, "Add another copy" / × per row, and the greyed placeholders show exactly what a
> blank row will generate — computed skipping numbers typed in other rows, so the preview never promises a
> barcode it can't use. Storage location stays batch-wide (copies received together share a shelf) and says so.
> `store.addUnits` took `{count, barcode, serial}` and now takes `{ units: [{barcode, serial}], placement }`
> (a bare `count` still means "that many generated"), validating every typed barcode against the register AND
> against the other rows ("#1021 is listed twice"). Repository already accepted a per-unit array.
> Verified on prod: 3 rows → previews 1020/1021/1022; typing 1021 in row 1 re-previewed the others as
> 1020/1022; a deliberate duplicate was refused with nothing written; then 2 copies added — #1021 with the
> hand-typed serial and #1020 with a generated one — and both written off again (317 units, as found).
> **FEATURE — non-barcoded / consumable stock moves by a DELTA, and item-level changes are finally logged.**
> Reported: "non-barcoded инвентарь не могу добавить, только обновить количество. При этом в логах не
> учитывается." Both true. (1) A non-barcoded item has no unit rows, so the card had NO primary action —
> adding stock meant opening "Edit item" and overwriting the count. Now the primary button is **+ Add stock**
> (barcoded items keep "+ Add unit"), opening `StockModal`: a **Received / Went out** toggle, a count, and a
> live "On hand 50 → 60" preview. Taking out more than you have is blocked before submit (preview goes red,
> button disabled) — stock can't go negative. Store `adjustStock(itemId, { delta })` refuses barcoded items
> (they add/write off units instead) and logs `item.stock_adjusted` with `{delta, from, to}`.
> (2) The `item.created` / `item.updated` / `item.deleted` vocabulary existed in `lib/activity.js` and
> **nothing ever emitted it** — so an item card's Activity read "No changes recorded" no matter what you did,
> and a corrected count left no trace. `addInventoryItem` / `updateInventoryItem` / `deleteInventoryItem` now
> log, with `updateInventoryItem` computing a real diff (field labels + `quantity 50 → 52`) so the feed says
> what moved; a save that changes nothing logs nothing.
> ⚠️ TWO latent bugs surfaced while verifying, both fixed here:
> • `repository.updateInventoryItem` only wrote `quantity` when `kind` was ALSO passed, so a quantity-only
> patch was an empty `.update({})` — a **silent no-op** that still resolved, so the first stock change
> "succeeded" without changing anything (and logged an event saying it had). Now `quantity != null &&
> kind !== 'barcoded'` writes it, and an empty patch returns early instead of hitting the DB.
> • `logActivity` bumped `activityVersion` **before** the insert resolved, so an open card refetched while
> the row was still in flight and came back without it — with nothing to bump again. In supabase mode the
> bump now happens in `.then()` after the row lands (callers stay fire-and-forget). This affected EVERY
> activity feed, not just items.
> Frontend-only, NO migration (`inventory_items.quantity` and `events` already exist). 6 Node assertions on
> the new `describeEvent` cases. Verified on prod: +10 → 60 on hand with "Ann Taylor added stock · +10 ·
> 50 → 60", −10 back to 50, an over-take of 100 refused, and an Edit-item correction logged as
> "edited the item · quantity 52 → 50" appearing instantly. Test events then deleted with service_role and
> J-Hook 2" left at its seeded 50 with an empty feed — including the phantom event from the pre-fix no-op.
> **REMOVED — the `consumable` item type.** Requested: "consumables больше не нужны вообще, нужно убрать
> такой тип товаров". 2.1 shipped three types, but expendable stock behaves exactly like non-barcoded stock
> (counted by quantity, no unit rows) and the only difference that mattered — it isn't rented by the day — is
> carried by `day_rate is null`, not by the type. So: `ITEM_KINDS` is down to Barcoded / Non-barcoded (the type
> toggle and the Inventory type filter both render from it, so they shrank for free), `NonBarcodedBody` lost its
> consumable branch, and `dayRateFor` keys on a new `NOT_RENTED_BY_THE_DAY` id set (gaff-tape, aa-batteries)
> instead of the kind — so the estimate still lists them and still leaves them out of the total.
> `20260807120000_drop_consumable_kind.sql` CONVERTS the two rows to `non_barcoded` (they're real stock:
> referenced by scenario lists, 46 usage rows between them) and then tightens the check constraint to
> `('barcoded','non_barcoded')`. The old constraint was created by an inline `check (...)` on `add column`, so
> the migration drops whatever check on the table still mentions 'consumable' via a `pg_constraint` lookup
> rather than guessing the auto-generated name. `kindLabel` now falls back to "Non-barcoded" for an unknown
> kind (it used to say "Barcoded", which would mislabel a legacy row on an un-migrated DB — `itemCount` already
> counted it by quantity).
> ⚠️ The push produced NO output for ~10 minutes and looked like a network problem; it wasn't. Re-running with
> `--debug` showed `40P01 deadlock detected` — my own earlier hung `db push` attempts were still holding
> `AccessExclusiveLock` on `inventory_items` and deadlocking against each other. Fix: TaskStop every stale
> push, confirm no `supabase` process remains, then run ONE push with `--yes`. Do not fire a second push while
> the first is unfinished, and pipe the log to a FILE (`| tail` hides everything until the process exits).
> Verified on prod behaviourally rather than by trusting "Remote database is up to date": writing
> `kind='consumable'` through PostgREST is now refused with `23514`. Gaffer Tape reads "Non-barcoded · 24 on
> hand" with an Add stock button and its usage history (58 used / 22 jobs) intact, and the "Loft e-commerce"
> scenario list still resolves its tape line as "2× · 24 on hand". 0 console errors.
> **ARCHITECTURE — nothing is deleted any more: everything archives.** Requested after the deletion audit
> ("можем сделать так, чтобы из базы по факту ничего не удалялось, а просто архивировалось?").
> `20260808120000_archive_not_delete.sql` adds `archived_at` + `archived_by` to the TEN tables with their own
> identity (orders, sets, inventory_items, units, contacts, companies, kits, scenario_lists, order_addons,
> company_types), partial `where archived_at is null` indexes, and — the real guarantee — **replaces each
> table's blanket `for all` RLS policy with explicit `for insert` + `for update`, so DELETE is never granted
> to the app**. Child rows that are the CONTENTS of a document (order_lines, addon_lines, kit_slots,
> scenario_list_entries, set_units, roster_entries, packing_signoffs) keep their DELETE: they're replaced
> wholesale on save and the diff already lives in `events`.
> ⚠️ With no DELETE policy, a delete does NOT error — Postgres RLS filters every row, so it silently affects
> 0 rows. Verified with a throwaway order: DELETE as `authenticated` → no error, row survived; UPDATE
> archived_at → works; `order_lines` DELETE → still allowed. Nothing can be destroyed, but a missed
> hard-delete path would look like success, which is why every one was converted.
> **The structural decision: archived rows stay LOADED and are filtered in the views, not in the queries.**
> The app resolves display data by id from the hydrated store (an order line → item name, a roster row →
> person, a PDF → item), so query-level filtering would fill history with holes. Repository reads pass
> `archivedAt`/`archivedBy` through with a strip-and-retry fallback layer (`stripArchive`), and generic
> `archiveRow`/`restoreRow` replace the ten `deleteX` functions.
> Side effects: an ORDER releases its gear and archives its shoot **with the same timestamp** (that shared
> stamp is what makes restore exact — a shoot archived separately stays archived); an ITEM archives its live
> units the same way, so restoring brings back only the copies that went down with it, not one written off
> earlier; a UNIT write-off is now an archive (barcode stays taken, history readable). Store: `archiveRecord`
> /`restoreRecord` serve the five flat types from an `ARCHIVABLE` config; orders/items/units/bookings/addons
> have their own actions. `isArchived`/`notArchived` are exported from the store as the single predicate.
> **persist v5.** New `EVENT.ARCHIVED`/`RESTORED` (+ `ARCHIVE_KINDS`) — 5 Node assertions.
> Filtering audit: `isUnitFree` gets ONE guard that covers kits, staging, scenario lists, bookings, the order
> editor and the reservation sync; `activeUnits`/`itemCount` exclude written-off copies; every list view,
> every picker, the calendar, `orderSearch` and `lib/scenarios` (archived kit/item reported as unsatisfiable,
> never silently resolved). 8 Node assertions on the availability side.
> UI: new **Archive** view (`src/components/Archive.jsx` + `nav.js`) grouped by type with Restore, "N archived"
> links from Inventory/Orders/People, an Archived badge on a card reached by link, and Delete → **Archive**
> wording everywhere (AddInventoryModal's `window.confirm` became an inline confirm, so it's testable).
> **Removed a real blocker:** the person editor used to HIDE its delete button for anyone with job history
> ("On 2 jobs — kept for history"), because `roster_entries` is RESTRICT — the roster could only ever grow.
> Archiving retires them and keeps every job.
> Verified end-to-end on prod with row counts before/after: archiving **Apple Lightning Cable** (on an H&M
> order line — the case that used to fail SILENTLY) took it and its 20 units out of every list while the DB
> still held 44 items / 317 units and that order line still resolved its name; archiving **Ava Morgan**
> (2 jobs) worked with contacts 25 and roster_entries 22 untouched; archiving the CONFIRMED **Wedding
> Editorial** order released 5 reservations (set_units 74→69), took its shoot off the calendar (11→10 chips)
> and kept its 4 lines, then Restore reported "5 piece(s) reserved · 1 could not be — nothing free for those
> lines" (the Canon, correctly). All three restored; every table back to its exact baseline, 0 rows archived,
> 0 console errors.
> ⚠️ Two bugs I introduced and caught in the browser, both worth remembering: `notArchived` used in
> `OrderEquipmentModal` without an import (it takes props, so it had no store import) → white screen with only
> a React warning; and `livePeople` referenced in a `useMemo` defined ABOVE it in `People.jsx` (temporal dead
> zone) — neither is caught by `npm run build`. A grep for "uses the helper but doesn't import it" across all
> files is the cheap check.
> NOT included: purge/permanent delete from the Archive. It would need `service_role`, since the app no
> longer holds DELETE.
> **DEMO CONTENT — job names now follow the studio's real convention.** The brand-style placeholders
> ("Wedding Editorial", "Nike SS26 Lookbook") were replaced with the client's actual format supplied by
> Ruslan: `YYYYMMDD_AT_MAIN_<season>_<line>_<set>` e.g. `20260716_AT_MAIN_SepMM_Missy_OMSet1`. One rename map
> covered everything, because `setTitle` is the link key between a shoot and its order: `data/bookings.js`
> titles (11), `data/orders.js` `setTitle` (11 — which keeps each sub-rental order tied to the client job it
> served, so the "N × PO" grouping still demonstrates one job with several orders), and the `data/usage.js`
> JOBS pool (15 → the 13 supplied names; the two spare names carry the usage-history-only jobs). Prod updated
> non-destructively by name: 13 `orders.job_name`, 11 `sets.title`, 235 `item_usage.job_title` and 12 `events`
> whose `data.jobName` denormalises it. The two form placeholders now teach the convention too.
> ⚠️ These names never fit a calendar cell, so both chip renderers gained a `title` — the full name plus the
> time is on hover. Worth remembering for any new surface that shows a job name in a narrow column.
> ℹ️ The names carry their own dates (24 Jun – 20 Jul) while the demo's shoots sit in the current week
> (27 Jul – 2 Aug), so a name's date prefix does NOT match its shoot's date. Left as supplied; re-stamping the
> prefixes to the real shoot dates (or moving the shoots) is a one-liner if the mismatch ever matters.
> **CHANGE — equipment is picked IN the order form (the old New Booking behaviour).** Reported twice:
> "все еще нет добавления инвентаря / раньше когда была кнопка New Booking — там была возможность добавлять".
> The chained picker (create → OrderEquipmentModal opens) was not what was wanted: the crew writes the job and
> the kit in ONE window. `OrderEditorModal` now carries an **Equipment** block in create mode — scenario list
> preset, inventory search with the free/`add anyway` signal, ± quantities with `/N free · M short`, and whole
> kits through the **unchanged epic-3 `KitStagingModal`** layered over the form (exactly what BookingModal
> does). It builds the same line shape the full picker saves, so `onCreate(payload, lines)` writes them with
> `setOrderLines` right after the order exists — and `eq_updated_by` picks up the author for free.
> The full picker stays behind "Edit equipment" for what it alone owns: sub-rental vendors and the
> zero-availability dialog; the form says so. If nothing was picked inline, creating still opens the full
> picker (both entry points: Orders and the calendar), so the flow never dead-ends on an empty order.
> The calendar's "New order" uses the same form, so it needed `inventory`/`kits`/`scenarios`/`setOrderLines`.
> Verified on prod end-to-end: a form with 1 a-la-carte line + Camera Kit A wrote **5 order_lines** — four kit
> lines with their pinned/assigned units and slot labels (#0956 Camera body, #0963 Lens, #0967 Monitor, #0968
> Media) plus the loose Sandbag — attributed to Ann Taylor, with the shoot on the calendar. Test order removed
> afterwards (orders back to 14: 13 demo + Ruslan's own "test").
> ⚠️ While testing, a mid-flow HMR update remounted the modal and lost its draft, which looked like "the kit
> didn't attach". Re-run from a clean reload before believing a picker bug — and note the DOM read right after
> a click is stale (React hasn't flushed), which reads as the same symptom.
> **CHANGE — the Archive tab is hidden; archived records are not viewable at all.** Requested: "по архивам
> просто надо скрыть с UI вкладку и все… если запись заархивирована, то не давать доступ в ЮИ ее просматривать".
> The MECHANICS are untouched — nothing is ever deleted, RLS still refuses DELETE, every "Archive" button still
> stamps `archived_at` — but the UI now has no way to see or restore an archived record: nav entry + App.jsx
> branch removed (`Archive.jsx` kept UNROUTED with a header note; re-adding is two lines), the "N archived"
> links dropped from Inventory/Orders/People, the Archived badges dropped, and confirm texts no longer promise
> "restorable from the Archive" (now e.g. "It and all its copies leave the app"). **Restore = service_role/SQL
> only** (`update … set archived_at = null, archived_by = null`; for an item, also its units
> `where archived_at = <the item's stamp>` — the shared-stamp rule keeps separately written-off units archived).
> Enforcement is layered: selection resolvers in Inventory/Orders/People resolve against the LIVE collections
> (so a stale selection or "first item" fallback can't show an archived card), and a store predicate
> `isViewBlocked(kind, id)` makes `focusInventory`/`openOrder`/`focusPeople`/`peek` silently ignore a click that
> would open one. Old references still READ (an archived item's name and price stay on its order lines and in
> the estimate) — they just stop being links that go anywhere.
> Verified in supabase mode: nav has 4 tabs; archiving Apple Lightning Cable removed it + its 20 units from every
> count with NO "archived" hint anywhere; the H&M order still shows the line and totals; clicking the item name
> does nothing (no peek, no navigation); restored via service_role, prod back to 44 items / 317 live units,
> 0 archived rows.
> ⚠️ Testing note that bit me AGAIN: clicking a list row and then grabbing "Edit" in the SAME synchronous JS
> block clicks the button of the PREVIOUS render (React hasn't flushed) — I archived A-Clamp 2" instead of the
> cable. Split row-click and detail-pane interaction into separate tool calls, and verify WHICH record a modal
> is editing before confirming a destructive action.
> **CHANGE — stock is held PER DAY, and closing an order gives it back.** Two reported gaps, both real:
> availability ignored dates ("камера забронена на сегодня → на завтра я снова могу её забронить, даже если
> заказ ещё не закрыт"), and there was NO way to close a job, so gear was held forever. Proved before fixing:
> `occupies()` in `repository.js` only asked "active set, not returned" — 53 of prod's 60 reservations were for
> OTHER days yet counted as busy today, even though `set_units.reserved_from/reserved_to` were already stored;
> and `fulfilled` existed only in `orderStatus.js` + seeded rows, with the card toggling Hold ↔ Confirmed only.
> **Dates.** A unit now carries `reservations: [{setId, setTitle, studioId, from, to}]` — mapped from
> `set_units` in supabase mode (`getInventory`), derived from the bookings in local mode (`reservationWindows`).
> `lib/availability.js` gained `overlaps(a,b)` (inclusive, a missing `to` = one day) and `isUnitFree` takes a
> `window`: with one, a unit is free unless one of ITS reservations covers those days; without one the answer
> falls back to "right now", which is what the inventory table means. Repair and archived still beat the window
> (physically away / written off), and `alsoFree` still wins so a record being edited owns its own gear.
> Threaded through every picker: BookingModal (the shoot's date), OrderEquipmentModal + OrderEditorModal (the
> order's working window), `lib/scenarios.js`, and KitStagingModal via a `dateWindow` prop — its FIXED-slot
> conflict check now reads "booked for those dates" instead of "checked out". `reservedUnitsForOrder` resolves
> against the order's OWN window, and `reservationsFromOrders` replaced the single global `claimed` set with a
> **claims map (unitId → windows)**: two confirmed orders on different days can hold the same camera, but
> overlapping ones still can't. Fixed kit pins stay dateless (dedicated to their kit), EXCEPT for units the
> order's own kit lines name — which also fixes a latent bug where a kit line naming a pinned unit reserved
> nothing. Editing a confirmed order passes `ownUnits` (units its shoot already holds) as `alsoFree`, or the
> picker would report its own gear as taken.
> **Closing.** `CLOSED_STATUS`/`isClosedStatus` in `orderStatus.js`; `fulfilled` is relabelled **Closed**
> ("Shot and returned — the gear is back on the shelf") and the card carries **Close order** beside Back to
> hold, plus **Re-open order** on a closed one. Closing does NOT delete the reservations: new repository
> `markSetReturned(setId)` flips that set's rows to `status='returned'`, which `occupies` already treats as
> free — so the stock is released while `set_units` stays as the unit's job history (the history dialog reads
> "Returned"). Local mode mirrors it: a closed order's set keeps its `unitIds` but is flagged `unitsReturned`,
> and both `reservationMap`/`reservationWindows` skip it. New `EVENT.ORDER_CLOSED`/`ORDER_REOPENED` (5 Node
> assertions) and the card says what happened ("Closed — 11 piece(s) are back on the shelf and bookable
> again"). The packing list + add-ons stay available on a closed order: the pull sheet and its sign-offs ARE
> the record of what went out. NO migration ('returned' was already in the `set_units` check constraint, and
> child tables kept their UPDATE/DELETE policies).
> ⚠️ **Fixed a bug this would have introduced:** `setReservationsForSet`'s no-op guard compared unit ids only,
> so closing an order and re-opening it (same ids) would skip the write and leave every row `returned` — the
> order would read Confirmed while holding nothing. A returned row is not a holding, so it can never satisfy
> the guard now.
> ℹ️ The inventory table still shows the job a unit is committed to even when that job is weeks out (status
> `checked_out`) — deliberate, it's "where this copy is going". What was missing is WHEN, so the LOCATION cell
> now appends the dates in grey ("… — Studio 1 · Jul 27", spans as "· Jul 27 – Jul 30").
> Verified against prod (17 Node assertions on the date logic first): the order form on 2026-07-27 offered
> **7 free** C-Stands, the same form on 2026-08-10 offered **10**, and a 27→30 Jul span offered **5** — each
> number matching what the DB's own reservation rows predict. Then CL-26051 (11 pcs, 27 Jul) → **Close order**
> → 74 `set_units` rows intact with its 11 flipped to `returned`, #0762-0764 read Available, the unit's history
> still lists the job as "Returned", `order.closed {released:11}` + 11 per-unit `returned` events logged with
> an actor → **Re-open** → the same 11 barcodes back to `reserved` with the right dates and the order
> `confirmed`. Prod left exactly as found (74 reserved, CL-26051 confirmed, 35 test events removed),
> 0 console errors, build clean, lint unchanged.
> **FEATURE — a hand-typed Set field on the order** (`20260809120000_order_set_label.sql`). A studio runs up
> to `MAX_SETS_PER_DAY` shoots a day and the crew tells them apart by their own designation ("OMSet1",
> "Set 2") — the same string that ends their job names. Until now it only existed buried inside the free-text
> job name, so nothing could show or find it. `orders.set_label` is free text, hand-typed like `po_number`,
> deliberately on `orders` and NOT on `sets`: the three sub-rental history orders have no Set row of their own,
> and a field that silently drops what you typed is worse than no field. Threaded through: the order form
> (beside the job name, 2:1 grid), the card's THE JOB block, the peek card, the list row (a chip),
> `lib/orderSearch` (searchable on its own — "A-cam" found exactly 1 of 15), BOTH PDFs' meta table (the crew
> pulling gear needs to know which set), and the CALENDAR CHIPS — `byDay` now attaches each shoot's
> `order.setLabel`, so a cell reads "09:00–18:00 · OMSet2" and the tooltip spells it out. `getOrders` gets its
> own `withSetLabel` select layer so a pre-migration DB degrades to everything-but-this rather than to the stub
> shape. Demo content: the seed derives the label from the job name's trailing segment (store
> `setLabelFromJobName`, mirrored in `seed-supabase.mjs`) — 13 prod orders backfilled non-destructively; the one
> order with no convention in its name (Ruslan's "test") was left blank rather than given an invented value.
> ⚠️ **FIXED A WHITE SCREEN THAT WAS ALREADY LIVE:** the Studio Calendar crashed with
> `ReferenceError: companies is not defined` — the previous commit added the sub-rental vendor picker to
> `OrderEditorModal`, and the calendar (which renders that same modal) passed `companies={companies}` while
> nothing declared it. `npm run build` and oxlint BOTH pass on an undefined identifier inside JSX, and the
> Orders view worked, so it went unnoticed. Lesson: adding a required prop to a shared modal means checking
> EVERY component that renders it. New `npm run audit:jsx` (`scripts/audit-jsx-props.mjs`) greps every
> `prop={ident}` and reports any that its own file never declares — this bug class has now bitten three times
> (`notArchived`, `livePeople`, `companies`). It can false-positive on a renamed object destructure
> (`{ loading: activityLoading }`), so read the survivors instead of trusting the count.
> Verified on prod: created an order from the Orders view with Set "B-cam Set 3" → stored verbatim; edited it to
> "OMSet3 / A-cam" → persisted; search by "A-cam" → 1 of 15; calendar chip and tooltip both show it; peek card
> shows the Set row; the calendar renders again (all 11 chips, each with its OMSet1/OMSet2); "New order" from
> the calendar opens the form with the field. Estimate + packing PDFs asserted under Node by extracting text
> from the generated bytes. Test order and its shoot removed afterwards — prod back to 14 orders / 12 sets /
> 74 reserved set_units, 0 console errors.
> **FEATURE — per-item availability CALENDAR in Inventory** (no migration; every input already existed).
> Requested: opening an item should show which days it's booked, how many pieces exist that day, how many are
> taken and free, WHICH barcodes, under which SETS, and WHO booked them. `src/lib/itemAvailability.js` is a
> PURE module (no React/store/date-fns — runs under plain Node, 27 assertions): `covers(reservation, iso)`,
> `dayAvailability(item, iso)` → `{total, booked, away, free, entries, awayUnits}`, `availabilityForDays`,
> `freeUnitsOn`, `bookedDays` (spans expanded, used for "next commitment"), `nextIso`. Archived copies are out
> of `total` entirely; an open repair is reported as `away` on EVERY day (physically gone), never as booked —
> so `free = total − booked − away` always adds up on screen.
> `src/components/ItemAvailability.jsx` is the month grid + day breakdown, rendered in the item card between the
> units table and Activity (inside the SAME scroll container — measured: it takes the container's client width,
> 912px, not the table's 1220px scrollWidth, so it never stretches off-screen). Each cell reads "N free" and is
> tinted white / amber / rose (rose = none free); the selected day spells out "17 total · 5 booked · 12 free
> · 1 in repair" and lists one row per held copy: `#0851 → <job> · Studio L · OMSet2 · PO-4516 · Ann Taylor`,
> the job name peeking the SET card. "Who booked" resolves reservation → `setId` → booking → `booking.orderId`
> → order, taking `eqUpdatedBy || createdBy` (null renders "seed data", not "unknown"). The component reads
> `bookings`/`orders`/`peek` from the store ITSELF rather than taking them as props — that chain is its own
> business, and threading three collections through the inventory tree is exactly how `companies={companies}`
> became a white screen. An empty month says so and offers a jump to the next commitment instead of looking
> broken, and a footnote states that only CONFIRMED orders hold gear (a hold shows nothing). Non-barcoded stock
> gets a sentence explaining why it has no calendar (counted, never reserved copy by copy) instead of an empty
> grid.
> ℹ️ The calendar is where the per-day reservation model becomes visible: the Magic Keyboard's #0851/#0852 are
> booked on Jul 27 (Studio 1) AND again on Jul 30 (Studio 2) — the same copies serving two shoots, which the
> LOCATION column can't show (it names only the first holding).
> Verified in LOCAL mode in the browser (17-unit keyboard: 27 Jul 15 free / 28 Jul 16 / 30 Jul 12 with all five
> barcodes, sets, Set labels, POs and authors; Canon EOS R5 → "2 piece(s) · 1 in repair", 30 Jul rose "none
> free" with #0960 booked and #0959 flagged repair-on-every-day; month nav, Today, the "next commitment" jump,
> and the set link opening the job peek; 0 console errors). The SUPABASE path was verified headlessly instead:
> the same `getInventory` embed (`set_units → sets`) shaped by hand and fed to the SAME pure function returned
> 2 / 1 / 5 booked for 27 / 28 / 30 Jul against prod's real rows, and set → order → `eq_updated_by` resolved to
> real names — the browser session had expired and passwords are not something I type.
> **POLISH — calendars turn pages instead of blinking.** Every grid swapped in one frame, which reads as a
> flicker and says nothing about which way you went. `src/lib/useCalendarFlip.js` takes the page's token (a
> sortable string: `'2026-08'`, `'week:2026-07-27'`) and returns the CSS class for the incoming page — the
> caller also sets `key={token}` on the same element so React mounts a fresh node and the animation replays.
> Direction comes from comparing the new token with the previous one in a REF written during render (the
> "derive from the previous value" case; state here would cost an extra render per turn). Animations live in
> `index.css` **outside** any `@layer` so they can't be out-cascaded: `cal-flip-fwd`/`cal-flip-back` slide
> 1.5rem in from the side you're heading towards + fade, 200ms ease-out (fast on purpose — this sits under
> repeated ‹ › clicks), and `cal-fade` lifts 0.25rem for a same-page refresh. A
> `@media (prefers-reduced-motion: reduce)` block turns all three off.
> Applied to ALL FOUR grids: the studio WEEK view, the studio MONTH view (the mode toggle counts as a turn —
> the key carries `month:`/`week:`), the item AVAILABILITY month plus a fade on its day panel, and the
> `DateField` popover (used by every date input in the app).
> Fixed while here: `ItemAvailability`'s `stepMonth` read `monthAnchor` from the render closure, so two clicks
> in one tick stepped once — now a functional `setMonthAnchor((cur) => …)` (July → September on a double click).
> Verified in the browser by measuring, not eyeballing: on the frame after a ‹ / › click the grid reports
> `cal-flip-in-right`/`-in-left` **running** with `opacity: 0` and `matrix(1,0,0,1,24,0)` → settling to opacity
> 1 / no transform; direction correct in both directions in all four grids (including "Today" jumping backwards
> from September → `cal-flip-back`); the reduced-motion rule found in `document.styleSheets`; 0 console errors.
> ⚠️ A screenshot is useless for this — the capture lands after the animation settles. Temporarily forcing
> `animation-duration: 8s` and reading `getAnimations()[0]` + `getComputedStyle` on the next `requestAnimationFrame`
> is what actually proves it (and the class read IMMEDIATELY after a click is stale — React hasn't flushed).
> **CHANGE — one date on an order, and creating one is explicitly TWO STEPS (create happens on step two).**
> Two requests. (1) "Съемки всегда один день" — the form's date RANGE became a single **Set date**; `ends_on` is
> still written (equal to `starts_on`) because availability, billable days and `orderSearch` all read a window,
> and legacy multi-day rows must still resolve. Both PDFs print "Set date" and fall back to "A to B (N days)"
> only for those legacy rows.
> (2) The inline equipment block added to `OrderEditorModal` in the previous change was REMOVED again on
> request: "форма на втором шаге отличается и она лучше с точки зрения мелких деталей" — `OrderEquipmentModal`
> alone owns the in-house/sub-rental switch, the vendor picker and the zero-availability dialog, so duplicating
> a lesser picker in the form was the wrong half to keep. The flow is now honestly two-step and the buttons say
> so: step one reads **"Select equipment"** (not "Create order"), step two reads **"Create order"**.
> The important part is that **nothing is written until step two**. `OrderEditorModal`'s `onCreate` became
> `onProceed`, which only hands the payload over; `Orders.jsx` holds it in a `draft` state and opens
> `OrderEquipmentModal` on an order-SHAPED object with `id: null`. `isNew = !order?.id` is how step two knows
> it's creating: it relabels the button/title, shows a context strip (job · Set · studio · date + "Nothing is
> saved yet"), and its save calls `createOrder(draft)` then `setOrderLines(newId, lines)`. So cancelling step two
> leaves **no empty order and no booked studio slot** — the previous flow created the order first and left one
> behind. Capacity (`MAX_SETS_PER_DAY`) is now checked in `onProceed` too, before the crew spends time picking
> gear; `createOrder` still checks it when it actually writes.
> The CALENDAR uses the same two steps: its "New order" form no longer creates anything either — new store
> action `openOrderDraft(payload, from)` sets a transient `orderDraft` (+ `activeView:'orders'`, pushes the nav
> trail) which `Orders.jsx` consumes in an effect and opens step two on. The calendar consequently stopped
> reading `inventory`/`kits`/`scenarios`/`companies`/`createOrder`/`setOrderLines` (six selectors gone —
> and with them the class of bug that white-screened it).
> Removed as dead: `pendingEqId` + its effect and `openOrder`'s `{equipment}` option / `orderFocus.openEquipment`
> — they existed only to open the picker AFTER a create, which no longer happens. A `createdDraftId` ref keeps a
> retry honest: if the order is written but its lines fail, pressing the button again saves onto that order
> instead of creating a second one (a ref, so it doesn't reload the picker and discard the picks).
> Frontend-only, no migration. Verified in local mode: step 1 → "Select equipment" → step 2 titled "New order —
> equipment" with the context strip → **Cancel left 14 orders and no shoot** → re-run, added Avenger Double Riser
> → "Create order" → 15 orders, the new one selected on Hold with EQUIPMENT · 1 PCS, $12.00 estimate and
> "Equipment by …" attribution; then the CALENDAR entry point → landed in Orders with step two open, a
> "← Back to Studio Calendar" trail and still 15 orders → Cancel → localStorage confirmed 0 orders and 0 bookings
> for that date. Demo data reseeded afterwards, 0 leftovers, 0 console errors, build + `npm run audit:jsx` clean.
> ⚠️ Browser-tool note: in this preview pane `computer` coordinates are CSS pixels while the screenshot is
> downscaled (dpr 2), so ref/screenshot-derived clicks landed off-target; `form_input` (DOM-based) and reading
> state back out of `localStorage` are what actually verified the flow.
> **FIX — pick WHICH copy fills a kit slot, and make a pasted barcode work.** Two dead ends reported in the
> staging window, both real. (1) "Use available" called `freeUnitsOf(item)[0]`, so after Replace → **Return to
> stock** the copy you had just released was first in the pool and came straight back — there was no way to
> take a different one, and the pencil (a stock correction) read as the only alternative. The button is now
> **"Choose unit"** and opens `UnitPickList`: the copies free FOR THE ORDER'S DATES, each with barcode, serial,
> shelf and a note when that copy is spoken for on some other day. Ad-hoc "Add item" is two steps now for the
> same reason (item → which copy). (2) Pasting a barcode did nothing: resolution hung on `Enter`, which a
> hardware scanner sends but Ctrl+V does not. A value that IS a known barcode (`knownBarcodes` set) assigns on
> the spot, there's an explicit **Assign** button, and an accepted scan reports "#0966 → SmallHD 702 Touch
> Monitor · Monitor" instead of silently clearing the field. The field also STATES the rule it always followed:
> a barcode belongs to one copy, so the scan fills whichever slot expects that item — that is how the app knows
> what was scanned, and why the case can be worked in any order; a code whose item no slot needs says exactly
> that.
> ⚠️ `ownUnitIds` is an ARRAY from BookingModal and a SET from OrderEquipmentModal — everything else forwards it
> to `isUnitFree`, which normalises it, so the new list was the first code to call `.includes` on it and
> white-screened the view. Normalised locally.
> Verified in the browser: #0962 picked → Replace → Return to stock → **#0964** picked (the thing that was
> impossible), paste of 0966 with no Enter → assigned to the MONITOR slot, wrong-item and unknown codes refused
> with their reasons, unknown → "Register & assign" offer intact. 0 console errors.
> **EPIC #6 COMPLETE — the scanning station** (`20260810120000_scanning.sql`). Audit first: 6.1 packing PDF,
> 6.2 sign-off initials, 6.3 vendor per line, 6.4 add-ons and 6.5 digital checklist were all in place; what did
> NOT exist was the scan log and any check that gear came back. Both now do.
> `src/lib/scanning.js` is PURE (no React/store/browser — 28 Node assertions): `isScannable` (confirmed, not
> archived, not closed), `expectedUnits(order, booking, inventory)`, `scanStates`, `scanProgress`,
> `outstandingUnits` and `resolveScan`. Two decisions worth keeping: **expected units come from the SET's
> reservations, not the order's lines** (a loose a-la-carte line carries a quantity, not units — the
> reservations are the resolved answer, and sub-rental lines are vendor gear with no barcode of ours), and the
> **log is append-only with the LAST scan winning**, so a unit that goes out again on a second day reads as out
> and a double scan is answerable ("already scanned out") instead of counted twice.
> `scans` is its own table (soft `unit_id`/`item_id` refs like `events`, so a written-off copy doesn't take its
> history down), SELECT + INSERT only — no update, no delete: a scan log you can rewrite is not a log.
> `set_units.status` moves 'reserved' → 'checked_out' → 'reserved'; both non-returned states occupy the unit, so
> **a scan never changes availability**, only where the copy is.
> New view **Scanning** (`src/components/Scanning.jsx`, its own tab — it stays open by the door for a shift):
> left column lists only CONFIRMED orders with live "N out · N back · N to go", right side is Scan out / Scan in,
> one big always-focused input, per-unit state with who+when, and the full history newest-first. Store
> `scanUnit(orderId, code, direction)` is OPTIMISTIC like the packing sign-off — but a failed write is **taken
> back** and reported (`scanSyncError`), because a station that claims gear moved when the DB disagrees is worse
> than a slow one. That path is also what a pre-migration database looks like. New cap `SCAN` (a packing shift
> may move gear without being allowed to rewrite the order) and events `scan.out`/`scan.in`, so the order's own
> Activity feed answers "who took the camera out".
> **Closing now verifies the gear is back:** `Close order` is disabled while `outstandingUnits` isn't empty and
> names what's still out (both in the tooltip and in the card's new Scanning block). An order whose gear was
> never scanned out still closes — a crew can pull a job without using the station, and blocking that would make
> the flow unusable.
> Verified end-to-end in LOCAL mode: 10 of 15 orders offered; scan out #0851 → "1 out · 0 back · 10 still on the
> shelf" with "out 03 Aug, 13:04 · Demo user"; duplicate refused and NOT counted twice; #0999 (ours, other
> order) and #4242 (not in the register) refused with their own messages; scan-in of a unit that never went out
> refused; Close order disabled with "1 piece(s) are still scanned out"; scan in → history shows both
> directions with actor + time and Close order unlocks ("The shoot is done and the gear is back"). Demo data
> reseeded after; 0 console errors, build + `audit:jsx` clean.
> **Migration APPLIED and verified on prod** (pushed from a network that allows 5432; the studio's faster Wi-Fi
> blocks that port, but only `db push` needs it — PostgREST is 443, so everything below was checked over it).
> Verified BEHAVIOURALLY as the `authenticated` role, not by trusting "Finished": INSERT works and stamps
> `scanned_by = auth.uid()`; a forged `scanned_by` is refused (**42501**); `direction:'sideways'` is refused
> (**23514**); UPDATE and DELETE affect **0 rows** each and the row survives both (append-only, as intended —
> only service_role can clear it); the app's exact embed `scanner:profiles!scanned_by` resolves ("out 0792 ·
> Ann Taylor"), which is the thing that silently breaks without the FK; `set_units` accepts 'checked_out' and
> goes back. The other two side fetches `getOrders` runs (packing_signoffs, order_addons) still answer, so
> nothing regressed. Prod has **9 confirmed orders** with reservations (11/8/7/7/6/5/5/4 units) for the station
> to list.
> Then a full ROUND TRIP through exactly what `store.scanUnit` does, with the UI's own pure module judging the
> fetched rows: station lists 11 copies → scan out #0851 → `{total:11,out:1,pending:10}`, `set_units` =
> checked_out, log "out #0851 by Ann Taylor", close BLOCKED (1 still out) → scan in → `{out:0,back:1}`, status
> back to reserved, close ALLOWED. Undone afterwards: 2 scans deleted with service_role, `scans` back to 0 rows,
> every `set_units` status back to 'reserved' — prod exactly as found.
> ℹ️ The in-browser check ran in LOCAL mode; the supabase path was verified headlessly (same approach as the
> item availability calendar) because signing in means typing a password, which I don't do.
> **FIX — a barcode copied off the screen carries the `#`, and the station refused it.** Reported from prod: a
> code pasted into Scan out came back "##0806 isn't in the register" — doubled hash and a false negative, while
> #0806 was sitting in that very order's list. The register stores bare digits; the `#` in every screen and PDF
> is DECORATION, but the obvious way to imitate a scan is to copy a code off the screen, which copies it too.
> New `normalizeBarcode` in `lib/scanning.js` (the one place that owns "what a reader actually sends"): trim,
> strip leading `#`, trim again — so a reader's trailing CR and a copied `#0806` both resolve, and an unknown
> code now reports itself with ONE hash. Used by `resolveScan` AND by KitStagingModal (same paste, same
> problem — it also fed the raw value into the known-barcode check, so auto-assign missed too).
> The STATION also got the kit modal's paste behaviour: a value that is a known barcode fires immediately, since
> a hardware reader ends with Enter but Ctrl+V doesn't, and waiting for a keypress that never comes looks exactly
> like a broken scanner. 8 more Node assertions (36 total).
> Verified in the browser with the reported input: paste `#0806`, no Enter → "#0806 Aputure 300X — out",
> "1 out · 5 still on the shelf", row reads "out 03 Aug, 13:44 · Demo user"; `#4242` → "#4242 isn't in the
> register." (one hash); `#0966` pasted in kit staging → assigned to the MONITOR slot. Demo data reseeded after.
> ⚠️ The console keeps stale `[vite] Failed to reload` lines from mid-edit HMR races; the app reloads and renders
> clean, and `npm run build` passes (it would fail on a real syntax error).
> **FIX — "Broken → send to repair" from an ORDER did nothing at all.** Reported: sent a unit for repair twice,
> availability stayed 12, nothing in the item's log. Root cause: `OrderEquipmentModal` never passed
> `onMarkBroken` / `onSetBarcode` to `KitStagingModal` — only `BookingModal` did — and the staging window calls
> them optionally (`onMarkBroken?.()`), so the slot emptied, no repair row was written, no event was logged and
> the pool never changed. The pencil (barcode correction) was the same silent no-op in that flow.
> ⚠️ This is the `companies={companies}` bug class again, but INVERTED: a *missing* optional prop, which
> `npm run audit:jsx` cannot see (it only flags props whose value identifier is undeclared). When a child calls a
> handler with `?.`, a parent that forgets it fails silently — the child now says so instead
> ("This window can't send units for repair — do it from the item's card").
> Also fixed the two things that made the failure unreadable even once wired: **a comment is now taken** (repair
> shop + "What's wrong with it?", Enter to submit — `repairs.vendor`/`issue` were always nullable, so a blank
> shop is legal and the issue falls back to "Flagged broken while packing"), and the window **says what the
> write did** ("#0963 sent for repair to Sony Pro Support — it's out of the pool everywhere and logged on the
> item"). That last part matters because **the "N free" count legitimately does not move**: the slot's own unit
> was already excluded as claimed, so releasing it and removing it for repair cancel out. The pool really does
> shrink — reopening the window shows it (4 free → 3).
> `BookingModal` passes the typed details through instead of its old hardcoded "Flagged broken during kit
> staging", and the stale "scan, use available, or remove" hint now matches the buttons.
> Verified in local mode: send #0963 with shop + issue → slot empties, green line, unit reads "In repair — Sony
> Pro Support" in the units table, item Activity shows "Demo user sent a unit for repair · Sony Pro Support ·
> Zoom ring sticks at 50mm · #0963", and the lens pool went 4 → 3. Pencil in the same flow: `0965` refused
> (belongs to the SmallHD monitor) with the panel kept open, `9001` written through to `units.barcode`. Demo
> data reseeded after; 0 console errors.
> **UI — one dropdown for the whole app** (`SelectField` + `ComboField`, no migration). Reported: the Studio
> and Photographer dropdowns look nothing alike. They weren't the same control: Studio was a native `<select>`
> whose OPEN list is drawn by the OPERATING SYSTEM (dark on macOS, unstyleable), and Photographer was
> `<input list>` + `<datalist>`, whose suggestion list is drawn by the BROWSER — two OS widgets, two looks,
> neither ours. No amount of CSS fixes that; the open list of a native select cannot be styled at all. So both
> were replaced, exactly the trade `DateField` already made for dates: `SelectField` is a listbox
> (trigger + portal popover, checkmark on the selected row) and `ComboField` is free text WITH filtered
> suggestions (a photographer who isn't on the list must still be typeable). Both mirror DateField's popover —
> `position: fixed` through a portal so a modal's `overflow` can't clip them, outside-click and Escape to close
> (Escape `stopPropagation`s so it closes the list, not the modal), one radius, one shadow — and both call
> `onChange` with an event-like `{ target: { value } }`, which is why all 28 call sites kept their handler
> bodies verbatim.
> Converted **25 selects across 11 files + 3 datalists** (BookingModal photographer/model, the order form's
> photographer). `document.querySelectorAll('select').length` is now **0**. Two behaviours worth knowing: the
> ACTION dropdowns ("Add a kit…", "Pick a preset…") stay controlled at `value=""`, so they fall back to the
> placeholder after firing — the old `e.target.value = ''` reset became dead code and was dropped; and the
> popover flips ABOVE the trigger when there isn't room below (verified in a 420px-tall viewport: trigger at
> y=279, popover placed 163–269).
> Verified in the browser by measuring, not eyeballing: both popovers report the same `rgb(255,255,255)` and
> `border-radius: 12px`; Studio lists all six studios with the checkmark on the current one and picking one
> closes it; the photographer combo filters to "Marcus Reed" on "ma" and picking it writes the value; the kit
> dropdown inside the scrollable equipment modal is not clipped and staging still opens; 0 console errors.
> **CHANGE — the packing checklist is per COPY, and signing is a checkbox.** Asked what the three boxes were
> (6.2's initials fields: two people at sign-out, one at return — typed by hand) and then: barcoded units each
> on their own row, non-barcoded together by quantity, and a checkbox instead of typing.
> New PURE `packingRows(estimate, { inventory, booking })` in `lib/packing.js` (24 Node assertions). An order
> LINE is not a row: "Arri 2K Open Face x2" is two bodies that get carried and returned separately, and one tick
> for both is how a piece goes missing. Barcoded stock expands to one row per copy, resolved from the SET's
> reservations (`booking.unitIds`) — the same source the scanning station uses, because a loose line carries a
> quantity and the reservation is the answer to "which ones". What cannot be expanded stays a counted row AND
> SAYS WHY: non-barcoded = "counted stock", a sub-rental line = "vendor gear" (it has no barcode of ours — that
> is exactly what the reported screenshot showed), and pieces asked for beyond what is reserved =
> "no unit reserved" rather than vanishing off the sheet. A unit named by a kit slot is never handed to a loose
> line of the same item as well.
> `SignBox` (a text input) became `SignCheck` — a checkbox that records the SIGNED-IN account's initials plus the
> timestamp, so who+when is still answerable (hover the box) while packing is one tap with gloves on. The three
> columns stayed: the double sign-out is the studio's own process and an acceptance criterion; only the input
> changed. Footer says "signed as DU". `packingLineKey` is unchanged (`itemId::slotLabel::barcode`), so per-copy
> rows get distinct keys for free and existing sign-offs still resolve — NO migration.
> **The PDF prints the same rows** (`packingListPdf` now calls `packingRows` too) — a printed sheet that doesn't
> match the digital one means the crew is ticking two different documents. Totals line reads
> "N rows · N pieces to pull · N signed off by barcode".
> Verified in the browser: a x3 keyboard + x2 mouse order became **8 rows, 8 by barcode** (#0851/#0852/#0853,
> #0868/#0869…); the sub-rental order shows **11 rows, 10 by barcode** with the Astera Titan Tube left as
> "×2 · vendor gear · Northlight Rentals"; ticking a box turns it green with the tooltip "DU · 03.08.2026,
> 17:10 · tap to undo", and both OUT boxes on one row move the counter to 1/4. PDF asserted under Node by
> extracting text from the generated bytes (#0801 and #0802 on separate rows, "counted stock", the new totals
> line, 1 page). Demo data reseeded after; 0 console errors.
> **REMOVED — add-on packing lists (6.4).** Requested: "выпиливаем функционал аддонов — у нас можно на
> любом этапе редактировать список инвентаря". True — 6.4 existed because the printed sheet was treated as
> immutable, and "Edit equipment" works on a confirmed order, so a second labelled list was a parallel way to
> do the same thing (and a second place to look for gear). Gone from the UI, the store, the repository and the
> event vocabulary: `createAddon`/`setAddonLines`/`archiveAddon`/`restoreAddon`, `getAddonsByOrder`,
> `order.addons`, the Add-ons card section with its four per-row actions, the add-on equipment editor and
> checklist instances, `EVENT.ADDON_CREATED`/`ADDON_DELETED` + their `describeEvent` cases, the `addon` entry in
> `ARCHIVE_KINDS`, the add-on branch of the unrouted Archive view, and `packingListPdf`'s `opts.addonLabel`
> (header line + filename suffix). `getOrders` went from three side fetches to two.
> The add-on-only `prefix` argument of `packingLineKey` / `packingProgress` went with it — dead plumbing that
> reads as live is worse than no plumbing. Keys are unchanged in VALUE (the prefix was always '' for the main
> list), so existing sign-offs still resolve.
> Fixed while here: the order card's "N/N signed out" counted order LINES while the checklist counts per-copy
> ROWS, so the two disagreed after the per-copy change — the card now calls the same `packingRows`.
> ⚠️ My own edit put `packProg` ABOVE the `inventoryList` selector it uses — a temporal dead zone, the
> `livePeople` bug again. Caught in the browser, not by the build.
> **The DB tables are LEFT IN PLACE** (`order_addons`, `addon_lines`): no app code reads them, and dropping a
> table destroys data, which is the opposite of the archive-not-delete rule. Prod holds 2 empty `order_addons`
> rows from testing (0 `addon_lines`, 0 namespaced `packing_signoffs`) — now unreachable. A drop migration is a
> one-liner if the schema should be clean.
> Verified in local mode: the order card's sections are STATUS / THE JOB / ATTRIBUTION / EQUIPMENT / ESTIMATE /
> PACKING LIST / SCANNING / ACTIVITY with **zero** occurrences of "Add-on" in the DOM; the checklist still ticks
> (1/4 after two OUT boxes) and the card now reports the same 1/4; the packing PDF still builds with per-copy
> rows, the "PACKING LIST" header and no ADD-ON text (asserted from the generated bytes under Node).
> **CHANGE — a CLOSED order's equipment is locked.** Requested: no editing the composition once the order is
> closed. A closed order is history: the shoot happened, the gear came back and the reservations were released,
> so changing what it carried would rewrite the record every other screen reads — the packing sheet that was
> signed, the scan log, the estimate that was quoted. Two layers: the card's **"Edit equipment"** becomes a
> greyed **"Closed — locked"** with the reason on hover, and `store.setOrderLines` REFUSES the write with
> "Re-open it to change the gear". The store guard is the real one — a picker left open while someone else
> closes the order would otherwise still save (the modal already surfaces a returned `{error}`).
> What stays available on a closed order, deliberately: the packing checklist and the pull-sheet PDF (they ARE
> the record of what went out), the order's own metadata (a PO can arrive after the shoot), and Re-open.
> Verified in local mode both ways: the closed order shows "EQUIPMENT · 6 PCS · Closed — locked" with no edit
> button; **Re-open** brings the button back; **Close order** locks it again; the checklist and Print PDF stay
> reachable throughout. 0 console errors. NOTE the store guard itself has no UI route left to exercise — it
> exists for the stale-modal race and any future call site, and was reviewed by reading, not by staging a race.
> **FEATURE — a rental price ON THE ORDER LINE** (`20260811120000_order_line_day_rate.sql`). Requested: adding a
> rental item to an order must let you enter its rental price. `inventory_items.day_rate` (5.4) is OUR rate for
> gear we own and is the right default — but it is the WRONG answer for a sub-rental line: that gear is the
> vendor's, the price is whatever this deal costs, and until now such a line was quietly quoted at our own rate
> for a comparable piece we happen to own. New nullable `order_lines.day_rate`: null = follow the item (what
> every existing row means), a typed value overrides it FOR THIS LINE ONLY, so a vendor's price or a one-off
> discount never edits the item everyone else quotes from.
> `buildEstimate` already read `line.dayRate ?? item.dayRate`, so the estimate, the card and both PDFs picked it
> up for free; it now also carries `rateOverridden`, which the card shows as a small "set here" so a vendor price
> is visibly not our rate. UI: a `$ ___ /day` field on every a-la-carte line with the item's rate as the
> PLACEHOLDER (so the default is legible), `reset` back to the item, and for a sub-rental line an explicit
> "vendor price not set" until it is. Kit lines are untouched — they're unit-level rows of an item we own.
> ⚠️ **Fixed a trap I introduced:** I first put `day_rate` inside `getOrders`'s BASE select, which on a
> pre-migration database fails every rich layer and degrades to the stub shape — orders would silently lose
> kits, units, sources and vendors, not just the price. It is now the OUTERMOST layer
> (`withLineRate = withSetLabel.replace(...)`), verified against the real prod DB: the top layer fails with
> **42703** and the next one still returns `id, item, unit, kit_id, source, vendor, unit_id, quantity,
> slot_label, vendor_company_id`. `setOrderLines` likewise strips the column and retries — but REPORTS it
> ("the equipment saved, but N line price(s) did not … apply migration 20260811120000"), because a price that
> silently vanishes is worse than one refused out loud.
> 10 Node assertions on the pricing (vendor price beats ours, days multiply, an unrated line still contributes
> nothing, **$0 is a real price and not "unset"**). Verified in local mode: the field shows 285 as a placeholder,
> switching a line to Sub-rental reads "vendor price not set", typing 340 moves the modal footer
> 475 → **530**, saving shows "$340.00/day set here" on the card with the estimate at $530, re-opening the picker
> loads 340 back, and `reset` returns to 475. Demo data reseeded after.
> **Migration APPLIED and verified on prod.** Checked behaviourally as the app's own role, through the app's own
> pricing code: the TOP select layer now succeeds (20 orders); a real SUB-RENTAL line — Sony 24-70mm, our rate
> **75** — accepted a vendor price of **137.50**, and reading it back through `mapLineRow`'s shape into
> `buildEstimate` gave "137.5 /day · overridden: true" with the order total following it; clearing to null went
> back to following the item. Undone afterwards: 105 `order_lines` rows, **0** with a per-line rate — prod
> exactly as found.
> ℹ️ No DB check constraint on the value: a negative rate is refused by the field, and only this app writes the
> column. Worth a `check (day_rate >= 0)` if that ever stops being true.
> **FEATURE — choose the COPY for a plain item too, and never ask for one when there is no barcode.**
> Requested: picking an item (or applying a preset) should let you set its barcode "the same way as in a kit",
> and a non-barcoded item should not ask — neither loose nor in a kit. NO migration: `order_lines.unit_id`
> already exists (kits use it) and `reservedUnitsForOrder` already pre-claims ANY line that names a unit, so the
> model was ready — only the picker wasn't.
> `UnitPickList` moved out of KitStagingModal into `src/components/UnitPickList.jsx` (one definition, both
> windows) and gained an optional scan field: typing filters by barcode or serial, and a value that IS a free
> copy's barcode is taken immediately — so a reader and a pasted `#0958` both work (`normalizeBarcode`).
> In `OrderEquipmentModal` each in-house barcoded line now carries a **Copies** row: a chip per pinned copy
> (× to release it), "N × any free copy" for the rest, and "Choose / scan a copy". Pinning does not change what
> the crew asked for — it says WHICH piece the n-th one is; unpinned pieces are still resolved at confirm.
> Storage is the kit's own shape: a pinned copy is emitted as a unit-level line, which is why reservations,
> packing rows and scanning needed no special case. On load, loose unit-level lines are FOLDED BACK into their
> item's line as chips instead of showing N one-piece lines. Pinned ids join `claimed`, so a chip removes the
> copy from the free pool for every other line and kit (visible: "2 left" → "1 left" the moment you pin).
> Stepping the quantity below the number of pinned copies releases the last pin rather than lying about the
> count, and switching a line to Sub-rental releases them all — that gear is the vendor's and has no barcode of
> ours.
> No copy question for counted stock: the Copies row is gated on `kind === 'barcoded'`, and a KIT slot whose item
> is non-barcoded now reads "counted stock · no copy to pick", counts as satisfied and is left out of the add
> (it used to sit "awaiting scan" with 0 free and block confirm forever). `KitEditorModal` already refuses to
> author such a slot, so that path is defensive — exercised by fabricating one in localStorage.
> Verified in local mode: 4 barcoded lines each offer Copies, the non-barcoded Gaffer Tape line does NOT;
> pasting `#0958` with the hash pinned that copy and dropped the pool 2 → 1 left; saving wrote a
> `unitId: u-0958` line and the card shows "#0958"; re-opening folded it back to a chip; the fabricated counted
> kit slot showed "no copy to pick", "2 of 6 slots assigned" and "Add 2 to set" (not 3), with no meaningless
> Replace. Demo data reseeded afterwards — 0 loose unit lines, fabricated slot gone, 0 console errors.
> **UI PASS — five reported details.** (1) **Subcategory is a list**: new `SUBCATEGORIES` map in
> `data/inventory.js` (7 categories × 5-6 kinds), offered through `ComboField` and merged with every
> subcategory the register already uses under that category — so the list maintains itself. Deliberately NOT a
> closed dropdown: new kinds of gear arrive, and refusing one is worse than an occasional new entry.
> (2) **The date popover jumps by month and year**: the title is now a button that swaps the day grid for 12
> month buttons + a scrollable year list (`THIS_YEAR + 3 … -30`), because paging one month at a time is useless
> for a purchase date 15 years back — which is exactly what that field asks for. Kept inside the SAME popover
> rather than nesting another portal. The ‹ › arrows step a YEAR while the chooser is open.
> (3) **Kits and scenario lists lost their category**: a kit is described by its name and slots, a list by the
> shoot it's for, and the third free-text label was a taxonomy nobody maintained. Gone from both editors, both
> list panes, both detail headers, the preset dropdown labels and the unrouted Archive rows. DB columns stay.
> (4) **The availability grid is legible at a glance**: weekends grey (slate-100), a day with sets amber-50,
> nothing free rose-50, and each cell now shows BOTH numbers — "15 free" over "2 out". "11 free" alone doesn't
> say whether a day is quiet or nearly full.
> (5) **One filter design**: new `FilterBar` (+ exported `FILTER_FIELD`) carries the search box, the
> Filters disclosure with its active-count badge, an optional trailing control (Orders' sort), the folded filter
> panel and the "N of M · Clear all" footer. Orders and Inventory both render it, so the two panes stopped being
> two designs — measured: identical button classes and one dropdown size (6px 8px / 12px) across both.
> ⚠️ Two of my own slips, both caught in the browser: `liveItems`/`liveScenarios` don't exist in Inventory (the
> collections are `liveInventory`/`liveLists`) — a white screen the build does not catch; and
> `npm run audit:jsx` reported `FILTER_FIELD` undeclared, which was a FALSE ALARM — its import pattern didn't
> understand `import Default, { Named }`. Fixed the script too: a tool whose job is to be believed can't cry wolf.
> Verified in local mode: subcategory suggests 6 Grip kinds; the date popover jumps 2011 → Mar → "March 2011";
> New kit has Name + Notes and no Category; the August grid shows white weekdays, grey 1-2 Aug, amber 3-4 Aug with
> "15 free / 2 out"; both filter bars share one look. 0 console errors, build clean, both Node suites pass.
> **UI — the studio calendar jumps by month and year too.** The date FIELD got this a change earlier; the
> calendar itself still only had ‹ › + Today, so a shoot two years out was 24 clicks away and a past season
> worse. The month/year chooser moved out of `DateField` into `src/components/MonthYearPicker.jsx` (one
> definition, one span of years: `THIS_YEAR + 3 … -30`) and the calendar's PERIOD LABEL became its trigger — the
> label was already saying which page you're on, so it's the honest place to change it. Same popover contract as
> DateField: `position: fixed` through a portal, outside-click and Escape to close. Picking a month keeps the day
> of the month, so the week view lands on a comparable week instead of always on the 1st; in month mode it just
> turns the page. Using ‹ › or Today folds the chooser away — those are a different intent.
> ⚠️ **Fixed a real staleness bug while testing it**: both handlers computed from `refDate` captured in the
> render closure, so picking a year and then a month faster than a re-render computed the month from the OLD year
> and silently lost the jump (verified: 2026 → Dec landed on Dec 2028). They now read
> `useStore.getState().selectedDate` at click time. Same trap as `ItemAvailability`'s `stepMonth`, third time in
> this codebase — if a handler derives from state and can fire twice before a render, read the store, not the
> closure.
> Also refactored `goPrev`/`goNext` into one `page(delta)` — they were the same body twice and both needed the
> new fold-away.
> Verified in local mode: the label opens 12 months + years 1996-2029; year 2028 → "Jul 31 – Aug 6, 2028", then
> Mar → "Feb 28 – Mar 5, 2028"; both clicks in ONE tick now give Dec 2026 (the bug above); month mode reads
> "December 2013" after a jump; Next while open pages AND closes it; Today returns to August 2026. 0 console
> errors.
> **FIX — the year list follows both the calendar year AND the year you're looking at.** Asked whether it
> "dynamically adds the next years". It did slide on its own (derived from `new Date().getFullYear()`, never
> hardcoded: +3 … -30, so next January the top moves up by itself) — but it ignored the year being VIEWED, so
> paging past 2029 with the arrows showed a list without the year you were on: nothing highlighted and no way
> back to it from the chooser. `yearsFor(viewed, today)` now returns the union of the standing window and a small
> band around the viewed year. Moved to `src/lib/years.js` because it is a pure rule and this codebase keeps
> those in lib/ where plain Node can assert them — 16 assertions incl. the slide (a fixed "today" of Jan 2027
> yields 2030…1997), viewing +9 / -40, and NaN/undefined.
> ⚠️ **Two more instances of the stale-closure trap, both found by this one question.** `page(delta)` computed
> from the render closure, so eight rapid clicks on › stepped ONCE and silently overwrote a month jump that had
> just happened (measured: 8 clicks moved one week; now they move eight). Everything that steps or jumps in
> StudioCalendar goes through `currentRef()` = `useStore.getState().selectedDate`. FOURTH occurrence in this
> codebase — the rule now written down: a handler that derives from state and can fire twice before a render must
> read the store, not the closure.
> ⚠️ And a self-inflicted one worth remembering: a scripted edit inserted `currentRef()` usage while its
> DECLARATION edit silently didn't apply (the anchor had changed shape), leaving a call to an undefined function
> — `npm run build` passed, `audit:jsx` can't see it. Caught by reloading the page. After a scripted multi-edit,
> grep for the identifier's declaration, don't assume the script's asserts covered it.
> Verified in the browser: 2029…1996 on the current week; paged 108 months to September 2035 → the chooser opens
> on 2037…1996 with **2035 present and highlighted**; 8 rapid › clicks = 8 weeks; Today returns to Aug 3-9 2026
> and folds the chooser. 0 console errors.
> **CHANGE — one tick per row in the packing checklist.** "Они просто хотят галочки потыкать, чтобы убедиться
> что всё принесли на сет" — so the three initials columns (6.2's OUT / OUT / RET, the paper form's double
> sign-out) are gone. This overrides that acceptance criterion on the client's say-so, and it costs nothing real:
> the RETURN side is the scanning station's record (scan-in stamps who and when, and closing an order refuses
> while anything is still out), so a second, weaker record of the same fact was worse than none.
> `PACKED_SLOT = 'out1'` in `lib/packing.js` — the tick reuses the column that already existed, `out2`/`ret` stay
> in `packing_signoffs` unwritten, and `packingProgress` returns `{ total, packed }`, counting a LEGACY double
> sign-out as packed so an order ticked before this change still reads right. NO migration.
> The printed sheet follows (one **PACKED** box per row instead of three, wider content columns, footer "tick each
> row when the piece is in the case", totals "N rows to tick") — a paper sheet that doesn't match the digital one
> means two documents get ticked. `describeEvent` now reads the slot as "packed"; the two old slot names still
> render for events logged before the change.
> Verified: 4 rows × ONE box, header "PACKED", "0/4 packed" → tick → "1/4 packed" with the tooltip
> "DU · 04.08.2026, 13:53 · tap to undo", and the order card agrees ("1/4 packed" — it counts the same rows).
> PDF asserted under Node from the generated bytes: PACKED head present, no OUT/RET columns, per-copy rows, 1
> page. Packing suite updated (legacy double sign-off, out2-alone, empty inputs). Demo data reseeded.
> **THREE FIXES on the company card / editor.** (1) **Removing a Type looked broken** — and the write was fine:
> `People.jsx` handed `CompanyEditorModal` the FULL `companyTypes`, archived rows included, so the × stamped
> `archived_at` and the Manage list kept rendering the row. Now it gets `liveCompanyTypes`, and the Manage list
> filters `notArchived` itself — it is the only place that shows that list, so it owns the rule.
> (2) **The client/vendor/both dropdown is gone**: "у нас нет клиентов, и не может быть оба одновременно". The
> editable **Type** list is the one classification that means anything, so the coarse axis went with its
> `KINDS` constant. ⚠️ The knock-on had to be fixed in the same breath: the sub-rental vendor pickers filtered on
> `kind === 'vendor' || 'both'`, and `companies.kind` is NOT NULL DEFAULT 'client' — so leaving the filter would
> have made every NEW company invisible as a vendor. Both pickers (Inventory's unit Vendor column and
> OrderEquipmentModal) now offer every live company. The column stays in the DB, unwritten and unread.
> (3) **A contact opens as a layered card**: from the Companies tab, clicking a contact used to jump to the People
> tab (`openPerson`); it now calls `peek({ type: 'person', id })` like related data does everywhere else, so the
> company card you were reading stays behind it.
> Verified in local mode: added "Catering probe" → × → it left the list; the editor shows one Type dropdown and no
> second one; a contact opens in the right-side card with the Companies tab still selected and "Open full view"
> available; the vendor picker now lists all **6** companies instead of 3. Demo data reseeded, 0 console errors.
> **CHANGE — every company and contact NAME is a link, in both directions.** Asked for the reverse of the last
> change and then generally: "с каждой строки где я вижу компанию или контакт я мог переходить". Audited every
> surface that renders one and closed the gaps:
> • the person CARD's company chip now peeks the company instead of jumping to the Companies tab (`openCompany`);
> • the person LIST row's company name is its own link — the row used to be one big `<button>`, which is exactly
>   why the company inside it couldn't be clickable (a button can't contain a button). It is a div now: the
>   person area is one target, the company name another. Measured, not eyeballed: both on one line, row height
>   unchanged at 56px;
> • the sub-rental VENDOR badge on an order's equipment line opens that company (it showed a company name and
>   did nothing); a line with no vendor picked yet stays a plain badge.
> Already linked before this and left alone: the company card's contacts, its order rows and gear, the order
> card's photographer / company / shoot, the calendar chips, and both peek cards (person ↔ company stack into each
> other). Deliberately NOT linked: the packing checklist's vendor name — it's a workflow surface, and a card
> stacked over a modal has no clean escape (the same rule as the equipment pickers).
> Verified in local mode: company name in a LIST row → company card; person card chip → company card with the
> People tab still selected; contact inside that card → "2 deep" with Back; Escape unwinds to where you started.
> 0 console errors.
> **FEATURE — every screen remembers where you were.** Reported: leaving a screen and coming back landed you on
> the first row again — "чтобы я возвращался на тот же заказ, на того же клиента, инвентарь". Two causes, both real:
> App.jsx renders ONLY the active view, so switching Orders → Inventory UNMOUNTS Orders and throws away its
> `useState` (selection, search, filters); and in supabase mode `partialize` persisted `{ activeView }` **alone**,
> so a reload reset everything else too.
> New store slice `viewState` (keyed by screen) + `patchViewState`, and `src/lib/usePersisted.js` — a drop-in
> useState replacement (`const [x, setX] = usePersisted('orders', 'search', '')`) that reads/writes that slice,
> supports the updater form, and reads the CURRENT value at call time rather than closing over it (the
> stale-closure trap, fifth appearance). Call sites kept their bodies verbatim; 21 state variables converted
> across Orders / People / Inventory / Scanning.
> Persisted now, in BOTH modes: `activeView`, `viewState`, `selectedDate` and `calendarMode`. Deliberately NOT
> persisted: open modals, half-typed drafts, `showDetailMobile`, the peek/nav stacks — restoring a dialog someone
> had open, or a form they abandoned, is not "where I was".
> ⚠️ The selections used to be SEEDED with the first record (`useState(() => orders[0]?.id)`); they now start
> null, so every resolver needed a first-visit fallback or the detail pane would open empty. Added to Orders,
> People (person + company) and Inventory's kit list; Inventory's item keeps its demo default (the 17-unit
> keyboard) as the fallback rather than plain alphabetical first. A stored id whose record is gone falls through
> to that same fallback, which is what makes an archived or deleted selection harmless.
> Verified in local mode: picked the 4th order + typed a search → Inventory (picked Aputure 600D Pro) → back to
> Orders: same order open, "4503" still in the box, "1 of 14 orders"; Inventory still on the Aputure; **reload** →
> everything still there (`viewState` in localStorage reads `{orders:{search:'4503',selectedId:'order-7'},
> inventory:{itemId:'aputure-600d'}}`); People on the Companies tab with Northlight selected survived a reload;
> the calendar kept Aug 17-23 across one. 0 console errors.
> **FIX — a filled ComboField could not be reopened, and free entry was invisible.** Reported on the inventory
> Subcategory field: once filled, "список больше не раскрывается, невозможно ее заменить". Reproduced exactly:
> the screenshot's value ("Aprons & Flags", a GRIP subcategory) with Category = Computers. `ComboField` filtered
> by the field's CURRENT value, and the popover only rendered `shown.length > 0` — so a value matching nothing in
> the list filtered it to zero and the list silently refused to open, with no way out but clearing the text.
> Two changes: filtering now happens only while TYPING (a new `filtering` flag reset on focus/click/chevron), so
> opening the list always shows everything whatever is in the field; and the popover renders even with no rows.
> (2) The "способ добавить новые пункты" already existed — the field is free text — but nothing said so, and issue (1) made it
> look broken. A typed value the list doesn't have now announces itself: "“Tablets” is not in the list — it will
> be added when you save." True as written: `subcategoryOptions` merges the taxonomy with every subcategory the
> register already uses under that category, so saving really does put it in the list.
> Applies to every ComboField (photographer / model too), which is the point of having one control.
> Verified in local mode: value from another category + Category=Computers → clicking the field opens the FULL
> Computers list (5 options) with the note; picked "Monitors" → replaced; typing "stor" → filters to
> "Storage & Media"; saved an item with a brand-new "Tablets" → stored as `{category:'Computers',
> subcategory:'Tablets'}` and reopening the modal offers Tablets as the 6th option. Demo data reseeded.
> **SWEEP — two reports, and everything the sweep turned up behind them** (no migration; frontend only).
> Reported: (1) "товар забукан в заказ на завтра, но теперь недоступен во все другие дни" — an item showing
> 1 out across a 10-day band; (2) the Inventory filter bar is narrower than every other tab.
> **(1) had TWO causes, and the interesting one is in current code.** The band itself is prod DATA: the order
> "test 3107" was raised on 31 Jul, when the form still took a date RANGE, and carries `starts_on 2026-08-06` /
> `ends_on 2026-08-15` with 69 `set_units` rows spanning it — so the availability calendar was telling the truth.
> The BUG is that the app could not put it right: `repository.setReservationsForSet`'s no-op guard compared the
> unit ids and the returned flag but **not the reservation WINDOW**. Gear is held per day, so moving a confirmed
> order's Set date changes nothing about WHICH units it holds — only WHEN — and the guard treated that as a
> no-op: the rows kept their old dates, leaving stock blocked on a day with no shoot and free on the day of the
> actual one. The window is now part of the comparison. Local mode was never affected (it derives windows from
> the booking), which is why this only ever showed on prod.
> Fixed while verifying, each found by a different tool rather than by clicking:
> • **`updateOrder` threw a ReferenceError on EVERY order edit in supabase mode.** `if (wrote.rateNotStored)`
>   had been pasted into it from `setOrderLines`, where `wrote` is declared — `updateOrder` has no lines and no
>   such variable. The write landed and then the function blew up, so the caller never got `{ok:true}`. The
>   message now lives with the write that produces it.
> • **The Lists tab was a white screen waiting to happen:** `liveScenarios` (the collection is `liveLists`) sat
>   in a ternary branch that only evaluates on that tab — the same leftover the earlier pass half-fixed.
> • **`Archive.jsx` had a SYNTAX ERROR** (orphan `))} />` left by the add-on removal) plus a stale
>   `archivedAddons` reference. It is unrouted, so Vite never parses it and `npm run build` passed for weeks.
> ⚠️ **`no-undef` is now ON in `.oxlintrc.json`** (`env: browser`, with a `node` override for `scripts/**` and
> `*.config.js`). oxlint always supported it; it simply was not enabled. It catches the exact class that has now
> bitten SIX times — `notArchived`, `livePeople`, `companies`, `currentRef`, `liveScenarios`, `wrote` — none of
> which `npm run build` or `audit:jsx` can see. `npm run lint` is clean; treat a new error as a real bug.
> **(2)** `FilterBar` carries its own `p-3` and Inventory nested it inside a `p-3` wrapper, so its contents were
> inset 24px against the tab strip's 12px (Orders renders it bare). It is now a SIBLING of the toggle's wrapper.
> Measured: Inventory's tab strip and search box both span 37→331, and both panes now inset 12px left and right.
> Also fixed, found by the sweep rather than reported:
> • **StockModal's disabled button gave no reason.** `error` was only set in `submit()`, which a disabled button
>   can never reach, so an impossible amount showed a rose "—" and nothing else. The reason renders on `tooMany`.
> • **A date-only order edit was logged as "confirmed the order"** — `statusEvent()` keyed on the submitted
>   status rather than on a MOVE. It returns `ORDER_UPDATED` unless the status actually changed, and the
>   `changed` list is now a real diff against the record (it used to name all eight fields the form submits).
> • **"Open the scanning station" opened the wrong order.** It called `setActiveView('scanning')` and the station
>   fell back to whichever confirmed order sorted first — a crew would scan gear against another job. New store
>   action `openScanning(orderId, from)` writes the station's `viewState` selection and pushes the back trail.
> • **"Reset demo data" left the activity log behind**, so an item restored to 24 on hand still showed
>   "added stock · 24 → 34". `buildSeedData()` now returns `activity: []`.
> Test assets (scratchpad, not committed — the repo deliberately has no test suite): **162 assertions** over
> every pure module in `src/lib` (+ `data/orderStatus`) and **31** over both PDFs, extracting text from the
> generated bytes. Three of those assertions were MY errors, not the code's, and are worth knowing:
> `resolveUnitsForQuantities` takes LINES not a qty map; `packingRows` returns GROUPS (`.lines`), and a row's
> reason field is `why`; `resolveScan` returns `{ok, unit, direction}`; `describeEvent(ev)` takes one argument
> and returns `{icon, title, detail}`; the estimate reads `order.number` (the repository maps `order_number`),
> and it deliberately does NOT print the sub-rental vendor — that is the client's document; the pull sheet does.
> Browser sweep in LOCAL mode, all five views and every modal opened: add-units (per-copy rows, previews that
> skip a typed barcode, duplicate refused with nothing written, 17→20 with placement + three logged events),
> unit history, repair log, stock in/out, kit + scenario editors (no Category), the order equipment window
> (copy pinning by pasted `#1017` dropping the pool 18→17, a per-line price moving the total 454→470, the
> sub-rental switch releasing pins, `Add anyway` reading "1 over capacity"), kit staging (picking a NON-first
> copy, and Broken→repair writing a real repair row from the ORDER flow), the packing checklist (2/5, the card
> agreeing), both PDFs, the scanning station (`#0851` pasted with its hash, duplicate refused, `#0999` named as
> a Wardrobe Rack), close blocked with "1 piece(s) are still scanned out" → scan in → closed → re-opened with
> the 5 reservations restored, peek cards 2 deep with Escape popping one, the calendar's month/year picker
> (2028 + Dec in ONE tick = Dec 2028; 8 rapid › = 8 weeks), two-step order creation from the calendar leaving
> 14 orders / 11 sets on cancel, a full RELOAD restoring view + search + selection, and the reseed returning
> 44 items / 17 keyboard units / tape at 24. 0 console errors; no horizontal overflow at 1280 / 768 / 375.
> ℹ️ **Still to do on prod:** the legacy "test 3107" order still spans 06→15 Aug. With the guard fixed, opening
> it and re-saving collapses it to one day and rewrites its 69 `set_units` rows — that is the repair path, and
> doing it through the UI both fixes the data and proves the fix. Everything else above is frontend-only.
> **(DONE — verified 2026-09-09: 0 jobs on prod have `ends_on != starts_on`.** And with multi-day shoots now
> supported, a span like that is no longer a data error to begin with.)
> **TOOLING — `npm run user:add` provisions ONE real account** (`scripts/add-user.mjs`, no migration).
> `seed-users.mjs` hardcodes the three demo logins and their shared password, so it is the wrong tool for
> adding a person later. The new script takes `--email` and `--name` (plus an optional `--role`, default
> `equipment_team`) and reads the password from the **`NEW_USER_PASSWORD` env var** — never hardcoded, never
> defaulted, never printed, so it stays with whoever runs it. It refuses without one, refuses under 10
> characters, and refuses a malformed email. `email_confirm: true` because the app sends no mail and
> self-registration was removed, so an unconfirmed account could never sign in. **Idempotent and deliberately
> non-destructive:** an existing account keeps its password (silently rotating someone's credentials is worse
> than doing nothing) and only its profile is upserted — password changes go through the Supabase dashboard.
> `profiles.role` takes any string since `20260724140000_flat_role.sql` dropped the admin/crew check, and the
> `fn_handle_new_user` trigger already inserts the row, so the upsert only corrects the name/role.
> Verified without creating anything: all three guards fire; the lookup + profile upsert path ran against the
> existing `ann.taylor@anntaylor.demo` ("exists — password left untouched") leaving prod at 6 profiles; and a
> quoted `--name "Clay Rodriguez"` survives `npm run … --` intact (npm's echo drops the quotes in the DISPLAY
> only, which looks like it split the argument and does not).
> ⚠️ Claude does not create accounts or handle passwords — the command is for the studio to run.
> **MIGRATION — the studio's REAL inventory replaced the demo register** (no schema migration; data + one
> constant). Source: `AnnTaylor_Inventory_Full.xlsx` exported from the old Mac system — 2 sheets, 2095 rows.
> ⚠️ **The export lists every item ONCE PER LEVEL of its category tree** (the same lens appears under
> `Strobes` and `Strobes - Profoto`), which is why the raw file looks like 734 items with 383 duplicate
> barcodes. Checked strictly before trusting it: **224 of 224** duplicated names are nested-category
> duplicates (one category is a prefix of the deepest), zero exceptions — so folding by name and keeping the
> DEEPEST category is provably safe, not a guess. Real content: **274 items — 73 barcoded with 435 copies
> (231 serials) and 201 counted with 1287 pieces on hand.**
> Normalisations, each reported rather than assumed: `ORGANIZED` is a shelf-status PREFIX, not a category
> (`ORGANIZED - GRIP - CLAMPS/PINS/PLATES` → Grip), so stripping it gave 41 items and 350 pieces a real home;
> `DIGITAL`/`GRIP`/`LIGHT MODIFIERS` were case variants of names already present; the 2 items under `DELETE`
> were dropped BY NAME in the report; a 4-level tree collapses to category + subcategory (levels 2..n joined
> with " / "). `Location` in the export is a STATUS, not a shelf — only `Available`/`Broken`, one broken copy.
> One genuine source error a human had to settle: barcode `0648` was on TWO items; kept on
> `Profoto Air Remote Transceiver` (inside its contiguous 0641-0648 run), and `Profoto Air Remote, TTL-C`
> imported with its other copy `0799` — the dropped copy is REPORTED, not silently lost, and needs a new label.
> **CATEGORIES is now the studio's own taxonomy (16), not the 7 invented for the demo.** More important than
> the constant: every category dropdown (filter + item editor) now MERGES it with the categories the register
> actually uses, exactly as subcategories already did — a filter built from a constant cannot find migrated
> stock, and this closes the class rather than the instance.
> ⚠️ **Archiving does NOT free a barcode** — `units.barcode` is `not null unique` table-wide, archived rows
> included. 100 imported barcodes were held by demo units, and they are physical labels on the client's gear,
> so renumbering was not an option. ⚠️ And `order_lines.inventory_item_id` is **ON DELETE RESTRICT**: with 121
> demo order lines alive, the demo ITEMS could not be deleted at all. Hence the shape of what was done, on the
> client's explicit "delete only the inventory, keep the orders": all 47 demo items + 321 units ARCHIVED (they
> leave every list, and their names still resolve on order lines — the archive architecture is built for this),
> then ONLY the 100 colliding units hard-deleted, which first needed 50 `set_units` rows cleared and 1 kit slot
> unpinned. ⚠️ That pin could not be nulled in place: a FIXED slot has a check constraint requiring a unit, so
> the slot was converted to GENERIC. Cost, stated up front: 93 of 143 reservations remain, 1 kit slot lost its
> pin, 2 demo repairs cascaded. Orders, lines, contacts, companies and accounts untouched.
> `scripts/import-inventory.mjs` is **DRY-RUN BY DEFAULT** and refuses to write while any validation error or
> barcode collision stands; it matches existing items by name among **LIVE rows only** — an archived namesake
> is retired stock, and reusing it would attach the imported copies to a row no list shows (caught by the
> dry-run: 4 demo items borrowed real names, including the 17-unit Magic Keyboard).
> ⚠️ **The data file is deliberately NOT in this repo — the repo is PUBLIC**, and a studio's barcodes and serial
> numbers have no business in it. The script takes `--file`. A full pre-flight backup of all 22 tables lives
> outside the repo too (`Downloads/prod-backup-*.json`, 611 KB) — the free tier has no backups.
> Verified on prod through the app's OWN richest `getInventory` select (whitespace-stripped, as supabase-js
> sends it): 321 rows / 274 live items / 435 live copies, full `units → set_units → sets` embed intact.
> ℹ️ **`day_rate` is null on all 274** — the export carried no price column, so estimates total $0.00 for
> migrated gear until rates are entered. Nothing was invented.
> **RENAME + FEATURE — an Order is a JOB, and jobs filter by Brand and Type**
> (`20260908120000_job_brand_type.sql`, applied and verified on prod).
> **The rename is USER-FACING TEXT ONLY — 69 curated strings across 16 files.** The `orders` table,
> `order_lines`, the `order.*` event types, `activeView: 'orders'`, the nav `id`, the `viewState` keys and every
> identifier still say `order`: renaming those rewrites stored data for zero visible benefit. `ARCHIVE_KINDS`
> keeps the KEY `order` and changes only its label, so `what: 'order'` in events already in the DB still renders.
> ⚠️ A terminology COLLISION had to be settled first: "Job" already named the shoot, so a Job card would have
> carried a "Job name" field inside a section called "The job". Settled as: the record is the **Job**, the field
> stays **Job name**, and that section is **"The shoot"** — which is what it lists (set date, studio, Set,
> photographer).
> ⚠️ **A mechanical pass was written, dry-run and THROWN AWAY.** Its JSX-text regex (`>…<`) spanned CODE between
> the brackets, so it would have turned `.order('name')` into `.job('name')` — breaking every PostgREST query in
> `repository.js` — and `est.order.poNumber` into `est.job.poNumber`. It also rewrote comments and would have
> produced "Build job #3". The curated list ASSERTS each of its 69 pairs, so a stale anchor is loud instead of
> silently skipped (two indentation mismatches were caught exactly that way). Lesson: for a rename, review the
> generated diff line by line before applying — the dry run is the deliverable, not the script.
> **BRAND + TYPE.** Neither could be derived from existing data: `company_id` holds agencies and rental houses
> (Atlas Model Management, Northlight Rentals), not the brand shot for, and the job-name convention
> (`20260716_AT_MAIN_SepMM_Missy_OMSet1`) encodes season and line. Both columns are FREE TEXT, not check
> constraints: `Editorial` and `PDP` ship as the offered types (`JOB_TYPES` in `lib/orderSearch.js`) but a closed
> list has been a dead end twice here (item categories, subcategories). `brandsIn`/`jobTypesIn` build the filter
> options from the REGISTER, so a dropdown can only offer a value that matches something, and both fields are in
> the free-text haystack — "nike editorial" answers without picking a field. (The studio stays OUT of the
> haystack, as before: a bare "2" matched every 2026 date.) Shown everywhere a job is: the form (ComboField with
> suggestions), chips on the list row, rows in the card and the peek card, and the meta table of BOTH PDFs.
> ⚠️ `getOrders`'s `withBrandType` is the OUTERMOST select layer — third time this rule has mattered: a column
> added last must be the first dropped, or a database without the migration loses equipment it does have.
> `createOrder`/`updateOrder` also strip the two newest columns and RETRY, because losing a brand is a missing
> field while a rejected insert is a crew that cannot write the job down at all.
> ⚠️ **`resolveOrder` in `store.js` is a WHITELIST.** The DB columns and the supabase path were correct and the
> values still vanished in LOCAL mode until they were added there too. Caught in the browser, not by the build —
> adding a column to `orders` means editing BOTH places.
> Fixed while here: the empty list said "No jobs **yet**" whenever a filter hid everything, because it tested only
> the search box and the status. It counts every filter now (studio, photographer and dates had the same flaw).
> ⚠️ **TESTS ARE IN THE REPO NOW: `npm run test:lib` (`scripts/check-lib.mjs`, 116 assertions), in CI ahead of
> the build** alongside `audit:tdz` and `lint`. The suites that would have caught a rename regression lived in the
> scratchpad and vanished with the session — they protected the change that prompted them and nothing after it.
> They pin the labels (every `EVENT` renders a title and none of them says "order"), the two new filters, the
> money, both PDFs' meta rows, and the packing/availability/year rules. One assertion was MY error, worth
> keeping: `packingRows` emits a THIRD row for a piece asked for beyond what is reserved — it must say
> "no unit reserved", not vanish off the sheet.
> Verified in local mode end-to-end (nav reads Jobs, zero "Order" in the DOM, section "THE SHOOT", brand+type
> saved → chips on the row → rows in the card → brand filter gives 1 of 14, "Filters 1", demo data reseeded) and
> on prod through PostgREST (columns accept and filter values, probe reverted — 0 jobs carry either field) plus
> the served bundle (`Any brand`, `Any type`, `The shoot`, `Job ref`, `New job` present; `New order`, `Order ref`,
> `No orders`, `Close order` absent).
> ℹ️ `day_rate` is still null on all 274 migrated items, so estimates total $0.00 until rates are entered.
> **DECISION — the DATABASE keeps saying `order`, deliberately.** Asked whether renaming the columns too
> matters "for scalability". It does not: a table name has no effect on capacity, integrity or performance —
> it affects human comprehension, which is a different axis. The mismatch is ONE word (`orders` = Job), it is
> documented, and the cost is ~40 queries, every FK (`order_lines.order_id`, `sets.order_id`,
> `packing_signoffs.order_id`, `scans.order_id`), a data migration for the `order.*` event types (69 rows) and a
> reset of every client's persisted `viewState`/`activeView` keys — each one a chance to break working software.
> **Do it only when it becomes cheap or necessary**, and then bundle it with a migration that is already
> touching the schema. Two triggers to watch for: PostgREST exposes table names AS endpoints, so
> `/rest/v1/orders` leaks the old word the moment a partner gets API access; and an analyst reading the DB
> without the app would meet it too.
> ⚠️ **What actually limits growth — measured, not guessed:** there is NO multi-tenancy (zero mentions of
> tenant/organization/org_id across 30 migrations) and **62 RLS policies are `using (true)`**, so a second
> studio would see the first one's gear — that is the real wall, and the migration is cheapest while the row
> counts are small. Second: the SAME logic is written twice (**54 `usingSupabase` branches** in store.js), which
> has already produced three one-mode-only bugs (the reservation-window guard, `resolveOrder`'s whitelist, live
> confirm→reserve). Third: one free-tier database serves both the demo and real data, with no backups. Fourth:
> one flat role. All four outrank the naming.
> **CHANGE — a shoot can run for SEVERAL DAYS, and a set is defined by dates, not times**
> (`20260909120000_multi_day_sets.sql`, applied and verified on prod). Requested: "Support multi-day job
> creation / заменить выбор даты и времени начала-конца сета на выбор даты начала и даты конца".
> This reverses the earlier "a shoot is ALWAYS one day" decision, and it was cheap because that decision only
> ever lived in TWO places: the form, which wrote `ends_on = starts_on`, and `sets`, which has one `date` and
> could therefore only put a chip in one calendar cell. Everything downstream already read a WINDOW —
> `orders.starts_on/ends_on`, `set_units.reserved_from/reserved_to`, `isUnitFree(window)`,
> `estimate.billableDays`, `orderSearch`'s overlap test and both PDFs' "A to B (N days)" fallback.
> **The times are gone, not hidden.** `sets.start_time/end_time` were fiction: the grid is studio × day, not
> hourly, and an order-created set got a hardcoded 09:00–18:00 because nothing collected one. Both the job form
> and the legacy `BookingModal` now take **First day / Last day**; the columns stay (nothing here deletes data)
> but nothing writes or reads them, so `TimeField.jsx` was deleted rather than left to read as live.
> `sets.end_date` is nullable and **NULL means "ends the day it starts"** — which is what all 20 existing rows
> mean, so there is no backfill and a browser still holding yesterday's bundle keeps working. It is the
> OUTERMOST `getBookings` select layer (4th time that rule has mattered): a database without the migration
> degrades to one-day sets instead of losing the roster and the reservations with them.
> **The calendar puts the chip in EVERY day the shoot covers**, labelled "Day 2/3" — a grid that showed the job
> only on its first day would read as FREE for the rest, which is the whole point of supporting a span.
> `byDay` expands each booking over `setDays(date, endDate)`; the chips' second line is the day counter + Set
> label where the time range used to be, and the span is in the tooltip.
> **Capacity is per studio per DAY, so a multi-day job has to clear every day it covers.** New pure
> `src/lib/setDays.js` (`setDays`/`setSpanDays`/`coversDay`/`windowsOverlap`/`firstFullDay`/`spanLabel`,
> `MAX_SET_DAYS = 60` so a mistyped year can't render 3600 chips) + store `setsUsedOn`/`capacityError`, used by
> create, edit AND the pre-flight check in `Orders.jsx`. The message NAMES the full day ("Studio 1 already has
> 5 sets on 2026-09-08") — without that the crew has to guess which end of the range to move. Two fixes fell
> out of writing it: the shoot being edited is EXCLUDED (`excludeSetId`), or stretching a job by a day would
> report the studio as full of itself; and archived shoots no longer count, which had been quietly shrinking a
> studio's day. Editing now checks capacity at all — it never did, so the old guard was bypassable by booking
> one day and extending it, which the range field makes an obvious move.
> ⚠️ **Fixed a real Supabase-only gap found while wiring this:** `updateOrder` wrote the `orders` row and
> nothing else, so editing a job's date moved its `set_units` and left the shoot on the OLD day of the
> calendar. Local mode had always mirrored the set in memory. New repository `syncSetForOrder` (job name,
> studio, window) closes it — the roster is deliberately left alone, that needs a contact id and is its own
> write. This is the "same logic written twice" class again (54 `usingSupabase` branches).
> `countSetsOn` was replaced by `activeSetsInRange`, which fetches the overlapping sets and judges them with
> the SAME `capacityError` local mode uses, so the two modes cannot drift.
> **28 new assertions (144 total).** One of them pins `setSpanDays === billableDays` for the same range: what a
> shoot OCCUPIES and what it BILLS are two rules in two files, and they must never disagree.
> Demo content: two seeded shoots now span days (`days: 3` in Studio 1, `days: 2` in Studio L) — chosen so no
> order goes short, since a longer hold competes with the other days' orders for the same stock.
> Verified in local mode by measurement: the 3-day job renders Day 1/3–3/3 across Mon–Wed and the keyboard's
> availability grid moved from 2/1/0 out on Sep 7/8/9 to **2/3/2**, arithmetic matching the orders on those
> days; stretching it to 5 days through the form moved the chips to five cells, the card to "Set dates ·
> 5 days", the estimate to "5 billable day(s) · $520.00" and Sep 10/11 to 7/4 out; creating a 3-day job from
> scratch wrote it across next week's grid; with the cap temporarily set to 1 the range was refused naming the
> full day, while shrinking that same job was allowed (the exclude rule). Reseeded afterwards; 0 console errors.
> On prod, behaviourally as the app's own `authenticated` role: the top `getBookings` layer returns 20 sets,
> all 20 with `end_date` null; a 3-day window wrote and read back; `end_date < date` was refused with **23514**;
> the capacity lookup answered over the range; then reverted — **0 sets carry a multi-day window**, prod exactly
> as found.
> Also fixed while here: the Jobs header still read "14 **orders**" (a miss from the 69-string rename), and
> three pieces of dead code went — `TimeField`, `KitRow`/`ItemLine` in `OrderEditorModal` (leftovers from the
> inline equipment block) and an unused `openOrder` selector in the calendar.
> ℹ️ The legacy "test 3107" span is GONE — checked rather than assumed: **0 of prod's jobs now have
> `ends_on != starts_on`**, and 0 of its 20 shoots carry an `end_date`. So the repair noted earlier in this
> file is no longer outstanding, and every prod shoot is a one-day set until someone books a range.
> **FEATURE — call times per ROLE, and a shoot wrap time**
> (`20260910120000_call_times.sql` + `20260910130000_call_times_roles_not_empty.sql`, both applied and
> verified on prod). Requested: "Replace generic time field with call times (producer / photographer / crew)
> + shoot wrap time … отдельные поля под call time сотрудников … неограниченное количество … нажимаю +,
> выбираю роль photograph и задаю время его вызова 8 утра, нажимаю еще + … модель, стилист (мультивыбор) —
> 9 утра … а могу вообще не задавать. Отдельно задаю shoot wrap time."
> The previous change took the generic start/end pair OFF a set because it was fiction; this puts time back
> where it means something. A shoot does not "start at 09:00": the producer is called at 07:30, the
> photographer and digital tech at 08:00, hair/makeup and styling at 08:30, the models at 10:00 — and the day
> wraps at some hour. That is a LIST of unknown length, and it is allowed to be empty.
> **`set_call_times`: one row per call, with `roles text[]`.** The crew sets ONE time for "model + stylist",
> so splitting that into two rows would have the UI grouping them back on every read. These are the CONTENTS
> of a shoot, like `order_lines` are the contents of a job — replaced wholesale on save, so they keep DELETE
> (the archive-not-delete rule covers rows with their own identity and card, which a call time has not).
> **`sets.wrap_time` is a NEW column, deliberately not a reuse of `end_time`:** that one holds the 09:00–18:00
> defaults `createSetForOrder` invented for shoots nobody typed a time into, and reading those back as "the
> crew said they wrap at 18:00" would be fabricated data. `start_time`/`end_time` stay as the legacy record,
> unread. `TimeField.jsx` came back out of git — deleting it one commit earlier was right (nothing collected a
> time) and it is needed again now.
> New pure `src/lib/callTimes.js` (+23 assertions, **167 total**): `normalizeCallTimes` drops half-filled rows
> rather than storing blank lines on a call sheet, de-duplicates roles and sorts the day; `earliestCall` is the
> one number a calendar chip has room for; `wrapBeforeFirstCall` is REPORTED, never clamped — clamping would
> invent an hour nobody typed. `rolesFor` merges the offered roles with every role already stored, so a typed
> one keeps being offered.
> UI: `CallTimesField` is shared by the job form and the legacy shoot editor, so both have one control and one
> set of rules. Roles are **toggle chips, not a dropdown** — the vocabulary is ten short labels and a call
> routinely names two or three at once, so a multi-select popover would be three clicks and a mystery — plus a
> "+ other" free-text chip, because a closed vocabulary has been a dead end three times here. Shown on the job
> card (Call times / Wrap rows, "not set" when empty), as its own section on the shoot peek card, and on the
> calendar chip as the earliest call with the whole sheet in the tooltip. NOT on either PDF: a call sheet is a
> different document from a pull sheet, and that was not asked for.
> ⚠️ **SIXTH instance of the stale-value trap, and this one was user-visible.** Every mutator mapped over the
> `value` PROP, so two role chips clicked before a re-render both computed from the same array and the second
> silently dropped the first (measured: `["Assistant"]`, then `["Assistant","Client","Gaffer"]` after the fix).
> `onChange` now takes an UPDATER which the parent applies against its current form state. The rule in this
> file — "a handler that derives from state and can fire twice before a render must read the current value" —
> applies to a controlled child's props too, not just to store reads.
> ⚠️ **A CHECK constraint that read as a guarantee and was a no-op.** `check (array_length(roles, 1) >= 1)`
> looks right; for an EMPTY array `array_length('{}', 1)` returns **NULL** (dimension 1 doesn't exist), and a
> CHECK treats NULL as satisfied — so `roles = '{}'` was accepted. Found by probing the real database rather
> than trusting the DDL, one hour after applying it. `cardinality(roles) >= 1` is a real test (0 for an empty
> array). Fixed in a SECOND migration because the first was already applied — editing an applied file would
> leave prod and the repo describing different schemas.
> Verified in local mode by measurement: the seeded 3-day job's chip reads "07:30 · Day 1/3 · OMSet1" with the
> full sheet on hover, its peek card lists all four calls plus "18:00 wrap", the form loads them back into five
> editable rows with the right roles ticked, a new call (11:15 · Client + Assistant + a typed "Gaffer") saved
> and sorted itself into the day, an empty row says "this row won't be saved" and is dropped, and a wrap of
> 05:00 against an 07:00 call says "That is before the first call". The legacy order-less shoot editor loads
> and saves the same sheet. 0 console errors.
> On prod, behaviourally as the app's own role: the top `getBookings` layer (new column AND new embed) returns
> 20 shoots; three calls + a wrap wrote and read back as "07:30 Producer · 08:00 Photographer, Digital tech ·
> 10:00 Model, Stylist" with the note intact and `roles` back as a real array; a call with no roles is refused
> with **23514** (after the constraint fix — accepted before it); the app's own wholesale DELETE works. Undone:
> **0 call times and 0 wrap times on prod**, exactly as found.
> Demo content: 3 of the 11 seeded shoots carry a call sheet (one with a note), one carries only a wrap, and
> the rest deliberately carry nothing — a shoot nobody has scheduled yet is a real state.
> **CHANGE — the calendar is "Calendar", its chips are painted by STATUS, and the status is editable from the
> grid** (NO migration — see below). Four requests, one screen.
> (1) **Renamed** to Calendar: the nav label, the heading and the back-trail label. The component file stays
> `StudioCalendar.jsx` — same rule as the `orders` table, an identifier nobody reads.
> (2) **Chip colour = job status.** `orderStatus.js` has carried a `calendar` hex per status since 5.5,
> written for exactly this ("epic #7 pulls the same colour into the studio calendar") and never used: the week
> chips took a per-shoot SEED colour and the month chips a per-studio one — a decorative rainbow that said
> nothing about the week you were looking at. Both grids now read `orderStatusColor`: **Hold amber, Confirmed
> emerald, Closed slate, Canceled rose.** A shoot with no job at all gets `NO_STATUS_COLOR` (neutral) rather
> than a colour borrowed from a status it isn't in, and a LEGEND sits next to the toolbar — colour-coding
> without a key is decoration, and its tooltip carries the instruction for (3).
> **"Canceled" needed no migration and no new vocabulary:** it was already in `ORDER_STATUS` with its rose
> pill and already allowed by the check constraint from `20260731120000` — it simply was never OFFERED.
> New `ORDER_STATUS_CHOICES` is the one list the card's pill dropdown and the calendar's menu both read, so the
> two surfaces can never offer different sets (the card's list was `[...ORDER_FLOW, CLOSED_STATUS]`).
> (3) **Status from the grid, three ways in, deliberately:** right-click (what a desktop hand reaches for), a
> long-press (the only equivalent a phone has), and a visible chevron on every chip (for everyone who tries
> neither, on either device — and a hover-only control does not exist on a touch screen). A plain tap still
> opens the job: that is the common action and it stays one tap. `src/components/StatusMenu.jsx` opens at the
> POINTER rather than under a trigger, which is why it is not `SelectField` — same popover contract otherwise
> (portal, `position: fixed`, outside-click, Escape, clamped to stay on screen). `src/lib/useLongPress.js`
> holds the gesture (in lib/ with the other hooks: exporting a hook beside a component breaks fast refresh).
> The tap that ENDS a long-press is suppressed with `preventDefault` on touchend — which is NOT passive in
> React, unlike touchstart — or the menu would open with the job card behind it. The chevron's glyph stays
> 16px so it cannot cover the job name in a narrow cell; `after:-inset-2` extends the touch area past it.
> Both grids now render ONE `BookingChip`, because the gestures have to be identical.
> ⚠️ **The close rule moved INTO the store.** `updateOrder` now refuses to close a job while units are still
> scanned out. The job card had only greyed its dropdown row and named the reason — so the calendar's status
> menu would have been a way around a rule that was enforced visually. The card keeps the greyed row (a reason
> before the click beats an error after it); the store is what makes it true. Same reasoning as
> `setOrderLines`' closed-job guard.
> (4) **A chip opens the JOB**, not a card for the shoot: `peek({ type: 'order' })`. And the shoot card's
> header now reads **Shoot** — `TYPE_META` had `order: 'Job'` AND `job: 'Job'`, two card types under one
> label, which is exactly what made the old click read as a pointless hop ("открывает Job, хотя по факту такой
> сущности в системе нет"). The shoot card is still reachable where it belongs: the job's own "Shoot" row, the
> item availability calendar and the unit history.
> ⚠️ **A defect in my own outside-click guard, found by my own test dispatch:** `ref.current.contains(e.target)`
> THROWS when the target is not a Node, which a synthetic event produces. Guarded with `t instanceof Node`,
> closing unless the click is provably inside. The same one-liner is missing in SelectField / DateField /
> ComboField / MonthYearPicker — unreachable from real input (a real mousedown always targets an Element), so
> left alone rather than swept.
> **19 new assertions (186 total)** on the colour contract: the four choices in the order a job travels through
> them, their four labels, four DISTINCT colours (or the coding says nothing), chip colour === the pill's own
> definition for every status, and an unknown status still getting a colour instead of an `undefined`.
> Verified in local mode by measurement: nav and heading read Calendar; chip backgrounds are
> `rgb(16,185,129)` / `rgb(245,158,11)`, the hexes from `orderStatus.js`; right-click → a menu listing the four
> with the current one checked → **Canceled** → that chip's inline style became `rgb(244,63,94)` and its set
> released all 7 units it held; the chevron opens the menu WITHOUT opening the job behind it; a synthetic 450ms
> long-press opened it too, and the tap that ended it came back `defaultPrevented`; at 375px every chip keeps
> its chevron, a probe 5px outside the glyph still hits the button, the menu fits entirely on screen and there
> is no horizontal overflow; a plain click opens the JOB card (header JOB · PO · THE SHOOT · EQUIPMENT · 8 PCS)
> with no shoot card in between; and closing from the calendar with #0851 scanned out left the status
> `confirmed` and printed "1 piece(s) are still scanned out". Demo data reseeded, 0 new console errors.
> On prod (no schema change to make): **22 jobs — 9 hold, 10 confirmed, 3 closed, 0 canceled**, so the grid
> reads amber/green/grey today; writing `status = 'canceled'` as the app's own role was ACCEPTED and an
> invented status refused with **23514**; the probe put the row back and the counts are identical.
> ℹ️ My probe printed a false "NO" on that last check — it compared two JSON strings whose KEY ORDER differed
> (one query was ordered, the other wasn't). The values matched. Compare counts, not serialisations.
> ⚠️ The stale-DOM-read trap again while verifying: a chip read emerald in the call that clicked the menu item
> and rose in the next one. React had not flushed. Split the click and the measurement, always.
> **FIX — a dropdown is as wide as its LABELS, not as wide as its trigger.** Reported on the status pill:
> the list read "Hold / Conf… / Clos… / Can…". `SelectField`'s popover took the trigger's width, which is
> right for a full-width form field and wrong for a 97px pill — the four labels arrived in a box that could
> not hold them. The trigger's width is now a **minimum** (`minWidth` + `width: max-content`), so a form
> field still gets a field-wide list and a small trigger grows to its longest label; `maxWidth` caps it at
> 24rem, the row keeps its ellipsis for a label long enough to need one (a disabled row that explains itself),
> and every row now carries a `title` so a clipped label is still readable.
> ⚠️ **Two things this needed that the obvious version missed.** (1) `width: max-content` did NOTHING at
> first: the label span was `flex-1`, i.e. a flex BASIS of 0, and a flex item with a zero basis contributes
> nothing to its container's max-content width. `flex-auto` makes the label count towards the intrinsic width
> while still shrinking when the cap bites. (2) Growing can push a list off the right edge, so it is measured
> once it exists and slid back — from `offsetWidth`, which does not depend on the shift, so re-running the
> measurement cannot walk the popover across the screen. That clamp is skipped below a 200px viewport: a
> HIDDEN browser pane reports `innerWidth: 0`, and the first version dutifully computed a negative bound and
> parked the list at x = -105.
> Measured: the status pill's list went 97 → **115px with none of the four labels truncated**, and the Jobs
> filter's status dropdown still matches its 164px field exactly (164 → 164), so nothing that was already
> right changed.
> **FEATURE — a DAY view: everything happening on one day** (frontend only, no migration). Requested:
> "Add day view (all shoots + style-outs per day, including L-row location shoots) / для отображения всех
> сетов на конкретный день (текущий по дефолту)".
> The toggle is **Day / Week / Month**, narrowest first. Picking **Day** jumps to TODAY — a day view opened
> on last month's Tuesday is not what anyone means by it — while a **day header in the week grid** and the
> **date badge in a month cell** open the day they name (the rest of a month cell still jumps to its week, as
> it always did). ‹ › step one day in this mode.
> The pane groups by studio and lists **every studio, including the empty ones** — "what is free today" is
> half of what this view answers, and a free studio offers **Book it** straight into the two-step create flow.
> Studio **L is always there**: that is where the location shoots sit, and a day view that dropped it would
> hide exactly the row the request named.
> Each set is a card with what the grid has no room for: the **whole call sheet** (every call time with its
> roles and note, then the wrap), the Set label, the shoot TYPE, the brand, the PO, "day 2 of 3 · Sep 10 – 11"
> for a span, the photographer and model, and the gear. It reuses the same status pill AND the same status
> menu as the chips (right-click / long-press / chevron), so there is one way to move a job. Clicking a card
> opens the job.
> **A style-out is a TYPE, not a second kind of record.** It books a studio for a day, has a call sheet and
> pulls gear exactly like a shoot, so `JOB_TYPES` gained `'Style-out'` beside Editorial and PDP (still free
> text, still merged with whatever the register uses) and the day card shows the type as a chip. That is what
> lets "all shoots + style-outs" be one list rather than a parallel entity. ⚠️ If a style-out is something
> else in the studio's own model — no studio, no gear — this is the assumption to correct.
> ⚠️ **A defect in my own card, caught by measuring rather than reading:** it printed
> `(b.unitIds || []).length` as "N pc(s) held", and that list is NOT what a job holds. A CLOSED set keeps its
> units as history flagged `unitsReturned`, and a HOLD reserves nothing — so a job I had just moved to Hold
> still claimed "8 pc(s) held". (Its 8 came from a sibling sub-rental order on the same set being `fulfilled`,
> which flags the set returned.) The card now reads "N pc(s) went out · back on the shelf" for a returned set
> and "nothing held yet" when the job holds nothing.
> The test suite caught the other half: two assertions pinned the two-type list, which is exactly the net
> working — they now pin three.
> Verified in local mode: **Day / Week / Month** all present, Day landing on "Thursday, 10 September 2026"
> with "2 shoots · 4 studios free", all six studios listed and Studio L carrying its 2-day shoot with
> "06:45 Crew · Load-in through the freight door · 08:00 Photographer, Assistant · 20:00 wrap · day 1 of 2";
> ‹ › moved to Friday; the week header (Sep 10) and a month date badge (9) each opened that day; the status
> menu opened from a day card and setting Hold wrote through; setting a job's Type to Style-out showed it as a
> chip on its day card; a card click opened the JOB card. Demo data reseeded, 0 new console errors.
> ℹ️ **Open question left with the studio:** the app labels the sixth studio "Studio L" and this file has
> called it "a large studio" since V1 — but the request says "L-row **location** shoots". If L means
> LOCATION, its label should say so (and it probably should not consume studio capacity the same way).
> Not renamed on a guess.
> **CHANGE — Equipment, Estimate and the pull sheet are ONE module; the pull sheet works at every status
> but Canceled; and stock, vendors and a scanner all work from inside the equipment window** (frontend only,
> no migration). Five requests.
> (1) **One module, no comment.** Three bordered boxes made the same list read as three unrelated things:
> the equipment IS what the estimate prices and what the pull sheet lists. Now one card — header
> "Equipment · N pcs · N lines · N billable days", the lines, then an estimate strip (total + Estimate PDF)
> and a pull-sheet strip (N/N packed + the two buttons). The explanatory paragraph ("Two forms of the same
> pull sheet…") is gone; the buttons say what they are.
> (2) **"Edit equipment" moved into the job header**, beside Edit — both are "change this job", and one of
> them was buried three sections down. A closed job shows **Equipment locked** there instead.
> (3) **The pull sheet is available at EVERY status except Canceled.** It used to require Confirmed, which
> just moved the work off the system: a crew pulls gear before the paperwork is signed. Before confirming,
> no copies are reserved, so the sheet lists what to pull without naming which piece — said in four words on
> the strip ("not confirmed — no copies reserved yet") and per row in the checklist ("no unit reserved"),
> which `packingRows` already emitted for exactly this case. Canceled is the one state with nothing to pull.
> (4) **Stock and vendors are created from inside the equipment window.** Both used to dead-end: gear that
> isn't in the register yet, or a rental house nobody has filed, sent the crew to another screen and lost
> this window's picks. The picker now offers **New item "<what you typed>"** (the search text becomes the
> name — `AddInventoryModal` gained a create-mode `prefill`) and the vendor dropdown offers **+ New vendor…**.
> Both open the SAME editors the Inventory and People screens use, layered over this window: they own the
> fields, the validation and the store call, and a lesser copy here would drift from them. A created item is
> added to the order in the same commit — the line only needs the id, and `inventory` arrives through a prop
> from the store, so the row resolves its name immediately.
> (5) **Scan gear onto the order.** One input beside "Add item": the code names one physical copy, so the
> item goes on the order AND that copy is pinned to it. Same three rules as the station and the kit window,
> for the same reasons — `normalizeBarcode` (a code copied off the screen carries the decorative `#`), a
> value that IS a known barcode fires without an Enter (a reader sends one, Ctrl+V doesn't), and every
> outcome is REPORTED: pinned, already on this order, already in a kit, written off, not in the register, or
> not free for these dates (naming the job that holds it — the item can still be added by name, which is the
> deliberate over-capacity choice).
> ⚠️ **A pre-existing bug my own feature made the normal path.** Pinned copies join `claimed` so no other
> line or kit can grab them — but `overFor` subtracted that same set from what the order ASKS, so a line
> reported ITSELF over capacity for every copy it named. Invisible while pinning was a rare manual step;
> the moment a scan pins by default, a scanned Canon read "1 over capacity". A line's own pins are put back
> before the comparison now. Measured: `7 pcs · $303.00 · 1 over capacity` → `7 pcs · $303.00`.
> Verified in local mode on a HOLD job: the header carries Edit equipment + Edit; the module reads
> "EQUIPMENT · 6 PCS / 4 lines · 1 billable day → ESTIMATE $291.00 → PULL SHEET 0/4 packed · not confirmed —
> no copies reserved yet"; the digital checklist opens with 4 rows each marked "no unit reserved"; pasting
> `#0851` with its hash and no Enter added the Magic Keyboard and pinned that copy (6 → 7 pcs, $291 → $303),
> the same code again said "already on this order" and `#4242` "isn't in the register", neither adding
> anything; typing "Profoto B10X" offered `New item "Profoto B10X"`, the editor opened with the name filled
> in, and creating it reported "added to the register and to this order" (7 → 8 pcs); switching a line to
> Sub-rental → **+ New vendor…** → "Lumen Rental House" created and selected on that line ("1 sub-rental").
> A CLOSED job shows "Equipment locked"; a CANCELED one shows "Canceled — nothing to pull." with both
> buttons gone. Demo data reseeded (the test item, vendor and status change gone), 0 new console errors.
> **FEATURE — a time PICKER, so nobody types the colon** (frontend only, no migration). Requested: a
> dropdown to choose the time, "на мобилке как листающаяся вниз история", convenient on a desktop too, and
> "во всех местах где есть такое поле" — which is one place: `TimeField` is the app's only time input (the
> call sheet's rows and the shoot's wrap), so the control owns it and every future field gets it free.
> **Two columns — hour, then minute — not one list of 96 slots.** 19:45 is two short scrolls instead of a
> long hunt, and each column is a thumb-sized flick on a phone. Rows are 40px because this list is used with
> a thumb (the 16px-target lesson). **One tap on an hour is already a valid time** (`HH:00`), the second
> refines it, so the common case is two taps and no typing. Minutes come in 5s; anything else stays typeable.
> ⚠️ **The minute column is INERT until there is an hour** — tapping ":15" on an empty field would need an
> hour invented for it, and this codebase does not invent values. An empty field's lists open at **08**, not
> 00:00: a studio calls people in the morning, and opening at midnight would make every pick a scroll.
> **Typing still works and no longer needs the colon:** `parseTimeInput` (pure, in `lib/callTimes.js`) reads
> "8" → 08:00, "830" → 08:30, "0830" → 08:30, "8:5" → 08:05, "19.45" → 19:45, "08:00:00" → 08:00 (a Postgres
> `time` someone pasted), and snaps on blur or Enter. Text it cannot read is **left alone** — the form already
> says what is wrong, and overwriting a typo with a guess hides it. ArrowDown/Up nudge ±5 minutes (`stepTime`,
> wrapping at midnight) so a value is corrected without retyping. **+32 assertions (218 total).**
> ⚠️ One of those assertions caught a real edge in my own parser: `"1:2:3:4"` became `01:02` — a value
> invented out of junk. Up to three parts is a time with seconds; four is not a time.
> ⚠️ **A pre-existing defect in EVERY popover in the app, found and proved while testing this one.** They all
> re-placed themselves with `window.addEventListener('scroll', fn, true)` — and a scroll INSIDE a container
> never reaches a capture listener on `window`. Measured with a probe: **0 hits** while the field moved 60px,
> so the list stayed where it was while the modal behind it scrolled away. `document` IS on the propagation
> path, which is why it is the idiom. Fixed in all six (`TimeField`, `SelectField`, `DateField`, `ComboField`,
> `StatusMenu`, the calendar's month/year picker) — one word each, and the class rather than the instance.
> Verified after: the field moved 260 → 190 and the list followed 264 → 194, still anchored 4px below.
> ⚠️ And a second one I introduced and measured: placement in TWO passes (place, then a separate effect that
> slid it back on screen) left the list at **x=417 on a 375px screen** — the clamp only re-ran when the
> coordinates changed, so a viewport change never re-evaluated it. One function owns both now.
> Verified in local mode by measurement, desktop and phone: two columns (24 + 12 rows, 40px each, 138×268),
> opening scrolled to the selected 16:00, tapping 19 gave "19:00" with the list still open, tapping 45 gave
> "19:45" and closed it; an empty field showed nothing selected, inert minutes and both lists at 08/00;
> "830" + blur became "08:30"; ArrowDown/Up moved 08:30 ↔ 08:35; at 375px the list opens at x=72 fully on
> screen, columns flick, and it follows the modal's scroll. Demo data reseeded, 0 new console errors.
> ℹ️ **Browser-tool lessons, both of which sent me down a wrong path first.** React maps `onBlur` from
> **focusout**, so a dispatched `blur` never reaches it — and `element.blur()` does nothing in this pane at
> all, because `document.hasFocus()` is false while the pane is hidden. Dispatch `focusout` (it bubbles).
> Second: a programmatic `scrollTop` change fires its event asynchronously, so measuring in the same call
> reads the old position — the third time this session that a same-tick measurement misled me.
> **TWO FIXES in the equipment window, both found by using it on prod.**
> (1) **Creating a vendor discarded every unsaved pick.** With the window open, "+ New vendor…" on a
> sub-rental line dropped the line that asked for it and the footer fell back from 7 pcs to 6. Cause: the
> effect that seeds `itemLines`/`stagedUnits` from the job's SAVED lines listed **`kits`** as a dependency —
> and `kits` comes from the store, where `hydrate()` hands out a NEW ARRAY every time, including the quiet
> refetch that `createCompany` AND `addInventoryItem` perform from inside this very window. That fresh
> identity re-ran the effect and re-seeded from the last saved state. `open` and `order` are the real
> triggers and both are snapshots held in the parent's own state; `kits` is read only to name a staged kit.
> ⚠️ A grep worth repeating: an init effect that seeds form state must not depend on a STORE COLLECTION.
> `OrderEquipmentModal` was the only editor that did (`UnitHistoryModal` depends on `bookings` but only
> refetches read-only rows, and `BookingModal`/`AddInventoryModal` take snapshots or a string).
> (2) **A quantity stepper lost clicks.** Two clicks on a line's + before a re-render took 1 → 2, not 1 → 3:
> `stepLine` read `itemLines[index]` from the render closure, so both computed the same next value. SEVENTH
> instance of the trap. Local state has no `getState()`, so the lines now also live in a **ref** that every
> write updates — `setItemLines` keeps its exact shape (a value or an updater) and no call site changed, but
> an updater runs against the CURRENT lines. The capacity guard judges the quantity as it stands, because
> each + consumes another piece.
> ⚠️ **An intermediate version of that fix was wrong and the browser said so:** it put the whole step inside
> the updater and reported the capacity block out through a closure variable. React runs an updater during
> the RENDER phase, so the flag was still null when it was read — the zero-availability dialog never appeared
> and the click just did nothing. A side effect cannot be driven by a value an updater assigns.
> Verified on prod: with the fix deployed, an unsaved 6 → 7 bump AND a newly added line both survived
> creating a vendor, and the vendor landed on the line that asked. Locally: 1 → 3 on two clicks, a third
> click raising the dialog, "Add anyway" giving "4 · 1 over capacity", and two minus clicks going 4 → 2.
> **FEATURE — the inventory taxonomy is editable, and gear is filed under a SUBCATEGORY**
> (`20260911120000_inventory_taxonomy.sql` + `20260911130000_taxonomy_position_default.sql`, both applied and
> verified on prod). Requested: create and edit categories and subcategories; every subcategory must belong
> to a category; delete a category only with no inventory and no subcategories, a subcategory only with no
> inventory, else an error; assign inventory to subcategories in bulk — and "инвентарь никогда не
> привязывается к категории напрямую".
> That last line is the model change. Both levels were free TEXT on `inventory_items` with the offered values
> in a frontend constant, and that could not express any of the rules: a subcategory had no owning category
> (on prod **"Profoto" and "Broncolor" each sat under Strobes AND Lighting Modification**), and "delete only
> if unused" has nothing to check when a category is a string someone typed. `SUBCATEGORIES` was also half
> dead — its keys were the OLD demo categories, so the register migrated from the studio's export had almost
> no suggestions.
> **`inventory_categories` + `inventory_subcategories` (`category_id` NOT NULL — the invariant is the
> database's, not a form's) + `inventory_items.subcategory_id`.** An item's category is DERIVED by following
> its subcategory, and `src/lib/taxonomy.js` is the one place that knows how. Backfilled from the register's
> own text: **17 categories, 63 subcategory rows** (one per category/subcategory PAIR, which is how the two
> shared names keep their meaning), **225 of 276 live items filed, 0 disagreeing with the text they came
> from**. Live items only — an archived item is retired stock and its old categories would pad the studio's
> taxonomy with the demo register's names.
> ⚠️ `subcategory_id` is **NULLABLE** because **51 items have no subcategory at all** (whole categories —
> Stands, Uncategorized — have none), and inventing names for them would be fabricating the studio's
> taxonomy. They read as "Not filed", which is what they are, and the bulk tool is how they get placed. The
> legacy `category`/`subcategory` TEXT columns are untouched and never read as a link: they are the record of
> what a piece was imported as, shown as "Imported as X — pick where it belongs" while it is being filed.
> `unassignedByFormerCategory` groups them by that text so a whole former category can be placed at once.
> **The removal rules return a REASON, not a boolean** — "Grip still holds 11 items in 5 subcategories. Move
> them elsewhere first." / "Clamps still holds 3 items. Reassign them first." / with no stock but
> subcategories left, the reason NAMES them. A blocked remove still CLICKS and says what is in the way;
> greying it out leaves the crew guessing. Retired stock does NOT block a removal but is reported ("2 archived
> items keep it for their history"). The guards live in the STORE as well as the form, because a picker left
> open while someone else fills a subcategory would otherwise still remove it (the `setOrderLines` reasoning).
> **Removal ARCHIVES**, like everything since `20260808120000`: verified on prod that DELETE as the app's own
> role affects **0 rows** and the row survives.
> UI: a **Categories** screen (tree with counts, add/rename/remove at both levels, and moving a subcategory
> to another category — every item in it follows, which is the point); ONE **"Filed under"** field on the item
> editor showing `Category / Subcategory` and **no direct category field**, with "+ New subcategory…" inline
> so a half-typed item is never abandoned to go make one; both levels in the filters plus **"Not filed (N)"**;
> and a select mode that files any number of items at once, logging **one `item.filed` line per piece**.
> The three item badges that printed the legacy `item.category` (inventory detail, peek card, work-history
> dialog) now print the derived `categoryLabel`, which says "Not filed" rather than showing an empty chip.
> ⚠️ **The local `updateInventoryItem`/`addInventoryItem` field lists are WHITELISTS** — `subcategoryId` was
> stored fine in supabase mode and dropped SILENTLY in local mode, so re-filing an item "saved" and changed
> nothing. Caught in the browser, not by the build. Same class as `resolveOrder`: adding a field to an item
> means editing BOTH modes.
> ⚠️ A `SelectField` option whose `value` equals the control's own value renders as the CURRENT selection, so
> the bulk bar read "— take out of its subcategory —" before anyone had chosen anything. The unfile choice is
> a distinct sentinel now, and the control stays at `''` so the placeholder shows.
> **32 new assertions (263 total)**, including the two twin subcategories staying distinct, both removal rules
> with their reasons, per-category name uniqueness allowing the same name elsewhere, a subcategory with no
> category being refused, and `taxonomyFromItems` — the rule the SQL backfill applies, written once so the
> demo seed and the migration cannot describe different shapes.
> Demo content: the seed register is filed with values drawn from the `SUBCATEGORIES` constant — 42 of 44
> items, with **two left unfiled on purpose** so the demo shows that state and the bulk tool doing something.
> ⚠️ That constant now has **no code consumer** (the taxonomy is rows), so nothing but an assertion keeps the
> two in agreement: `test:lib` checks every seeded subcategory is one the map lists for that item's category
> (**266 assertions**). A comment claiming they agree would have been the only thing holding it together.
> Verified on prod as the app's own `authenticated` role: the backfill counts, the derived-category match,
> NOT NULL refusing an orphan subcategory (**23502**), the per-category unique index refusing a duplicate
> (**23505**) while the same name under another category is accepted, rename/archive/bulk-assign all working,
> DELETE affecting 0 rows — then in the browser on the deployed build: 17 category rows with their counts,
> Strobes' own Broncolor/Profoto separate from Lighting Modification's, the "51 items are not filed" banner,
> and one item filed through the UI (`subcategory_id` written, unfiled 51 → 50) and taken back out
> (51 again). Every probe row and event removed — prod at 17/63/225/51 exactly as found.
> ℹ️ **Left to the studio, not guessed:** those 51 items need subcategories NAMED before they can be filed
> (10 of them were imported as "Stands", a category with no second level at all). The bulk tool places a
> whole former-category group in one action once the names exist.
> **CHANGE — Purchase price, and a barcoded item is created WITH its copies**
> (`20260912120000_item_category_nullable.sql`; the feature itself is frontend-only). Two requests.
> (1) **Replacement price → Purchase price.** Text only, in the three places a person reads it (the item
> form, the card's detail grid, and the activity feed's diff labels). ⚠️ The COLUMN stays
> `replacement_price`: it was added as an insurance value (`20260724160000`) and the studio uses it for what
> a piece cost, which is why the label now sits beside Purchase date. Renaming the column would rewrite
> stored data for no visible benefit — the same call as the `orders` table meaning Job — so the mismatch is
> documented where `getInventory` maps it.
> (2) **Creating a barcoded item took a QUANTITY and generated that many units with auto barcodes**, so
> registering gear whose labels are already on it meant creating the item, then opening "Add unit" and
> correcting every copy. The item form now carries the SAME one-row-per-copy control the card's "Add unit"
> uses: blank rows are generated (a batch of identical stands), typed rows carry the label in hand. Counted
> stock still takes a plain number and is offered no copies; an existing item still manages them from its
> card, and switching the type toggle swaps between the two.
> `src/components/UnitRowsField.jsx` is that control, extracted so the two places ask the question one way,
> and **`src/lib/unitRows.js` is the RULE they share with the store**: a typed barcode must be free, no two
> rows may claim one, and blank rows take the next free numbers skipping anything typed above. It was
> written TWICE before (the store's `addUnits` and the form's greyed previews) and could drift — `test:lib`
> now pins that **every preview equals the code the save actually assigns** (+18, **281 assertions**). One of
> those assertions is the interesting one: `barcodePreviews` must claim each number it hands out, or two
> blank rows preview the same barcode.
> ⚠️ **`store.addInventoryItem` returns `{id}` or `{error}` now** — it used to return a bare id, so a
> refused barcode had nowhere to be reported and the form closed on a write that never happened. Both
> callers updated; the equipment window's "New item" names the reason instead of a generic "could not be
> created". The copies are resolved BEFORE anything is written, so a clash costs nothing.
> ⚠️ **That error surface immediately exposed a regression the taxonomy change had shipped 30 minutes
> earlier: `inventory_items.category` is NOT NULL, and the item editor had deliberately stopped writing that
> legacy text — so EVERY create failed on the real database** with `null value in column "category" …
> violates not-null constraint`. Local mode has no constraint to violate, which is exactly why the browser
> pass missed it, and the old bare-id return made it silent. `20260912120000` drops the NOT NULL: nullable is
> the honest shape, because a newly registered item has no imported text and the 276 rows from the studio's
> export keep theirs. **The lesson is the reporting, not the constraint** — the same write had been failing
> invisibly, and one honest return value found it.
> ⚠️ And the per-copy events had to be logged the SAME way in both modes. My first version passed a local
> unit id in local mode and logged NOTHING in supabase mode, while the comment claimed "the same way
> whichever door it came in" — caught by counting the events during the prod cleanup (1 removed, 3
> expected). They hang off the ITEM with the barcode naming the copy, exactly as `addUnits` does it, so no
> DB-generated id is needed.
> Also fixed here: **`npm run audit:tdz` no longer flags PROPERTY reads.** `item.units` cannot trip a
> temporal dead zone, only a bare `units` can, and my own memo tripped that false alarm. Verified the audit
> still catches a real TDZ by staging one — a tool whose job is to be believed cannot cry wolf.
> Verified in local mode by measurement: previews 1017/1018/1019 against a register topping out at 1016;
> typing 1018 into row 1 re-previewed the blanks as 1017/1019; the same barcode in two rows was refused next
> to the field and #0851 (the Magic Keyboard's) was refused by the store — both with the form kept open and
> nothing written; a real create then wrote #1018 with its typed serial and #1017 generated, logged
> `item.created` plus one `unit.added` per copy ("registered a unit · #1018 · SF2H29…"), and the card read
> "PURCHASE PRICE $1,250.50". The shared control in "Add units" still previews, and two clicks on
> "Add another copy" in ONE tick add two rows (it takes an updater). Counted stock shows a quantity and no
> copies. Demo data reseeded, 0 console errors.
> On prod in supabase mode, on the deployed build: the form reads Purchase price with no "Replacement
> price" anywhere and previews 1026 (the register's highest is Clay's 1025); the first create surfaced the
> NOT NULL regression above; after the migration the SAME form — every value still in it — wrote the item
> with `category` null, both copies (typed **#9911 / ZZ-SERIAL-A** and generated **#1026** with a generated
> serial) and `replacement_price` 899, and the card read "PURCHASE PRICE → $899.00". Probe item, its 2 units
> and its events removed with service_role — prod back to **276 live items / 437 live units**.
> **FIX — the two date filters say what they are, and a backwards range says so.** Reported from a
> screenshot: two bare date boxes in the Jobs filters with no clue which is which ("непонятно что за две
> разные даты?"), and the pair in that screenshot (2026-09-11 → 2026-09-10) had emptied the list with no
> explanation. The dropdowns beside them describe themselves ("Any studio"); a filled date field just shows
> a date. Both are labelled now — **SHOOTING FROM / SHOOTING UNTIL** — with the rule stated under them and
> changing with what is filled (a period matches jobs shooting on any day in it, `from` alone means on or
> after, `to` alone on or before, either side may be left open), and a backwards period is NAMED with a
> one-click **Swap them** — measured: 0 of 14 becomes 4 of 14.
> ⚠️ Two things I got wrong on the way, both caught by measuring rather than reading. I first read
> `windowsOverlap(startsOn, endsOn, from, to)` as passing four strings to `setDays`' two-object function and
> called it a bug: it is not — `orderSearch` has its OWN correct local helper of that signature, proved by
> running `searchOrders` itself. And my first "a backwards period matches nothing" assertion passed on a weak
> fixture: a job SPANNING both dates slips through, because the two one-sided tests are each satisfied alone
> (the screenshot said "1 of 14", not 0), so the warning text was untrue. An empty interval holds no days, so
> the filter now rejects everything when `from > to`, and the fixture includes a straddling job.
> The date filter had NO assertions at all — the primitive was covered, the CALL SITE was not, which is
> exactly where a wrong answer hides. 13 added (294 total).
> **FIX — a job with no shoot no longer takes a call sheet and drops it.** Found while verifying on prod. A
> call sheet lives on the SHOOT (`set_call_times` + `sets.wrap_time`), and three legacy jobs have no shoot
> row at all — they are sub-rental history, we rented FROM a vendor and no studio was booked. The form
> offered the full control anyway: measured on prod, typed 07:15 for Producer + Photographer with an 18:30
> wrap, saved, got no error, and the card came back "Call times: not set". The work just vanished. Editing
> such a job now states the situation instead of showing a control that cannot keep anything, and says the
> rest of the form still saves; creating a job is unaffected (its shoot is written in the same action).
> Confirmed it is the missing shoot and not a broken chain: the same call sheet on a set-backed job wrote
> through to Postgres as `{"roles":["Producer"],"call_time":"06:45:00"}` and read back on the card. Both prod
> probes reverted — 0 call times, 0 wrap times.
> **FEATURE — a free-text Note on a job and on an inventory item** (`20260913120000_notes_fields.sql`,
> applied). Requested: "Добавить поле Note в: job, inventory, people, companies". **People and companies
> ALREADY had one** — `contacts.notes` and `companies.notes` exist since the first schema, both editors write
> them and both cards show them. Checked rather than assumed: 4 prod companies already carry a note. So the
> migration adds only the two that were missing, `orders.notes` and `inventory_items.notes`.
> ⚠️ `sets.notes` already existed and is a DIFFERENT note — it belongs to the SHOOT (the legacy
> `BookingModal` writes it). This one belongs to the JOB, the record the crew actually opens, which is why it
> is a new column and not a read of that one.
> Both are textareas, not inputs: what gets written is a sentence or three ("load in through the freight
> door"), and the cards render it with `whitespace-pre-line` so the crew's own line breaks survive. A row
> appears only when there IS a note — an empty "Note" row on every job would be noise on most of them.
> Plumbing, both traps this file has already written down: `notes` is the OUTERMOST select layer in
> `getOrders` AND `getInventory` (**sixth** time that rule has mattered) and joins the columns a
> pre-migration write strips and retries — `writeItemRow`'s retry used to drop `subcategory_id` alone and now
> drops every column added after launch, or the second such column would refuse the whole write; and
> `resolveOrder` in store.js is a WHITELIST, as are the local item field lists, so both were edited or the
> note would store on prod and vanish in local mode. The item edit logs "note" in the activity diff.
> Demo content: ONE seeded person carries a note, because 0 of 31 did and a field the demo never shows
> demonstrates nothing — not all of them, which would read as a required field.
> **REMOVED — the scanning station.** Requested: "УБрать модуль сканирования / Сканирование
> применяем только для скана инвентаря внутри job при редактирвоание equipment". Epic #6's station was a
> whole view that stayed open by the door for a shift; what the studio actually wants from scanning is the one
> field that puts a copy on a job. Gone: the Scanning view and its nav tab, `store.scanUnit` +
> `scanSyncError` + `clearScanSyncError` + the `scans` slice, `openScanning`, the repository's
> `getScansByOrder` / `logScan` / `setSetUnitStatus`, `order.scans`, the job card's SCANNING block, the `SCAN`
> capability, and `src/lib/scanning.js` — whose only surviving rule, `normalizeBarcode` (a code copied off the
> screen carries the decorative `#`; a reader sends a trailing CR), moved to `src/lib/barcode.js`. A browser
> that persisted `activeView: 'scanning'` falls back to the calendar — verified, that fallback already
> existed for the hidden Archive. What SURVIVES is what was asked for: the scan field inside the equipment
> window, verified after the removal (`#0851` with its hash and no Enter took the footer 4 → 5 pcs).
> ⚠️ Two consequences, both deliberate: **nothing records the return of gear any more** (the pull sheet's
> `ret` column is still in `packing_signoffs`, unwritten and waiting), and **closing a job is no longer
> blocked** by units still scanned out — that guard read a log nothing writes, so it was a rule that could
> never fire. The `scans` TABLE is left in place, as always: no app code reads it and dropping a table
> destroys data.
> **FEATURE — a DARK THEME, by redefining the palette rather than prefixing ~1800 classes.** Requested:
> "Добавить темную тему и протестировать ее очень качественно".
> **Mechanism.** Every colour utility in Tailwind v4 compiles to `var(--color-*)`, and those are plain
> INHERITING custom properties on `:root,:host` (only the internal `--tw-*` ones are registered with
> `@property`, which would not inherit). So the whole theme is a REDEFINITION of the palette under
> `:root.dark` — not one `dark:` prefix anywhere, and every existing utility keeps working. The values are
> Tailwind's OWN, generated from `node_modules/tailwindcss/theme.css`, never hexes I invented. ⚠️ Reading
> them out of the COMPILED bundle looks equivalent and is not: it tree-shakes the steps the app does not use,
> so `slate-950` was simply missing.
> **Three states, not a boolean.** `src/lib/theme.js` is pure (14 assertions, **313 total**): System / Light
> / Dark, because a two-way toggle cannot express "follow the device" once it has been touched.
> `src/lib/useApplyTheme.js` puts the class on `<html>` and, ONLY while the preference is System, listens for
> `prefers-color-scheme`. One button in the top bar (not the account menu — local mode has no account menu),
> whose icon shows the state in effect and whose tooltip says what the next click does.
> **No flash.** An inline script in `<head>` reads the same persisted store and sets the class before React
> mounts; applying it from an effect means a white flash on every load, which is the one thing a dark theme
> must not do. A synchronous head script always precedes first paint, and `dist/index.html` keeps it. A
> corrupted `localStorage` falls back to the device — verified by corrupting it: the app still rendered, dark,
> with the preference back at System.
> **What could not be themed by the ramp, and why each got its own token.** `bg-white` meant TWO things —
> the surface of a card/modal/popover (58 uses) and the text on a coloured button (`text-white`, 67) — and
> one variable cannot invert one and leave the other, so the surface became `--color-surface` (`bg-white` is
> now 0 occurrences). A modal backdrop is a veil over content and stays dark in both themes
> (`--color-scrim`); the strong neutral chip carries white text so it must stay darker than whatever surface
> it sits on (`--color-chip`). And the SOLID BUTTONS: every one of the 48 `bg-violet-600` and 9 `bg-rose-600`
> occurrences carries `text-white` (checked, not assumed). White on violet-600 measures 5.89 and on
> violet-500 only 4.4, so lifting the fill with the ramp would have failed 48 button labels — while leaving
> the step where it was would have kept `text-violet-600` (75 uses) at 3.46 on a dark tint. They are now
> `bg-brand` / `bg-danger` (+ `-strong` for the hovers) with **NO dark override**: a fill under white text has
> no business changing with the theme. In the light theme `bg-brand` computes to exactly the old violet-600 —
> measured, so the 96 class replacements are a visual no-op there.
> **The neutral ramp is assigned BY ROLE, not mirrored.** A symmetric mirror (50↔950 … 400↔600) is the
> obvious answer and it read badly, measurably: it puts muted text at 44% lightness on a 28% card (contrast
> **2.35**) and `text-slate-400` is this app's most-used text colour. Counted, each step does exactly one job
> — 100/200 are backgrounds and borders with **0** text uses, 400/500/600 are text with **0** border uses —
> so the text steps land in the readable 70–98% band and the surfaces stay at 13–45%. No single mirror can do
> both. Accents are mapped PER FAMILY for the same reason: violet-500 as text reads 3.46 on a dark tint while
> amber-500 already reads 7.03, so lifting them identically would only wash amber out.
> ⚠️ **One step's direction FLIPS.** `bg-slate-100` is an inset panel (120 uses), and in the light theme an
> inset is slightly DARKER than the card around it. Mirrored, it landed on exactly the dark card's own colour
> — caught by measuring, not reading: every well, sticky group header, row hover and inactive segment was
> invisible. Nothing is darker than the page, so nesting on a dark ground reads by getting LIGHTER.
> **Measured, every view and every modal, with transitions FROZEN** (`getComputedStyle` during a transition
> returns the interpolated value — that once reported a dark amber cell as 1.4 against a true 10.37) and
> colours converted through a CANVAS (an `rgb()`-only regex reads `oklch()` as "no colour" and invents
> white-on-white; a second regex read `rgb()`'s blue channel as alpha). Text failures below WCAG AA, dark vs
> light: calendar **0/10**, jobs **0/46**, inventory **0/63**, people **0/49**, and **0** in the job editor,
> the equipment window, kit staging, the unit pick list, add-inventory, add-units, the item editor, work
> history, the kit and list editors, the person and company editors, the packing checklist, peek cards two
> deep, the select / date / month-year / status popovers, the mobile drawer, and each of those at 375px with
> no horizontal overflow. The harness was proved to still bark by planting a 1.48 element.
> The four that remain in dark are shared with the light theme and BETTER here than there: the "—" and "→"
> placeholders (2.35 vs light's 1.49), out-of-month day numbers (2.54 vs 1.45), a DISABLED button (3.94 vs
> 2.13) and the inert minute column before an hour is picked (which disappears the moment one is — checked).
> Also better in dark, measured: card/popover separation from the page (1.13–1.18 vs light's 1.05), borders
> against their own surface (1.72 vs 1.23), input placeholders (5.05 vs 3.05) and every coloured chip
> (9.2–11.1 vs 4.85–6.65). `color-scheme: dark` hands the UA canvas, form controls and scrollbars over too.
> ℹ️ **Two spots fail EQUALLY in both themes**, because their fill is theme-independent:
> `bg-amber-500 text-white` on the calendar's "today" date badge (**2.13**) and `bg-emerald-500 text-white` on
> the Confirmed toggle (**2.47**). Pre-existing, not introduced by the dark theme, and left alone rather than
> quietly restyling an approved light theme — a one-line change each if the studio wants them fixed. The same
> goes for the light theme's own muted labels (`text-slate-400` on white, **2.63**, 282 uses): dark reads 6.78
> there, and "fix the light theme too" is a separate decision.
> ℹ️ The PDFs stay light in both themes: a pull sheet is printed on paper.
> ℹ️ The LOGIN screen was the one surface the signed-in session could not reach; measured the next
> day when prod's session had expired and it rendered on its own: **0 failures in dark** (its worst
> is white on the brand button at 5.89), against light's usual 2.63 muted line.
> ⚠️ Browser-tool lesson, twice over: a synthetic `change` on a MediaQueryList reaches only listeners on
> THAT object, so my first "the device-follow is broken" reading was my own invalid test — patching
> `matchMedia` and re-running the effect is what actually proves it (with System it attaches exactly ONE
> listener and follows the device both ways; on an explicit choice the listener is REMOVED and a device flip
> no longer overrides it). And this pane's `resize_window({colorScheme})` emulation is RE-SYNCED to the app's
> own theme, so it cannot be used to test that at all. Screenshots were unavailable for this pass (the pane
> draws nothing while Claude's window is behind another) — and a screenshot taken then returns a STALE frame
> rather than failing, which is worth knowing before believing one.
> **CHANGE — the note is ON the card and always writable, and a SORT that had been
> reshuffling every list.** Reported with a screenshot of a person's card: "ноут через
> редактирование не оч функционален … хорошо бы чтобы это поле было доступно в карточках и всегда
> было редактируемым … это касается всех Note сущностей во всех разделах."
> True as reported: a note appeared only once one existed, so an empty record gave no hint that a
> note was possible, and writing one meant opening the record's full editor, finding the field and
> saving the whole form — the most clicks for the quickest thought a crew has.
> `src/components/NoteField.jsx` is ONE control for all **seven** note-bearing records — job,
> inventory item, kit, scenario list, person, company and the shoot — on their full cards AND on the
> peek cards. One component because a note must behave identically everywhere and seven copies of the
> save/dirty/flush logic would drift.
> It saves **on blur**, on **Cmd/Ctrl+Enter**, and from a **Save** button that appears while the text
> differs. The button is not a second code path: `save()` compares against the last stored value, and
> a click always arrives AFTER the blur it caused, so it no-ops — measured, blur + button produce
> exactly ONE `item.updated` event. **Escape** puts the stored text back and does NOT close the card
> behind it (`stopPropagation`, the SelectField precedent).
> ⚠️ **The peek cards get the note too — the one thing they let you change.** They are read-only on
> purpose (they own no edit state, and nesting a view's modals in them would put dialogs inside
> dialogs), but a note carries its own save and is exactly the field you want where you are standing.
> ⚠️ **The SHOOT's note was invisible.** `sets.notes` has always existed beside `orders.notes` — two
> different columns, one belonging to the day and one to the job — and only the legacy booking editor
> ever wrote it, with nothing displaying it. It is on the shoot's peek card now; verified the two do
> not cross (writing one left the other untouched).
> ⚠️ **A PRE-EXISTING BUG this surfaced, and the real reason the first version "lost" notes: the
> app's sorts were not TOTAL.** `(a, b) => (a.date < b.date ? 1 : -1)` reads as "newest first" and is
> a broken comparator — for two rows with the SAME date it answers -1 whichever way it is asked, i.e.
> "a after b" AND "b after a" — so V8 swapped the pair on every sort. This store re-sorts on EVERY
> write, so two jobs on one day changed places each time anything was saved, and a view whose
> selection falls back to the first row (which every view does on a first visit) then showed a
> DIFFERENT record after each save. INSTRUMENTING the field is what caught it — the log read
> `run order-10 … reseed order-9 … run order-10 now:""`, i.e. the card had flipped under the field.
> `src/lib/ordering.js` `newestFirst(field, tie)` breaks ties on the id, which is unique and never
> changes; all **nine** occurrences now use it (store.js ×5, People ×2, repository, the usage seed).
> **6 assertions (319 total)**, one of which pins the OLD comparator's own inconsistency as the thing
> being fixed.
> ⚠️ The other half of that failure was mine: the queued save read the draft when its TURN came, "so
> a burst of edits collapses into one write". Across a record change the later draft belongs to a
> DIFFERENT record — it wrote an empty note over the one just saved. The text and the record are
> captured at the CALL now, and the result only touches this field's state while it is still on that
> record. Switching rows flushes a dirty draft to the record it was typed on.
> ⚠️ And the reverse of the stale-value trap, which this component lives with: every write ends in a
> quiet `hydrate()` that hands out new objects, so `value` changes identity constantly. A naive
> "sync props into state" effect would wipe what is being typed — the incoming value is adopted only
> while the field is clean.
> Each of the six full cards reads its store action ITSELF rather than taking a prop: the note's
> write is that card's own business, and threading an action through every parent is how a shared
> modal once lost a required prop and white-screened a view. Every write path was checked to be
> partial-safe FIRST — `orderColumns` / `personColumns` / `companyColumns` and the kit / list /
> booking patches all emit only the keys they are handed, and every local branch merges over the
> record — so a `{ notes }` patch cannot blank a neighbouring field.
> Verified in local mode by measurement, all seven records and both card kinds: the field is present
> and empty on a record with no note; a two-line note round-trips through the store with its line
> breaks; the item card logs the edit as "note"; switching jobs shows the other job's note and coming
> back shows the saved one; the compact field on the item card is 36px against 56px elsewhere;
> frozen-transition colours give text 14.62 light / 17.04 dark with a visible border in both; no
> horizontal overflow at 1280 or 375. Demo data reseeded — the seed's own 4 company / 3 kit / 4 list
> / 1 person notes are back and every test note is gone. 0 console errors on a clean load.
> ⚠️ My own measurement error, for the second time in two days: reading a computed colour right after
> toggling the theme class returned the INTERPOLATED value and reported the light theme as dark.
> Freeze transitions before believing any colour.
> ⚠️ **A SECOND pre-existing bug, found by checking the supabase path rather than trusting the
> browser pass.** `itemFieldColumns` in the repository emitted ALL six of its older columns on every
> call, filling the absent ones with null. That is right for the item FORM (which always submits its
> whole shape) and destructive for a partial write — so the note saved from the item card would have
> written null over brand, asset type, storage location, subcategory, purchase date and purchase
> price. **Local mode guards its own field list with `in`, so the browser pass could never have
> caught it: only the real database would have lost the data** — the "same logic written twice" class
> again. Worse, it was ALREADY losing something: the item form deliberately does not submit the
> legacy `subcategory` TEXT (the record of what a piece was imported as), so every item edit on prod
> had been nulling that column.
> `src/lib/patch.js` `pickPatch(source, map)` is the rule written once — `undefined` leaves a column
> alone, null or '' clears it — with 6 assertions (**325 total**). The item form's own saves are
> byte-identical through it (every key it sends is present), so nothing that worked changes.
> **UI PASS — the interface stopped explaining itself, and a physical piece is a UNIT.** Two reports
> against a screenshot of the Add-units window: "убрать комменты со всех сущностей там где это не
> уместно, потому что слишком много данных и текста … оно будто документация какая-то а не интерфейс",
> and "почему у нас везде называются они теперь copy? давай унифицируем до unit".
> Both fair, and the first is measurable: **42 blocks of literal small-print prose across the
> components, 2855 characters — now 26 and 1358.** Half the prose gone, and it was the half that
> taught the model rather than doing any work.
> **The rule applied to each block: does this say something the screen doesn't?** Cut: the boxed
> "One row per copy. Leave a row empty and its barcode and serial are generated…" (the greyed previews
> already show the exact codes a blank row will take) and "N copies will be registered" (the number is
> in the field beside it); four sentences under Storage location about inheritance and about a
> different column in a different table; "Each unit tracked by barcode & serial" under a toggle whose
> buttons read Barcoded / Non-barcoded — that note survives only in EDIT mode, where it explains a
> disabled control; "Its category comes from the subcategory"; "Stock can be registered before it is
> filed"; the Categories intro restating removal rules that are REPORTED with real counts the moment a
> removal is blocked; the Stock box explaining how it differs from editing the number; "Who is expected
> on set, and when…" under a field labelled Call times; "Must match the PO accounting issued";
> "Renaming relabels companies using it"; "Shoots this person was crewed on" under a heading that reads
> Work history; and the three-sentence paragraph beside a counted item's on-hand number.
> **What stayed, deliberately:** validation that prevents silent loss ("this row won't be saved"), a
> blocked action's REASON, the consequence of a destructive click ("It leaves the pool for every job
> until it's marked back"), the FIXED/GENERIC legend, and empty states that say what to do next. Those
> are work, not documentation. ⚠️ This reverses a habit several entries in this file were proud of —
> the app SAYING what a write did. The line is now: say it when it is about to happen or has just
> happened, never as standing prose next to a field.
> **One word for a physical piece: UNIT.** "Copy" had become a second name for the same thing, against
> the `units` table, the UNIT column, "+ Add unit", `UnitEditorModal` and every other label. 26
> user-facing strings renamed ("Its copies" → "Its units", "Add copy" → "Add unit", "Choose / scan a
> copy", "N × any free copy", the Copies row label, the tooltips); `document.body.innerText` now
> matches /copy|copies/ **zero** times on every screen. Code identifiers and comments keep their
> wording — nobody reads those, and renaming them is diff noise.
> ⚠️ The test suite caught the rename, which is what it is for: an assertion pinned the old
> "each copy needs its own barcode" message (**325 assertions**).
> Verified by reading the modals back out of the DOM: Add units is now "Adding units to X · How many? ·
> BARCODE SERIAL · Add another unit · Storage location"; Add inventory item is labels and fields with no
> prose at all; the job editor has no paragraphs under Call times, Shoot wrap time or PO; kit staging
> reads "Filling slots here doesn't change the kit itself · 4 slots still need a unit". Orphaned by the
> cuts and removed: `KIND_HELP` and two now-unused `Info` imports. 0 console errors on a clean load.
> **CHANGE — one from–to field for a shoot's days, two job types, and a week grid that fills the
> screen.** Four reports against the job form and the calendar, plus one question answered by
> measurement.
> **(1) The New-job banner is gone** ("The job starts on Hold and books the studio for the day.
> Equipment comes next…"): the status dropdown says Hold, the button says "Select equipment" and the
> date field says how many days — three facts the banner repeated in prose, the same class the text
> pass cut.
> **(2) ONE field for the days.** `src/components/DateRangeField.jsx` replaces the First day / Last
> day pair in the job form AND the legacy shoot editor. The trigger reads "Sep 21 – 23 · 3 days" or
> "Sep 11 · one day"; the popover is DateField's own calendar with range selection — the FIRST click
> sets a one-day shoot (complete and valid on its own, so closing right there keeps it) and the second
> stretches it. Typing survives the move: both ISO ends sit at the top of the popover, visible
> together instead of in two separate fields. Same popover contract as every other one here (portal,
> `position: fixed`, outside-click, Escape with `stopPropagation`, re-placed on a **document** scroll).
> The control cannot emit a backwards pair — the grid orders the two clicks itself and the typed
> inputs are normalised on the way out — which is what let the form drop `setStart` (it existed only
> to keep the two fields in order) and the entire "that is before the first day" branch.
> ⚠️ **EIGHTH instance of the stale-value trap, designed out rather than found.** Two clicks before a
> re-render would both read the range captured by the render that created the handler, and the second
> would RESTART the range instead of completing it. The live range is held in a REF that the props
> feed. Measured: two clicks in ONE tick give "Sep 7 – 9 · 3 days", not "Sep 9 · one day". A second
> click BEFORE the first swaps the ends (22 then 19 → "Sep 19 – 22").
> **(3) Two job types, not three.** `Style-out` was MY assumption when the day view was built, and
> this file flagged it as the thing to correct if the studio's model differed — it does. `JOB_TYPES`
> is Editorial / PDP again; still free text, still merged with whatever the register carries, so a job
> already carrying another type keeps it. Two assertions updated with it.
> **(4) The week grid fills the screen.** It stopped at its rows' own 92px minimum and left the bottom
> of the page empty however many jobs a week held. `min-h-full` +
> `gridTemplateRows: auto repeat(N, minmax(92px, 1fr))`. Measured at 1440×940: rows 92 → **119px**,
> the grid bottoms out 1px short of its wrapper (the border) instead of ~160px short; at 1440×520 the
> rows fall back to 92px and the wrapper SCROLLS, so a short window or a stack of jobs still works.
> No horizontal overflow; month and day views untouched.
> ℹ️ **Asked and answered: a multi-day job holds its gear on EVERY day of the span.** Measured rather
> than reasoned — the seeded 3-day job's units each carry ONE reservation `2026-09-07 → 2026-09-09`,
> `isUnitFree` refuses them on all three days and the day before is free. A job created through the
> new field wrote `2026-09-21 → 2026-09-23` on both the order and its shoot. The model was already
> there (`set_units.reserved_from/reserved_to`, `overlaps`, `covers`); this just confirms it end to
> end. ⚠️ A job on HOLD still reserves nothing, which is why a freshly created one shows its units as
> free — that is the reservation model, not a gap.
> ⚠️ **TOOLING LESSON that nearly cost a wrong conclusion:** `await import('/studio-demo/src/store.js')`
> in the Vite dev server hands back a **SECOND store instance** — its own state, rehydrating from the
> same localStorage. Writes made through it never reach the running app, which looked exactly like
> "archiving an order no longer takes its shoot off the calendar" (the chips stayed, a fabricated
> booking never appeared). Drive the app through its UI; use a dynamic import only to READ pure
> modules. "Reload seed" put the demo back to 14 orders / 11 shoots / 44 items.
> ℹ️ The legacy `BookingModal` got the same field, but the seed has no order-less shoot to open it
> with (archiving an order now takes its shoot down too), so that one is covered by the build, the
> lint and `audit:jsx` rather than by a click.
> **FIX — the call sheet shows on the JOB's peek card too.** Reported against the card a calendar chip
> opens: "надо call time светить внутри джобы". The sheet was on the job's FULL card and on the
> SHOOT's peek card, but not on the job's peek — which is exactly the card you land on from the grid,
> and the first thing anyone asks of a job on the day is what time people are due. It now sits in THE
> SHOOT block under the Shoot row: every call with its roles and note, then the wrap.
> ⚠️ That would have been a THIRD copy of the same rendering, so `src/components/CallSheetList.jsx`
> is the one definition and all three read through it. `wrapTime` is optional: the full job card keeps
> the wrap in its own labelled row, while the peek cards want the whole sheet in one block.
> Verified on the seeded 3-day job: the job peek reads "Call times · 07:30 Producer · 08:00
> Photographer, Digital tech · 08:30 Hair & makeup, Stylist · 10:00 Model · 18:00 wrap"; the shoot
> peek shows the same list from the same component; the full card is unchanged in shape. A job whose
> shoot has no sheet reads "not set" on the card and the job peek, "No call times set for this shoot."
> on the shoot card.
> **FIX — the call sheet reads as a schedule, and one call is one line.** Reported against a job's
> peek card that printed "08:15 Producer" **twice**: "вот это работает? … нужно как-то подметить их
> более ярко". Both halves were fair.
> **(1) The duplicate was real data, and the app had no reason to keep it.** Nothing duplicates rows —
> the write path DELETEs and re-INSERTs — so those were two rows someone typed. But a call sheet is
> read BY TIME (that is why `roles` is a list in the first place), so a second "08:15 Producer" line
> adds nothing and reads as a rendering fault. `normalizeCallTimes` now unions the roles of rows that
> share a time. ⚠️ Rows sharing a time with DIFFERENT notes stay apart: the note is what tells them
> apart ("freight door" vs "park on 9th"), and folding them would strand it on a role it was never
> about. It runs on READ as well as on write (the repository maps `set_call_times` through it, and
> `CallSheetList` does it again), so a shoot saved before this change reads right **without its rows
> being rewritten** — proved by planting the reported pair in storage and reloading: 4 stored rows,
> 3 lines on the card, the two 06:45s with different notes still two.
> **(2) The time is what is being looked up**, so it is set in a chip at the card's strongest text
> colour instead of reading as one more grey line among the "—" rows around it. Measured with
> transitions frozen: chip 13.97 dark / 16.28 light, roles 16.28 / 10.36, wrap 12 / 4.76 — the wrap
> takes the same shape in OUTLINE because it is the end of the day, not somebody's call. The job
> card's separate "Wrap" row folded into it, so all three surfaces (job card, job peek, shoot peek)
> show one block from `CallSheetList`. No overflow at 375px.
> 7 new assertions (**332 total**), including the reported pair collapsing and `earliestCall` still
> answering from it.
> **CUT — the hints that teach how to click.** Requested against the note field's "Click away or ⌘↵ to
> save": "поубирай такого рода подсказки с разных мест, определи важность этой подсказки и поудаляй
> подобные". The Save button sits under the box and says it already.
> Judged the same way and cut with it: three peek-card headings that narrated their own rows ("Open a
> line to see that item's units and history", "Open a unit that's out to jump to the job holding it",
> "Shoots this person was crewed on"), the taxonomy banner's directions to another screen (the COUNT
> of unfiled items stays — that is a fact), and both "Edit anything below" tails on the
> scenario-applied banners (BookingModal and OrderEquipmentModal — the second one only surfaced in the
> BUNDLE grep, not in the source sweep I ran first).
> Kept, by the rule this file already carries: validation that prevents silent loss ("this row won't
> be saved"), the REASON a blocked action is blocked, what a destructive click will do, the
> FIXED/GENERIC legend, and empty states that say what to do next. Tooltips were left alone — they are
> asked for, not standing on screen.
> `PeekPanel`'s `Section` lost its now-unused `hint` slot: dead plumbing that reads as live is worse
> than no plumbing.
> Verified in local mode: the note header reads just "NOTE" with the Save button while dirty, Escape
> still reverts the draft without closing the card behind it, the sections render straight into their
> content, and the bundle greps **0** for all six strings.
> ⚠️ My own measurement slip, worth remembering: `innerText` applies `text-transform`, so a check for
> "The shoot" on a card whose heading is uppercased comes back FALSE and reads as "the card closed".
> Use `textContent` when asserting that something is on screen.
> **CHANGE — the status control SHOWS every state, so nothing has to explain it.** Reported against
> the job form with a screenshot: a note under the Hold/Confirmed toggle read "Currently 'canceled' —
> picking Hold or Confirmed replaces it", which reads as "the default status is canceled" — followed
> by "сделать холд дефолтным".
> Hold WAS already the default (`status: 'hold'` in the form's initial state, and `createOrder` writes
> whatever it is handed). The real defect is that the toggle could only show TWO of the four states a
> job can be in, so a job that was anywhere else left both segments dark and needed a sentence to
> apologise for it — a control that cannot show where you already are reads as broken. The card's pill
> dropdown had learnt this already; the form hadn't.
> Now it renders `ORDER_STATUS_CHOICES` (plus the job's own value when that is a legacy `draft`), each
> lit in its OWN pill classes from `orderStatus.js` — so the form, the card pill and the calendar menu
> cannot disagree, and the segment is the statement the note used to make. ℹ️ Side effect worth having:
> the old lit style was `bg-emerald-500 text-white`, one of the two 2.47-contrast spots this file has
> been listing; the pill classes measure **6.78 dark / 5.02 light**.
> **Creating offers only the two states a job ahead of you can be in, with Hold lit** — that is what
> "Hold is the default" looks like on screen, and it is shown on create now (it used to be hidden
> behind `isEdit`, which is how the default became invisible enough to be doubted). Picking Confirmed
> at creation is safe: the two-step flow calls `setOrderLines` immediately after `createOrder`, and
> that already syncs reservations.
> Cut in the same pass, same class as the click-hints: the "Job name — **what are we shooting?**"
> label suffix (and its echo in the validation message), and the call-time note placeholder's
> "— where to arrive, what to bring…" tail.
> ℹ️ **Three of the things the screenshot crossed out were already gone** — "Who is expected on set,
> and when…", "When the shoot finishes…", "Must match the PO accounting issued…" — and the First
> day / Last day pair is one "Shoot days" field now. The page had not been reloaded since those
> deploys. Worth checking the CURRENT source against a screenshot before believing a report is about
> live code.
> Verified in local mode by measurement: the edit form reads Job name (no suffix) and Status with four
> segments and no note; a job moved to **Canceled** from the card shows Canceled lit in rose (the
> reported case), one click on Hold + Save wrote `hold` through and the card's pill agreed; a new job
> shows Hold lit of two; the call-time row's placeholder is "Note"; at 375px the four segments are
> 78px each with nothing clipped and no page overflow. Demo data reseeded (14 jobs / 11 shoots /
> 0 activity).
> ⚠️ The pane kept ONE console error from the moment between two of my edits (`ORDER_FLOW is not
> defined` — the import landed in the next command). It survives a reload in the buffer, so it cannot
> be dismissed as stale by assumption: the path that reads that binding is the CREATE form, and it
> renders Hold/Confirmed after a full reload, which is the proof.
> **CHANGE — a refusal is PINNED where it can be seen, plus two Categories fixes and an unboxed
> note.** Four reports against the Categories window and a note field.
> **(1) Errors, everywhere.** "когда я пытаюсь удалить то, что нельзя удалять, выскакивает ошибка, но
> сверху и я ее не вижу пока не пролистаю наверх … это касается всех репортов об ошибках". True and
> general: every modal rendered its refusal INSIDE its scroll container — Categories at the top of a
> long list whose × can be anywhere in it, the rest at the bottom of a form you may be reading the top
> of. A message nobody reads is the same as no message.
> `src/components/ErrorNote.jsx` renders it OUTSIDE the scroll container, between the content and the
> footer. The panel is a flex column with a capped height (`max-h-[88vh]`), so a `shrink-0` row there
> is on screen at EVERY scroll position, right above the button that was just pressed — and in the same
> place in all nine windows (Categories, job, equipment, unit, add-inventory ×2, company, kit, person,
> scenario), so the crew learns where a problem appears once. `AddInventoryModal` had already solved
> this by hand for its archive refusal — that one was the precedent, now the shared component.
> Measured: with the Categories list scrolled to the bottom (scrollTop 473 of 473), the refusal sits at
> y=751 in a 910px viewport with the list NOT scrolled by it; scrolled back to 0, same y. Contrast
> 11.09 dark / 5.49 light. At 375px it wraps to two lines, still fully on screen, no overflow.
> **(2) "New category" moved to the TOP** of the window — it sat under the whole tree, which on a
> 17-category register means scrolling past everything to add one. The empty state no longer says "Add
> the first one below".
> **(3) The note field lost its frame** ("убери эту коемочку вокруг нотес выглядит не очень"): a dashed
> box on every one of the SEVEN records it appears on made each card look like a form. At rest it is
> now text on the card (transparent border AND background, measured), with the box appearing on
> `hover:`/`focus:`.
> ⚠️ Doing that with a React flag was wrong and the CSSOM said so: `focused ? 'bg-surface' : ''` leaves
> BOTH `bg-transparent` (base) and `bg-surface` applied, so the winner is stylesheet order, not intent.
> The `focused` state is gone entirely — `focus:` already expresses it, and a variant beats a plain
> utility by construction. Verified the four utilities are really compiled by walking
> `document.styleSheets` (⚠️ recursively — Tailwind v4 nests utilities inside `@layer`, so a top-level
> scan finds nothing and reads as "the class does not exist").
> **(4) The comments were already gone.** The screenshot's intro ("Gear is filed under a subcategory…")
> and the unfiled banner's "use 'File under…' in the inventory list" tail had both been cut earlier —
> the page had not been reloaded. **Second report in a row against a stale bundle**: check the current
> source before treating a screenshot as live code. What remains in that window is the COUNT of unfiled
> items, which is a fact, not an explanation.
> Verified in local mode: Categories opens with the create row first, then the count, then the tree;
> a blocked × on "Furniture still holds 4 items in 3 subcategories" shows pinned at the bottom of the
> list and at the top; the job editor's "Give the job a name." appears pinned while the form is
> scrolled to 0; nine windows carry the component in the same slot. Demo data untouched (14 jobs /
> 44 items / 7 categories / 27 subcategories).
> **PROD PASS over the whole of 11 Sep** (read-only; no browser). Asked to test the day's changes on
> prod. ⚠️ Both browser surfaces were dead that session — the desktop app refuses an MCP server named
> `Claude Browser` / `claude-in-chrome` ("uses a name reserved for the desktop app's built-in tools"),
> so the clicking half could not run at all. Verified instead by (a) content-grepping the SERVED
> bundle — 13 feature strings present, 18 cut strings absent — and (b) probing the live database with
> the app's OWN queries and pure modules under Node, which is the documented substitute.
> Findings worth keeping: the three OUTERMOST select layers (`orders`+notes, `inventory_items`+notes,
> `sets`+end_date+wrap+calls) all succeed, so prod loads the rich shape rather than a degraded one;
> the reported duplicate call sheet is FIXED ON PROD DATA — the shoot "Name" stores two identical
> `08:15 Producer` rows and now renders ONE line plus the wrap, roles kept, rows untouched; a job note
> written by the studio round-trips with its line break; `pickPatch` emits only `notes` for a
> note-only save AND **prod carries 0 `item.updated` events**, so the pre-fix partial write had never
> fired there — nothing was lost, the fix is preventive. Two categories ("Uncategorized", "A/V /
> Events") were archived through the new screen, both empty, with 0 orphan subcategories and 0
> stranded items — the removal guard doing its job. Estimates still total **$0.00** because
> `day_rate` is null across the migrated register (unchanged, known). 0 multi-day jobs on prod, so the
> range field's second half is unexercised there.
> ⚠️ Three of my own probe bugs, all of the same family: `est.days` is not `est.billableDays`,
> `events.type` is `event_type` (a wrong column name returns NO rows and reads as "nothing ever
> happened"), and a packing row's name field is not `name`. **Check a probe's field names against the
> module before believing its answer** — a silent empty result is the dangerous shape.
> **FIX — the people pickers read the ROSTER, and the brand list is never empty.** Three reports
> against the New-job form.
> **(1) The brand dropdown was empty.** `brandsIn` built its options from the register alone and no
> job carries a brand yet, so the control offered nothing and read as broken. `BRANDS`
> (**Ann Taylor**, **Loft**) is now offered exactly the way `JOB_TYPES` already was, merged with
> whatever the register carries — still free text, so another label needs no code. ℹ️ Consequence,
> deliberate and already true of types: the FILTER can offer a brand that currently matches nothing.
> **(2) A new job starts as Type `PDP`** — the studio's everyday shoot; the rare one gets changed.
> Editing is untouched (the form seeds from the record).
> **(3) A photographer added in People did not appear in the picker.** The real defect was that THREE
> surfaces asked three different questions: the Jobs screen merged people whose subcategory is exactly
> "Photographer" with a frozen seed constant, while the CALENDAR and the legacy shoot editor showed
> that constant ALONE — so whether a new person appeared depended on which door you came in through.
> `src/lib/peopleOptions.js` is the single rule and is built so it cannot hide anyone: the people whose
> trade says so first, then **everyone else on the roster** (an assistant shoots sometimes, and a
> picker that refuses to offer the person you just filed is exactly the bug), then any name already
> written on a job that is not in the database (the field has always taken free text; dropping those
> would make an existing job's own value unofferable). `src/lib/usePeopleNames.js` lets each window
> read the roster ITSELF rather than taking it as a prop — a list threaded through a parent is how two
> of the three drifted, and it is the same shape as the required prop a shared modal once lost.
> The frozen `PHOTOGRAPHERS`/`MODELS` constants and their file are gone with their only consumer (the
> two store fields), so there is nothing left to drift from.
> Audited the rest of the option lists while here: roles, company types, vendors, categories,
> subcategories, kits, lists and inventory all already read live data; `STUDIOS` is the one frozen
> list left, and that one is real.
> Verified in local mode with **no reload in between**: created a person in People, then the job form
> offered them at position 7 — inside the photographers, in name order — from BOTH entry points, with
> 32 options against the 7 the calendar used to show; Brand offers Ann Taylor / Loft on a register
> carrying neither; Type reads PDP on a new job from both doors. Probe person removed, demo data
> reseeded (31 people / 14 jobs / 44 items), 0 console errors. **+12 assertions (344)** — and the suite
> caught the old `brandsIn` assertion, which is what it is for.
> **FIX — the note field wears the app's OWN hairline.** Asked for right after the frame came off
> entirely ("еще рамочку для Note добавь плз, чтоб было видно что это поле, а не текст"): with no
> border the box read as a paragraph rather than as something writable. Both reports are right and
> they are not in conflict — what was wrong with the FIRST version was the DASHED border and the
> filled grey panel, not the existence of an outline.
> It is `border-slate-300` now, the same one every input in the app wears — measured against the job
> form's own field: identical colour, 0.8px solid, 8px radius, 12px padding, so the note cannot look
> like a different kind of control. The ground stays TRANSPARENT (the field sits on whatever card it
> is in) and hover/focus still do the rest in CSS. Border against its card: 2.35 dark / 1.49 light,
> i.e. more visible than the app's usual 1.72 / 1.23.
> Verified on the job card and on the PEEK card (the surface in the report) in both themes with
> transitions frozen; no overflow, 0 console errors.
> **HOSTING + RENAME — the project is Kitbay, and one repo builds for Vercel and for Pages.**
> Asked to host on Vercel and then: "пусть название проекта будет везде Kitbay … это переходит в V1
> проект."
> **The only thing in the code that knew where the app lives is `base`**, which decides every asset
> URL in `index.html`. Pages serves under the REPO NAME, Vercel serves a project at the ROOT of its
> own domain — a Pages build put there asks for `/studio-demo/assets/…` and renders a blank page. So
> `base` reads the environment instead of a literal: `/` when `VERCEL` is set (Vercel's own build sets
> it), otherwise `/<GITHUB_REPOSITORY's repo half>/` (Actions supplies it), with a dev fallback.
> ⚠️ That second half is the interesting one: **renaming the GitHub repo can no longer leave a stale
> path here** — the thing that would otherwise blank the deployed page a week later, with a commit
> nobody connects to the rename. Measured all four shapes from one tree: `…/studio-demo` →
> `/studio-demo/assets/…`, `…/kitbay` → `/kitbay/…`, `VERCEL=1` → `/assets/…`, plain dev → `/kitbay/`.
> `vercel.json` runs the same gates CI does (`audit:tdz`, `lint`, `test:lib`) before the build, so a
> failing assertion does not deploy. Nothing else is needed on Vercel: `.env.production` is committed
> (public URL + anon key by design), so Vite picks the supabase source up at build time.
> ℹ️ Supabase needs NO change: sign-in is email+password with no redirect flow (checked —
> no `resetPasswordForEmail` / `emailRedirectTo` / OAuth anywhere), so Auth's URL configuration is not
> involved, and PostgREST answers any origin.
> ⚠️ **A Vercel PREVIEW deployment talks to the same production database.** The app requires sign-in,
> so nothing is public, but a preview build can WRITE to the real register. Deployment Protection or a
> second Supabase project is the fix if that ever matters.
> **The rename, in the scaffolding rather than the UI** (the product has said Kitbay since the
> rebrand): package + lockfile name; the seed's internal company id (`anntaylor-rental` →
> `kitbay-studio`, 4 refs, never shown); `src/lib/brand.js` gains `APP_URL` beside `BRAND_NAME` so
> `npm run user:add` stops carrying its own copy of the address it hands a new user; and the README,
> which was still the untouched Vite template.
> ⚠️ **The browser STORAGE KEY changed** (`anntaylor-rental-demo` → `kitbay`) — the last place a
> crew member's own machine held the old name. A new key is not read by the old one: local mode
> reseeds (what "Reload seed" does anyway) and on prod each person's theme and "where I was" reset
> ONCE. The old key is left in place rather than deleted: it is superseded, not garbage worth removing
> from someone's browser behind their back. On a new host the origin is new and storage is empty
> regardless, which is why this was the cheapest moment to do it.
> **NOT renamed, deliberately:** the demo logins `@anntaylor.demo` are real Supabase users and
> renaming them breaks sign-in; and the GitHub repo itself, which is an outward-facing URL and the
> studio's call — `base` no longer depends on that decision either way.
> Verified on prod after the deploy: the served page still points at `/studio-demo/assets/…` (the repo
> is not renamed, so the live link is untouched), the head script reads `localStorage.getItem('kitbay')`,
> the bundle carries `kitbay-studio`, and the old key appears **0** times. Locally the app runs at
> `localhost:5173/kitbay/` with the seed under the new key (44 items / 14 jobs / 31 people), 0 console
> errors, 344 assertions.
> **HOSTING — one address: `kitbay.vercel.app`.** The studio picked the Vercel address over a custom
> subdomain, so the app now has ONE home and the old GitHub Pages path stops being a second one.
> `APP_URL` follows it — that constant is what `npm run user:add` prints to whoever is being given an
> account, so a stale address there is a support call rather than a cosmetic slip.
> **The Pages deploy is not simply switched off, and the reason is the whole point of the step.** Turning
> the workflow off leaves the LAST BUILD published at `duck-agency.com/kitbay/` permanently: a second,
> ageing copy of the app, writing to the SAME production database, reached by every bookmark that
> predates the move. So that path serves a REDIRECT instead — meta refresh (it has to work with JS off)
> plus a visible link, published by `.github/workflows/pages-redirect.yml`, with `404.html` identical so
> an old deep bookmark lands there too. It is **dispatch-only**: the page never changes, and rebuilding
> it on every push would be an identical deploy against every commit. It reads the address out of
> `brand.js` rather than carrying its own copy — two definitions of where the app lives is exactly how
> one of them ends up pointing somewhere dead.
> ⚠️ **Splitting the workflow mattered more than the redirect.** `deploy.yml` carried the four GATES
> (`audit:tdz`, `lint`, `test:lib`, `build`) as well as the deploy, so deleting it would have quietly
> taken CI with it. They live in `.github/workflows/ci.yml` now (push + PR), which also gained
> `audit:jsx` — it was in the README and in `vercel.json` but had never been in the GitHub workflow.
> Vercel runs the same commands before its own build, so a failure already blocks a deploy; CI is what
> puts that answer on the COMMIT instead of only inside another dashboard.
> ⚠️ **The redirect page is a FILE (`.github/pages-redirect/index.html`), not a heredoc inside the
> workflow — and that is the lesson.** Written inline it has to satisfy two rules that pull in opposite
> directions: the shell wants a heredoc terminator at column 0, and YAML ends a `run: |` block at the
> first line indented less than the block. Indenting the body satisfied YAML and put the terminator
> where the shell never looks; flush-left satisfied the shell and made the FILE invalid — GitHub failed
> that run in **0 seconds** with "a workflow file issue". The step is one `sed` substitution into a real
> file now, with a guard that fails if a placeholder survives. A comment in that file must not name the
> placeholder either: the first version explained itself with the literal token and got substituted.
> ⚠️ **Before that, a backslash level vanished on the way to disk and left a CONTROL CHARACTER in the
> YAML.** The address was first extracted with a capture group, `s/…'\(.*\)'$/\1/p`; by the time it
> reached the file the `\1` was a literal **0x01 byte**, so the expression substituted nothing and `url`
> came back empty — and `grep` renders 0x01 invisibly, so the line READ as correct. `cat -A` is what
> showed it. The extraction is `grep -m1 … | cut` now: no backslashes, so there is no escape level to
> lose. **Prove a workflow step by EXTRACTING it and RUNNING it**, and parse the YAML (`npx js-yaml`,
> judged by its EXIT CODE — grepping its output for "error" flags every file whose script contains
> `::error::`, which failed a workflow that had been running for weeks).
> ℹ️ Left undone deliberately, both the studio's call: no custom domain (a CNAME to Vercel is a DNS
> change, and the plain address is what was chosen), and no Deployment Protection — pushes go straight
> to `main`, so previews are rare, but a preview build CAN write to the real register.
> Verified on the deployed build before the change: `kitbay.vercel.app` 200 with assets at `/assets/…`
> (so `base: '/'` took), the sign-in screen rendered, **0 console messages**, the bundle carrying the
> Supabase URL and the `kitbay` storage key with `studio-demo` and the old key at **0**. And from the new
> ORIGIN — the thing a host move can actually break — Auth answered **200** with email sign-in enabled
> and PostgREST answered **200 with `[]`** to an anonymous reader: reachable, and still closed by RLS.
> Verified after: all three workflows parse; CI ran every gate on the commit (`npm ci`, `audit:tdz`,
> `lint`, `audit:jsx`, `test:lib`, `build` — all green in 24s); the dispatched redirect deployed, and
> `duck-agency.com/kitbay/` now answers 200 with "Kitbay has moved", the canonical link and the meta
> refresh, and **0** occurrences of `assets/index-` — the app is gone from that path. A real browser
> navigated to the old address LANDS on `kitbay.vercel.app` with the sign-in screen and 0 console
> messages. ℹ️ A deep old path (`/kitbay/anything`) still carries a **404 status** — GitHub Pages serves
> `404.html` with one — but it is the same page, so the browser is forwarded anyway.
> **FEATURE — the address bar says which screen you are on, and the back arrow walks them.** Requested:
> "в каждом открытом разделе сверху было обозначение ссылки где я нахожусь … https://kitbay.vercel.app/calendar
> … пройдись по всем разделам … чтобы оно всё могло сохраняться и я мог переходить просто стрелочкой назад".
> The app has never had a router and still does not need one — `activeView` in the store stays the source of
> truth — but the URL never changed, so a screen could not be linked to or bookmarked, a reload landed on
> whatever localStorage remembered, and the browser's back arrow only walked the drill-in trail.
> `src/lib/routes.js` is the one definition (PURE, 42 assertions): **/calendar · /jobs · /inventory · /people**.
> ⚠️ The segment is USER-FACING TEXT, so it follows the LABEL: the store's view id is `orders` and the screen
> is called Jobs, so the address says **/jobs**. Same split as the `orders` TABLE meaning Job — renaming the
> identifier would rewrite every stored `viewState` key for nothing visible. An assertion walks
> `WORKSPACE_NAV` and fails if a tab has no path, so adding a screen cannot silently give it the calendar's URL.
> ⚠️ **`vercel.json` needed a rewrite, and without it the feature is worse than useless:** `/jobs` is not a
> file, so a reload or a pasted link would have 404'd on the host while working perfectly in dev. Every path
> now serves `index.html` (static files still win, so `/assets/…` is untouched). Both bases produce ABSOLUTE
> asset URLs — `/assets/…` on Vercel, `/kitbay/assets/…` in dev — so a deep path still finds its bundle;
> relative ones would not.
> ℹ️ **Side effect of a catch-all rewrite, found the next day while verifying a deploy:** a MISSING asset
> now answers **200 with index.html** instead of 404 — `curl`-ing the previous build's
> `/assets/index-<old hash>.js` returned 1,432 bytes of HTML. It costs nothing today (one bundle, and a
> stale chunk would have failed either way — with a MIME error rather than a 404), but it makes a
> content-grep against an old asset look like a pass, and it would hide a genuinely missing file.
> `"source": "/((?!assets/).*)"` restores the honest 404 if that ever matters.
> **Which screen a LOAD opens on is decided in the persist `merge`**, synchronously at store creation: an
> explicit address beats what was remembered, and a path naming no screen falls back to the remembered one.
> Doing it in an effect instead would paint the wrong screen for a frame.
> ⚠️ **The whole difficulty is push vs replace**, and getting it wrong is invisible until someone presses back:
> one way the arrow needs two presses to undo one step, the other way it SKIPS the screen you came from. Every
> entry is now STAMPED with the screen it represents, and two OBSERVABLE facts decide — the address already
> matching (the browser moved us, or the push carried it) and the stamp. A tab click pushes its own entry; a
> drill-in's `pushNav` already pushed one and only needs its URL written; a navigation that pushed nothing
> ("Open full view" on a peek card) gets an entry pushed for it.
> ⚠️ **My first version tracked "did the browser move us" in a REF, and it leaked:** a popstate that changed
> nothing left the flag set, so the NEXT navigation replaced instead of pushing. The symptom was the FORWARD
> arrow dying ("no forward history") — found by testing forward, not back. A fact you can read beats a flag
> you have to remember to clear.
> ℹ️ **Peek cards deliberately do NOT change the address.** A peek layers a card over the screen you are on
> and closing it puts you back exactly where you started — it is not a navigation, and giving it a URL would
> put an entry in history for something the X already undoes. Its "Open full view" IS a navigation and does.
> ℹ️ **The selected record is NOT in the URL** — `/jobs`, not `/jobs/order-7`. Each screen already persists
> its own selection and filters in `viewState`, so a reload lands you back on the same job; what a URL would
> add is SHARING one, and that is its own change (every view's selection resolver, and a per-click history
> entry that would flood the back arrow unless selection replaced rather than pushed).
> ⚠️ My own test read a false positive twice: the item name on an equipment line opens a PEEK, not a drill-in,
> and "Back to jobs" in the DOM is the MOBILE master-detail button (`lg:hidden`), not the trail bar. Check
> WHICH control you are exercising before concluding the feature is broken.
> Verified in local mode by measurement: a load of "/" normalised to the real screen's path; all four tabs
> wrote their own address with one history entry each; back three times walked People → Inventory → Jobs →
> Calendar with the screen following, and forward walked the same trail back; a pasted `/kitbay/people` opened
> People; an unknown `/kitbay/nope` fell back to the remembered screen rather than an error; "Open full view"
> pushed exactly one entry and back returned to the screen it came from. On the PRODUCTION bundle (`npm run
> preview`, supabase mode): `/kitbay/people` reached the sign-in screen with the address intact — so signing in
> lands on People — and **0 console messages**. ⚠️ The dev console kept hooks-order and missing-export errors
> from my own mid-edit rewrites of the hook (`useRef` ↔ `useEffect`); the production bundle has no HMR and was
> clean, which is what settles it.
> **FIX — People filters by TRADE, which is the only level anyone looks a person up by.** Reported
> against the open filter with a screenshot: "не вижу теперь а как тут фотографов отфильтровать" — the
> dropdown offered All categories / Freelancer / Model / Rental company / Agency and no way to reach a
> photographer.
> The model is two levels: `contacts.category` is Freelancer / Model / Rental company / Agency, and
> `subcategory` is the TRADE (Photographer, Stylist, Hair & makeup, Booker, Driver). The filter only ever
> read the first one — and nobody asks for "a freelancer". Measured on prod: 33 live contacts, categories
> 14/14/4/1, and **8 photographers** sitting under Freelancer with no way to select them.
> A second dropdown now offers the trades, `src/lib/peopleOptions.js` `subcategoriesIn(people, category,
> categories)` decides which (PURE, +8 assertions, **394 total**). Built from the ROSTER so every option
> matches somebody — the `brandsIn` lesson — with `PEOPLE_CATEGORIES` supplying the ORDER rather than the
> alphabet, and a trade the register carries but the taxonomy does not APPENDED rather than dropped (the
> person editor takes free text wherever a category has no list of its own). Picking a trade with the
> category left on All is the normal case: it answers "who are the photographers" without having to know
> they are filed under Freelancer.
> ⚠️ **The cross-filter guard is the part worth keeping.** Narrowing the category while a trade is
> selected would otherwise empty the list with nothing on screen explaining why — so `pickCategory` clears
> a trade the new category has nobody in. Verified: with Photographer chosen, picking **Agency** reset the
> trade to All and showed Agency's one person, and the dropdown itself narrowed to ["Booker"].
> A count line reads **"N of M · Clear all"** whenever any filter is on, the same footer Jobs and Inventory
> carry — without it a filter that hides 24 of 31 people is silent.
> ℹ️ The search box ALREADY matched `subcategory`, so typing "photographer" worked the whole time — but
> nothing said so, which is exactly why the screen read as having no answer. A control beats a secret.
> ⚠️ Fixed while here: the People/Companies TAB COUNTS read the raw collections, archived rows included,
> while the heading beside them counts live ones — the two disagreed the moment anything was retired.
> ℹ️ A Model has no trade at all (Model IS the trade — `PEOPLE_CATEGORIES.Model` is empty, and 14 of prod's
> 33 carry none), so under that category the dropdown has nothing to offer and is HIDDEN rather than shown
> empty. An assertion pins that case.
> Verified in local mode by measurement: both dropdowns render; the trade list holds all ten trades present
> in the seed in taxonomy order; **Photographer with category All gives "7 of 31"** and lists exactly the
> seven; Agency clears the trade as above; Clear all resets both and the count line disappears; the choice
> survives leaving the screen and is written to `viewState.people.subcategory`, so a reload keeps it.
> 0 console errors.
> **RENAME — the job card's own words, from an annotated screenshot, confirmed item by item.** The
> studio drew on the card and asked for each change to be proposed in text and confirmed before anything
> shipped ("уточняй … чтобы не ушло ненужное"). Confirmed and done, EVERYWHERE a person reads the word —
> the job card, the job form, the peek card, both PDFs, the Jobs filter and the calendar chip's tooltip:
> **Set date(s) → Shoot date(s)** (and the two forms' "Shoot days" → **Shoot dates**, so one field has one
> name); **Set → Set name**; **Type → Shoot type** ("Any type" → "Any shoot type"); the job note's
> PLACEHOLDER only → **Additional details** (its title stays **Note**, as asked). And **Attribution moved
> below Equipment**, directly above Activity: The shoot → Note → Equipment → Attribution → Activity.
> ⚠️ **"Type" is three different fields in this app and only ONE was renamed.** The company Type (the
> editable `company_types` list) and the inventory item Type (Barcoded / Non-barcoded) kept theirs, and so
> did the inventory CATEGORY named "Set" in `data/inventory.js` — set dressing, not a job's set. A blanket
> find-and-replace would have renamed all four; the edit list named each occurrence and asserted it.
> **The activity feed printed CODE:** a job edit logs the KEYS of what moved, and the feed showed them
> verbatim — "Edited the job · setLabel, jobType". `jobFieldWords()` in `lib/activity.js` maps them to the
> card's own words ("set name, shoot type"), both ends of the dates collapse to one "shoot dates", and an
> unmapped key still reads as words rather than camelCase. Applied when an event is READ, so every edit
> already logged on prod reads right too. +9 assertions (**403 total**).
> ⚠️ **The escape trap, a FOURTH time — and this time it produced an assertion that could never fail.** A
> `\b` word boundary in a test regex reached the file as a literal BACKSPACE byte (0x08), so
> `/<BS>Set dates?<BS>/` matched nothing, ever, and "no Set date left on the PDF" passed unconditionally.
> `cat -A` showed the `^H`. Rewritten as `!t.includes('Set date')` — a substring test has no escape to
> lose, and "Set dates" contains "Set date" anyway. **A check that cannot fail is worse than no check:
> it reads as protection.** After any scripted edit that writes a backslash, grep for control characters.
> ℹ️ **Found and deliberately NOT fixed (asked instead):** every save of a job that HAS a wrap time logs
> "wrap time" as changed even when nobody touched it. The diff in `updateOrder` compares the submitted
> fields with the JOB record, but `wrapTime` and `callTimes` live on the SHOOT — so the job always reads
> as empty there. The same comparison stringifies the call-time ARRAY, so a real call-time change never
> registers. Pre-existing; it only became legible once the feed spoke in words.
> Verified in local mode: the card's rows read Shoot date · Studio · Call times · Set name · Brand ·
> Shoot type · Photographer · Company · Shoot; the form's labels read Set name / Shoot dates / Shoot type
> with the note placeholder "Additional details" and the title Note; the filter offers "Any shoot type";
> 14 calendar tooltips read "Set name OMSet1" with 0 old-style left; a 3-day job's peek card says
> "Shoot dates 2026-09-28 → 2026-09-30"; an edit of the set name logged "edited the job · set name, wrap
> time" (the second word is the defect above). The longest new PDF label, "Shoot dates", measures 47.7pt
> at 9pt Helvetica — shorter than the existing "Photographer" (54pt), against a value column at 100pt.
> Demo data reseeded, 0 console errors. Items 6–9 of the same screenshot (Studio → Location with an
> address, a person's name on each call, "all crew" instead of one photographer, the Shoot row's "?") are
> DATA changes, not renames, and wait on the studio's answers.
> **FEATURE — "L" is LOCATION, and a location shoot has an ADDRESS** (`20260929120000_order_location.sql`,
> applied and verified on prod). Settles the open question this file carried since the day view: asked
> "is L the Location — a shoot outside your own studios?", the studio answered yes. So the sixth row was
> never "a large studio", and V1's comment saying so is gone.
> `studioLabel('L')` is **"Location"**, and because all 26 places that name a studio call that one
> function, the card, the peek card, the day view's group header, the unit history, both PDFs and the
> capacity message changed with it. L keeps its one-letter ID — it is the calendar's row key and every
> stored job carries it — and the week grid's "L" badge now says "Location" on hover.
> **`orders.location`** is free text (venue, room, street address, in the crew's own words) written only
> while the job is on L. On `orders`, not `sets`, for the `set_label` reason: a job with no shoot row must
> not silently drop what was typed. The form's studio field is **"Location / Studio"**; picking Location
> reveals an **Address** field, and picking any studio hides it AND clears it on save — enforced at the
> write in both modes (`orderColumns` nulls `location` whenever `studioId` is not L, `resolveOrder` does
> the same locally), so an address can never ride along on a studio shoot and send the crew to the wrong
> building. `placeLabel(studioId, location)` in `data/studios.js` is the one sentence for where a job
> happens ("Location · Pier 59 / Studio 101"); it is pure, so the PDFs use it under Node.
> Shown on the job card (a second line under "Location", or "no address yet"), the peek card, the day
> view (with a map pin — "where is it today" is the question of the day), the calendar chip's tooltip,
> and BOTH PDFs; the job search finds a job by its address ("pier 59" → 1 of 14).
> ⚠️ **Two more WHITELISTS had to learn the field**: `resolveOrder` in the store (the known one) and
> `buildEstimate`'s `order` shape, which copies named fields into what the PDFs read — without it the
> column would have been stored, shown on screen and silently missing on paper.
> ⚠️ **The PDF meta table assumed every value fits one line; an address does not.** Values now wrap via
> `splitTextToSize` inside the page (measured in the value's own bold face). Proved rather than assumed:
> a 105-character address wrapped into 391pt + 112pt against a 399pt column, where one line would have
> run to 461pt — past the margin. The assertion checks the PDF's own text runs, so without the wrap it
> fails (one run, too wide).
> ℹ️ **Left for the studio, not changed:** Location still counts against `MAX_SETS_PER_DAY` like a room
> does — six location shoots on one day, each at a different venue, would be refused with "Location
> already has 5 sets". Whether that limit should apply to L at all is their call.
> ℹ️ The Jobs filter keeps **"Any studio"**: "Any location / studio" clipped by 3px at 375px (107px of
> room for 110px of text), and the placeholder was never on the studio's drawing — Location is in the
> option list regardless. Found by measuring at 375 after the 1280 pass said "fits".
> ⚠️ Tool lesson worth keeping: with the browser pane HIDDEN, `innerWidth` is 0 and every layout
> measurement collapses (a trigger read 18px wide and "truncated") — `resize_window` to a real size before
> believing any width. And the calendar's mode buttons are lowercase in the DOM ("day"); CSS capitalises them.
> +17 assertions (**420 total**): the label, `placeLabel`'s four cases (with / without address, a studio
> job with a stale address, no studio), the search, and both PDFs printing and wrapping the address.
> Verified in local mode: the seeded Pier 59 shoot reads "Location / Studio · Location · Pier 59 / Studio
> 101 · Chelsea Piers, New York, NY 10011" on the card; the form offers Studio 1–5 + Location with the
> Address field present and filled; switching to Studio 2 hid it and saving stored `location: null`; the
> day view on 1 Oct groups Studio 1–5 + Location with the address and its pin; the second, address-less
> location job reads "no address yet"; no overflow at 375 or 1280. Demo data reseeded, 0 console errors.
> On prod: the dry run listed exactly this one migration; after it, `location` answers for all 20 live
> jobs, 2 of them on Location, **0 carrying an address** — nothing invented.
> **SWEEP — one name per thing, and every button names what it acts on** (frontend only, no migration).
> Reported against the item card with "ADD ITEM" drawn at **+ Add unit**: "проверь все приложение на подобные
> косяки… чтобы адд айтем был адд айтемом а не юнитом". The audit (every on-screen string, extracted with
> rolldown's parser — 2254 of them) found the real pattern: every record is created by **New X** → **Create X**
> and edited by **Edit X** → **Save X** (job, person, company, kit, list), and the ITEM was the one exception on
> all four counts — "Add inventory" → "Add inventory item" → "Add item" / "Edit inventory item" → "Save changes".
> That is the "add item isn't add item". ⚠️ The drawing pointed at the card's **Add unit**, which adds UNITS to that
> item — renaming it would have undone the copy→unit decision — so this was ASKED, not guessed: the studio chose
> **New item at the top, Add unit stays**. Item is now New item → Create item / Edit item → Save item.
> Retired words, each replaced EVERYWHERE a person reads it:
> • **order → job** in the leftovers the 69-string rename missed: the archive confirm, three equipment-window
> scan messages ("already on this job", "added to Inventory and to this job"), the empty packing PDF, the item
> peek ("Not on any job"), the company card and peek ("Job history", "N jobs"), a work-history row ("no job");
> • **booking / set → shoot** where the day is meant: the legacy shoot editor (New shoot / Create shoot / Save
> shoot, "Job name", "Location / Studio", "Equipment", "Search items to add…"), the unit history ("Shoots" link,
> "N shoots", "any shoot yet"), the day view's studio group ("N shoots"), the capacity refusal ("already has 5
> shoots"). ⚠️ `KitStagingModal` is shared, so it gained `targetNoun` ('job' default, BookingModal passes
> 'shoot'): "Add 4 to job", "#0956 already on this job". "Set name" stays — it is the label a shoot carries;
> • **contacts → people**: the People header ("31 people · 6 companies"), company rows/headers/peeks ("3 people"),
> the company card's own section (it said "Contacts" right above "Jobs its people worked"), the archive note.
> "Contact" survives only as the contact-DETAILS heading (email, phone);
> • **pull sheet / packing checklist / digital checklist → Packing list**: one document had three names (strip,
> modal, PDF). The strip reads Packing list · Checklist · Packing list PDF (beside Estimate PDF), the modal is
> "Packing list", the PDF already said PACKING LIST — the client's own word from the epic-6 spec;
> • **"stock" meaning items → items** in pickers (Search items…, the kit window's "Add item", "No item with free
> units matches", "No free unit of X"). "Stock" keeps ONE meaning: counted, non-barcoded quantity (Add stock,
> counted stock — "not unit-tracked" was jargon for it);
> • **the rest**: "item type"/"Inventory item" → New item / Item, "preset" → list, "pc(s)" → pcs, "Roster" →
> Crew (incl. the estimate PDF's crew heading, which printed **ROSTER** — found by the test, not by the audit),
> "placement"/"shelf" → storage location, the shoot peek's "Gear on this shoot" → Equipment, and the repair log's
> "Vendor" → **Repair shop** ("Vendor" is the company we rent from; the kit window already said repair shop).
> Deliberately left: the Jobs filter's "Any studio" and the usage-log form's "Studio" (both measured too narrow
> for "Location / Studio"), and every DB/identifier name, as before.
> ⚠️ **`npm run test:lib` now carries a VOCABULARY SCAN** (420 → **424 assertions**, see the block at the end
> of `scripts/check-lib.mjs`): it parses every component, `src/lib`, `src/*.jsx` and the user-facing `src/data`
> modules, walks JSX text, attributes and string/template literals, and fails naming file:line and the reason
> for any retired word. It is a list of WORDS, not screens, so tomorrow's screen is covered. Rules that matter:
> identifiers are skipped (snake_case column lists, `order.updated`, `line-order-…` ids — a template's gaps are
> joined with a placeholder, not a space, or an id reads as words), console lines are skipped, and **JSX text is
> always checked however short** — a lone lowercase "set"/"contact"/"order" there is the noun of a count
> ("{n} set{s}"), case-sensitive so the "Contact" heading stays legal. Proved to bark twice by planting the old
> strings ("Add inventory", "2 sets"); both named the exact line.
> ⚠️ Found by it: the first scan was blind to exactly that count shape — it treated a short JSX fragment like an
> identifier and missed "2 sets" in the unit history, "3 contacts · 2 orders" on the company card and the day
> view's "N sets". The browser pass is what showed "2 sets"; the scan now checks JSX text unconditionally.
> ⚠️ The escape trap, FIFTH and SIXTH time, both caught before they wrote anything: a Python raw string ending in
> `\"` KEEPS the backslash (so nine anchors would have matched nothing — the per-anchor assert would have
> refused), and a `\s` pushed through bash into sed arrived as a bare `s`, which "trimmed" every s out of the
> extracted words ("Statu", "hoot"). Scripts are files written with the Write tool; content ending in a quote
> uses `r'''…'''`.
> ℹ️ Browser-tool slip: finding a button by `startsWith('Edit')` clicked "Edit equipment". Match exact text.
> Verified in local mode: Inventory header "New item" → modal "New item" / "Create item", Edit item → "Save item",
> the card keeps Add unit, 17 unit rows link "Shoots", the unit history reads "2 shoots" and opens a shoot card
> with "Equipment (5)"; Jobs strip "Packing list · Checklist · Packing list PDF", the checklist titled Packing
> list, the archive confirm "Archive this job?…" (kept, not archived), the equipment window's "Search items…",
> "Pick a list…", "New item", a double scan "#0851 is already on this job." (window cancelled — nothing saved),
> the kit window "Add item" / "Search items…" / "Add 0 to job" / "already on this job"; People "31 people · 6
> companies", company rows "3 people" / "1 person", sections People + Job history in the card and the peek; the
> day view "11 pcs held"; the repair log "Repair shop". A DOM scan of every view (calendar week/month/day, all 14
> job cards, 10 person and 6 company cards, and 14 modals) found no retired word except two seed EMAIL
> addresses (orders@…, bookings@…), which are data. At 375px the strip's buttons sit on one line, no overflow.
> Demo data untouched (14 jobs / 11 shoots / 44 items / 0 archived), 0 console errors.
> **BATCH — the PDFs wear the status colours, "Other…" for the shoot type, Shoot name, Set name only for PDP,
> and no daily cap on Location** (frontend only, no migration). From three annotated screenshots plus answers.
> **(1) Colour code** ("привести к общему стандарту… конфермд зелёным, кенселд красным"). On screen every status
> already came from `orderStatus.js`; the PDFs did not, and auditing them found two real bugs behind the grey
> text: the estimate kept its OWN status vocabulary (`STATUS_LABEL`, which printed **FULFILLED** for what the app
> calls Closed), and the packing list printed a hardcoded **CONFIRMED** whatever the job was — true when the sheet
> existed only for confirmed jobs, false since it prints at every status but Canceled. Both headers now call
> `drawStatusPill` (exported by `estimatePdf.js`): the app's pill on paper — rounded fill, ring, a DRAWN dot ("●"
> is outside WinAnsi) and the label, from `orderStatusMeta`. The colours are a new `print` block per status in
> `orderStatus.js` holding the RGB of exactly the Tailwind colours its `pill`/`dot` classes name (jsPDF takes
> numbers, not classes), and ⚠️ `test:lib` DERIVES each one from `node_modules/tailwindcss/theme.css` (oklch →
> sRGB) and fails on drift — proved by nudging the Confirmed fill. The PDF assertions compare against the fill
> operator jsPDF itself writes for that colour (its number formatting — "0.82 0.98 0.9 rg" — is its own business,
> so the test asks jsPDF rather than guessing). Also: a legacy canceled SHOOT in a person's work history wore
> lowercase rose text; it is the standard Canceled pill now, and not twice when the job's pill already says so.
> **(2) Shoot type "Other…"** — the combo box allowed typing but read as two fixed choices. `SelectField` gained an
> `other` prop: a last row that turns into a text box INSIDE the menu (Enter or Add commits, Escape returns to the
> list without closing the modal — `stopPropagation` in the portal); a typed value that matches an option in
> another case becomes that option ("editorial" → Editorial, no twin), and a custom value is listed and ticked.
> Brand stays a combo (asked for the shoot type only).
> **(3) "Job name" → "Shoot name"** (drawn with a strikethrough): the form label and its message, the legacy shoot
> editor, the sort option and the feed word; the search placeholder reads "PO, shoot, photographer…". The record
> is still a Job. The feed's `studioId` word follows the field too ("location / studio").
> **(4) Set name only for PDP** ("only populate if PDP"). `setNameApplies(type)` / `showsSetName(order)` in
> `lib/orderSearch.js`: the field shows for PDP and for a job with **no type yet** — 13 of prod's 20 jobs carry a
> set name and no type, and hiding theirs would erase it on the next save. Any other type hides the field and
> CLEARS the set name on save (the Location-address rule), enforced at the write in both modes (`orderColumns` and
> `resolveOrder`). The card, the peek card and both PDFs show the row only where a set name belongs — or where one
> is still stored (1 editorial job on prod has one until it is next saved). Asked, and the answer was about the
> Other… menu, so the recommended option was taken; flipping to "hide but keep" is one line.
> **(5) No daily cap on Location** (answered: each location shoot is its own venue). The rule moved out of
> store.js into a pure `src/lib/capacity.js` (`MAX_SETS_PER_DAY`, `hasDailyCap`, `setsUsedOn`, `capacityError`,
> re-exported by the store so no caller changed) — a rule with an exception needs an assertion, and the store
> cannot load under Node.
> The vocabulary scan learnt "job name" and "FULFILLED". **477 assertions.**
> Verified in local mode: the New-job form reads Shoot name + Set name with PDP preselected; the type menu lists
> Editorial / PDP ✓ / Other…; Other… → "Lookbook" + Enter closed the menu, set the type, hid Set name and widened
> Shoot name to the full row; reopened, Lookbook is listed and ticked; back to PDP brings Set name back; Escape in
> the box returned to the list with the job form still open; "editorial" typed through Other… became Editorial. On
> a seeded untyped job with OMSet1, switching to Editorial hid the field and saving stored `jobType: Editorial,
> setLabel: null` — the card lost its Set name row. Both PDFs looked at, not only asserted: "EQUIPMENT ESTIMATE ●
> Confirmed" in green and "PACKING LIST ● Hold" in amber for a job that used to print CONFIRMED. Demo data
> reseeded (14 jobs / 11 shoots / 44 items / 0 activity), 0 console errors.
> ℹ️ The feed line of that edit read "set name, shoot type, **wrap time**" — the known false positive (the diff
> compares the job with fields that live on the shoot). It is fixed with the crew block, which rewrites that diff.
> ⚠️ Tool note: the pane cannot navigate to a `blob:` URL nor screenshot a local-file tab; a PDF is looked at by
> putting its blob in an `<iframe>` over the app page (`#zoom=250,330,20` for the header), then removing it.
> **FEATURE — one call sheet: every row is TIME · ROLE · PERSON** (`20260930120000_crew_call_times.sql`).
> Items 7 + 8 of the annotated job card ("Call times + name of person", "Photographer → add all crew"), agreed as:
> one block, each row "10:00 · Producer · Clay Rodriguez", ONE role and ONE person per row, the photographer just one
> of the rows, people picked from People or typed — and (answered) a typed name that People doesn't have is ADDED to
> People. Until now a shoot kept two lists describing the same people from two ends: `set_call_times` (a time + the
> roles it applies to, no names) and `roster_entries` (a person + a role, no time) — prod's own data showed the
> strain: a Photographer call whose NOTE read "Ann Tes", because there was nowhere else to write a name.
> **The roster became the call sheet** — it is the table that already links people to shoots (work history reads
> it): `contact_id` nullable (a role listed before anyone is booked), `call_time`, `note`, `position`, a non-blank
> role check, and the old unique (set, person, role) DROPPED via a `pg_constraint` lookup (a person can be called twice;
> the app folds exact duplicates before writing). Roles moved to the call sheet's own words (`photographer` →
> `Photographer`). The migration CARRIES OVER every `set_call_times` row: each role of a call becomes a row, joining
> the shoot's row of that role that has no time yet ("08:00 Photographer" meets the photographer it was always about),
> otherwise a new person-less row — unless an identical one exists (prod had "08:15 Producer" twice). `set_call_times`
> stays in place, unread. ⚠️ **That merge rule exists ONCE in JS too — `crewFromLegacy` in the new pure
> `src/lib/crew.js`** — and builds the local demo seed and `seed-supabase.mjs`, so the demo and prod cannot describe
> different shapes; `test:lib` holds it against the prod cases (the duplicate, the note that held a name, a second call
> in the same role).
> `lib/crew.js` is the one set of rules: `normalizeCrew` (trim, drop role-less rows, the day in order — timed rows by
> time, untimed after — exact duplicates folded), `firstWithRole`/`crewNameFor` (the job's single photographer is the
> first NAMED Photographer row), `earliestCrewCall`, `crewSummary` (tooltip: "08:00 Photographer (Marcus Reed)"),
> `wrapBeforeFirstCrewCall`, `crewRowProblem` (a row with anything in it needs a role; a time must be HH:MM),
> `crewRoles` (the offered roles + every role a sheet uses, no case twins). ⚠️ The suite caught a real bug in my own
> first version: sorting untimed rows with `localeCompare` and a `'~'` key put them at the TOP — collation orders
> punctuation before digits. Plain string comparison now.
> UI: `CrewField` replaces both the Photographer field and `CallTimesField` (deleted) in the job form AND the legacy
> shoot editor — time (compact), role (`SelectField` with the new Other… row), person (`ComboField` fed by
> `useCrewNameOptions`: people whose TRADE is the row's role first — the Stylist row offers Jonas Lind — then
> everyone, then names already on sheets), note, ×; a changed name drops the row's `contactId`. `usePhotographerNames`
> /`useModelNames` went with their only callers. The form lost its Photographer field (Location / Studio now pairs
> with Shoot dates). `CallSheetList` renders rows (time chip — a dash chip when there's none yet — role, person as a
> link when People has them, note, wrap) on the job card, the job peek and the shoot peek, whose separate Crew section
> folded into it. The day card lists the sheet with names; the chip shows the earliest call; the tooltip the whole
> sheet. A job with NO shoot (sub-rental history) still shows its own photographer row. The estimate's CREW section
> prints the NAMED rows with their call time (a role nobody is booked for is not client-document material).
> Work history now covers EVERY role: Jonas Lind's card gained the shoot "as Stylist" (only photographer/model had
> history before), and local mode re-resolves people whenever a sheet changes (it never did — histories went stale).
> ⚠️ **Three bugs found on the way, all fixed here:**
> • **A photographer picked in the job form never reached the database.** The form sent a NAME, `orderColumns` only
>   writes `photographer_contact_id` from an id, and `syncSetForOrder` "deliberately left the roster alone". Supabase
>   only — local mode kept the name — so the UI-created jobs on prod all read "not assigned". `setCrew(setId, rows,
>   {orderId})` now resolves every name (case-insensitively, a live person before an archived namesake) and keeps
>   `orders.photographer_contact_id` equal to the first Photographer row, so the Jobs filter and search still work.
> • **`isUndefinedColumn` missed PostgREST's write-side code.** An INSERT/UPDATE with an unknown column is answered
>   from the schema cache with **PGRST204** ("Could not find the 'call_time' column…"), not 42703 — proved on prod
>   (a select says 42703, an insert PGRST204). Every "retry without the newest column" fallback behind a write could
>   never fire. It matches both now.
> • **`npm run seed:supabase` could not start**: it imported `src/data/contacts.js`, deleted in e98e31d. It builds its
>   extra contacts from the booking templates now, and writes the call sheet instead of `set_call_times`.
> ℹ️ The feed's false "wrap time" is fixed: `updateOrder` diffs the sheet and the wrap against the SHOOT they live on
> (it compared them with the job, which has neither). Verified: an edit that changed two people logged just
> "call times" on a shoot with an 18:00 wrap.
> Reads degrade by layer as always: the newest `getBookings` layer selects the roster's new columns; every older
> layer reads the two legacy lists and merges them with `crewFromLegacy`, so a database without the migration shows
> the same sheet. Writes on such a database put the people in the roster and the times in `set_call_times`.
> **497 assertions.** Verified in local mode: the reseeded 3-day shoot reads 07:30 Producer · 08:00 Photographer ·
> Marcus Reed · 08:00 Digital tech · 08:30 Hair & makeup · 08:30 Stylist · 10:00 Model · Hailey Halter + 18:00 wrap on
> the card (names as links); the form shows those rows and no Photographer field; the Stylist row's person list starts
> with Jonas Lind; typing "Clay Rodriguez" said it would be added on save, and saving put Clay in People (31 → 32) with
> the job "as Producer" in his history and made his name a link on the job peek; the day card, the chip (07:30 · Day
> 1/3) and the tooltip all read the sheet; a new job created through both steps with 08:00 Photographer Ann Taylor
> stored the sheet and gave the job `photographer: Ann Taylor`. At 375px a row wraps to time + role / person + × /
> note with no overflow; at 1440 it is one line. Demo data reseeded, 0 console errors on a clean load.
> **Migration APPLIED and verified on prod** — deployed AFTER the code (the old bundle matched `role ===
> 'photographer'` and the migration capitalises roles; the new code reads both). The dry run listed exactly this one
> migration; the prediction was written down first and matched: `roster_entries` **22 → 27** — the two identical
> "08:15 Producer" calls arrived ONCE, "07:15 Photographer · note Ann Tes" joined Priya Nair's row (note kept), the
> other four calls became person-less rows with positions in time order — and roles now read Photographer 11 · Model
> 11 · Producer 3 · Crew 1 · eee 1. The app's newest `getBookings` layer answers 200; a person-less row with a call
> inserts, a blank role is refused with **23514**; the probe row was removed (27 again). Read through the app's own
> rules, prod's sheets render as "07:10 eee · 09:15 Producer · 10:20 Crew" and "07:15 Photographer (Priya Nair) ·
> Model (Amanda Googe)", with the chip reading the earliest call. `set_call_times` still holds its 7 rows, unread.
> ⚠️ **`node --env-file=.env.local` TRUNCATES the DB password**: the value is unquoted and contains `#`, which
> `--env-file` reads as a comment — 7 of its 15 characters came through and the push failed with `28P01`. Parse
> `.env.local` by hand (split on the first `=`) before `encodeURIComponent`; the other keys have no `#`.
> **CHANGE — the job has an ASSIGNEE again; the call sheet is just the schedule** (frontend only, no migration).
> Reported against the job card one day after the call sheet shipped: "здесь должны быть указаны времена звонков
> просто, верни фотографа на место … Вместо фотографа поставь Assignee и чтобы можно было выбрать кого угодно с
> People". That reverses the previous entry's "the job's single photographer is the first Photographer row", and
> the reversal is right: the sheet says WHO IS CALLED WHEN, the assignee says WHOSE JOB IT IS, and deriving the
> second from the first meant a job had no owner until somebody was booked in a Photographer row.
> **Assignee** sits where the Photographer field was — beside Location / Studio in the form, after Shoot type on
> the card — and is a `ComboField` over **everyone in People** (`useAssigneeNames`: the whole roster in name order,
> then any name already on a job that People lacks, so a job's own value stays offerable). No trade is put first,
> because "кого угодно" was the requirement. Read live from the store, so a person filed a moment ago is offered.
> A typed name People doesn't have is ADDED to People on save, the rule the call sheet already follows; the combo's
> "is not in the list — it will be added when you save" note says so before the click.
> **Storage did not move:** it is still `orders.photographer_contact_id` (`order.photographer` in the app) — it named
> the photographer when that was the only person a job carried, the same "the identifier keeps its old word" rule as
> the `orders` table. What changed is who WRITES it:
> • ⚠️ `setCrew` no longer syncs it from the first Photographer row — a sheet that rewrote the column would silently
>   undo what the form just saved. The `orderId` option went from `setCrew` / `updateBooking` / `syncSetForOrder`
>   and from both store callers; local mode's two `crewNameFor(crew, 'Photographer')` overrides went too.
> • New `withAssignee(row, o)` in the repository resolves the form's NAME to a contact id (via `resolveContactId`,
>   which files a new person) on `createOrder` and `updateOrder`. ⚠️ This is the write the photographer field had
>   been MISSING since the beginning (the form sent a name, `orderColumns` only writes an id) — the previous entry
>   papered over it through the sheet. A patch without `photographer` (status, note) leaves the column alone.
> Shown on the job card (a link to the person's card, or "not assigned"), the job PEEK (the card a calendar chip
> opens — linked, stacks the person card), the day view's card ("Assignee · Nadia Brooks", LABELLED: right under
> the call sheet a bare name read as one more person on it), the chip tooltip, and both PDFs, whose meta row now
> reads **Assignee**. The estimate's CREW section is the sheet's named rows only — the assignee is not crew by
> definition, so its old "fall back to the job's photographer" row is gone. The feed words `photographer` /
> `photographerContactId` read "assignee", on events already stored too (applied on read).
> Work history counts it: a person's card lists every job they are the assignee of, "as assignee" — local mode via a
> mirrored `booking.assignee` (seed, create, edit), Supabase via a new OUTERMOST `getPeople` layer
> (`assigned:orders!photographer_contact_id ( sets (…) )`, falling back to the old select). ONE row per shoot, and a
> call-sheet role beats "Assignee" for the same shoot (`personJobs`), so Ann Taylor on her own job still reads "as
> Photographer" rather than twice. Local unit history now lists the sheet's named rows (it only knew the first
> photographer and model), matching what the database mode reads from `roster_entries`.
> **The theme control is a dropdown** (asked for in the same breath: "сделай выбор темы выпадающим списком"). The
> cycling button made Dark two clicks from System through Light, and nothing on screen said what the other states
> were. It is the app's own `SelectField` now — System / Light / Dark with the one in effect ticked — which gained an
> optional per-option `icon` (drawn in the row AND the trigger) and a `labelClassName`, so on a phone the trigger is
> its icon alone (`hidden sm:inline`), as the button was. `nextTheme` went with its only caller; the head script
> never used it.
> 499 assertions (the PDFs print Assignee and not Photographer, no crew row is invented from the assignee, the feed
> word, the dropdown's order). Verified in local mode: the card reads "Assignee · Ann Taylor" after Shoot type; the
> form puts Assignee beside Location / Studio (same row, 302px each) with all 31 people offered; picking Jonas Lind —
> a stylist — saved `order.photographer` and `booking.assignee` while the sheet's Photographer row stayed Ann Taylor,
> the feed read "edited the job · assignee" and his card "as assignee"; typing "Nadia Brooks" showed the will-be-added
> note, saving took People 31 → 32 with her history "as assignee" and dropped Jonas's (re-resolved, not appended); her
> name is a link on the card and on the job peek ("2 deep"); the tooltip reads "… · Assignee Nadia Brooks · …"; the
> day card reads "Assignee Nadia Brooks". Theme: 3 options with icons, Dark → `html.dark` + moon, Light → sun, System
> → monitor and following the device; at 375px the trigger is 54px, the list slides to 252–367 on screen, no overflow.
> Reseeded (31 people / 14 jobs / 11 shoots / 0 activity), 0 console errors. On prod, read-only through the app's own
> new select: 200, 33 contacts, 8 people are the assignee of a job with a shoot (each still shows once, under their
> call-sheet role), and 14 of 21 live jobs carry an assignee — they will read as such on the first load.
> **CHANGE — "Categories" is the INVENTORY HIERARCHY, and it is organised by drag & drop** (frontend only, no
> migration). Requested as a ticket ("Rename the existing Categories section to Inventory Hierarchy … Inventory →
> Inventory Hierarchy → Category → Subcategory") plus the studio's own line under it: "дать им тут возможность
> раскрывать списки inventory и перемещать их между категориями и сабкатегориями при помощи drag&drop".
> **The rename is two strings, deliberately:** the Inventory header button (`Categories` → **Inventory Hierarchy**,
> icon-only below `sm` with the name in `aria-label`) and the window title (`Categories & subcategories` →
> **Inventory Hierarchy**). The LEVELS keep their names — Category and Subcategory are what the filters, the item
> form's "Filed under" and every count say — and the window now states the order they nest in with a small
> "CATEGORY › SUBCATEGORY › ITEM" key, counts read "5 subcategories · 11 items" (it said "5 sub"), and adding one is a
> labelled "+ Subcategory" instead of a bare plus. The vocabulary scan retires the old title.
> **The tree opens down to the items.** Categories start open and collapse (one by one, or "Collapse all"); a
> subcategory opens to list its items with their unit / on-hand counts; and **Not filed** is a group of its own at the
> top — the 51 pieces on prod with no subcategory, grouped by the category they were imported as — always present,
> so there is somewhere to drag an item OUT to.
> **Drag & drop, on pointer events — not the HTML5 API**, which does not work with a finger on most phones and
> tablets, and this app runs on iPads. `src/lib/useTreeDrag.js` owns the gesture: a press becomes a drag only after
> 4px of movement (a tap is still a tap), the place under the pointer is the nearest `[data-drop]` ancestor of
> `elementFromPoint`, the panel scrolls itself near its edges, a place held for 550ms is reported (a collapsed
> category opens under the pointer, like a folder), Escape cancels WITHOUT closing the window (a capture-phase
> listener on window runs before the modal's own), and the click the browser fires after a drop is swallowed so the
> drop doesn't also toggle what it landed on. The ghost follows the pointer by writing its transform directly; React
> re-renders only when the PLACE under it changes. A mouse drags a row from anywhere on it; a finger only from the
> grip, which carries `touch-action: none`, so the rest of the list still scrolls under a thumb.
> **What a drop MEANS lives in the pure `src/lib/hierarchyDrop.js`** (+24 assertions, **523 total**): an item (or
> every TICKED item — a drag of one carries them all) onto a subcategory files it there, only the pieces not already
> there move, and the destination reads as its path because "LED" can exist in two categories; onto Not filed takes it
> out; onto a CATEGORY is refused with the reason ("Items go in a subcategory — drop on one.") — the rule the
> taxonomy was built on; a subcategory onto a category, or onto a row of another category, moves there with its items
> following, and a name that category already has is refused with the clash named. Dropped where it already is,
> nothing happens and nothing lights up. `undoPlan` is worked out BEFORE the move, per origin, so **Undo** sends a
> gathered drag's pieces each back to its own subcategory, Not filed included. The place under the pointer lights
> violet where it would land and rose where it is refused, and the ghost says which ("→ Grip / Rigging").
> Without a drag: tick items and the footer offers **Move to…** (every "Category / Subcategory" path + Not filed) —
> the keyboard's and a small screen's way, through the SAME verdicts. The footer is also where "Moved “B10” to Grip /
> Clamps · Undo" appears, outside the scroll container like `ErrorNote`, so it is seen wherever the list is scrolled.
> ⚠️ **Moves are OPTIMISTIC in Supabase mode now** (`assignItemsSubcategory`, `updateSubcategory`): the local state
> changes first in both modes, then the database is written, and a refused write is put back — only the rows that
> call moved — and reported. Without it a dropped item snapped back to where it came from for the second the refetch
> took, which reads exactly like a failed drop. Both used to let a thrown write escape as an unhandled rejection; they
> return `{ error }` now, which the bulk "File under…" tool gets for free.
> Verified in local mode by measurement, every path: mid-drag the ghost read "Big Ben Clamp → Grip / Rigging", the
> target carried `ring-violet-300`, the source row `opacity-40` and `body.tree-dragging` was set; the drop moved it
> (Clamps 3 → 2, Rigging 1 → 2, stored subcategory Rigging, one `item.filed` event), Undo put it back; an item held
> over a category went rose with the reason and changed nothing; Rigging dragged onto Audio moved with its J-Hook
> (Audio 4 subcategories · 5 items) and Undo returned it; Grip's Clamps onto an Audio that has a "Clamps" was refused
> ("Audio already has a “Clamps”."); an unfiled Safety Cable into Rigging took Not filed 2 → 1, and back out to Not
> filed 1 → 2; two ticked items moved together both by drag ("2 items → Grip / Rigging") and by Move to… (28 options);
> a click dispatched onto the Rigging row right after a drop did NOT open it; Escape mid-drag cancelled with the
> window still open and the item unmoved; a collapsed Audio opened after 800ms held over its header; holding at the
> bottom edge scrolled the list 294px in half a second and the top edge brought it back; a TOUCH pointer on a row
> did not start a drag while one on the grip did. At 375px no overflow, every subcategory on one line (a long name
> truncates rather than pushing its icons onto a line of their own — found in the screenshot and fixed), the header
> button icon-only; light and dark both looked at. Reseeded (44 items / 27 subcategories / 2 unfiled / 0 activity),
> 0 console errors. ℹ️ The Supabase write path was verified by reading, not by clicking — signing in is not something
> Claude does; the first real drag on prod exercises it.
> **RENAME — the Items tab's primary button is "Add Inventory", and the card's is "Add item"** (frontend only).
> Asked why the card's **Add unit** couldn't read "Add item", the studio heard the answer (an item's card vs one
> physical piece of it) and decided: the header button that CREATES an entry becomes **Add Inventory**, which frees
> **Add item** for the card's button that adds another piece to that entry. Exactly those two labels changed, plus
> the card button's tooltip ("Another one of these — with its own barcode and serial"), which would otherwise have
> contradicted it. A non-barcoded entry keeps **Add stock** there. The vocabulary scan used to RETIRE "add
> inventory" (from the sweep that made the button "New item"); that entry is gone and the reason now names the new
> button — the scan follows the studio's words, not the other way round.
> ⚠️ **Deliberately NOT renamed, pending the studio's call** — the windows those buttons open and the rest of the
> unit vocabulary still say what they said: the create window is titled "New item" / "Create item" (and the job
> equipment window offers "New item “…”"), the card's window is "Add units" with "Add another unit" / "Add 2 units",
> and the card, table and counts read UNIT / "N units". Asked in the same breath whether those should follow.
> Verified in local mode: header reads Inventory Hierarchy · Add Inventory; a barcoded card reads Add item · Work
> history · Edit item, a non-barcoded one (Gaffer Tape) Add stock; Add item opens the units window and Add Inventory
> the create window, as before; 523 assertions, 0 console errors.
> **FEATURE — inventory search that finds the gear without its exact name** (frontend only, no migration).
> Ticket: partial keyword matching, live results, typo tolerance, part of a name, and a synonym list — "users must
> type inventory names almost exactly as stored". True, and worse than it sounds: SIX places searched inventory
> (the Inventory list, the job's equipment window, the legacy shoot editor, the kit window's "Add item", the kit and
> scenario-list editors), each with `name.toLowerCase().includes(query)` — ONE unbroken piece of the stored name —
> and every picker then took `.slice(0, 8)` in REGISTER order, so with many matches the best one could be cut off.
> **Options weighed, and why this one:** a server-side search (Postgres full-text or `pg_trgm`) would add a round
> trip per keystroke to data the browser already holds — the whole register (276 items / 437 units) is loaded, so
> the right place is the client, and it stays right to tens of thousands of rows. A library (Fuse.js, MiniSearch)
> was the other option; a pure module was chosen because the rules that matter here are domain rules no library
> ships with (sizes, inch/foot marks, fractions, barcodes that must never match fuzzily), and a pure module is what
> `test:lib` can pin — the same reason every other rule in this codebase lives in `src/lib`.
> **`src/lib/search.js`** (PURE): both the names and the query are normalised the same way — case and accents off;
> a size written 6×6, 6x6 or 6' x 6' is ONE term (the real register writes it all three ways, sometimes for the same
> product); 2" is "2 in", 25' is "25 ft", 5° is "5 degree"; neighbouring words also yield the joined word (C-Stand →
> cstand, Speed Rail → speedrail — both spellings exist in the register) and a word mixing letters and digits its
> parts (B10X → b, 10, x). Every query term must match (AND, in any order) the name, brand, subcategory, category,
> unit barcodes/serials or note — as the whole word, the start of a word (live, part-typed), inside a word, or
> within typo distance (Damerau–Levenshtein, a swapped pair counts once; one edit from 4 letters, two from 8 — the
> thresholds search engines use). Plural = singular without a stemmer ("lens" must not become "len"). Ranked by how
> well and where each term matched (name counts most) plus small bonuses (name starts with the first word, holds
> every word, in the order typed); highlighting returns spans in the ORIGINAL string, so a typo or synonym match
> marks the word it actually found ("profto" marks Profoto, "shot bag" marks Sandbag).
> **The noise rules — each one found by running the engine against the studio's REAL register** (read-only, into the
> scratchpad, never the public repo) with a battery of ~80 queries, old `includes()` count beside the new one:
> • numbers and codes are never fuzzy — 0852 must not find barcode 0851 — and a number is the START of another
>   ("12" → 120) only while it is the word being typed: "2 inch" means 2", not the 20"/24"/27" it first returned;
> • a single letter matches a whole word of the NAME only ("usb c", "a clamp"), or the start of one while typed
>   ("profoto b" → Beauty Dish) — "c stand" first returned stands filed under the category **C**amera Support;
> • inside-a-word matching reads names and brands only: "head" inside "OVERHEAD Fabrics" brought 15 silks;
> • a typo keeps its first letter ("mark" is not "cark" — the laptops are named CARK-ANN-…; "cstand" is not "stand"
>   with the c deleted), and synonym expansions get no typo tolerance on top (it compounded exactly that way);
> • a four-letter word is forgiven a typo only when it matches NOTHING as typed: "grid" is a real word and must not
>   also bring every item filed under "Grip", while "magc" still finds Magic; and a typo in a word still being typed
>   needs five letters ("mats" was a typo of the start of every "Matt…hews").
> **Synonyms: `src/data/searchSynonyms.js`**, ~90 groups built from the register's own vocabulary (Lightbank/Octabank
> = Softbox, Shot Bag = Sandbag, Applebox Eighth/Quarter/Half = 1/8, 1/4, 1/2, Para = parabolic, Transceiver /
> Pocket Wizard = trigger, Cube Tap, UPS = Battery Back-Up, China ball = Lantern, mbp = MacBook Pro, md/lg/xs…) plus
> the usual grip and camera slang and spelling (grey/gray, colour/color, inch/in, feet/ft, lb/pounds, watt/w). A
> phrase of up to three words is one term ("century stand"), and the word still being typed reaches a group through
> its start ("shotb" → sandbag). A wrong entry can only widen a search; a direct match always outranks a synonym one.
> **Speed:** each distinct query word is scored against each DISTINCT term of the register once (a dictionary built
> with the index), and items only look those scores up — the first version scored per item and took 65 ms on a
> synonym-heavy query; now 1–8 ms per keystroke, the index ~15–25 ms and rebuilt only when the register changes.
> **Wiring:** `src/lib/useItemIndex.js` (the index, reading the taxonomy ITSELF so no picker grew a prop — the
> `companies={companies}` lesson) and `src/components/MatchText.jsx` (the highlight) are used by all six places; the
> Inventory list orders groups, subgroups and items by relevance while a search is on (the tree order returns when
> it is cleared); kits and lists are searched by name the same way; the unit table's barcode/serial marking now
> strips a copied `#`. Barcodes and serials keep exact-piece matching in `UnitPickList` (a typo there is a wrong unit).
> **58 new assertions (581 total)** — every requested behaviour, every noise rule, highlighting, the synonym list's
> shape — and proved able to fail by mutation (typo tolerance switched off → the suite goes red).
> Verified on the real register: "fresnel profoto" / "prof fres" → Profoto Fresnel Spot; "profto" → the 24 Profoto
> items; "c stand" / "cstand" / "century stand" → exactly the two C+ Stands; "12x12 silk" → the two 12' x 12' silks;
> "6x6" → 12 (was 3); "quarter silk" → the 1/4 silks; "chimera lightbank md" → the two medium Lightbanks; "mark 4" →
> the three Mark IV items; "type c" → the 8 USB-C/Type-C items and "usb-c cable" the 5 USB-C cables (adapters left
> out); "#0793" → the Fresnel by barcode; "2 inch" → nothing (there is no 2" item); "profoto keyboard" → nothing.
> In the browser (local mode): the list, the job's equipment window ("magik keybaord" → Apple Wireless **Magic
> Keyboard**, both words marked), the kit editor, and the Kits/Lists tabs ("camra" → Camera Kit A, "ecomerce" →
> Loft e-commerce); 0 console errors.
> ℹ️ **Not built, offered instead:** a studio-EDITABLE synonym list (the file above is code — adding a word needs a
> deploy; a small table + screen would let the crew add their own nicknames), a per-item "also known as" field, and
> the same engine for the Jobs and People searches, which still use their own matching.
> **REDESIGN — the packing list tracks the lifecycle: Item · Vendor Source · Check-Out · Check-In, on screen and
> on paper** (`20261001120000_packing_lifecycle.sql`). The ticket, item by item: (1) the item with an optional
> per-line note IN PARENTHESES after the name, no notes column; (2) Vendor Source = In-House / Rental House, Rental
> House highlighted yellow; (3) Check-Out when the piece is placed in the studio, recording the staff member's name
> and the date/time by itself; (4) Check-In by a tap or by scanning a barcode / QR, recorded the same way;
> acceptance: the same layout and the same yellow in the digital view and the exported PDF.
> **Storage was mostly there.** `packing_signoffs` has carried `out1 / out2 / ret` slots since 6.2, the single
> "packed" tick wrote `out1`, and `ret` sat "unwritten and waiting" — this file said so. So `CHECK_OUT = 'out1'`
> (every tick ever made reads as a check-out, a legacy double sign-out included) and `CHECK_IN = 'ret'`; the
> migration adds only `out1_name`, `ret_name` and `ret_via` (`manual | scan`, CHECKed). The initials stay beside
> the names as the record of the three-field era. And `order_lines.notes` has existed since the FIRST schema —
> `setOrderLines` even wrote it (always null) — but nothing selected it, mapped it or let anyone type it: the note
> is a read (`notes` in the lines select, `mapLineRow`, the local resolver) plus one field in the equipment window,
> not a column. ⚠️ Reads degrade by layer as always: `getPackingSignoffs` selects the three new columns as the
> OUTERMOST layer, and `setPackingSignoff` strips them and retries on a database without the migration (reporting
> `nameNotStored`), so deploying before migrating loses nothing but the name.
> **`lib/packing.js` is the one definition** (PURE): `packingRows` carries each line's note onto every row it
> expands to; `itemLabel` → "Profoto B10 (Needs new battery)"; `sourceLabel` / `isRentalHouse` — the ticket's
> words, "In-House" / "Rental House · Northlight Rentals" (the equipment window still says Sub-rental, deliberately
> not renamed on a guess); `signoffOf` (legacy-aware), `packingProgress` → `{ total, out, back }`, `signerName`,
> `whenLabel` ("01 Oct 2026, 14:32" — one fixed English format so the screen and the paper agree to the minute),
> and `resolvePackingScan`: the row carrying the scanned barcode, refused with a sentence when the code is not on
> this job or the piece is already checked in/out (naming who), and ALLOWED for a piece never checked out — a crew
> can pull a job without the sheet and still record the return — but said ("it was never checked out").
> **Digital** (`PackingChecklistModal`, now `size="xl"` — a new `max-w-4xl` in Modal): one scan field at the top
> with a Check in / Check out segment (check-in default, the ticket's case), the kit window's three rules (the
> decorative `#` stripped, a value that IS a barcode on this list fires without Enter, every outcome reported); the
> four column heads; per row the item + "(note)" + barcode/slot/×qty, the source chip (`bg-amber-100 text-amber-800`
> for a rental house — the amber ramp is mapped in the dark theme), and two check cells. An empty cell is a dashed
> button; a tap records the signed-in account's full name and the time; a signed cell shows both (violet for out,
> emerald for in, "· scan" on a scanned check-in) and because a name and a time are a RECORD, undoing takes a second
> deliberate tap — the cell turns into "Undo? Yes / No" rather than clearing on the first. On a phone the row is
> three tiers (item / source / the two cells side by side); from `sm` the wrappers are `contents` and dissolve into
> the four-column grid. The job card's strip reads "N/N out · N/N back". Closing a job is NOT blocked by pieces
> still out (the rule this file already carries), the counts are what say so.
> **PDF** (`packingListPdf`): the same four columns, 214 / 78 / 104 / 103pt on A4 portrait; the name wraps to two
> lines with the note in parentheses, the detail line under it; a Rental House cell is filled amber-100 with
> amber-800 ink and the vendor on a second line — `test:lib` asserts the exact fill operator jsPDF writes for
> [254,243,199]; a recorded check prints the name (bold) and the time in a tinted cell (violet-50 / emerald-50, as
> on screen, "(scan)" appended for a scanned check-in); an unrecorded one prints an EMPTY box to be filled in by
> hand — so the printed sheet is both the digital record and a paper form. The legend above the table says so in
> two lines; the totals line reads "N rows · N pieces · N checked out · N checked in". The stale "Initials: two at
> sign-out…" line that had survived since the three-field era is gone.
> **Activity**: `Checked out` / `Checked in` (with the name, "· scanned" for a scan) / `Undid the check-in` replace
> "Signed packed"; an initials-only event from before still renders.
> **+41 assertions (618 total)**, and three of the first drafts were MY fixture errors worth keeping: a row that
> carries a legacy `out2` sign-off IS checked out, so a scan of it must not say "never checked out", and a check-out
> scan of it must be refused by its initials; and PDF bytes escape parentheses — a note prints as `\(…\)`, so the
> assertion has to look for the escaped form.
> Verified in local mode by measurement: the checklist opens at 896px with the four heads; Check out → the cell
> turns violet with "Demo user · 01 Oct 2026, 08:54"; pasting `#0805` with its hash and no Enter → "#0805 Aputure
> 300X — checked in (it was never checked out)", the cell emerald with "· scan", the input cleared, the counts
> 1/6 out · 1/6 back; the signed cell → "Undo?" → No keeps it; the store holds `{ name, via }` and the feed two
> events (`out1:Demo user`, `ret:Demo user:scan`); a note typed in the equipment window on Aputure 600D Pro stored
> on the line and read "Aputure 600D Pro (Needs new battery)" in the list, with its check-out INTACT across the
> equipment save (the line key is content, not id); on the job with the Astera Titan Tube the chip read "Rental
> House · Northlight Rentals" in amber; both PDFs looked at through an iframe overlay (note in parentheses, violet
> and emerald cells with name and time, the yellow cell with the vendor, "11 rows · 12 pieces · 1 checked out · 0
> checked in"). At 375px the first layout squeezed the source chip to 16px (two 8.5rem cells took the width) —
> fixed to three tiers: chip 62px / rental chip 183px untruncated, cells 142 + 141, no overflow. Demo data
> reseeded, 0 console errors.
> ⚠️ Browser-tool lesson: changing only the `#zoom=…` fragment of a blob URL does NOT reload the PDF viewer in an
> iframe — the screenshot came back identical and read as stale. Recreate the iframe element.
> ⚠️ **Fixed from the studio's first prod screenshots:** the scan field's selected segment (Check in / Check out)
> was `bg-slate-800 text-white` — in the dark theme slate-800 is a TEXT step and maps light, so the label vanished
> into a white box. It is `bg-brand text-white` now (a fill under white text never follows the theme — the rule the
> dark-theme entry wrote down); measured 5.89 in both themes. Their screenshots otherwise matched the design: the
> note in parentheses, "Rental House · Kitbay" in amber, "Clay Rodriguez · 01 Oct 2026, 10:17", the PDF identical,
> and one row reading "CR · 29 Sep 2026, 18:51" — a tick from the initials era, read as a check-out by design.
> **FEATURE — the register sees the lifecycle: where every unit stands now, and "Out now"** (frontend only, no
> migration). Asked after the packing redesign whether "full lifecycle tracking … with inventory visibility" was met:
> honestly, no — a check-out lived only inside its job. The two pieces that close it:
> **(1) Where each copy stands, on the item.** `lib/packing.js` `unitLifecycle(orders)` derives it from every job's
> sign-offs (PURE, +9 assertions, **627 total**): per `itemId::barcode` the LATEST event wins (out on one job, back on
> it, out again on the next), an archived job's checks are gone with it, and a CLOSED or canceled job's outstanding
> check-outs are history — closing releases the gear, so "out on a closed job" is not "out now". `isOutNow`,
> `unitState`, `outNowByItem` (counted rows count as one), `lifecycleEventsFor(orders, {barcode})` (a unit's own
> history, newest first, across jobs, legacy double sign-outs included). The units table's STATUS cell carries the
> record under the badge — "Out since 01 Oct 2026, 10:40 · Demo user" in violet, "Back 01 Oct 2026, 10:40 · Demo
> user" in emerald, the job in the tooltip; the units header counts "N out now"; the unit HISTORY dialog prints
> "Out … / Back … · scan" under the shoot they belong to; the item peek marks a unit "· Out"; and the packing events
> now carry `unitId`, so an item's Activity feed shows "Demo user checked out · Aputure 300X" for free (an item's feed
> reads its units' events). ⚠️ **The reservation badge is "Reserved" now, not "Checked out"** (and the units header
> "N reserved"): the ticket made "checked out" mean the recorded moment, and one word cannot carry both — the value
> stays `checked_out`. Fixed while there: "1 units".
> **(2) "Out now" in Inventory.** A toggle in the Filters panel ("Out now · N", N = items with a piece checked out and
> not back), counted in the Filters badge and cleared with the rest; the list row says "N out" in violet BEFORE any
> filter, which is the register's view of the packing lists.
> Also: the feed detail no longer repeats the actor's name (it IS the actor now; initials from the three-field era
> still show, they could differ).
> Verified in local mode: check-out #0803 + a pasted-scan check-in of #0805 → card "2/6 out · 1/6 back"; Inventory:
> Aputure 600D Pro header "3 units · 1 available · 1 reserved · 1 out now · 1 in repair", #0803 "Reserved / Out since
> 01 Oct 2026, 10:40 · Demo user", #0805 "Back …", list row "1 out", "Out now · 1" → "1 of 44 items" with Filters 1,
> the unit history "Out 01 Oct 2026, 10:40 · Demo user" under the right shoot, the item's Activity "Demo user checked
> in · Aputure 300X · scanned". Reseeded, 0 console errors.
> **CHANGE — a job has several ASSIGNEES, and "Other" is a choice with its detail beside it**
> (`20261001130000_job_assignees.sql`, applied and verified on prod). Two reports against the job form.
> **(1) "Просили ALL Crew — нужен множественный выбор."** The Assignee field took one person; the client's ticket
> said "Photographer → add all crew". New `MultiComboField`: chips for who is on the job, a text box after them
> that narrows People, the usual popover (portal, fixed, flips above, outside-click / Escape — Escape closes the
> list, not the modal). A row TOGGLES and the list stays open; Enter adds what was typed (and never submits the
> job); Backspace on an empty box takes the last chip off; a name People lacks is offered as `Add "…"` and said
> under the field ("is not in People yet — added when you save"), then filed on save as before. `onChange` takes
> an UPDATER (the stale-value rule). The text box is sized to its content (`size`) and the chevron is absolute,
> so two names and the cursor share ONE 38px line — measured: with a `min-w-[6rem]` box the field was 68px
> beside a 38px neighbour. Label "Assignees" (one person still reads "Assignee" on the card, peek, day view,
> tooltip and both PDFs). The feed calls the field "assignees", on old events too (applied on read).
> **Storage:** `order_assignees (order_id, contact_id, position)`, unique per job+person, contact RESTRICT, RLS
> for authenticated, DELETE kept (a job's contents, replaced wholesale like its lines). `photographer_contact_id`
> STAYS and is written as the FIRST assignee, so a tab on yesterday's bundle still shows somebody; a job with no
> rows falls back to that column on read. The migration backfilled every job that had a person. The app holds
> `order.assignees` (names, in order) everywhere `order.photographer` used to be; `booking.assignees` mirrors it
> in local mode. Repository `withAssignees` resolves each name (filing new people) and `setOrderAssignees`
> replaces the rows; `getOrders` and `getPeople` each got a new OUTERMOST layer (seventh time that rule held).
> Search finds a job by ANY assignee. The dead `photographersIn` and the unused `photographer` search criterion
> went. **persist v7 CONVERTS a v6 snapshot** (single `photographer` → `assignees`) instead of reseeding, and
> Supabase mode now keeps its whole UI state across a bump — the earlier bumps reset theme and "where I was" for
> nothing. Demo: the 3-day shoot has two assignees (Marcus Reed, Jonas Lind).
> **(2) "Other каждый раз создаёт новую опцию — дать Other и рядом вводить что именно."** The shoot type's
> in-menu "Other…" typed INSIDE the list and the typed value joined the list for everyone (`jobTypesIn` merged
> every type a job carried; prod showed a one-off "Test"). Asked, and the same was applied to the call sheet's
> roles (prod's role list offered a test "eee" forever). New `OtherSelectField` + pure `lib/otherChoice`: a FIXED
> list plus Other, and picking Other puts a "Which one?" field beside it, focused. What is STORED is still the
> typed detail ("Lookbook"; a bare Other is "Other"), so cards, PDFs and search read it unchanged and no
> migration was needed. The mode is held in component state, not derived from the value: typing "PDP" into the
> detail would otherwise flip the choice mid-word; it settles on blur, where a detail that names a fixed option
> BECOMES it ("pdp" → PDP — `normalizeChoice`, also applied to the payload). The Jobs filter offers Editorial /
> PDP / Other, and Other matches every typed type (found by text, never offered as an option). Roles: CALL_ROLES
> + Other; `crewRoles` is gone, `crewRow` canonicalises a listed role's spelling ("photographer" → Photographer),
> so two spellings of one call fold into one row. `SelectField` lost its `other` prop (dead plumbing removed).
> ⚠️ In Other mode the wrapper's classes REPLACE the plain ones instead of adding to them: two `min-w-*` in one
> class list are settled by stylesheet order, not intent.
> **654 assertions.** Verified in local mode: v6 snapshot converted (14 jobs, 11 shoots); the seeded job's card
> reads "Assignees · Marcus Reed, Ann Taylor" after an edit, the person histories re-resolved (Ann gained it,
> Jonas lost it), feed "edited the job · set name, shoot type, assignees"; Other → "Lookbook" stored as typed,
> list still Editorial / PDP / Other on reopen, filter Other → 1 of 14; "pdp" typed beside Other stays Other
> while typing and becomes PDP on blur (Set name returns); roles list 10 + Other with "Gaffer" beside it on one
> line at 1280 and wrapped cleanly at 375 (no page overflow); calendar tooltip, day view and the job peek list
> both names, a name in the peek stacks the person card; a NEW job through both steps stored two assignees and
> "Test type" and filed "Probe Person" into People. Chip text 6.65 light / 10.98 dark. 0 console errors.
> On prod (service_role + anon only — no sign-in): predicted 14 backfilled rows from 14 jobs with a person, got
> **14/14** at position 0; both new embeds answer 200; a duplicate is refused **23505**, an unknown person
> **23503**; an anonymous read returns `[]`. ℹ️ The authenticated WRITE was not exercised by me (that needs a
> sign-in); its policy is the same `for all to authenticated` as `packing_signoffs`.
> **RENAME — the position is INVENTORY and a physical piece is an ITEM** (frontend only, no migration). Asked
> against the Add Inventory window's "Its units / Add another unit": "Если поменяли в одном месте Units на Items,
> то так должно быть везде" — the card's "+ Add unit" had become "+ Add item" at the studio's request (732a9d4),
> and nothing else followed. ⚠️ The collision had to be settled first and was ASKED: "item" already named the
> position ("44 items", the Items tab, "Edit item", "Furniture still holds 4 items" — ~90 strings), so pieces
> becoming items left the position without a name. Offered Product / Inventory / Item type with previews; the
> studio first floated "Equipment" (assessed: uncountable, and it collides with the job's own "Edit equipment"
> button), then chose **Inventory — the client's word**. This SUPERSEDES the earlier "one word for a physical
> piece: UNIT" pass.
> The rule now: **Inventory** for the position — the tab, "Add Inventory" → "Create", "Edit inventory" →
> "Save", "Search inventory…", "New inventory “…”", "Category › Subcategory › Inventory", the peek card's type
> label; English has no countable form, so a COUNT in compact places reads "44 inventory" (the header, the
> filter footer, the hierarchy's "5 subcategories · 11 inventory") and in a SENTENCE "inventory entry/entries"
> ("Grip still holds 11 inventory entries in 5 subcategories", "added this inventory entry", the drag ghost,
> the bulk-file note). **Item** for the piece — "Add item", "Its items", "Add another item", the ITEM column,
> "3 items · 1 available", "Item history", "Edit item #0802", "Choose / scan an item", "Choose item",
> "3 slots still need an item", "Sub-rented from them (4 items)", the feed's "registered an item" / "sent an
> item for repair", the store's refusals. A kit counts its slots as items, which is now exactly right; the
> packing list's "Equipment item" column was already the client's word for a piece and stays.
> 157 replacements across 24 files, each asserted with its count (one comment twin caught that way). The
> scanner MISSES one-word literals handed to a plural helper (`pieces(n, 'item', 'items')`, `'units'`) — it
> reads them as identifiers — so those were found with a separate grep: the hierarchy counts, the taxonomy
> refusals, the drag label and `ARCHIVE_KINDS` (item → "inventory entry", unit → "item"). "Added a ${kind}" /
> "Renamed a ${kind}" now pick their article (`withArticle`), or "an item" would have read "a item".
> Identifiers, tables, file names (`UnitEditorModal`, `units`, `inventory_items`) keep their words.
> ⚠️ **The vocabulary scan now RETIRES `unit(s)`** (`test:lib`, 659 assertions incl. 5 new feed titles), so a
> screen written tomorrow cannot bring the old word back; "item" can't be retired — it is the piece now.
> Verified in local mode by reading every surface back out of the DOM: Inventory header "44 inventory · 3 kits
> · 4 lists · 314 items", tabs Inventory / Kits (3) / Lists (4), card buttons Add item · Work history · Edit
> inventory, column Item, "3 items · 1 available · 1 reserved · 1 in repair"; windows Add items ("Adding items
> to Aputure 600D Pro", "Add another item"), Edit inventory ("3 items — managed individually", Save), Add
> Inventory ("Its items · How many? · Add another item", Create), Edit item #0802, Item history, the hierarchy's
> refusal; the job card, the equipment window (row label Items, "Choose / scan an item", Add inventory,
> "Search inventory…", "New inventory"), kit staging ("Add A-Clamp 2\" (Medium) — pick an item"), the packing
> list, the inventory peek ("3 items · 2 free", "ITEMS (3)"), People, and Calendar week / month / day — **zero**
> "unit" in text, titles, placeholders or aria-labels anywhere. 375px: no overflow, the header wraps to two
> lines, no tab clipped. 0 console errors; demo data untouched.
> **CHANGE — every person picker takes the whole team, and everyone's ROLE is visible**
> (`20261001140000_assignee_roles.sql`, applied and verified on prod). The studio explained the client's "ADD ALL
> CREW" annotation: "crew — команда … выбрать не ток фотографа, а прям много людей … отображать списком в формате
> имя (роль)", then: "сделай это для всех мест где можно выбрать человека". Asked first, and settled: the label
> STAYS **Assignees**, and Call times stay SEPARATE (not filled from the assignees).
> There are exactly two person pickers, and both changed. **(1) Assignees** (`AssigneesField`): a list of rows —
> name · role · × — with an "Add people…" search under it; each pick starts with what People says the person does
> (`personTrade`: their subcategory, or Model), put in the call sheet's spelling (`canonicalRole`) and changeable for
> this job through the same Other control the call-sheet roles use (a trade outside the list — a Booker —
> arrives as Other + "Booker"). Stored as `order_assignees.role`; the migration gave every existing assignment the
> person's own trade by the same rule — never an invented one (no trade → no role, the name reads alone). The app
> shape is `order.assignees: [{ name, role }]` (`normalizeAssignees` also reads plain names — persist **v8**
> converts v7's strings). Shown as "Marcus Reed (Photographer)" one per line on the job card and the peek, joined on
> the day card, the chip tooltip and both PDFs (`assigneeLabel`); a person's work history now says "as Stylist"
> rather than "as assignee", and a role change counts as an edit in the feed. **(2) Call times**: a line can call
> SEVERAL people — "10:00 · Model · Hailey Halter, Valery Kaufman". The form edits LINES and the database still
> keeps one roster row per person (that row is what puts someone on a shoot and builds their history):
> `groupCrew` folds rows sharing time + role + note into a line, `expandCrew` writes one row per person back, and
> every reader (the job card, both peeks, the day card, the tooltip) goes through `groupCrew`. Two calls of one role
> with different notes stay two lines — the note is what tells them apart.
> Every picker's list now shows each person's trade beside the name ("Marcus Reed · Photographer") and matches it
> when typed ("hair" lists the hair & makeup people) — `MultiComboField` takes `{ value, hint }` options, a
> `chips={false}` mode (the assignees list their picks as rows) and `size="sm"` for the call sheet's 30px fields.
> Reads degrade by layer as always: the role is the OUTERMOST layer of both `getOrders` and `getPeople`, and a write
> on a database without the column keeps the people and drops only the roles.
> **674 assertions** (+15: grouping and its round trip, notes keeping lines apart, the tooltip, `personTrade`, the
> label, plain names from before roles, the PDF printing "Marcus Reed (Photographer), Jonas Lind (Stylist)").
> Verified in local mode: v7 snapshot converted on load; the seeded 3-day job reads "Assignees · Marcus Reed
> (Photographer) · Jonas Lind (Stylist)" and "10:00 · Model · Hailey Halter, Valery Kaufman"; in the form, typing
> "hair" offered Marta Silva · Hair & makeup and picking her added a row with that role; Bea Lombardi arrived as
> Other · Booker; a new "Nadia Brooks" had no role, was set to Producer and was filed into People on save (31 → 32,
> history "Producer"); Ann Taylor added to the 07:30 Producer line stored as her own row; the feed read "call
> times, assignees"; the tooltip, the peek and the day card all show "name (role)" and the two-person line. 375px:
> name + × on one line and the role under it, no overflow; 1280: every row one line. Reseeded, 0 console errors.
> On prod (service_role only): predicted the 19 assignments' roles from their people first (Photographer 13, Model
> 3, Assistant / Booker / Warehouse 1 each — the studio had added five since the morning) and got **19/19**; the
> app's two new embeds answer 200 (27 jobs, 33 people), e.g. "Priya Nair (Photographer)".
> ⚠️ **Pushed once with a RED suite, and the reason is worth keeping.** The gate ran as `npm run test:lib | tail -1
> && git commit …` — a pipeline's exit status is the LAST command's, so `tail` succeeded and the chain committed and
> pushed while the suite had failed (its last line read "Node.js v22.18.0", the tail of a crash). Vercel runs the
> same gates before building, so the bad commit never deployed; the fix followed minutes later. Gate chains run
> under `set -o pipefail` now. The failure itself was a FALSE positive in the vocabulary scan: it skipped
> `className` but not `otherClassName="order-last …"`, and read "order" as the retired word. Any `*ClassName`
> prop is code now — and the scan was proved to still bark by planting "Role on 2 orders" in a placeholder.
> **FEATURE — a GENERAL call time for the whole shoot** (`20261002120000_shoot_general_call.sql`, applied and
> verified on prod). Requested: "Call Time: Add the ability to just add a general call time for the shoot without
> needing to add role/person. Sometimes everyone's call time is the same." Every call-sheet row (`roster_entries`)
> must carry a role (a CHECK), so "everyone at 08:00" had nowhere to go but one row per role, each with the same time.
> **`sets.call_time`** (nullable `time`) sits beside `wrap_time` for the same reason: one time for the whole shoot.
> ⚠️ NOT a reuse of `start_time` — that column holds the 09:00 an order-created set was once given without anyone
> typing it, and reading it back as "everyone is called at 09:00" would be fabricated data. Null = no general call.
> **Form:** "General call time" opens the call-sheet block (`CrewField` `callTime`/`onCallTimeChange`, in the job form
> and the legacy shoot editor); the rows under it are the exceptions, the wrap stays last. The wrap check counts it
> (`wrapBeforeFirstCrewCall(crew, wrap, generalCall)`), so a wrap before the general call is reported even when no row
> has a time.
> **Reading it — `scheduleLines(crew, generalCall)` in `lib/crew.js`** (pure) is the call sheet as read: the general
> call takes its place in the day BY TIME (a producer called earlier stays above it; at the same hour it comes first),
> and a row with NO time of its own is called WITH everyone — it reads at the general call's time, listed right under
> it, marked `atGeneral` and drawn lighter (outlined chip, `text-slate-500`) so it is told from a time somebody typed.
> Nothing is stored for those rows, so changing the general call moves them too. Without a general call they keep
> the dash chip, as before. One rule for all five surfaces: the job card, both peek cards (`CallSheetList`), the day
> view, and the chip tooltip (`crewSummary(crew, generalCall)`, which leaves the repeated time off the covered rows);
> the chip's own first time is `earliestCrewCall(crew, generalCall)`. Measured with transitions frozen: the lighter
> chip reads 12 dark / 4.76 light, the general one 13.97 / 16.28. The feed calls the field "general call time", and
> `updateOrder` diffs it against the SHOOT, like the wrap.
> **Repository:** `writeSetRow` is ONE strip-and-retry ladder for `sets` (`call_time` → `wrap_time` → `end_date`,
> newest first), replacing three hand-written copies in `createBooking` / `updateBooking` / `createSetForOrder` — and
> the 6 lint warnings their unused destructured columns produced (18 → 12). `call_time` is the OUTERMOST `getBookings`
> layer (eighth time that rule held).
> ⚠️ **Fixed while verifying, pre-existing:** the WRAP field's time picker had a DETACHED chevron, and the new field
> copied its classes. `sm:w-32` on the INPUT shrank the box to 128px while `TimeField`'s own wrapper stayed full width,
> so the chevron sat at x=980 beside a field ending at 545. The width goes on a wrapper now — the call-sheet rows
> already did exactly that, with a comment saying why. Measured: chevron 517–541 inside 417–545, and at 375px 306–330
> inside 41–334. The wrap field also gained the aria-label it never had.
> Demo: the Studio 2 shoot (Priya Nair) carries `call: '08:00'` with its two people untimed — the "everyone's call
> time is the same" case. +14 assertions (**688 total**).
> Verified in local mode: that shoot's chip reads "08:00 · OMSet1" and its tooltip "08:00 General call · Photographer
> (Priya Nair) · Model (Amanda Googe)"; the job peek, the job card and the shoot peek list "08:00 General call" with
> both people at a lighter 08:00 under it; typing "745" in the form snapped to 07:45, a wrap of 07:00 said "That is
> before the first call", 18:00 saved, and the feed read "edited the job · wrap time, general call time". On the
> seeded 3-day job a general call of 08:00 landed between "07:30 Producer" and "08:00 Photographer" on the card, the
> tooltip and the day view, with the chip still reading 07:30. A new job with ONLY a general call (09:00, no rows),
> created through both steps, stored `callTime: '09:00'` with an empty sheet and showed it on the card, the peek and
> the day view. The picker opens 4px under the field and Escape closes it without closing the form. 375px: both time
> fields full width, no page overflow. Reseeded (14 jobs / 11 shoots / 44 items / 0 activity), 0 console errors.
> On prod, prediction written first: the dry run listed exactly this migration; after it, `call_time` answers for all
> **25** sets with **0** carrying one (nothing invented), the app's newest `getBookings` layer answers 200 with 25
> shoots, a write of 07:45 reads back as `07:45:00`, `25:00` is refused with **22008**, and an anonymous read returns
> `[]`. The probe row was put back to null and left no event — prod exactly as found.
> **CHANGE — the app reads the American 12-hour clock: "5PM", not "17:00"** (frontend, plus six prod text rows;
> no migration). Requested: "Switch app to the american time format … Чтобы было 5PM а не 17:00 / пройдись полностью
> по всему приложению".
> **Storage does NOT change.** A call time stays `HH:MM`, 24-hour: it is what a Postgres `time` holds, and it sorts as
> plain text, which is what puts a call sheet in the order of the day (`normalizeCrew`, `scheduleLines` and
> `earliestCrewCall` all compare strings). Only what a person READS and TYPES changed.
> **`src/lib/clock.js`** (new, pure) is the one place that knows how time reads: `formatTime` ("17:00" → "5PM",
> "17:30" → "5:30PM", "00:00" → "12AM", "12:00" → "12PM" — the minutes are left off on the hour, as in the request;
> anything that isn't a time comes back as it was), `hourLabel` for a picker row, and `whenLabel`, the app's one format
> for a MOMENT ("01 Oct 2026, 2:32PM"), moved here from lib/packing because it is every stamp's now.
> ⚠️ **Five stamps printed the BROWSER's locale** (`new Date(…).toLocaleString()`): the job card's Created and
> Equipment-by rows, the job peek's "Equipment last changed", every activity entry's hover, and the unrouted Archive —
> 24 hours plus seconds on a machine set to Russian and another shape again on an American one, so one card could show
> the same kind of stamp two ways. All read `whenLabel` now.
> **Reading:** every surface goes through `formatTime` — the call sheet (`CallSheetList`: the job card and both
> peeks), the calendar chip's first call, its tooltip (`crewSummary`), the day view, the wrap everywhere, the estimate
> PDF's crew times — and every stamp through `whenLabel`: the packing list on screen and on paper, the item's
> "Out since …", the unit history, the activity feed.
> **Typing:** `parseTimeInput` reads the 12-hour clock first ("5pm" · "5 PM" · "5p" · "5:30pm" · "530p" · "12am" →
> 00:00 · "12pm" → 12:00 · "8:15 a.m."), and a time with NO AM/PM is still read on the 24-hour clock, so "17" and
> "1730" keep working. A bare "5" is 5AM: a period is never guessed. "13pm" and "0am" are refused, not corrected.
> **The field (`TimeField`)** shows "5PM" and hands its parent "17:00". Its hour column runs through the day as
> **12AM … 11PM** (24 rows) rather than 1–12 plus an AM/PM column: one tap is still a complete time, there is no
> period to forget, and it still opens at 8AM. Minutes read ":00 … :55".
> ⚠️ What is typed is now a local DRAFT until the field is left. Reformatting live would turn "10:30" into "10:30AM"
> under the cursor and the " PM" being typed would land after it — measured: mid-typing the field still reads
> "10:30"; after " PM" and blur, "10:30PM". The list and the arrows clear the draft, so a pick is never overwritten by
> stale text. Text that can't be read stays as typed AND the field says so (`aria-invalid` + a rose ring, written as a
> VARIANT so it beats the caller's border); the job form refuses it with "The wrap time should look like 6PM or
> 6:30PM.", and the legacy shoot editor — which had no such check and would have handed Postgres a non-time — now
> refuses too. The numeric keypad (`inputMode="numeric"`) is gone: "5pm" needs its letters. The call-sheet row's time
> field grew 5.5 → 6.5rem, because "12:30PM" is the longest value and it was clipped.
> **The estimate:** a crew member with no time of their own now prints at the shoot's GENERAL call — the rule every
> other surface has read since the general call shipped, and the client's document had missed.
> **Content:** the company editor's placeholder and the six seeded opening hours are 12-hour ("Mon–Fri 8AM–8PM ·
> Sat 10AM–4PM"). On prod the same six rows still carried our seed text verbatim, so they were rewritten BY EXACT MATCH
> (the old value in the PATCH filter, so a row the studio had edited would have been skipped): 6 written, 0 left on
> the 24-hour clock, no events. Opening hours stay free text — whatever the crew types there is theirs.
> ⚠️ **`npm run test:lib` retires `HH:MM` and any 24-hour time in words** (`\b([01]\d|2[0-3]):[0-5]\d\b`); it found the
> opening-hours placeholder the moment it ran. Numeric-only literals (stored seeds, fallbacks) have no letters, so they
> are not words and don't trip it. +46 assertions (**734**), including a round trip over every 5-minute step of the day
> (what the field shows types back as what it stores) and the PDF bytes: "(8AM) Tj" on the estimate, "(01 Oct 2026,
> 2:32PM)" on the packing list, and no 24-hour stamp left on it.
> Verified in local mode by measurement: chips "7:30AM · Day 1/3 · OMSet1"; tooltips ending "10AM Model (Hailey
> Halter, Valery Kaufman) · wrap 6PM"; the day view, the job card and both peeks; the form ("7:30AM" … "6PM" in the
> fields, "--:-- --" when empty); "12:30pm" → 12:30PM, sorted into place on save while the store kept "12:30"; "1730" →
> 5:30PM; ArrowDown → 5:35PM; 7AM then :00 from the list → 7AM; "abc" ringed and refused; "6p" → 6PM; the packing check
> "Demo user · 02 Oct 2026, 10:33AM", the same stamp as "Out since" in the units table and in the unit history;
> "Equipment by Demo user · 02 Oct 2026, 10:34AM" on the card and the peek; the activity hover; the company hours. A
> sweep of all 14 job cards, 32 people, 14 company rows and 81 inventory entries found **0** 24-hour times in text or
> tooltips. 375px: every field fits, the picker stays on screen, no overflow. Reseeded, 0 console errors.
> ℹ️ **Dates did not change** — "01 Oct 2026" and the ISO "2026-09-30" on the cards are a separate format the request
> didn't mention; asked rather than switched.
> **FEATURE — the calendar filters by shoot type: All jobs / PDP / Editorial** (frontend only, no migration).
> Requested: "Добавить фильтр на страницу Календаря, чтобы можно было видеть все джобы, только PDP или только
> Editorial". A segmented control beside Day / Week / Month — same shape, one tap, the choice in effect always
> visible — with exactly the three choices asked for. A job typed anything else (Other → "Lookbook") or not typed at
> all shows under **All jobs** only. The rule is pure, `matchesTypeFilter(jobType, filter)` in `lib/orderSearch`
> beside `JOB_TYPES`, so a stored "pdp" still counts as PDP (it goes through `choiceOf`).
> The filter is applied ONCE, where the calendar lays its shoots out by day (`byDay`), so the week grid, the month
> grid and the day view can't disagree. It is kept like every other screen's filter (`usePersisted('calendar',
> 'jobType')`), so it survives a trip to Jobs and a reload.
> ⚠️ **The day view had to stay honest about capacity.** A studio holding only filtered-out shoots used to read
> "free · Book it" — an invitation to book a day that is taken. The layout now also counts what the filter HID, per
> day and studio (`hiddenByDay`): such a studio reads "1 shoot hidden by the filter", the summary says
> "2 shoots · 1 hidden by the filter · 3 studios free", and only a truly empty studio is free. The week and month
> grids simply hide the chips: there a filter is expected to.
> **Demo content:** the 11 client jobs in the seed carry a type now (8 PDP, 3 Editorial, both seed paths). Without
> one, PDP and Editorial both showed an empty grid. The Editorial ones get no Set name, by the form's own rule
> (`setNameApplies`).
> ℹ️ **On prod only 4 of 21 live jobs have a type** (1 PDP, 3 Editorial; 16 untyped, 1 "test"). Until the rest
> are typed they show under All jobs only. The data is the studio's, so no types were guessed.
> **Fixed while here — `audit:tdz` cried wolf.** It read IDENTIFIERS out of a hook's raw text, comments and
> strings included, so the word "free" in a comment inside `byDay` matched a `const free` declared in another
> function and was reported as a read before its declaration. A small state machine now drops comments and string
> contents before the scan, and keeps template literals' `${…}` expressions, which ARE reads. Proved both ways with a
> throwaway file: a real read before the declaration and one inside `${…}` are flagged, the same words in a comment
> and in a string are not.
> +5 assertions (**739**). Verified in local mode by measurement: the week shows 14 chips under All, 10 under PDP and
> 4 under Editorial (10 + 4 = 14, with no PDP chip under Editorial and none the other way); the month grid gives the
> same split; on Sep 29 with PDP the day view reads as above. The choice survives Jobs → Calendar and a reload. The
> toolbar fits on one line at 1440 and 1024, wraps to three lines at 375 with nothing clipped and no overflow.
> Reseeded, 0 console errors.
> **CHANGE — dates read the American way: "Sep 30, 2026", typed as MM/DD/YYYY** (frontend only, no migration).
> Requested right after the 12-hour clock: "Да, даты тоже переведи на американский формат". **Storage does NOT
> change** — a day stays ISO `YYYY-MM-DD`: it is what Postgres `date` holds, it sorts as text, and it keys every
> reservation window.
> **`lib/clock.js` owns dates too:** `formatDate` ("Oct 1, 2026"); `formatDateRange`, which says the year once ("Sep
> 28 – 30, 2026" · "Sep 28 – Oct 4, 2026" · "Dec 30, 2026 – Jan 2, 2027"); `whenLabel`, now month first ("Oct 1,
> 2026, 2:32PM"); and `parseDateInput`, month FIRST — "9/30/2026", "09/30/26", "9-30-2026", "Sep 30, 2026",
> "September 30 2026", "30 Sep 2026", or a pasted ISO. It returns '' for a February 30th, a 13th month or a day with
> no year: no year is ever guessed. `MONTH_ABBR` is the one month list — four copies used to live in clock, setDays,
> Inventory and the month picker.
> `lib/setDays` gains `spanDated` ("Sep 28 – 30, 2026 · 3 days") for every surface where a span may be any year's:
> the job card and list rows, the peeks, the unit history, the equipment window, both PDFs. The calendar keeps the
> year-less `spanLabel`, because its header already says the year.
> ⚠️ **A stored DAY is never put through the Date parser.** `new Date('2026-10-01')` is UTC midnight, which in New
> York is the evening of Sep 30, so the date a person reads would slip by one. `formatDate` reads `YYYY-MM-DD`
> literally and treats only a full timestamp as a moment. The audit found this trap ALREADY live in three places:
> • the job card's "Created" ran a date-only stamp through `whenLabel` (local mode), inventing a time and, west of
>   UTC, the previous day;
> • the estimate's "Raised by" and the Archive both took the UTC date of a timestamp (`toISOString().slice(0, 10)`).
> `whenLabel` now returns just the date for a bare day.
> **Fields.** `DateField` shows "Sep 30, 2026", reads typing as above, holds a draft until the field is left (the
> TimeField rule) and rings text it can't read. Its `pattern="\d{4}-\d{2}-\d{2}"` is gone: the browser enforced it
> on submit in the repair, usage and item forms, so it would have blocked them the moment the format changed.
> `DateRangeField`'s two typed ends are `DayInput`s on the same rule. They commit a whole day, so a typed last day
> before the first reorders the range ("Sep 20 – 28 · 9 days") instead of passing raw text on. Placeholders read
> MM/DD/YYYY, and the numeric keypad is gone — month names need letters.
> **Surfaces converted** — the audit's list, ~60 sites across 18 components and 6 libs:
> • the calendar: day header ("Wednesday, September 30, 2026"), week label, hover texts. The week label says the
>   month once ("Oct 5 – 11, 2026") and shows BOTH years across New Year, where it used to show only the second;
> • the item availability calendar: tooltips, heading, next commitment, multi-day spans;
> • Jobs list rows and the job card;
> • the peek cards: job dates (which printed "2026-09-28 → null" for a job with no end and called it "Shoot
>   dates"), the item's "On jobs", person and company histories, the shoot badge;
> • People's histories;
> • Inventory: the location column (month said once), purchase date, usage;
> • the repair log, work history, unit history and the equipment window's strip;
> • both PDFs, the capacity refusal ("…5 shoots on Oct 5, 2026") and the unrouted Archive.
> **Search.** The job search's haystack gains the date as the list prints it, so "sep 28" finds a job. An
> unreadable bound in a date filter now filters NOTHING: compared as text, "13/45/2026" sorts before every 2026 date
> and emptied the list. The field itself is ringed instead.
> ℹ️ **Weeks still start on Monday** in every grid. That is a calendar convention, not a date format — asked rather
> than switched.
> `npm run test:lib` retires the `YYYY-MM-DD` placeholder. +52 assertions (**791**), including:
> • every day of 2026–2027 round-tripping through formatDate → parseDateInput;
> • the UTC trap and month-first numeric parsing;
> • ranges across months and years, and `spanDated`;
> • the bare-day stamp, the date search and the unreadable bound.
> Verified in local mode by measurement:
> • the calendar labels as above;
> • Jobs rows "Location · Oct 4, 2026"; the card "Shoot dates · Sep 28 – 30, 2026 · 3 days" and "Created · Sep 28, 2026";
> • the filter fields, typed "9/29/2026" and "Oct 1, 2026", read "Sep 29, 2026" / "Oct 1, 2026", stored ISO and
>   gave "8 of 14 jobs"; "13/45/2026" was left as typed, ringed and ignored by the list;
> • the job form's range, typed "10/2/2026" → "Sep 28 – Oct 2 · 5 days" and "Sep 20 2026" → "Sep 20 – 28 · 9 days"
>   (not saved);
> • a purchase date typed "3/14/2019" saved as 2019-03-14 and read "Mar 14, 2019";
> • the repair log "Sent Sep 26, 2026 · 6 days out", with the return field at "Oct 2, 2026";
> • the peeks and the unit history as above.
> A sweep of 14 job cards, 32 people, the companies, 80 inventory entries and all three calendar modes found 0 ISO and
> 0 day-first dates. Reseeded, 0 console errors.
> **CHANGE — the calendar's type filter gains Other: every typed type at once** (frontend only, no migration).
> Asked about the PDP / Editorial filter: "а можно добавить что бы еще и Other все варианты были?". The control is
> now **All jobs · PDP · Editorial · Other**, and Other means exactly what it means in the Jobs filter: every type
> typed beside Other ("Lookbook", "test"…), all of them together. It is one button rather than one per variant,
> because those variants are free text — a list of them would grow with every typo. Nothing new in the rule:
> `matchesTypeFilter` already compared `choiceOf(jobType, JOB_TYPES)`, which answers `OTHER` for any typed type,
> so the fourth choice is one entry in `CALENDAR_TYPE_FILTERS`. A job with NO type is not Other: it still shows
> under All jobs only.
> The button's tooltip names what Other holds right now ("Every other shoot type: Lookbook"), from the pure
> `otherTypesIn(orders)` (case-folded, once each, name order, live jobs only). Demo content: seeded CL-26057 is a
> Lookbook, so every choice has something to show.
> +4 assertions (**795**): the four choices in order; Other gathers "Lookbook" and "test", never PDP or a lowercase
> "editorial", and never an untyped job; `otherTypesIn` names each variant once.
> Verified in local mode by measurement: the week reads All 14 = PDP 9 + Editorial 4 + Other 1, each filter showing
> only its own type; the tooltip reads as above; the toolbar still fits one line at 1024 (the group is 264px) and the
> four buttons fit unclipped at 375. 0 console errors.
> ℹ️ On prod, Other currently holds one job (typed "test"); 16 jobs have no type at all and show under All jobs only.
> **UI — the calendar's type filter is a DROPDOWN** (frontend only). Reported with a screenshot of the toolbar:
> "Сделай вид фильтра как-то более канонично, чтобы было дропдауном, ибо даёт юзер экспириенс плохой". Fair: it was a
> second segmented control right beside Day / Week / Month, painted in the same violet, so the two read as one
> control with two halves — which half is the view, and which is the filter?
> It is the app's own `SelectField` now: a filter icon, the choice in effect ("All jobs" / PDP / Editorial / Other)
> and a chevron. The list ticks the current choice, and Other carries what it gathers as a muted hint in its row
> ("Other · Lookbook"). While the filter narrows the grid the trigger is tinted violet, so a filtered week is never
> mistaken for an empty one. The trigger keeps ONE width (8.5rem, fitting "Editorial"), so changing the filter never
> shoves the view toggle and the arrows sideways.
> `SelectField` gained two small generic props: a field-level `icon` (drawn in the trigger alone, when the options
> carry none), and an option `hint`, a muted second label in the row that also joins the row's tooltip.
> Measured in local mode: the trigger is 38px tall like Today and the view toggle, and 136px for all four choices with
> nothing clipped. Its tint reads 10.98 dark / 6.65 light. PDP shows 9 chips, All jobs 14, and the choice persists.
> The toolbar fits one line at 1440 and 1024; at 375 it is two lines instead of three, with the list opening on
> screen. No overflow, 0 console errors.
> **UI — selectors are dropdowns, app-wide, by one rule** (frontend only). Requested after the calendar filter: "Это
> касается всех упрощений UI где ты можешь сделай дропдаун, чтобы выглядело красиво". Audited every button group
> and segmented strip in the components and applied a rule rather than converting everything:
> • **Choosing one value from 3+ options → dropdown.** The calendar's view (Day / Week / Month) is a `SelectField`
>   with a calendar icon beside the type filter. The toolbar is now one row of the same kind of control instead of
>   two segmented strips that read as one, and Day still jumps to today. The job form's **Status** is a field-shaped
>   dropdown whose options carry each state's own dot — the card pill's and the chips' colours, through a per-status
>   icon component made once (`statusDot`). A new job still offers Hold and Confirmed only, and Hold is preselected.
> • **The same switch repeated in every row of a list → dropdown.** In the equipment window each line's In-house /
>   Sub-rental is a small dropdown beside its vendor picker, amber while it is a sub-rental. Before, it was a
>   column of pill pairs. In the kit editor each slot's Generic / Fixed is a dropdown beside its item picker.
> • **Kept on purpose:** the section TABS (Inventory / Kits / Lists, People / Companies — a dropdown would hide the
>   other sections) and the single primary two-way switches that ARE the form's first question: Barcoded /
>   Non-barcoded when adding inventory, Received / Went out in the stock window, and the packing list's Check in /
>   Check out scan mode. There, a dropdown would put the only alternative behind an extra click.
> ⚠️ **Fixed while converting:** re-picking a line's CURRENT source ran `switchSource` against the line's own
> quantity. An in-house line therefore read as short of itself and could raise the zero-availability dialog — easy
> to trigger from a dropdown, where re-choosing the shown value is common. It returns early now. A kit slot
> re-picked as its own type is a no-op too.
> Also removed: a comment orphaned by the date change, which described the deleted `dateRange` helper.
> Measured in local mode: the view dropdown turns Month → "October 2026", Week → "Sep 28 – Oct 4, 2026", Day → today;
> the toolbar fits one line at 1024 (view 120px, type 136px) and two lines at 375 with no overflow. The status
> options are Hold / Confirmed / Closed / Canceled, each with its own dot, and picking Hold shows its amber dot in
> the field (cancelled). In the equipment window four lines each offer In-house / Sub-rental; Sub-rental tints the
> line and brings up the vendor picker, switching back raises nothing, and re-picking In-house raises nothing. A kit
> slot switched to Fixed brings up its item picker with "#0961 (out)". Nothing saved, 0 console errors.
> **FIX — the time picker's scroll no longer "hangs", and AM/PM is its own column** (frontend only). Two reports
> with a screenshot of the wrap field: "Зависает прокрутка при выборе времени" and "обычно выбирается час, минуты, а
> потом отдельно AM/PM".
> ⚠️ **The hang was real, and self-inflicted by the placement code.** The list re-places itself on any scroll
> (`document` capture listener, so a scrolling modal carries it along), and a scroll INSIDE one of its own columns
> reached that listener too. Each re-placement set new coords, which re-ran the effect that centres a column on its
> selected row — so the column snapped back while it was being flicked. Two fixes: the listener ignores scrolls
> whose target is inside the list; and the centring runs ONCE per opening (plus once when the arrow keys move the
> value), through `scrollTop` rather than `scrollIntoView`, which also scrolls whatever is behind. Measured: an
> hour column centred at 219 now stays at 0 / 60 / 140 when scrolled there, and at its bottom (238) for 300; a
> minute column stays at 200. Before, every one of those came back to 219.
> **Three columns, the canonical order: HOUR (12, 1 … 11) · MIN (:00 … :55) · AM/PM.** This replaces the 24-row
> "12AM … 11PM" hour list. Nothing is written until the hour AND the half of the day are known — the field never
> guesses AM or PM — and the minute is :00 unless one is picked. While a time is being assembled on an empty field,
> the placeholder says how far it has got ("6:-- --", then "6:30 --"), only while the list is open. AM/PM is the last
> step of the usual order, so picking it closes the list. An existing time edits in place: a new hour or minute is
> written at once, and the list stays open. A minute off the 5-minute grid (08:07) survives an hour or AM/PM change.
> ⚠️ An empty header made the AM/PM column's header 9px against 24px, so the rows didn't line up. A plain space
> collapses; it is `\u00a0` now.
> **Also removed, on request** ("убрать отсюда доп коммент"): the calendar filter's Other row no longer lists the
> types it gathers. It had read "Other · test" — the studio's own test job. With it went the code that only existed
> for it: `SelectField`'s option `hint`, `orderSearch.otherTypesIn` and its assertion (**794**). Dead plumbing that
> reads as live is worse than none.
> Verified in local mode: on an empty wrap, 6 → nothing written, ":30" → nothing written, PM → "6:30PM" and the list
> closes; on 8AM, 9 → "9AM" (still open), PM → "9PM" (closed), ArrowDown → "9:05PM" with the columns on 9 / :05 / PM.
> The list is 178×268, fully on screen at 375 with 40px rows. The filter reads All jobs / PDP / Editorial / Other with
> no extra text. Nothing saved, 0 console errors.
> **CHANGE — every time on a calendar chip is NAMED, and a call-sheet row picks the PERSON first** (frontend only).
> Two reports. (1) With a screenshot of a chip reading "6AM": "Добавлен general call time, но тянет сюда первый,
> который не general … просто время тут не оч понятно что значит … может выводить первый и general и помечать если
> они разные". Fair: the chip printed `earliestCrewCall` bare, so a shoot with an 8AM general call showed somebody's
> 6AM, and nothing said what the number was. `chipCallLabel(crew, generalCall)` in `lib/crew` (pure, +6 assertions,
> **800**) names it:
> • "General 8AM" — the general call comes first, because it is when everyone comes;
> • "General 8AM · First 6AM" — when an individual call is earlier than that;
> • "First call 7:30AM" — when there is no general call;
> • nothing, when there are no times at all.
> A row AT the general hour is not "first". The tooltip still carries the whole sheet.
> (2) "Логичнее будет тогда сначала давать выбрать человека, чтобы подтянуло его роль, а не роль и потом человека".
> A call-sheet row is now TIME · PEOPLE · ROLE in the form, and picking the first person with a trade fills an EMPTY
> role from People — `canonicalRole(trade)`, the rule the assignees list already uses, so a trade outside the list
> arrives as Other + its name. A role already chosen is never overwritten, and removing the person leaves the role
> alone. The call sheet as it is READ keeps time · role · people.
> Verified in local mode: chips read "First call 7:30AM · Day 1/3 · OMSet1", "General 8AM · OMSet1", "First call 9AM"
> and "First call 6:45AM · Day 1/2". Setting a general call of 8AM on the 3-day job (saved, then reseeded) made its
> chip "General 8AM · First 7:30AM · Day 1/3 · OMSet1". In the form, a new row's fields run Call time → People → Role;
> picking "Jonas Lind · Stylist" filled the role with Stylist, and adding Marcus Reed (a photographer) to the 7:30AM
> Producer row left it Producer. At 375 the row wraps field by field with no overflow. 0 console errors.
> ⚠️ My own test slip, worth keeping: a multi-person picker stays OPEN after a pick, by design. A second
> `querySelector` for an option then found "Marcus Reed" in the PREVIOUS row's still-open list and put him there,
> which made the "a chosen role is kept" check pass vacuously. Redone with exactly one list open. When driving a
> picker that stays open, close it, or scope the option search to the popover you just opened.
> **UI — the time field wears a CLOCK and picks from one card; the call sheet sits in two rows** (frontend
> only, no migration). Reported with a screenshot of the job form's call sheet: "Очень стремная такая иконка …
> чтобы выбор времени был симпатичнее … растянуто по екрану, сделать более компактно". Drawn first on a Claude
> Design canvas — A · tap grid, B · scroll wheel, and the empty sheet — and A shipped.
> • **The icon is a clock**, where DateField keeps its calendar (same box, size and colour), lit while the card
>   is open. The chevron made a time read as one more dropdown.
> • **The picker is ONE card with nothing to scroll:** HOUR (12, 1 … 11) and MIN (:00 … :55) as 3×4 grids, then
>   two tall AM/PM buttons — 340×177 against the old 178×268, and the three columns' Windows scrollbars are gone.
>   The rules did not change (nothing is written until the hour AND AM/PM are known, the minute is :00 unless
>   picked, AM/PM closes, typing and the ±5 arrows still work). The quarter hours fill the first column and the
>   other minutes are a step quieter. Cells are 32px with a mouse and 40px under a finger (`pointer-coarse`). The
>   centring code and its refs went with the columns: nothing inside the card scrolls any more.
> • **Placeholder "Set time"** ("Time" in a call row) instead of "--:-- --"; the "6:30 --" progress shown while a
>   time is being assembled stays.
> • **A compact sheet:** General call and Shoot wrap side by side (a 2-column grid, at most 21rem), the "Call
>   times" heading only once a row exists, and no clock in front of a row (its field has one). Empty sheet:
>   **232 → 130px** tall. The wrap warning stays under the wrap field, on one line.
> ℹ️ The card is placed twice per opening — first from a guessed size, then from its measured one — because
> whether it opens above the field depends on its height, which is taller under a finger.
> Verified in local mode: 6 → :30 → PM gave "6:30PM" and closed; 9 on that time gave "9:30PM" (still open), AM
> "9:30AM" (closed); "5a" + Enter gave 5AM and the wrap warning; "12:30pm" fits a call row's 104px field;
> Escape closes the card and not the job form; ArrowDown on an empty field 8AM → 8:05AM; at 375px the two fields
> are 141px each, the card slides to 27–367 and its cells are 40px. Contrast with transitions frozen: cells
> 10.36 light / 16.28 dark, quiet minutes 4.76 / 12, the selected cell 5.89.
> Ship each section end-to-end (migration → verify on Supabase → commit → push → confirm prod).
> Note: migrations 2.6 `repairs` (`20260725120000`), 2.7 `item_usage` (`20260725130000`), 3.1 `kit_slots`
> (`20260726120000`), 3.3 slot types (`20260727120000`), 3.5 scenario lists (`20260728120000`),
> 4.1/4.2 people profiles + `cvs` bucket (`20260729120000`), 4.3/4.4/4.5 company details + `company_types`
> + `units.sub_rental_vendor_id` (`20260730120000`), `orders.kind` (`20260730130000`),
> 5.1/5.2 order fields + `po_number` + `created_by` + `hold` status (`20260731120000`),
> 5.3/5.4 order-line kit/unit columns + `inventory_items.day_rate` (`20260801120000`),
> 5.6 order-line `source` + `vendor_company_id` (`20260802120000`).
> `supabase link` fails here — push with
> `db push --db-url "postgresql://postgres.<ref>:<URL-ENCODED_PW>@aws-0-eu-north-1.pooler.supabase.com:5432/postgres"`.
> Seed via
> `npm run seed:supabase` (wipes+reseeds), or add rows non-destructively (3.3 fixed slots were applied
> to prod via a targeted UPDATE, not a wipe). Every added frontend degrades gracefully if its table is absent (repairs/usage/kits
> fetched in separate try/caught queries), so deploying before a migration never breaks inventory.

## What this is
A **sales demo** of an inventory-tracking + studio-scheduling web app for a photo/film
studio rental company. Goal: a clickable, good-looking prototype to show a prospective
client and close a deal. It is **not** production software.

## Priorities (in strict order)
1. Looks clean, modern, and professional.
2. Core flows are clickable and feel real (create a booking, open an inventory item and
   see its individual units).
3. Ships to GitHub Pages as a static site.

**De-prioritized — do NOT build these:** real backend, auth, database, tests,
edge-case handling, i18n, mobile layouts, accessibility perfection. Do not over-engineer.
If a choice is between "robust" and "simple and good-looking," pick simple.

## Tech stack
- **Vite + React** (JavaScript, not TypeScript — keep iteration fast)
- **Tailwind CSS** for styling
- **Zustand** for state, with the `persist` middleware → `localStorage`
- **lucide-react** for icons
- **date-fns** for date math (week ranges, month grids, formatting)
- **No router needed** — a single `activeView` field in the store switches between
  `"calendar"` and `"inventory"`. (react-router is optional and not required.)

## Data lives entirely in the client
Seed data from `src/data/*`, load it into the Zustand store, persist to `localStorage`.
Provide a **"Reset demo data"** action (e.g. under the Admin menu) that clears
localStorage and reloads the seeds — useful for re-running the demo cleanly.

## Data models

### Studios (fixed)
```js
const STUDIOS = ["1", "2", "3", "4", "5", "L"];
// "L" is just a studio label (a large studio). Treat it like any other studio;
// only the displayed label differs.
```

### Inventory item
```js
{
  id: "kbd-magic",
  name: "Apple Wireless Magic Keyboard",
  category: "Computers",          // drives the category filter
  units: [ /* Unit[] — quantity shown in the list = units.length */ ]
}
```

### Unit (an individual physical copy)
```js
{
  id: "u-0708",
  barcode: "0708",
  serial: "SF0T919700HYH1",
  status: "available",            // "available" | "checked_out"
  location: "Available",          // "Available" OR a set name, e.g. "Nike SS26 — Studio 2"
  ownership: "owned"              // "owned" | "sub_rental"  (manually toggleable in UI)
}
```
- `status`/`location` reflect whether the unit is reserved by a booking on the selected
  date. Precompute this in the seed data, and update it when a booking is created/edited.

### Booking / Set
```js
{
  id: "set-001",
  title: "Nike SS26 Lookbook",
  studioId: "2",
  date: "2026-07-02",             // ISO date
  startTime: "09:00",
  endTime: "17:00",
  photographer: "Ann Taylor",
  model: "Jordan Lee",
  unitIds: ["u-0708", "u-0624"],  // reserved inventory units
  status: "active",               // "active" | "canceled"
  color: "#3b82f6"                // optional, used to tint the chip
}
```

### Contacts (optional, for dropdowns)
Small mock arrays of photographer names and model names to populate the selects in the
booking modal. Free-text entry should also be allowed.

## Views

### App shell
- **Left sidebar** buttons: `Booking Calendar` (placeholder/disabled is fine),
  `Studio Calendar` (default active), `Inventory`. Highlight the selected one.
- **Top bar**: title "AnnTaylor Rental System" + decorative menu labels
  (Admin / View / Generate / Inventory). Only real action needed: **"Reset demo data"**
  under Admin.
- Clicking a sidebar item swaps the main panel. Default view = Studio Calendar.

### Studio Calendar
A **Week / Month** toggle switches layout.

**Week view (primary — mirror reference screenshot 1):**
- Grid: **rows = the 6 studios** (1, 2, 3, 4, 5, L), **columns = the 7 days** of the
  selected week (Mon–Sun).
- Header shows day name + date per column. Tint **weekend columns (Sat/Sun) pink** and
  **today's column yellow**.
- Date nav: `‹` / `›` move by one week, a date label in the middle, a **Today** button.
- Each cell renders that studio's bookings for that day as **chips** (title + time range),
  tinted by `color`. Empty cells are clickable.
- **Click an empty cell** → open the Booking modal with `studioId` + `date` pre-filled.
- **Click a chip** → open the Booking modal in view/edit mode.

**Month view:**
- Standard month grid (weeks as rows, day cells). Nav moves by month.
- Each day cell lists that day's bookings **across all studios** as small chips
  (`studio label + title`), color-coded by studio. If crowded, show "+N more".
- Click a chip → open that booking. Click a day → jump to that week in Week view.

**Booking modal (create + edit):**
Fields: Studio (pre-filled select), Date (pre-filled), Start time, End time,
Photographer (select from contacts OR free text), Model (select OR free text),
**Inventory (searchable multi-select of items → reserves units)**, Notes.
Buttons: Save / Cancel / Delete (edit mode). On save: add/update the booking in the
store and mark the selected units `checked_out` with `location = booking title` for that date.

### Inventory
- **Search box** (filters item list by name) + **Category dropdown** ("All" default).
  Both filters apply together.
- **Item list**: rows showing quantity (`units.length`) + item name. Selecting a row
  opens its detail.
- **Unit detail panel**: a table of that item's units — columns `#`, Barcode, Serial,
  Status (badge: green **Available** / orange **Checked out**), Location, Ownership
  (badge: **Owned** / **Sub-rental**). This is the "17 keyboards → see all 17 with
  serials + location" behavior. Clicking the Ownership badge **toggles owned ↔ sub-rental**
  (manual marking).
- **Add inventory** modal: create a new item (name, category, quantity). Auto-generate
  that many units with placeholder 4-digit barcodes + serials, ownership default `owned`.
  Adds to the store and appears in the list.

## Mock data guidance
Domain = photo/film studio gear. Seed **~30–40 items** across a few categories so the list
looks real. Pull names from the reference screenshot, e.g.: A-Clamp 2" (Medium),
A-Clamp 3" (Large), AC Extension Cord / Stinger 20amp 25', Anker USB-C Hub, Apple Late 2019
16" MacBook Pro, Apple Lightning Cable, Apple MacBook Pro 96W USB-C Power Adapter,
**Apple Wireless Magic Keyboard (17 units)**, Apple Wireless Magic Mouse, Applebox
Full/Half/Pancake/Quarter, Arri 2k Open Face, Arri 750, Avenger Double Riser, Baby Roller,
Bench, Big Ben Clamp, Box Cutter, etc.
Suggested categories: **Grip, Electric/Lighting, Computers, Cables, Furniture, Camera, Audio**.
- Give multi-unit items realistic 4-digit barcodes and serials (like `SF0T919700HYH1`).
- Seed **~8–12 bookings** spread across the current week and studios so the calendar isn't
  empty. Put one or two on "today" and a couple on the weekend so the tinting is visible.
  Set the reserved units' status/location accordingly.

## Build order (separate steps — deploy at step 0, commit after each)
0. **Scaffold + deploy pipeline FIRST.** Add Tailwind + libs, add the GitHub Actions
   workflow and `base` in `vite.config.js`, push, and confirm the empty app is **live on
   GitHub Pages**. (Debug deployment now, not at the end.)
1. Seed data files (`src/data/`) + Zustand store (persist + reset).
2. App shell: sidebar + top bar + view switching.
3. Inventory view: search + category filter + item list + unit detail table.
4. Add-inventory modal.
5. Studio Calendar **week view** + date nav + weekend/today tinting + booking chips.
6. Booking modal (create/edit) wired to the store + unit reservation.
7. **Month view** + Week/Month toggle.
8. Polish: spacing, color, badges, hover/empty states. Make it look intentional.

## Deployment — GitHub Pages via Actions

**`vite.config.js`** (change `studio-demo` to the real repo name):
```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/studio-demo/",
});
```

**`.github/workflows/deploy.yml`:**
```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Then: repo **Settings → Pages → Source = GitHub Actions**.
Live at `https://ruslanduck.github.io/studio-demo/`.

## Definition of done
- Live URL loads with seeded data, no console errors on main flows.
- **Inventory:** search + category filter work; selecting an item shows its units;
  ownership toggles; can add a new item.
- **Calendar:** week + month views; date nav works; clicking a cell creates a booking that
  appears in the grid; clicking a chip opens it.
- Consistent, intentional visual design.
