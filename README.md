# Crick Grid

**Crick Grid** is an advanced, offline-first cricket analytics, net-practice tracking, and live match scoring application built for players, coaches, and analysts.

It enables granular ball-by-ball telemetry tracking (pitch location, contact point, delivery speed, seam/spin movement, line and length, shot selection), real-time match scoring with interactive field placement physics, automated analytics visualizations, video highlight tagging, and exportable PDF coaching reports.

---

## Features

- 🎯 **Net Practice Session Tracking**: Record detailed ball-by-ball deliveries with interactive pitch map plotting (line/length) and batter contact map plotting.
- 📊 **Ball & Pitch Analytics**: Visual heatmaps and scatter charts for length distribution, line breakdown, delivery types, average swing/turn degrees, and into/away movement.
- 🏏 **Player & Batting Quality Ratios**: Automated calculation of Middled %, Edge %, and Miss % contact quality metrics. Smart wide-ball logic excludes unhit extra deliveries from inflating batter miss rates.
- 🏟️ **Live Match Centre & Scoring**: Real-time match engine tracking overs, wickets, partnerships, extras (wides, no-balls, byes, leg-byes), strike rotation, and run overrides.
- 📐 **Field Positioning & Physics Scoring**: Interactive field placement canvas with automated score calculation based on fielder positions, shot angles, and boundary boundaries.
- 📄 **PDF Coaching Reports**: Professional exportable PDF session reports with visual pitch maps, ball breakdowns, and quality statistics via Expo Print.
- 🎬 **Video Tagging & Highlights**: Attach video timestamps to individual deliveries and generate filtered highlight clips for boundaries, wickets, and specific shot types.
- 📱 **Offline-First Capabilities**: Full local persistence using React Native `AsyncStorage`. All scoring, net logging, analytics calculations, and report generation function seamlessly offline.

---

## Tech Stack

### Frontend
- **Framework**: React Native `0.86.3` with Expo `~57.0.0`
- **Routing**: Expo Router `~57.0.22` (File-based navigation)
- **Local Database / Storage**: `@react-native-async-storage/async-storage` `2.2.0`
- **UI & Graphics**: `react-native-svg` `15.15.4`, `react-native-chart-kit` `^6.12.2`, `@expo/vector-icons` `^15.0.3`
- **PDF & Sharing**: `expo-print` `~57.0.2`, `expo-sharing` `~57.0.21`
- **Media**: `expo-video` `~57.0.4`, `expo-media-library` `~57.0.5`
- **HTTP Client**: `axios` `^1.15.0`

### Backend
- **Runtime & Server**: Node.js with Express `^4.18.2`
- **Database**: PostgreSQL (`pg` `^8.11.0`) with built-in automatic In-Memory database fallback
- **Security & Logging**: `helmet` `^7.0.0`, `cors` `^2.8.5`, `morgan` `^1.10.0`
- **File Uploads**: `multer` `^2.1.1`
- **Environment Management**: `dotenv` `^16.0.3`

### Database
- **Primary**: PostgreSQL (`5432`)
- **Fallback**: In-Memory JavaScript Data Store (activates automatically if PostgreSQL is unavailable)

---

## Project Structure

```
cricket-app/
├── backend/                  # Node.js Express REST API backend
│   ├── src/
│   │   ├── controllers/      # Route controllers
│   │   ├── db/               # PostgreSQL pool & In-Memory fallback engine
│   │   ├── models/           # Data models
│   │   ├── routes/           # REST API endpoints (analytics, balls, matches, etc.)
│   │   └── index.js          # Express app entry point
│   ├── uploads/              # Uploaded video files & media assets
│   ├── .env                  # Backend environment configuration
│   └── package.json          # Backend dependencies & npm scripts
├── frontend/                 # React Native / Expo mobile application
│   ├── app/                  # Expo Router file-based screens & layouts
│   │   ├── (nets)/           # Net practice logging, ball tracker, & analytics
│   │   ├── match/            # Live Match Centre & scoring interface
│   │   └── _layout.jsx       # Main root layout
│   ├── assets/               # App icons, splash screens, and images
│   ├── components/           # Reusable UI components (VideoTagger, Pitch maps)
│   ├── services/             # API client & PDF report generator
│   ├── app.json              # Expo application configuration & package name
│   ├── eas.json              # Expo Application Services build profiles
│   └── package.json          # Frontend dependencies & npm scripts
└── README.md                 # Project documentation
```

