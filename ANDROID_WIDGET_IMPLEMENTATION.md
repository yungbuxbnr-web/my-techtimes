
# 🎯 Android Home Screen Widget Implementation Guide for TechTime

## 📖 Overview

The TechTime Android widget displays job statistics and provides quick access to add jobs directly from the home screen. The widget works fully offline using on-device storage.

## ✨ Widget Features

### Small Widget (2x2)
- TechTime title
- Today: total AW
- Today: jobs count  
- Hours today (hh:mm format)
- "+ Add Job" button

### Medium Widget (4x2)
- All features from Small widget
- Backup status (days since last backup)
- Latest job (WIP + Reg)
- Current streak (if enabled)

## 🔗 Deep Links

The widget supports two deep link actions:

1. **Stats/Info Area Tap**: Opens app to Dashboard
   - Deep link: `techtimes://dashboard`

2. **"+ Add Job" Button Tap**: Opens Add Job screen with keyboard focused
   - Deep link: `techtimes://add-job`

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)

Follow the comprehensive guide in `WIDGET_SETUP_GUIDE.md` for step-by-step instructions with troubleshooting.

### Option 2: Manual Setup

1. **Generate native Android project:**
   ```bash
   npx expo prebuild -p android
   ```

2. **Copy widget files** from `android/widget/` to the Android project:
   - Layout files → `android/app/src/main/res/layout/`
   - XML configs → `android/app/src/main/res/xml/`
   - Drawables → `android/app/src/main/res/drawable/`
   - Kotlin file → `android/app/src/main/java/com/brcarszw/techtimes/`

3. **Update AndroidManifest.xml** - Add widget receivers (see `android/widget/AndroidManifest_additions.xml`)

4. **Update strings.xml** - Add widget descriptions (see `android/widget/strings.xml`)

5. **Build and install:**
   ```bash
   npx expo run:android
   ```

6. **Add widget to home screen:**
   - Long-press home screen
   - Tap "Widgets"
   - Find "TechTime"
   - Drag to home screen

## 📁 File Structure

### Frontend Files (✅ Already Implemented)
```
utils/widgetManager.ts          - Widget data management
app/(tabs)/add-job.tsx          - Calls updateWidgetData() after save
app/add-job-modal.tsx           - Calls updateWidgetData() after save
app/(tabs)/settings.tsx         - Updates backup timestamp
app/(tabs)/jobs.tsx             - Updates widget after edit/delete
app/_layout.tsx                 - Initializes widget on app start
```

### Native Android Files (📋 Ready to Deploy)
```
android/widget/
├── README.md                           - Quick reference
├── widget_layout_small.xml             - Small widget UI
├── widget_layout_medium.xml            - Medium widget UI
├── widget_info_small.xml               - Small widget config
├── widget_info_medium.xml              - Medium widget config
├── widget_background.xml               - Widget background drawable
├── button_background.xml               - Button background drawable
├── TechTimeWidgetProvider.kt           - Widget provider logic
├── strings.xml                         - Widget descriptions
└── AndroidManifest_additions.xml       - Manifest additions
```

## 🔄 Widget Data Flow

```
App Action (Save/Edit/Delete Job)
    ↓
updateWidgetData() called
    ↓
Calculate daily aggregates
    ↓
Store in AsyncStorage (@techtimes_widget_data)
    ↓
Widget reads data on next update
    ↓
Widget displays updated stats
```

## ⏰ Refresh Triggers

Widget data is refreshed:
- ✅ Immediately after job save/edit/delete
- ✅ After backup restore/import
- ✅ Daily at midnight (scheduled)
- ✅ On widget update cycle (system-triggered every 30 minutes)

## 🎨 Theme Support

The widget automatically adapts to the system's light/dark theme using:
- `?android:attr/colorBackground` for background
- `?android:attr/textColorPrimary` for primary text
- `?android:attr/textColorSecondary` for secondary text

## 🐛 Common Issues

### Widget Not Appearing
- Ensure you ran `npx expo prebuild -p android`
- Verify all files were copied correctly
- Check AndroidManifest.xml has widget receivers
- Try a clean build: `npx expo run:android --clean`

### Widget Shows Zeros
- Open the app and add at least one job
- Check console logs for "WidgetManager: Updating widget data"
- Verify AsyncStorage permissions

### Deep Links Not Working
- Verify scheme in app.json: `"scheme": "techtimes"`
- Test manually: `adb shell am start -a android.intent.action.VIEW -d "techtimes://dashboard"`
- Check intent filters in AndroidManifest.xml

## 📊 Widget Data Structure

The widget reads data from AsyncStorage with key `@techtimes_widget_data`:

```typescript
interface WidgetData {
  todayAW: number;
  todayJobs: number;
  todayHours: string;           // "hh:mm" format
  lastBackupDate: string | null;
  lastBackupDaysAgo: number | null;
  latestJobWIP: string | null;
  latestJobReg: string | null;
  currentStreak: number | null;
  lastUpdated: string;          // ISO timestamp
}
```

## 🔍 Debugging

### View Logs
```bash
adb logcat | grep -E "TechTimeWidget|WidgetManager"
```

### Check AsyncStorage
```bash
adb shell
run-as com.brcarszw.techtimes
cd shared_prefs
cat RKStorage.xml
```

### Force Widget Update
```bash
adb shell am broadcast -a android.appwidget.action.APPWIDGET_UPDATE
```

## ✅ Testing Checklist

- [ ] Widget appears in widget picker
- [ ] Small widget (2x2) displays correctly
- [ ] Medium widget (4x2) displays correctly
- [ ] Stats area opens Dashboard
- [ ] "+ Add Job" button opens Add Job screen
- [ ] Widget updates after adding job
- [ ] Widget updates after editing job
- [ ] Widget updates after deleting job
- [ ] Backup status updates correctly
- [ ] Latest job displays correctly
- [ ] Streak displays if enabled
- [ ] Widget adapts to light/dark theme

## 📚 Documentation

- **WIDGET_SETUP_GUIDE.md** - Comprehensive step-by-step setup guide with troubleshooting
- **WIDGET_SUMMARY.md** - Implementation summary and features overview
- **android/widget/README.md** - Quick reference for file locations

## 💡 Notes

- Widget uses AsyncStorage for data sharing between app and widget
- Deep links are handled by expo-router in the app
- Widget refresh is triggered by AlarmManager for daily updates
- PendingIntents use FLAG_IMMUTABLE for Android 12+ compatibility
- Widget data is cached for fast rendering without database queries
- Minimum update period is 30 minutes (Android system limitation)

## 🆘 Support

For detailed setup instructions and troubleshooting, see:
- `WIDGET_SETUP_GUIDE.md` - Complete setup guide
- [Android Widget Documentation](https://developer.android.com/develop/ui/views/appwidgets)
- [Expo Documentation](https://docs.expo.dev/)
- [React Native AsyncStorage](https://react-native-async-storage.github.io/async-storage/)

---

**Ready to integrate?** Start with `WIDGET_SETUP_GUIDE.md` for step-by-step instructions!
