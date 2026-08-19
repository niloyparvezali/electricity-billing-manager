# CurrentFlow — Production Firebase Version

This version is intentionally **not a monthly-billing app** and contains **no seeded/mock data**.

## Business model

Property
→ Flat / Building / Half Building / Market
→ Room / Shop
→ Residential / Commercial
→ Electricity Meter
→ Meter Readings
→ Exact-period Calculation Record
→ Room-wise History

## Calculation model

A calculation is created between the previous meter baseline and the new meter reading.

Example:

- Meter baseline: 1 Jan 2026, 0 units
- New reading: 10 Feb 2026, 100 units
- Period: 1 Jan → 10 Feb
- Days: 40
- Usage: 100 units
- Rate: saved at calculation time
- Amount: usage × rate
- Calculation time: stored when the calculation is generated

If the next reading happens on 10 Jun, the next calculation is:

10 Feb → 10 Jun

It does **not** reset at the end of a calendar month.

## Reading timestamps

Every meter reading stores:
- reading date/time (`readingAt`)
- last update date/time (`updatedAt`)
- opening/previous reading is determined from the meter history
- calculation stores its own `calculationAt`

Editing an old reading causes calculations for that meter to be rebuilt from the meter baseline and ordered readings, so the periods and amounts stay consistent.

## Meter replacement

A replacement deactivates the old meter and creates a new active meter with:
- serial
- starting reading
- start date/time

Old meter readings and calculations remain in Firestore.

## Account isolation

All application data is stored under:

`users/{firebaseAuthUid}/...`

Firestore rules only allow the authenticated UID to access that namespace.

## Firebase setup

1. Create a Firebase project.
2. Enable Authentication → Email/Password.
3. Create Firestore Database.
4. Add a Firebase Web App.
5. Copy `.env.example` to `.env.local`.
6. Fill in your Firebase Web App config.
7. Deploy `firestore.rules`.

```bash
npm install
npm run dev
```

For deployment:

```bash
npm run build
firebase deploy --only firestore:rules
```

## No mock data

New accounts start empty:
- no properties
- no rooms
- no shops
- no tenants
- no meters
- no readings
- no calculations

The user creates every record through the UI.


## Final requested workflow
- Tenants page shows only active tenants by default, sorted A–Z, with name search and property filter.
- Tenant actions: Add Tenant and Mark left. There is no Archive button.
- Meter cards show tenant name in the upper-right, with the room/shop number directly beneath.
- Meter Reading starts with no selected room/shop. A search box filters the unit list for large properties. After save/edit, Firestore data is refreshed without navigating away from the page.
- Calculations is the history hub: Property → Room/Shop → Tenant. The separate History page is not used.


## V6 mobile-first experience
- Meter identity is vertically stacked: tenant name in the upper-right, room/shop directly underneath.
- Meter reading is a guided 3-step mobile flow with large touch targets and no default unit selection.
- Calculations are presented as a mobile drill-down: property → room/shop → tenant → calculation timeline.


## V7 reading center
The meter-reading page is a full workflow screen rather than a small form:
1. Find a unit using property filtering and search across room/shop, tenant, and meter.
2. Review the selected unit, tenant, meter, opening value, and enter the closing reading.
3. Record the meter check date/time and save.
4. Keep the live reading history visible on the same page after save/edit.
The workflow is responsive and prioritizes touch targets and mobile use.


## V8 tenant workspace
- Rebuilt the Tenants page with an occupancy-focused hero, active tenant stats, search, property filter and A–Z active sorting.
- Desktop uses a dense professional data table.
- Mobile uses readable tenant cards with property/unit/joined/status sections and a full-width Mark left action.
- Mark left uses an in-app confirmation modal and preserves all historical records.


## Backup & restore
Settings now supports both:
- Export backup: downloads the current workspace as a JSON file.
- Restore selected backup: selects a previously exported `.json` file, validates it as a CurrentFlow backup, confirms replacement, then restores all workspace records into the currently signed-in account while preserving record IDs and relationships.


## V10 global search
The global search is now a focused command-palette style experience with:
- instant workspace search,
- quick shortcuts for Properties, Tenants, and Meter Readings,
- result type icons,
- keyboard shortcut Ctrl/Cmd + K,
- Escape to close,
- mobile-friendly single-column layout,
- actual navigation into the corresponding CurrentFlow section.


## V11 tenant recycle-bin history
- Tenants has two views: Active and Left / History.
- Mark left does not delete a tenant. It sets them inactive, releases their room/shop, and keeps the tenant record and history.
- Former tenants can be searched and filtered and can be restored when their original room/shop is vacant.
- There is no permanent delete action on the Tenants page.
- Phone text is kept on its own line under the tenant name so "No phone number" never runs into the name.


## V12 tenant history
Former tenants are history-only. Mark Left moves a tenant to the separate Left / History view, preserves all records, and frees the unit. There is no Restore action and no permanent delete action on the Tenants page.


## V13 meter workspace
The Meters page is rebuilt as a responsive management workspace:
- searchable by meter serial, room/shop, tenant, or property;
- filterable by property;
- tenant name is aligned in the upper-right with the room/shop directly below;
- latest reading and meter start values are clearly separated;
- Edit changes only the meter serial and preserves history;
- Reset / Replace deactivates the old meter and creates a new meter chain without deleting the old record.


## Overall reliability fixes
- Fixed missing backup/restore imports so Settings can build and restore backups correctly.
- Fixed backup restore to use Firestore batches with safe chunking.
- Parallelized workspace loading for large properties.
- Removed demo seeding from the legacy data module; production has no demo-data path.
- Meter readings now determine the tenant by the actual reading date/time, not only the currently active tenant.
- Backdated meter readings use the correct previous reading in chronological order and are prevented from exceeding the next recorded reading.
- Added an application-level error boundary with a safe reload screen.


## VS Code JSX syntax repair
The latest source has been checked with the TypeScript JSX parser. The major cascading JSX errors came from two broken closures in `src/main.jsx`: the global-search conditional in `Layout` and the missing closing `</section>` in `Tenants`. Both are repaired.


## Tenant history shortcut
Every tenant row now includes a History button. It opens a tenant-specific electricity history view showing:
- tenant identity and property/unit;
- joined and left/present dates;
- meter reading timeline;
- linked calculations;
- usage and calculated amount totals.
The history view is internal to the Tenants workflow; no separate History navigation item is required.