---

## Prerequisites

Before running the project, ensure you have the following installed on your machine:

1. **Node.js**: `v18.x` or `v20.x` LTS recommended (npm included).
2. **Git**: Installed and available in PATH.
3. **PowerShell / Terminal**: Windows PowerShell or standard Bash terminal.
4. **Expo Go Mobile App**: Installed on your physical Android or iOS device from Google Play Store or Apple App Store (for physical phone testing).
5. **PostgreSQL** *(Optional)*: If you wish to use PostgreSQL persistent storage. If PostgreSQL is not installed or running, the backend automatically uses its built-in In-Memory database fallback.

---

## Installation

Run the following commands in PowerShell from your workspace directory:

### 1. Clone the Repository
```powershell
git clone <repository-url>
cd cricket-app
```

### 2. Install Backend Dependencies
```powershell
cd backend
npm install
cd ..
```

### 3. Install Frontend Dependencies
```powershell
cd frontend
npm install
cd ..
```

---

## Environment Variables

### Backend (`backend/.env`)
The backend relies on environment variables defined in `backend/.env`. Create or edit `backend/.env`:

```env
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cricket_app
DB_USER=your_db_user
DB_PASSWORD=your_db_password
```

| Variable | Description | Example / Placeholder |
| :--- | :--- | :--- |
| `PORT` | Port number for Express API server | `3001` |
| `DB_HOST` | PostgreSQL host address | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | PostgreSQL database name | `cricket_app` |
| `DB_USER` | PostgreSQL user | `your_db_user` |
| `DB_PASSWORD` | PostgreSQL password | `your_db_password` |

### Frontend API URL Configuration (`frontend/services/api.js`)
The mobile frontend references the backend API server in `frontend/services/api.js`:

```javascript
// Replace <YOUR_LOCAL_IP> with your machine's IPv4 address from ipconfig
const BASE_URL = 'http://<YOUR_LOCAL_IP>:3001/api';
export const SERVER_URL = 'http://<YOUR_LOCAL_IP>:3001';
```

---

## Running the Backend

From the repository root, navigate to `backend` and start the server:

### Development Mode (with hot reloading via nodemon):
```powershell
cd backend
npm run dev
```

### Production Mode:
```powershell
cd backend
npm start
```

The Express server will start on port `3001` (`http://localhost:3001`). You can verify it by opening `http://localhost:3001/health` in your browser.

---

## Running the Frontend

From the repository root, navigate to `frontend` and start the Expo development server:

```powershell
cd frontend
npm start
```

Available npm scripts in `frontend`:
- `npm start`: Starts the Expo Metro bundler.
- `npm run android`: Opens the app in an connected Android emulator/device.
- `npm run ios`: Opens the app in iOS simulator (macOS only).
- `npm run web`: Opens the app in a web browser.

---

## Testing on a Physical Phone

To test the application on a physical phone using Expo Go:

### 1. Network Requirements
- Your PC and your physical phone **MUST be connected to the exact same Wi-Fi network**.

### 2. Find Your PC's Local IP Address
In PowerShell on your Windows PC, run:
```powershell
ipconfig
```
Look for **IPv4 Address** under your active Wi-Fi adapter (e.g. `192.168.x.x` or `10.x.x.x`). 
> **Note**: IP addresses like `10.0.243.66` or `192.168.1.50` are specific to a local development machine. Teammates must inspect their own machine's IPv4 address and replace `<YOUR_LOCAL_IP>` with their own IP.

### 3. Update Frontend API Address
Open `frontend/services/api.js` and update `BASE_URL` and `SERVER_URL` with your machine's IPv4 address:

```javascript
const BASE_URL = 'http://<YOUR_LOCAL_IP>:3001/api';
export const SERVER_URL = 'http://<YOUR_LOCAL_IP>:3001';
```

