
# Android Home Screen Widget Implementation Guide for TechTime

This guide provides complete instructions for implementing the Android Home Screen Widget for TechTime.

## Overview

The TechTime Android widget displays job statistics and provides quick access to add jobs directly from the home screen. The widget works fully offline using on-device storage.

## Widget Features

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

## Deep Links

The widget supports two deep link actions:

1. **Stats/Info Area Tap**: Opens app to Dashboard
   - Deep link: `techtimes://dashboard`

2. **"+ Add Job" Button Tap**: Opens Add Job screen with keyboard focused
   - Deep link: `techtimes://add-job`

## Implementation Steps

### Step 1: Run Expo Prebuild

Generate the native Android project:

```bash
npx expo prebuild -p android
```

This will create the `android/` directory with the native Android project.

### Step 2: Copy Widget Files

Copy the following files from `android/widget/` to the appropriate locations in your Android project:

#### XML Layout Files

Copy to `android/app/src/main/res/layout/`:
- `widget_layout_small.xml` - Small widget layout (2x2)
- `widget_layout_medium.xml` - Medium widget layout (4x2)

#### XML Configuration Files

Copy to `android/app/src/main/res/xml/`:
- `widget_info_small.xml` - Small widget provider configuration
- `widget_info_medium.xml` - Medium widget provider configuration

#### Drawable Resources

Copy to `android/app/src/main/res/drawable/`:
- `widget_background.xml` - Widget background drawable
- `button_background.xml` - Button background drawable

#### Kotlin Widget Provider

Copy to `android/app/src/main/java/com/brcarszw/techtimes/`:
- `TechTimeWidgetProvider.kt` - Widget provider implementation

### Step 3: Update AndroidManifest.xml

Add the widget receiver to `android/app/src/main/AndroidManifest.xml` inside the `<application>` tag:

```xml
<receiver
    android:name=".TechTimeWidgetProvider"
    android:exported="true">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
        <action android:name="com.brcarszw.techtimes.OPEN_DASHBOARD" />
        <action android:name="com.brcarszw.techtimes.ADD_JOB" />
    </intent-filter>
    <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/widget_info_small" />
</receiver>

<receiver
    android:name=".TechTimeWidgetProvider"
    android:exported="true">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
        <action android:name="com.brcarszw.techtimes.OPEN_DASHBOARD" />
        <action android:name="com.brcarszw.techtimes.ADD_JOB" />
    </intent-filter>
    <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/widget_info_medium" />
</receiver>
```

### Step 4: Add String Resources

Add widget descriptions to `android/app/src/main/res/values/strings.xml`:

```xml
<string name="widget_description_small">TechTime Small Widget - Quick job stats and add job button</string>
<string name="widget_description_medium">TechTime Medium Widget - Detailed stats with backup status and latest job</string>
```

### Step 5: Handle Deep Links in App

The app is already configured to handle deep links. The widget will use these routes:

- `techtimes://dashboard` → Opens to dashboard
- `techtimes://add-job` → Opens add job modal with keyboard focused

Make sure your `app.json` has the scheme configured:

```json
{
  "expo": {
    "scheme": "techtimes"
  }
}
```

### Step 6: Build and Test

1. Build the Android app:
```bash
npx expo run:android
```

2. Once installed, long-press on the home screen

3. Select "Widgets"

4. Find "TechTime" in the widget list

5. Drag either the Small (2x2) or Medium (4x2) widget to your home screen

6. Test the widget:
   - Verify data displays correctly
   - Tap on stats area → should open dashboard
   - Tap on "+ Add Job" button → should open add job screen with keyboard
   - Add a job in app → verify widget updates
   - Test backup → verify backup status updates in widget

## Widget Data Flow

1. **App Updates Widget Data**: When jobs are saved/edited/deleted, the app calls `updateWidgetData()` from `utils/widgetManager.ts`

2. **Data Stored in AsyncStorage**: Widget data is stored with key `@techtimes_widget_data` in AsyncStorage

3. **Widget Reads Data**: The widget provider reads data from AsyncStorage on update

4. **Widget Displays Data**: Widget displays the data and handles tap events via PendingIntents

## Refresh Triggers

Widget data is refreshed:
- Immediately after job save/edit/delete
- After backup restore/import
- Daily at midnight (scheduled)
- On widget update cycle (system-triggered every 30 minutes)

## Theme Support

The widget automatically adapts to the system's light/dark theme using:
- `?android:attr/colorBackground` for background
- `?android:attr/textColorPrimary` for primary text
- `?android:attr/textColorSecondary` for secondary text

## Troubleshooting

### Widget Not Updating

1. Check that `updateWidgetData()` is being called after job operations
2. Verify AsyncStorage permissions in AndroidManifest.xml
3. Check Android logs for widget provider errors:
   ```bash
   adb logcat | grep TechTimeWidget
   ```

### Deep Links Not Working

1. Verify the scheme is configured in `app.json`
2. Check that the intent filters are correctly added to AndroidManifest.xml
3. Test deep links manually:
   ```bash
   adb shell am start -a android.intent.action.VIEW -d "techtimes://dashboard"
   ```

### Widget Shows "?" Icons

This means the Material icon names are invalid. Check that you're using valid Material Icons names in the layout XML files.

## Files Modified

### Frontend Files (Already Implemented)
- `utils/widgetManager.ts` - Widget data management
- `app/(tabs)/add-job.tsx` - Calls `updateWidgetData()` after save
- `app/add-job-modal.tsx` - Calls `updateWidgetData()` after save
- `app/(tabs)/settings.tsx` - Calls `updateLastBackupTimestamp()` after backup
- `app/(tabs)/jobs.tsx` - Calls `updateWidgetData()` after edit/delete
- `app/_layout.tsx` - Initializes widget on app start

### Native Android Files (Need to be Created)
- `android/app/src/main/res/layout/widget_layout_small.xml`
- `android/app/src/main/res/layout/widget_layout_medium.xml`
- `android/app/src/main/res/xml/widget_info_small.xml`
- `android/app/src/main/res/xml/widget_info_medium.xml`
- `android/app/src/main/res/drawable/widget_background.xml`
- `android/app/src/main/res/drawable/button_background.xml`
- `android/app/src/main/java/com/brcarszw/techtimes/TechTimeWidgetProvider.kt`
- `android/app/src/main/AndroidManifest.xml` (modified)
- `android/app/src/main/res/values/strings.xml` (modified)

## Notes

- Widget uses AsyncStorage for data sharing between app and widget
- Deep links are handled by expo-router in the app
- Widget refresh is triggered by AlarmManager for daily updates
- PendingIntents use FLAG_IMMUTABLE for Android 12+ compatibility
- Widget data is cached for fast rendering without database queries

## Support

For issues or questions about the widget implementation, refer to:
- Android Widget Documentation: https://developer.android.com/develop/ui/views/appwidgets
- Expo Documentation: https://docs.expo.dev/
- React Native AsyncStorage: https://react-native-async-storage.github.io/async-storage/

