
# 🚀 TechTime Android Widget Setup Guide

This guide will help you integrate the Android home screen widget into your TechTime app so it appears in the system's widget picker.

## 📋 Prerequisites

- Expo CLI installed
- Android Studio (optional, but helpful for debugging)
- Physical Android device or emulator

## 🔧 Step-by-Step Integration

### Step 1: Generate Native Android Project

Run the following command to generate the native Android project:

```bash
npx expo prebuild -p android
```

This will create an `android/` directory with the full native Android project structure.

### Step 2: Copy Widget Files

After prebuild completes, copy the widget files from `android/widget/` to the appropriate locations:

#### 2.1 Layout Files
Copy these XML layout files:
```bash
cp android/widget/widget_layout_small.xml android/app/src/main/res/layout/
cp android/widget/widget_layout_medium.xml android/app/src/main/res/layout/
```

#### 2.2 Widget Configuration Files
Create the `xml` directory if it doesn't exist, then copy:
```bash
mkdir -p android/app/src/main/res/xml
cp android/widget/widget_info_small.xml android/app/src/main/res/xml/
cp android/widget/widget_info_medium.xml android/app/src/main/res/xml/
```

#### 2.3 Drawable Resources
Copy the drawable resources:
```bash
cp android/widget/widget_background.xml android/app/src/main/res/drawable/
cp android/widget/button_background.xml android/app/src/main/res/drawable/
```

#### 2.4 Kotlin Widget Provider
Copy the widget provider class:
```bash
cp android/widget/TechTimeWidgetProvider.kt android/app/src/main/java/com/brcarszw/techtimes/
```

### Step 3: Update AndroidManifest.xml

Open `android/app/src/main/AndroidManifest.xml` and add the widget receivers inside the `<application>` tag (before the closing `</application>` tag):

```xml
<!-- Small Widget Receiver -->
<receiver
    android:name=".TechTimeWidgetProvider"
    android:exported="true"
    android:label="TechTime Small">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
        <action android:name="com.brcarszw.techtimes.OPEN_DASHBOARD" />
        <action android:name="com.brcarszw.techtimes.ADD_JOB" />
    </intent-filter>
    <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/widget_info_small" />
</receiver>

<!-- Medium Widget Receiver -->
<receiver
    android:name=".TechTimeWidgetProvider"
    android:exported="true"
    android:label="TechTime Medium">
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

### Step 4: Update strings.xml

Open `android/app/src/main/res/values/strings.xml` and add the widget descriptions:

```xml
<string name="widget_description_small">TechTime Small Widget - Quick job stats and add job button</string>
<string name="widget_description_medium">TechTime Medium Widget - Detailed stats with backup status and latest job</string>
```

### Step 5: Build and Install

Build and install the app on your Android device:

```bash
npx expo run:android
```

Or if you prefer using Android Studio:
1. Open the `android/` folder in Android Studio
2. Wait for Gradle sync to complete
3. Click "Run" or press Shift+F10

### Step 6: Add Widget to Home Screen

1. **Long-press** on your Android home screen
2. Tap **"Widgets"** in the menu that appears
3. Scroll down to find **"TechTime"** in the widget list
4. You should see two widget options:
   - **TechTime Small** (2x2 grid)
   - **TechTime Medium** (4x2 grid)
5. **Drag** your preferred widget size to the home screen
6. The widget should appear with your current job statistics!

## 🎯 Widget Features

### Small Widget (2x2)
- TechTime title
- Today's total AW
- Today's job count
- Hours worked today (hh:mm format)
- "+ Add Job" button

### Medium Widget (4x2)
- All Small widget features
- Backup status (days since last backup)
- Latest job (WIP number + Registration)
- Current streak (if streaks are enabled)

## 🔗 Deep Links

The widget has two clickable areas:

1. **Stats Area** (tap anywhere except the button)
   - Opens the app to the Dashboard screen
   - Deep link: `techtimes://dashboard`

2. **"+ Add Job" Button**
   - Opens the Add Job screen with keyboard ready
   - Deep link: `techtimes://add-job`

## 🔄 Widget Updates

The widget automatically updates when:
- ✅ You save a new job
- ✅ You edit an existing job
- ✅ You delete a job
- ✅ You create a backup
- ✅ You import jobs
- ✅ Daily at midnight (automatic refresh)
- ✅ Every 30 minutes (system-triggered update)

