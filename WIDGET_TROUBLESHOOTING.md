
# 🔧 TechTime Widget Troubleshooting Guide

This guide helps you solve common issues when integrating or using the TechTime Android widget.

## 🚨 Common Issues

### 1. Widget Not Appearing in Widget Picker

**Symptoms:**
- After building the app, "TechTime" doesn't appear in the Android widget picker
- Long-press home screen → Widgets → No "TechTime" option

**Possible Causes & Solutions:**

#### ❌ Cause: Prebuild not run
**Solution:**
```bash
npx expo prebuild -p android
```

#### ❌ Cause: Widget files not copied
**Solution:**
Check that all files were copied to the correct locations:
```bash
# Check layout files
ls android/app/src/main/res/layout/widget_layout_*.xml

# Check config files
ls android/app/src/main/res/xml/widget_info_*.xml

# Check Kotlin provider
ls android/app/src/main/java/com/brcarszw/techtimes/TechTimeWidgetProvider.kt
```

#### ❌ Cause: AndroidManifest.xml not updated
**Solution:**
Open `android/app/src/main/AndroidManifest.xml` and verify both widget receivers are declared inside `<application>` tag.

#### ❌ Cause: Build cache issue
**Solution:**
```bash
cd android
./gradlew clean
cd ..
npx expo run:android --clean
```

#### ❌ Cause: Device needs restart
**Solution:**
Restart your Android device or emulator.

---

### 2. Widget Shows Default Values (0 AW, 0 jobs, 0:00 hours)

**Symptoms:**
- Widget appears but shows all zeros
- No actual job data displayed

**Possible Causes & Solutions:**

#### ❌ Cause: No jobs added yet
**Solution:**
1. Open TechTime app
2. Add at least one job
3. Wait 5-10 seconds
4. Check widget updates

#### ❌ Cause: Widget data not being stored
**Solution:**
Check console logs when adding a job:
```bash
npx expo start
# Look for: "WidgetManager: Updating widget data"
```

If you don't see this log, check that `updateWidgetData()` is being called in:
- `app/(tabs)/add-job.tsx`
- `app/add-job-modal.tsx`

#### ❌ Cause: AsyncStorage permissions issue
**Solution:**
Verify AndroidManifest.xml has storage permissions:
```xml
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

#### ❌ Cause: Widget reading wrong storage location
**Solution:**
Check Android logs:
```bash
adb logcat | grep TechTimeWidget
```

Look for errors related to reading SharedPreferences.

---

### 3. Widget Not Updating After Adding Jobs

**Symptoms:**
- You add jobs in the app
- Widget still shows old data or zeros
- Widget doesn't refresh

**Possible Causes & Solutions:**

#### ❌ Cause: Widget update not triggered
**Solution:**
Check that `updateWidgetData()` is called after job operations:
```typescript
// In add-job.tsx or add-job-modal.tsx
await api.createJob(jobData);
await updateWidgetData(); // ← This line must be present
```

#### ❌ Cause: System update delay
**Solution:**
Android updates widgets every 30 minutes minimum. To force an update:
```bash
adb shell am broadcast -a android.appwidget.action.APPWIDGET_UPDATE
```

Or remove and re-add the widget to home screen.

#### ❌ Cause: AsyncStorage not syncing
**Solution:**
Check AsyncStorage data:
```bash
adb shell
run-as com.brcarszw.techtimes
cd shared_prefs
cat RKStorage.xml | grep techtimes_widget_data
```

If data is missing, check that `updateWidgetData()` completes successfully.

---

### 4. Deep Links Not Working

**Symptoms:**
- Tapping widget does nothing
- Tapping "+ Add Job" button doesn't open the app
- App doesn't open to the correct screen

**Possible Causes & Solutions:**

#### ❌ Cause: Scheme not configured
**Solution:**
Check `app.json` has the correct scheme:
```json
{
  "expo": {
    "scheme": "techtimes"
  }
}
```

#### ❌ Cause: Intent filters missing
**Solution:**
Verify AndroidManifest.xml has intent filters for deep links:
```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="techtimes" />
</intent-filter>
```

#### ❌ Cause: App is force-stopped
**Solution:**
Make sure the app is not force-stopped. Open the app at least once after installation.

#### ❌ Cause: PendingIntent not configured correctly
**Solution:**
Check that `TechTimeWidgetProvider.kt` uses `FLAG_IMMUTABLE`:
```kotlin
PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
```

#### Test deep links manually:
```bash
# Test dashboard link
adb shell am start -a android.intent.action.VIEW -d "techtimes://dashboard"

# Test add job link
adb shell am start -a android.intent.action.VIEW -d "techtimes://add-job"
```

---

### 5. Widget Shows "?" Icons

**Symptoms:**
- Icons appear as question marks
- Widget layout looks broken

**Possible Causes & Solutions:**

#### ❌ Cause: Invalid Material icon names
**Solution:**
The current implementation uses text labels instead of icons, so this shouldn't occur. If you've customized the layout, verify you're using valid Material Icons names.

Valid examples: `home`, `person`, `settings`, `notifications`
Invalid examples: `profile`, `trash`, `bell`

---

### 6. Widget Doesn't Adapt to Theme

**Symptoms:**
- Widget stays light in dark mode (or vice versa)
- Text is hard to read

**Possible Causes & Solutions:**

#### ❌ Cause: Hardcoded colors in layout
**Solution:**
Check that layout files use theme attributes:
```xml
<!-- Correct -->
android:textColor="?android:attr/textColorPrimary"
android:background="?android:attr/colorBackground"

