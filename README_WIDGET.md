
# 🎯 TechTime Android Widget - Complete Guide

## 📱 What Is This?

The TechTime Android Widget allows you to view your job statistics directly on your Android home screen without opening the app. You can also quickly add new jobs with a single tap.

## ✨ Features

### 🔹 Small Widget (2x2)
- Today's total AW (Allocated Work)
- Number of jobs completed today
- Hours worked today
- Quick "+ Add Job" button

### 🔹 Medium Widget (4x2)
- Everything in the Small widget, plus:
- Days since last backup
- Latest job (WIP number + Registration)
- Current logging streak (if enabled)

### 🔗 Quick Actions
- **Tap widget** → Opens TechTime Dashboard
- **Tap "+ Add Job"** → Opens Add Job screen with keyboard ready

## 🚀 How to Install

### Prerequisites
- TechTime app installed on your Android device
- Expo CLI installed on your computer
- USB debugging enabled (for development)

### Installation Steps

**Choose your guide based on your experience level:**

1. **🚀 Quick Start** (5 minutes)
   - See `WIDGET_QUICK_START.md`
   - Best for: Developers familiar with React Native/Expo

2. **📖 Detailed Setup** (15 minutes)
   - See `WIDGET_SETUP_GUIDE.md`
   - Best for: First-time widget integration
   - Includes troubleshooting and debugging

3. **✅ Checklist Approach** (20 minutes)
   - See `WIDGET_INTEGRATION_CHECKLIST.md`
   - Best for: Ensuring nothing is missed
   - Step-by-step verification

### Basic Steps (Summary)

1. Generate native Android project:
   ```bash
   npx expo prebuild -p android
   ```

2. Copy widget files from `android/widget/` to the Android project

3. Update `AndroidManifest.xml` and `strings.xml`

4. Build and install:
   ```bash
   npx expo run:android
   ```

5. Add widget to home screen:
   - Long-press home screen → Widgets → TechTime

## 📁 Documentation Structure

```
Project Root
├── README_WIDGET.md                    ← You are here (Overview)
├── WIDGET_QUICK_START.md               ← 5-step quick start
├── WIDGET_SETUP_GUIDE.md               ← Comprehensive guide with troubleshooting
├── WIDGET_INTEGRATION_CHECKLIST.md    ← Step-by-step checklist
├── ANDROID_WIDGET_IMPLEMENTATION.md   ← Technical implementation details
├── WIDGET_SUMMARY.md                   ← Feature summary
│
└── android/widget/                     ← Widget source files
    ├── INTEGRATION_STEPS.md            ← Quick reference for file locations
    ├── README.md                       ← Widget files overview
    ├── widget_layout_small.xml         ← Small widget UI
    ├── widget_layout_medium.xml        ← Medium widget UI
    ├── widget_info_small.xml           ← Small widget config
    ├── widget_info_medium.xml          ← Medium widget config
    ├── widget_background.xml           ← Widget background
    ├── button_background.xml           ← Button background
    ├── TechTimeWidgetProvider.kt       ← Widget logic (Kotlin)
    ├── strings.xml                     ← Widget descriptions
    └── AndroidManifest_additions.xml   ← Manifest additions
```

## 🎯 Which Guide Should I Use?

| Your Situation | Recommended Guide |
|----------------|-------------------|
| "I just want to get it working fast" | `WIDGET_QUICK_START.md` |
| "I want detailed instructions" | `WIDGET_SETUP_GUIDE.md` |
| "I want to make sure I don't miss anything" | `WIDGET_INTEGRATION_CHECKLIST.md` |
| "I want to understand how it works" | `ANDROID_WIDGET_IMPLEMENTATION.md` |
| "I want to see what features are included" | `WIDGET_SUMMARY.md` |

## 🔄 How the Widget Works

1. **App Updates Data**: When you add/edit/delete a job, the app calls `updateWidgetData()`
2. **Data Stored**: Widget data is saved to AsyncStorage
3. **Widget Reads Data**: The widget reads from AsyncStorage every 30 minutes
4. **Widget Displays**: Your latest statistics appear on the home screen

## 🎨 Customization

The widget automatically adapts to your device's theme:
- **Light Mode**: Light background, dark text
- **Dark Mode**: Dark background, light text

## 🐛 Common Issues

### Widget not appearing in picker?
→ See troubleshooting in `WIDGET_SETUP_GUIDE.md`

### Widget shows zeros?
→ Open the app and add at least one job

### Deep links not working?
→ Check that `app.json` has `"scheme": "techtimes"`

### Widget not updating?
→ Check console logs for "WidgetManager: Updating widget data"

## ✅ Success Indicators

You'll know the widget is working when:
- ✅ "TechTime" appears in your Android widget picker
- ✅ You can add both Small (2x2) and Medium (4x2) widgets
- ✅ Widget displays your actual job statistics
- ✅ Tapping the widget opens the TechTime app
- ✅ "+ Add Job" button opens the Add Job screen
- ✅ Widget updates automatically when you add jobs

## 🔍 Technical Details

- **Platform**: Android only (iOS widgets use a different system)
- **Update Frequency**: Every 30 minutes (system limitation) + immediate after app changes
- **Storage**: AsyncStorage with key `@techtimes_widget_data`
- **Deep Links**: Uses `techtimes://` scheme
- **Theme**: Adapts to system light/dark mode
- **Offline**: Works completely offline

## 📚 Additional Resources

- [Android Widget Documentation](https://developer.android.com/develop/ui/views/appwidgets)
- [Expo Prebuild Documentation](https://docs.expo.dev/workflow/prebuild/)
- [React Native AsyncStorage](https://react-native-async-storage.github.io/async-storage/)

## 🆘 Getting Help

1. **Check the guides**: Start with `WIDGET_SETUP_GUIDE.md`
2. **Review the checklist**: Use `WIDGET_INTEGRATION_CHECKLIST.md`
3. **Check logs**: `adb logcat | grep -E "TechTimeWidget|WidgetManager"`
4. **Clean build**: `npx expo run:android --clean`

## 🎉 Ready to Start?

1. **New to widgets?** → Start with `WIDGET_SETUP_GUIDE.md`
2. **Want it fast?** → Use `WIDGET_QUICK_START.md`
3. **Want to be thorough?** → Follow `WIDGET_INTEGRATION_CHECKLIST.md`

---

**The widget integration is already 90% complete!** The frontend code is ready. You just need to copy the native Android files and build the app. Follow any of the guides above to get started!

Good luck! 🚀