### 4. Start Backend Server
Ensure the backend server is running on your PC:
```powershell
cd backend
npm run dev
```

### 5. Windows Firewall Settings
Ensure Windows Defender Firewall allows incoming connections on port `3001` (Backend) and port `8081` (Expo Metro Bundler) for Private networks.

### 6. Start Expo Dev Server & Scan QR Code
In a separate PowerShell terminal, run:
```powershell
cd frontend
npx expo start --host lan
```
- Open the **Expo Go** app on your phone.
- **Android**: Tap "Scan QR code" in Expo Go and scan the QR code displayed in your terminal.
- **iOS**: Open the native Camera app on iPhone and scan the QR code to open in Expo Go.

---

## Database Setup

1. **PostgreSQL Setup (Optional)**:
   - Create a PostgreSQL database named `cricket_app`.
   - Update credentials in `backend/.env` if different from default (`postgres`/`postgresql`).
2. **Automatic In-Memory Fallback**:
   - If PostgreSQL is not installed or configured, the backend automatically activates its built-in In-Memory DB engine. You can start testing immediately without installing PostgreSQL.

---

## API / Backend Routes

The backend exposes the following REST API endpoints under `/api`:

| Route Category | Base Endpoint | Description |
| :--- | :--- | :--- |
| **Health Check** | `GET /health` | Server status verification |
| **Sessions** | `/api/sessions` | Create, fetch, update, and delete net practice sessions |
| **Balls** | `/api/balls` | Log, update, and query individual ball delivery data |
| **Analytics** | `/api/analytics` | Retrieve session pitch maps, contact maps, and delivery statistics |
| **Fields** | `/api/fields` | Save and fetch custom field positioning settings |
| **Scoring** | `/api/scoring` | Match scoring engine calculations and ball outcomes |
| **Videos** | `/api/videos` | Video metadata management and file upload handling |
| **Clips** | `/api/clips` | Create and filter video highlight clips |
| **Reviews** | `/api/reviews` | Decision Review System (DRS) tracking |
| **Matches** | `/api/matches` | Live match state, toss, overs, and scorecard tracking |

---

## Build / Deployment

The application is configured for Expo Application Services (EAS Build).

### Build Profiles (`frontend/eas.json`)
- **`preview`**: Builds a standalone Android `.apk` file for internal testing.
- **`production`**: Builds an Android App Bundle (`.aab`) ready for Google Play Console submission.

### Creating Builds
1. Install EAS CLI globally:
   ```powershell
   npm install -g eas-cli
   ```
2. Build Android APK for testing:
   ```powershell
   cd frontend
   eas build -p android --profile preview
   ```
3. Build Android App Bundle (`.aab`) for Google Play Store:
   ```powershell
   cd frontend
   eas build -p android --profile production
   ```

---

## Troubleshooting

1. **Phone Cannot Connect to Backend (Network Error)**:
   - Verify that your PC and phone are on the same Wi-Fi network.
   - Run `ipconfig` and ensure `BASE_URL` in `frontend/services/api.js` matches your current IPv4 address.
   - Check that Windows Defender Firewall is not blocking port `3001`.

2. **PostgreSQL Connection Warning on Backend Start**:
   - Message: `⚠️ PostgreSQL connection unverified — activating In-Memory Database fallback.`
   - Explanation: This is expected if PostgreSQL is not running. The app will function normally using the in-memory database fallback.

3. **Expo Metro Cache Issues**:
   - If UI changes do not appear on your phone, clear Metro cache:
     ```powershell
     cd frontend
     npx expo start -c
     ```

---

## Development Notes

- **Offline-First Design**: The frontend uses `AsyncStorage` as a fallback engine with a fast 400ms API timeout in `frontend/services/api.js`. If the backend is offline, local storage takes over instantly without stalling the mobile UI.
- **Scoring Logic Parity**: Pure JavaScript scoring logic in `frontend/services/api.js` (`scoreBallLocal`) mirrors the backend scoring calculations (`backend/src/routes/scoring.js`) for seamless offline/online parity.

---

## Contributors / Team

Developed by the **Crick Grid** engineering team.