<!-- Wrong -->
android:textColor="#000000"
android:background="#FFFFFF"
```

---

### 7. Build Errors

**Symptoms:**
- Build fails with errors
- Gradle sync fails
- Kotlin compilation errors

**Common Build Errors & Solutions:**

#### Error: "Cannot find symbol: R.layout.widget_layout_small"
**Solution:**
Layout files not copied. Copy from `android/widget/` to `android/app/src/main/res/layout/`

#### Error: "Cannot find symbol: R.xml.widget_info_small"
**Solution:**
Config files not copied. Copy from `android/widget/` to `android/app/src/main/res/xml/`

#### Error: "Package com.brcarszw.techtimes does not exist"
**Solution:**
Check that `TechTimeWidgetProvider.kt` is in the correct package directory:
`android/app/src/main/java/com/brcarszw/techtimes/`

#### Error: "Duplicate class found"
**Solution:**
Clean build:
```bash
cd android
./gradlew clean
cd ..
npx expo run:android
```

---

### 8. Widget Crashes

**Symptoms:**
- Widget appears but crashes when tapped
- App crashes when widget updates
- Android logs show exceptions

**Possible Causes & Solutions:**

#### ❌ Cause: Null pointer exception
**Solution:**
Check Android logs:
```bash
adb logcat | grep -E "TechTimeWidget|AndroidRuntime"
```

Look for stack traces and null pointer exceptions.

#### ❌ Cause: JSON parsing error
**Solution:**
Verify widget data format in AsyncStorage:
```bash
adb shell
run-as com.brcarszw.techtimes
cd shared_prefs
cat RKStorage.xml
```

Check that `@techtimes_widget_data` contains valid JSON.

#### ❌ Cause: RemoteViews error
**Solution:**
Check that all view IDs in `TechTimeWidgetProvider.kt` match the layout XML files.

---

## 🔍 Debugging Tools

### 1. Check Widget Logs
```bash
adb logcat | grep TechTimeWidget
```

### 2. Check App Logs
```bash
adb logcat | grep WidgetManager
```

### 3. Check AsyncStorage
```bash
adb shell
run-as com.brcarszw.techtimes
cd shared_prefs
cat RKStorage.xml | grep techtimes_widget_data
```

### 4. Force Widget Update
```bash
adb shell am broadcast -a android.appwidget.action.APPWIDGET_UPDATE
```

### 5. Test Deep Links
```bash
adb shell am start -a android.intent.action.VIEW -d "techtimes://dashboard"
adb shell am start -a android.intent.action.VIEW -d "techtimes://add-job"
```

### 6. Check Installed Widgets
```bash
adb shell dumpsys appwidget
```

### 7. View All Logs
```bash
adb logcat -v time | grep -E "TechTime|Widget|WidgetManager"
```

---

## 🛠️ Advanced Troubleshooting

### Clean Everything and Rebuild
```bash
# Clean Android build
cd android
./gradlew clean
cd ..

# Clean Expo cache
npx expo start --clear

# Rebuild
npx expo run:android --clean
```

### Verify File Integrity
```bash
# Check all widget files exist
ls -la android/app/src/main/res/layout/widget_*.xml
ls -la android/app/src/main/res/xml/widget_*.xml
ls -la android/app/src/main/res/drawable/widget_*.xml
ls -la android/app/src/main/res/drawable/button_*.xml
ls -la android/app/src/main/java/com/brcarszw/techtimes/TechTimeWidgetProvider.kt
```

### Check AndroidManifest.xml
```bash
# View AndroidManifest.xml
cat android/app/src/main/AndroidManifest.xml | grep -A 10 "TechTimeWidgetProvider"
```

### Reinstall App
```bash
# Uninstall
adb uninstall com.brcarszw.techtimes

# Rebuild and install
npx expo run:android
```

---

## 📋 Troubleshooting Checklist

Use this checklist to systematically diagnose issues:

- [ ] Ran `npx expo prebuild -p android`
- [ ] Copied all widget files to correct locations
- [ ] Updated AndroidManifest.xml with widget receivers
- [ ] Updated strings.xml with widget descriptions
- [ ] Built app successfully (`npx expo run:android`)
- [ ] App installs and runs without crashes
- [ ] Added at least one job in the app
- [ ] Checked console logs for "WidgetManager: Updating widget data"
- [ ] Checked Android logs for widget errors
- [ ] Verified AsyncStorage contains widget data
- [ ] Tested deep links manually
- [ ] Tried removing and re-adding widget
- [ ] Tried clean build
- [ ] Tried restarting device

---

## 🆘 Still Having Issues?

If you've tried everything and the widget still doesn't work:

1. **Check the setup guide**: `WIDGET_SETUP_GUIDE.md`
2. **Review the checklist**: `WIDGET_INTEGRATION_CHECKLIST.md`
3. **Check architecture**: `android/widget/ARCHITECTURE.md`
4. **Review logs**: Look for specific error messages
5. **Start fresh**: Clean build and reinstall

### Collect Debug Information

When asking for help, provide:
- Android version
- Device model
- Build logs
- Android logcat output
- Console logs from the app
- Screenshots of the issue

---

## ✅ Success Indicators

You'll know everything is working when:
- ✅ "TechTime" appears in widget picker
- ✅ Widget displays actual job data (not zeros)
- ✅ Widget updates after adding jobs
- ✅ Tapping widget opens Dashboard
- ✅ "+ Add Job" button opens Add Job screen
- ✅ Widget adapts to light/dark theme
- ✅ No errors in logs

---

**Good luck!** Most issues can be resolved by following this guide. If you're still stuck, review the setup guide and checklist for additional help.