## 🐛 Troubleshooting

### Widget Not Appearing in Widget Picker

**Problem:** After installation, the widget doesn't appear in the widget picker.

**Solutions:**
1. Make sure you ran `npx expo prebuild -p android` before building
2. Verify all widget files were copied to the correct locations
3. Check that the widget receivers are properly declared in `AndroidManifest.xml`
4. Rebuild the app: `npx expo run:android --clean`
5. Restart your device

### Widget Shows Default Values (0 AW, 0 jobs)

**Problem:** Widget displays but shows zeros instead of actual data.

**Solutions:**
1. Open the TechTime app and add at least one job
2. Wait a few seconds for the widget to update
3. If still showing zeros, check that `updateWidgetData()` is being called:
   - Open the app
   - Add a job
   - Check the console logs for "WidgetManager: Updating widget data"

### Widget Not Updating After Adding Jobs

**Problem:** You add jobs but the widget doesn't reflect the changes.

**Solutions:**
1. Check that the app has storage permissions
2. Verify AsyncStorage is working by checking app logs
3. Manually refresh the widget:
   - Remove the widget from home screen
   - Add it again
4. Check Android logs:
   ```bash
   adb logcat | grep TechTimeWidget
   ```

### Deep Links Not Working

**Problem:** Tapping the widget doesn't open the app.

**Solutions:**
1. Verify the scheme is set in `app.json`: `"scheme": "techtimes"`
2. Test deep links manually:
   ```bash
   adb shell am start -a android.intent.action.VIEW -d "techtimes://dashboard"
   ```
3. Make sure the app is installed and not force-stopped
4. Check that intent filters are correctly added to `AndroidManifest.xml`

### Widget Shows "?" Icons

**Problem:** Icons appear as question marks.

**Solution:** This means Material icon names are invalid. The current implementation uses text labels instead of icons, so this shouldn't be an issue. If you've customized the layout, verify you're using valid Material Icons names.

## 📱 Testing Checklist

After installation, test the following:

- [ ] Widget appears in the widget picker
- [ ] Small widget (2x2) can be added to home screen
- [ ] Medium widget (4x2) can be added to home screen
- [ ] Widget displays correct today's statistics
- [ ] Tapping stats area opens the Dashboard
- [ ] Tapping "+ Add Job" button opens Add Job screen
- [ ] Adding a job updates the widget
- [ ] Editing a job updates the widget
- [ ] Deleting a job updates the widget
- [ ] Creating a backup updates backup status
- [ ] Latest job displays correctly (medium widget)
- [ ] Streak displays correctly if enabled (medium widget)
- [ ] Widget adapts to light/dark theme

## 🔍 Debugging

### View Widget Logs

To see widget-related logs:

```bash
adb logcat | grep -E "TechTimeWidget|WidgetManager"
```

### View AsyncStorage Data

To check if widget data is being stored:

```bash
adb shell
run-as com.brcarszw.techtimes
cd shared_prefs
cat RKStorage.xml
```

Look for the `@techtimes_widget_data` key.

### Force Widget Update

To manually trigger a widget update:

```bash
adb shell am broadcast -a android.appwidget.action.APPWIDGET_UPDATE
```

## 📚 Additional Resources

- [Android Widget Documentation](https://developer.android.com/develop/ui/views/appwidgets)
- [Expo Prebuild Documentation](https://docs.expo.dev/workflow/prebuild/)
- [React Native AsyncStorage](https://react-native-async-storage.github.io/async-storage/)

## 💡 Tips

1. **Development Workflow:** After making changes to widget files, you need to rebuild:
   ```bash
   npx expo run:android
   ```

2. **Clean Build:** If you encounter issues, try a clean build:
   ```bash
   cd android
   ./gradlew clean
   cd ..
   npx expo run:android
   ```

3. **Widget Preview:** Some Android launchers show a preview when adding widgets. Make sure your widget looks good in both light and dark themes.

4. **Battery Optimization:** Widgets update every 30 minutes by default. This is a system limitation to preserve battery life.

## ✅ Success!

Once you see "TechTime" in your widget picker and can add it to your home screen, the integration is complete! The widget will now display your job statistics and provide quick access to add new jobs.

If you encounter any issues not covered in this guide, check the logs and refer to the troubleshooting section.
