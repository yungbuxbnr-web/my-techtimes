
# ✅ TechTime Widget Integration Checklist

Use this checklist to ensure the widget is properly integrated and working.

## 📋 Pre-Integration Checklist

- [ ] Expo CLI is installed (`npm install -g expo-cli`)
- [ ] Android device or emulator is available
- [ ] Project builds successfully (`npx expo run:android`)

## 🔧 Integration Steps

### Step 1: Generate Native Project
- [ ] Run `npx expo prebuild -p android`
- [ ] Verify `android/` directory was created
- [ ] Check that `android/app/src/main/` exists

### Step 2: Copy Widget Files

#### Layout Files
- [ ] Copy `widget_layout_small.xml` to `android/app/src/main/res/layout/`
- [ ] Copy `widget_layout_medium.xml` to `android/app/src/main/res/layout/`
- [ ] Verify both files exist in the layout directory

#### Configuration Files
- [ ] Create directory `android/app/src/main/res/xml/` (if it doesn't exist)
- [ ] Copy `widget_info_small.xml` to `android/app/src/main/res/xml/`
- [ ] Copy `widget_info_medium.xml` to `android/app/src/main/res/xml/`
- [ ] Verify both files exist in the xml directory

#### Drawable Resources
- [ ] Copy `widget_background.xml` to `android/app/src/main/res/drawable/`
- [ ] Copy `button_background.xml` to `android/app/src/main/res/drawable/`
- [ ] Verify both files exist in the drawable directory

#### Kotlin Provider
- [ ] Copy `TechTimeWidgetProvider.kt` to `android/app/src/main/java/com/brcarszw/techtimes/`
- [ ] Verify the file exists in the correct package directory

### Step 3: Update AndroidManifest.xml
- [ ] Open `android/app/src/main/AndroidManifest.xml`
- [ ] Locate the `<application>` tag
- [ ] Add Small Widget receiver declaration
- [ ] Add Medium Widget receiver declaration
- [ ] Verify both receivers are inside `<application>` tag
- [ ] Save the file

### Step 4: Update strings.xml
- [ ] Open `android/app/src/main/res/values/strings.xml`
- [ ] Add `widget_description_small` string
- [ ] Add `widget_description_medium` string
- [ ] Save the file

### Step 5: Build and Install
- [ ] Run `npx expo run:android`
- [ ] Wait for build to complete
- [ ] Verify app installs on device
- [ ] App launches successfully

## 🧪 Testing Checklist

### Widget Picker
- [ ] Long-press on home screen
- [ ] Tap "Widgets" in the menu
- [ ] Scroll to find "TechTime" in the list
- [ ] "TechTime Small" option is visible
- [ ] "TechTime Medium" option is visible

### Small Widget (2x2)
- [ ] Drag Small widget to home screen
- [ ] Widget appears with TechTime title
- [ ] "Today: X AW" displays
- [ ] "X jobs" displays
- [ ] "X:XX hours" displays
- [ ] "+ Add Job" button is visible
- [ ] Widget has rounded corners
- [ ] Widget adapts to system theme (light/dark)

### Medium Widget (4x2)
- [ ] Drag Medium widget to home screen
- [ ] Widget appears with all Small widget features
- [ ] "Backup: X" status displays
- [ ] "Latest Job" section displays
- [ ] WIP number shows (or "—" if no jobs)
- [ ] Registration shows (or "No jobs yet" if empty)
- [ ] Streak displays if enabled (or hidden if disabled)
- [ ] Widget has rounded corners
- [ ] Widget adapts to system theme (light/dark)

### Functionality Tests

#### Deep Links
- [ ] Tap on widget title → Opens Dashboard
- [ ] Tap on stats area → Opens Dashboard
- [ ] Tap "+ Add Job" button → Opens Add Job screen
- [ ] Add Job screen has keyboard focused
- [ ] Back button returns to previous screen

#### Data Updates
- [ ] Open TechTime app
- [ ] Add a new job
- [ ] Wait 5-10 seconds
- [ ] Check widget updates with new data
- [ ] Edit an existing job
- [ ] Check widget updates
- [ ] Delete a job
- [ ] Check widget updates

#### Backup Status (Medium Widget)
- [ ] Create a backup in Settings
- [ ] Check widget shows "Backup: 0d ago"
- [ ] Wait a day (or change device date)
- [ ] Check widget shows "Backup: 1d ago"

#### Latest Job (Medium Widget)
- [ ] Add a job with WIP "12345" and Reg "ABC123"
- [ ] Check widget shows WIP "12345"
- [ ] Check widget shows Reg "ABC123"
- [ ] Add another job
- [ ] Check widget shows the newest job

#### Streak Display (Medium Widget)
- [ ] Enable streaks in Settings
- [ ] Add jobs on consecutive days
- [ ] Check widget shows streak count
- [ ] Check streak has fire emoji (🔥)
- [ ] Disable streaks in Settings
- [ ] Check streak section is hidden

### Theme Adaptation
- [ ] Set device to Light mode
- [ ] Check widget has light background
- [ ] Check text is dark/readable
- [ ] Set device to Dark mode
- [ ] Check widget has dark background
- [ ] Check text is light/readable

### Edge Cases
- [ ] Remove all jobs from app
- [ ] Check widget shows "0 AW", "0 jobs", "0:00 hours"
- [ ] Check Latest Job shows "—" and "No jobs yet"
- [ ] Never created backup
- [ ] Check widget shows "Backup: Never"
- [ ] Streaks disabled
- [ ] Check streak section is hidden

## 🐛 Troubleshooting Checklist

### Widget Not Appearing in Picker
- [ ] Verified all files were copied correctly
- [ ] Checked AndroidManifest.xml has both receivers
- [ ] Tried clean build: `cd android && ./gradlew clean && cd .. && npx expo run:android`
- [ ] Restarted device
- [ ] Checked Android logs: `adb logcat | grep TechTimeWidget`

### Widget Shows Default Values
- [ ] Opened app and added at least one job
- [ ] Waited 10 seconds for update
- [ ] Checked console logs for "WidgetManager: Updating widget data"
- [ ] Verified AsyncStorage permissions in AndroidManifest.xml
- [ ] Removed and re-added widget to home screen

### Deep Links Not Working
- [ ] Verified `app.json` has `"scheme": "techtimes"`
- [ ] Tested deep link manually: `adb shell am start -a android.intent.action.VIEW -d "techtimes://dashboard"`
- [ ] Checked intent filters in AndroidManifest.xml
- [ ] Verified app is not force-stopped
- [ ] Reinstalled app

### Widget Not Updating
- [ ] Checked that `updateWidgetData()` is called after job operations
- [ ] Verified AsyncStorage is working (check app logs)
- [ ] Checked Android system logs: `adb logcat | grep TechTimeWidget`
- [ ] Tried manual widget update: `adb shell am broadcast -a android.appwidget.action.APPWIDGET_UPDATE`
- [ ] Removed and re-added widget

## 📊 Final Verification

- [ ] Widget appears in system widget picker
- [ ] Both widget sizes (Small and Medium) are available
- [ ] Widget displays correct real-time data
- [ ] Deep links work (Dashboard and Add Job)
- [ ] Widget updates automatically after app changes
- [ ] Widget adapts to light/dark theme
- [ ] All interactive elements work correctly
- [ ] No crashes or errors in logs

## ✅ Integration Complete!

If all items are checked, your TechTime widget is successfully integrated and ready to use!

## 📝 Notes

- Widget updates every 30 minutes (Android system limitation)
- Manual updates trigger immediately after job operations
- Widget data is stored in AsyncStorage with key `@techtimes_widget_data`
- Deep links use the scheme `techtimes://`

## 🆘 Need Help?

If you encounter issues:
1. Check `WIDGET_SETUP_GUIDE.md` for detailed troubleshooting
2. Review `ANDROID_WIDGET_IMPLEMENTATION.md` for technical details
3. Check Android logs: `adb logcat | grep -E "TechTimeWidget|WidgetManager"`

---

**Congratulations!** Your TechTime widget is now integrated and working! 🎉
