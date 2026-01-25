
# ⚡ TechTime Widget - Quick Start

## 🎯 Goal
Make the TechTime widget appear in Android's widget picker so you can add it to your home screen.

## 🚀 5-Step Setup

### 1️⃣ Generate Native Android Project
```bash
npx expo prebuild -p android
```

### 2️⃣ Copy Widget Files
```bash
# Layout files
cp android/widget/widget_layout_small.xml android/app/src/main/res/layout/
cp android/widget/widget_layout_medium.xml android/app/src/main/res/layout/

# Config files
mkdir -p android/app/src/main/res/xml
cp android/widget/widget_info_small.xml android/app/src/main/res/xml/
cp android/widget/widget_info_medium.xml android/app/src/main/res/xml/

# Drawables
cp android/widget/widget_background.xml android/app/src/main/res/drawable/
cp android/widget/button_background.xml android/app/src/main/res/drawable/

# Kotlin provider
cp android/widget/TechTimeWidgetProvider.kt android/app/src/main/java/com/brcarszw/techtimes/
```

### 3️⃣ Update AndroidManifest.xml
Open `android/app/src/main/AndroidManifest.xml` and add inside `<application>` tag:

```xml
<!-- Small Widget -->
<receiver android:name=".TechTimeWidgetProvider" android:exported="true" android:label="TechTime Small">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
        <action android:name="com.brcarszw.techtimes.OPEN_DASHBOARD" />
        <action android:name="com.brcarszw.techtimes.ADD_JOB" />
    </intent-filter>
    <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_info_small" />
</receiver>

<!-- Medium Widget -->
<receiver android:name=".TechTimeWidgetProvider" android:exported="true" android:label="TechTime Medium">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
        <action android:name="com.brcarszw.techtimes.OPEN_DASHBOARD" />
        <action android:name="com.brcarszw.techtimes.ADD_JOB" />
    </intent-filter>
    <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_info_medium" />
</receiver>
```

### 4️⃣ Update strings.xml
Open `android/app/src/main/res/values/strings.xml` and add:

```xml
<string name="widget_description_small">TechTime Small Widget - Quick job stats and add job button</string>
<string name="widget_description_medium">TechTime Medium Widget - Detailed stats with backup status and latest job</string>
```

### 5️⃣ Build and Test
```bash
npx expo run:android
```

Then on your device:
1. Long-press home screen
2. Tap "Widgets"
3. Find "TechTime"
4. Drag widget to home screen

## ✅ Success Indicators

- ✅ "TechTime" appears in widget picker
- ✅ Two widget sizes available (Small 2x2, Medium 4x2)
- ✅ Widget displays your job statistics
- ✅ Tapping widget opens the app
- ✅ "+ Add Job" button opens Add Job screen

## 🐛 Quick Troubleshooting

**Widget not in picker?**
```bash
npx expo run:android --clean
```

**Widget shows zeros?**
- Open app and add a job
- Wait 5 seconds for update

**Deep links not working?**
- Check `app.json` has `"scheme": "techtimes"`

## 📚 Full Documentation

- **WIDGET_SETUP_GUIDE.md** - Detailed setup with troubleshooting
- **ANDROID_WIDGET_IMPLEMENTATION.md** - Technical implementation details
- **WIDGET_SUMMARY.md** - Feature overview

## 💡 What the Widget Shows

**Small (2x2):**
- Today's AW
- Job count
- Hours worked
- Add Job button

**Medium (4x2):**
- All small features
- Backup status
- Latest job
- Current streak

---

**Need help?** See `WIDGET_SETUP_GUIDE.md` for detailed instructions!
