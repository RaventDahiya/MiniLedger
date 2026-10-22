# MiniLedger

MiniLedger is a small lending tracker with a TypeScript/Express API backed by PostgreSQL and an Expo React Native client.

## Features

- Phone number login with a mock OTP printed in the API server log
- Add loans with friend name, amount, and due date
- Mark loans as repaid
- Summary of total lent, total repaid, and overdue amount
- Overdue loans are highlighted in the mobile list
- Input validation and API tests

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Expo Go (for running the mobile app on a physical device), or an Android/iOS simulator

## Run the API

```powershell
cd backend
npm install
Copy-Item .env.example .env
# Set DATABASE_URL in .env if it differs from the example.
npm run db:migrate
npm run dev
```

The API listens on `http://localhost:4000`. OTPs are printed in the terminal running the API.

## Run the mobile app

```powershell
cd mobile
npm install
npm run start
```

Set `EXPO_PUBLIC_API_URL` when the API is not reachable at the default local address:

```powershell
$env:EXPO_PUBLIC_API_URL = "http://192.168.1.10:4000"
npm run start
```

For a physical device, use your computer's LAN IP rather than `localhost`.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/auth/request-otp` | Request a mock OTP for a phone number |
| POST | `/auth/verify-otp` | Verify the OTP and receive a bearer token |
| GET | `/loans` | List the authenticated user's loans |
| POST | `/loans` | Add a loan |
| PATCH | `/loans/:id/repaid` | Mark a loan as repaid |
| GET | `/summary` | Return totals for the authenticated user |

## Test the API

```powershell
cd backend
npm test
```

## Project layout

```text
backend/  Express API, PostgreSQL schema, and tests
mobile/   Expo React Native app
```

