
# TechTimes - Vehicle Technician Job Tracker

A secure, offline-first Android app for vehicle technicians to track their work using the AW (Allocated Work) system.

## Features

### 🔐 Security
- **PIN Authentication**: Default PIN is `3101`, customizable in settings
- **Biometric Login**: Fingerprint/Face unlock support (Android)
- **Lock on Resume**: Automatically locks when app goes to background
- **Fully Offline**: All data stored locally, GDPR-compliant (no customer data)

### 📊 Job Tracking
- **AW System**: 1 AW = 5 minutes
- Track jobs with:
  - WIP Number (5 digits, validated)
  - Vehicle Registration (auto-uppercase)
  - AW Value (0-100)
  - Optional notes
  - Auto-captured date/time

### 📈 Dashboard
- **Today's Stats**: Jobs count, total AW, time, average AW/job
- **This Week**: Total jobs, AW, hours
- **This Month**: Total jobs, AW, hours
- Real-time calculations showing time as hh:mm and decimal hours

### 📝 Job Management
- View all jobs (newest first)
- Search by WIP or Registration
- Filter by: Today / Week / Month / All
- Edit and delete jobs with confirmation
- Empty state guidance

### ⚙️ Settings
- Change PIN (requires current PIN)
- Enable/Disable Biometrics
- Toggle Lock on Resume
- **Theme Switcher**: Dark Workshop / Light Workshop
- **Overlay Strength Slider**: Adjust background overlay (30-90%)

### 💾 Data Management
- **Export CSV**: Share job data with columns: createdAt, wipNumber, vehicleReg, aw, minutes, notes
- **Backup**: Create JSON backup of all jobs + settings
- **Restore**: Import backup with validation and confirmation

## Visual Design

### Automotive Workshop Theme
- Every screen features automotive-themed backgrounds:
  - Workshop tools and equipment
  - Engine bays and diagnostics
  - Workshop bays and ramps
- Adjustable overlay for optimal readability
- Modern card-based UI with smooth animations

### Color Schemes
**Dark Workshop (Default)**
- Primary: Orange (#ff6b35) - automotive accent
- Background: Deep black with workshop imagery
- Cards: Dark gray with subtle shadows

**Light Workshop**
- Primary: Orange (#ff6b35)
- Background: Light gray with workshop imagery
- Cards: White with clean shadows

## Technical Stack

- **Framework**: React Native + Expo 54
- **Navigation**: Expo Router (file-based routing)
- **Storage**: Expo SecureStore (encrypted local storage)
- **Authentication**: Expo Local Authentication (biometrics)
- **File Sharing**: Expo Sharing + Document Picker
- **Backend**: REST API for job data persistence

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run android
   ```

3. Default PIN: `3101`

## Data Privacy

TechTimes is designed to be GDPR-compliant:
- ✅ Stores: Vehicle registrations, WIP numbers, AW values, work notes
- ❌ Does NOT store: Customer names, addresses, phone numbers, emails
- All data stored locally on device
- Optional cloud backup via user-controlled file sharing

## Backend Integration

The app includes TODO comments for backend integration:
- `GET /api/jobs` - Fetch all jobs
- `GET /api/jobs/today` - Today's jobs
- `GET /api/jobs/week` - This week's jobs
- `GET /api/jobs/month` - This month's jobs
- `POST /api/jobs` - Create new job
- `PUT /api/jobs/:id` - Update job
- `DELETE /api/jobs/:id` - Delete job

## Quality Features

- ✅ Keyboard-aware inputs (never hidden)
- ✅ Fast performance with large job lists
- ✅ Friendly validation messages
- ✅ Graceful empty states
- ✅ Pull-to-refresh on all data screens
- ✅ Confirmation dialogs for destructive actions
- ✅ Informative console logs for debugging

## License

Private use only - Vehicle Technician Job Tracker
