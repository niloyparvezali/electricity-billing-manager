# CurrentFlow — Firebase Edition

Account-based electricity/current bill management.

## Scope
- Flat / Building / Half Building / Market
- Room / Shop
- Residential / Commercial
- Electricity meter readings
- Automatic opening-reading carry-forward
- Meter replacement/reset while preserving history
- Tenant occupancy history
- Monthly electricity bill calculations
- No rent, payments, water, gas, or internet

## Account isolation
All business data is stored under the authenticated Firebase UID:

`users/{uid}/properties`, `users/{uid}/units`, `users/{uid}/meters`, `users/{uid}/readings`, `users/{uid}/tenants`, `users/{uid}/settings`

The included Firestore rules only allow a signed-in user to access their own UID namespace. Account A therefore cannot read or write account B data.

## Firebase setup
1. Create a Firebase project.
2. Enable Authentication → Email/Password.
3. Create a Firestore database.
4. Add a Firebase Web App and copy its config into `.env.local` (use `.env.example` as the template).
5. Deploy `firestore.rules` with Firebase CLI:

```bash
firebase login
firebase use YOUR_PROJECT_ID
firebase deploy --only firestore:rules
```

6. Run:

```bash
npm install
npm run dev
```

A new account is seeded with demo data only when its own `properties` collection is empty. Remove the `seedDemoData` call later when you are ready for a completely blank production account.
