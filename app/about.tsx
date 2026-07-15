
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

export default function AboutScreen() {
  console.log('AboutScreen: Rendering comprehensive about page');
  const { theme } = useThemeContext();
  const [exporting, setExporting] = useState(false);

  const handleExportToPDF = async () => {
    console.log('AboutScreen: User tapped Export Complete Guide as PDF');
    setExporting(true);

    try {
      const now = new Date();
      const currentDate =
        now.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }) +
        ' ' +
        now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              padding: 30px;
              line-height: 1.7;
              color: #2c3e50;
              background: linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 100%);
            }
            .container { background: white; border-radius: 20px; padding: 40px; box-shadow: 0 20px 60px rgba(0,0,0,0.4); }
            .header {
              text-align: center; padding: 30px 0;
              border-bottom: 4px solid #00d4ff;
              margin-bottom: 40px;
              background: linear-gradient(135deg, #0a0a2e 0%, #1a1a5e 100%);
              color: white; border-radius: 15px;
              box-shadow: 0 10px 30px rgba(0, 212, 255, 0.3);
            }
            .header h1 { font-size: 42px; margin-bottom: 10px; font-weight: 800; color: #00d4ff; }
            .header .subtitle { font-size: 18px; opacity: 0.9; margin-top: 10px; font-weight: 500; color: #ffffff; }
            .header .meta { font-size: 14px; margin-top: 15px; opacity: 0.75; color: #aaaacc; }
            .toc { background: #f0f4ff; padding: 25px; border-radius: 12px; margin-bottom: 40px; border-left: 5px solid #00d4ff; }
            .toc h2 { color: #0a0a5e; margin-bottom: 15px; font-size: 22px; }
            .toc ul { list-style: none; padding-left: 0; }
            .toc li { padding: 8px 0; border-bottom: 1px solid #d0d8f0; }
            .toc li:last-child { border-bottom: none; }
            .toc a { color: #0055cc; text-decoration: none; font-weight: 500; }
            .section { margin-bottom: 50px; page-break-inside: avoid; }
            h2 { color: #0a0a5e; font-size: 30px; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 3px solid #00d4ff; font-weight: 700; }
            h3 { color: #1a1a7e; font-size: 22px; margin-top: 28px; margin-bottom: 14px; font-weight: 600; }
            h4 { color: #333; font-size: 17px; margin-top: 18px; margin-bottom: 10px; font-weight: 600; }
            p { margin-bottom: 14px; font-size: 15px; line-height: 1.8; }
            ul, ol { margin-left: 25px; margin-bottom: 18px; }
            li { margin-bottom: 9px; font-size: 15px; line-height: 1.7; }
            .highlight { background: linear-gradient(135deg, #e8f4ff 0%, #d0e8ff 100%); padding: 18px; border-left: 5px solid #00d4ff; border-radius: 8px; margin: 18px 0; }
            .highlight strong { color: #0055cc; font-size: 15px; }
            .info-box { background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); padding: 18px; border-left: 5px solid #2196F3; border-radius: 8px; margin: 18px 0; }
            .warning-box { background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); padding: 18px; border-left: 5px solid #ff9800; border-radius: 8px; margin: 18px 0; }
            .success-box { background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); padding: 18px; border-left: 5px solid #4caf50; border-radius: 8px; margin: 18px 0; }
            .formula { background: #f0f0f0; padding: 14px; border-radius: 8px; font-family: 'Courier New', monospace; font-size: 14px; margin: 14px 0; border: 2px solid #ccc; text-align: center; font-weight: bold; }
            .feature-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin: 18px 0; }
            .feature-card { background: #f0f4ff; padding: 14px; border-radius: 10px; border-left: 4px solid #00d4ff; }
            .feature-card strong { color: #0055cc; display: block; margin-bottom: 7px; font-size: 15px; }
            table { width: 100%; border-collapse: collapse; margin: 18px 0; }
            th, td { padding: 11px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background: #0a0a5e; color: white; font-weight: 600; }
            tr:hover { background: #f5f8ff; }
            .eff-green { background: #e8f5e9; color: #2e7d32; font-weight: bold; }
            .eff-yellow { background: #fff8e1; color: #f57f17; font-weight: bold; }
            .eff-red { background: #ffebee; color: #c62828; font-weight: bold; }
            .page-break { page-break-after: always; }
            .footer { margin-top: 50px; padding: 28px; border-radius: 15px; text-align: center; background: linear-gradient(135deg, #0a0a2e 0%, #1a1a5e 100%); }
            .footer h3 { color: #00d4ff; margin-bottom: 14px; }
            .footer p { color: #aaaacc; font-size: 13px; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚙️ Tech Times</h1>
              <div class="subtitle">Complete User Guide &amp; Feature Documentation</div>
              <div class="meta">
                <strong>Version:</strong> 1.0.9 &nbsp;|&nbsp;
                <strong>Generated:</strong> ${currentDate}
              </div>
            </div>

            <div class="toc">
              <h2>📑 Table of Contents</h2>
              <ul>
                <li><a href="#about">1. About Tech Times</a></li>
                <li><a href="#aw-system">2. Core Concept &amp; The AW System</a></li>
                <li><a href="#dashboard">3. Dashboard</a></li>
                <li><a href="#adding-jobs">4. Adding Jobs</a></li>
                <li><a href="#smart-entry">5. Smart Job Entry (AI)</a></li>
                <li><a href="#job-records">6. Job Records Tab</a></li>
                <li><a href="#job-store">7. Job Store Tab</a></li>
                <li><a href="#media">8. Media Tab</a></li>
                <li><a href="#insights">9. Insights Tab</a></li>
                <li><a href="#stats">10. Time Statistics Tab</a></li>
                <li><a href="#streaks">11. Streaks</a></li>
                <li><a href="#calendar">12. Performance Calendar</a></li>
                <li><a href="#work-schedule">13. Work Schedule</a></li>
                <li><a href="#absence">14. Absence Logger</a></li>
                <li><a href="#export">15. Export &amp; Backup</a></li>
                <li><a href="#notifications">16. Notifications</a></li>
                <li><a href="#security">17. Security</a></li>
                <li><a href="#privacy">18. Privacy &amp; Data</a></li>
                <li><a href="#widgets">19. iOS &amp; Android Widgets</a></li>
                <li><a href="#appearance">20. Appearance</a></li>
                <li><a href="#formulas">21. Formula Settings</a></li>
                <li><a href="#tips">22. Tips &amp; Best Practices</a></li>
                <li><a href="#troubleshooting">23. Troubleshooting</a></li>
              </ul>
            </div>

            <div class="section" id="about">
              <h2>📱 1. About Tech Times</h2>
              <p>Tech Times is a fully offline, PIN-secured personal job tracking app built exclusively for vehicle technicians. Every feature is designed around one core unit: the AW (Allocated Work), where 1 AW = 5 minutes of sold labour time.</p>
              <p>The app tracks jobs, calculates efficiency in real time, monitors monthly targets, and generates professional PDF reports — all without any internet connection, cloud storage, or external servers. Your data never leaves your device.</p>
              <div class="feature-grid">
                <div class="feature-card"><strong>🔒 Fully Offline</strong>All data stored locally. No cloud, no servers, complete privacy.</div>
                <div class="feature-card"><strong>🔐 PIN + Biometrics</strong>4-digit PIN and fingerprint/Face ID protect your data.</div>
                <div class="feature-card"><strong>📊 Live Dashboard</strong>Real-time efficiency rings, workday progress bar, and streak tracking.</div>
                <div class="feature-card"><strong>🧠 AI Smart Entry</strong>Natural-language job entry with pattern recognition and autocomplete.</div>
                <div class="feature-card"><strong>📸 Photo Attachments</strong>Attach job card photos; browse all images in the Media gallery.</div>
                <div class="feature-card"><strong>📤 PDF / JSON Export</strong>Daily, weekly, monthly, or all-time reports with efficiency bars.</div>
                <div class="feature-card"><strong>🔔 Smart Notifications</strong>Work start/end, lunch, daily reminders, efficiency alerts.</div>
                <div class="feature-card"><strong>📅 Performance Calendar</strong>4 view modes with efficiency rings on every working day.</div>
                <div class="feature-card"><strong>🔥 Streaks</strong>Daily and weekly logging streaks with a visual calendar heatmap.</div>
                <div class="feature-card"><strong>📈 Insights Tab</strong>Job mix, repeat regs, trends, goals, and drilldown analysis.</div>
                <div class="feature-card"><strong>🎨 Dark / Light Themes</strong>Workshop-themed backgrounds with adjustable overlay strength.</div>
                <div class="feature-card"><strong>📱 iOS &amp; Android Widgets</strong>Home screen widgets showing today's progress and efficiency.</div>
              </div>
            </div>

            <div class="page-break"></div>

            <div class="section" id="aw-system">
              <h2>⚙️ 2. Core Concept &amp; The AW System</h2>
              <p>The AW (Allocated Work) is the fundamental unit of Tech Times. Every job is measured in AWs, and all efficiency calculations derive from this unit.</p>
              <div class="formula">1 AW = 5 minutes &nbsp;|&nbsp; 12 AW = 1 hour &nbsp;|&nbsp; 96 AW = 8 hours</div>
              <h3>Key Formulas</h3>
              <div class="formula">Sold Hours = Total AW × 5 ÷ 60</div>
              <div class="formula">Efficiency = Sold Hours ÷ Available Hours × 100</div>
              <div class="formula">Available Hours = Working Days Elapsed × Daily Hours − Absences</div>
              <div class="formula">Target Hours = Working Days in Month × Daily Hours</div>
              <h3>Efficiency Colour Thresholds</h3>
              <table>
                <tr><th>Efficiency</th><th>Colour</th><th>Status</th></tr>
                <tr><td class="eff-green">≥ 65%</td><td class="eff-green">Green</td><td class="eff-green">Excellent</td></tr>
                <tr><td class="eff-yellow">≥ 31%</td><td class="eff-yellow">Yellow</td><td class="eff-yellow">Good</td></tr>
                <tr><td class="eff-red">&lt; 31%</td><td class="eff-red">Red</td><td class="eff-red">Needs Improvement</td></tr>
              </table>
              <div class="info-box">
                <strong>ℹ️ Configurable Thresholds:</strong> The green and yellow thresholds can be adjusted in Settings → Formula Settings to match your workshop's targets.
              </div>
            </div>

            <div class="section" id="dashboard">
              <h2>📱 3. Dashboard</h2>
              <p>The Dashboard is your real-time command centre. It auto-refreshes every 30 seconds and reloads instantly when you return from adding a job.</p>
              <h3>Dashboard Components</h3>
              <h4>⏰ Live Clock &amp; Date</h4>
              <p>Large digital clock updating every second, with today's date below it.</p>
              <h4>🔥 Streaks Card</h4>
              <p>Shows current streak, best streak, and best day this month (highest AW). Tap to open the full Streaks screen.</p>
              <h4>⏱️ Workday Progress Bar</h4>
              <p>Live progress bar spanning your configured work start to end time. A yellow section marks the lunch break window. States: Before Work / Working / Lunch Break / Work Complete / Absent / Not a Work Day.</p>
              <h4>🎯 Today's Live Progress Rings (3 Concentric)</h4>
              <ul>
                <li><strong>Inner ring</strong> — daily target hours (static reference)</li>
                <li><strong>Middle ring</strong> — time elapsed through workday (live, moves every minute)</li>
                <li><strong>Outer ring</strong> — sold hours today vs daily target (updates as you add jobs). Turns yellow if within 15% behind pace, red if more than 15% behind.</li>
              </ul>
              <h4>📊 Monthly Target Ring</h4>
              <p>Sold hours vs monthly target. Colour-coded. Tap to open Target Details.</p>
              <h4>📈 Efficiency Ring</h4>
              <p>Sold hours ÷ available hours × 100. Colour-coded. Tap to open Efficiency Details.</p>
              <h4>📋 Monthly Breakdown Card</h4>
              <p>Total AW, Sold Hours, Target Hours, Available Hours, Efficiency %.</p>
              <h4>📦 4 Stat Tiles</h4>
              <ul>
                <li><strong>Total AWs</strong> — tap for Total AW Details</li>
                <li><strong>Time Logged</strong> — tap for Time Logged Details</li>
                <li><strong>Jobs Done</strong> — tap for Jobs Done Details</li>
                <li><strong>Hours Remaining</strong> — tap for Hours Remaining Details</li>
              </ul>
              <h4>Today &amp; This Week Cards</h4>
              <p>Both tappable for detailed breakdowns of that period.</p>
              <h4>➕ Add New Job Button</h4>
              <p>Opens the Add Job modal directly from the dashboard.</p>
              <h4>📅 Performance Calendar Quick Link</h4>
              <p>Quick navigation to the full Performance Calendar screen.</p>
              <h4>Landscape / Tablet Layout</h4>
              <p>On wider screens the dashboard switches to a two-column layout automatically.</p>
            </div>

            <div class="page-break"></div>

            <div class="section" id="adding-jobs">
              <h2>📝 4. Adding Jobs</h2>
              <p>Tap <strong>Add New Job</strong> on the Dashboard or the <strong>+ Add Job</strong> button in Job Records to open the Add Job modal.</p>
              <h3>Job Fields</h3>
              <table>
                <tr><th>Field</th><th>Details</th></tr>
                <tr><td><strong>WIP Number *</strong></td><td>Exactly 5 digits (e.g. 12345). Validated on save.</td></tr>
                <tr><td><strong>Vehicle Registration *</strong></td><td>Auto-uppercased. Scan button available (camera or gallery OCR).</td></tr>
                <tr><td><strong>AW Value *</strong></td><td>0–100. Live time preview shown (e.g. 20 AW = 1h 40m).</td></tr>
                <tr><td><strong>VHC Status</strong></td><td>Colour buttons: Green / Orange / Red / None. Tap again to deselect.</td></tr>
                <tr><td><strong>Date &amp; Time</strong></td><td>Defaults to now. Tap to change. Cannot be set in the future.</td></tr>
                <tr><td><strong>Notes</strong></td><td>Optional free-text notes about the job.</td></tr>
                <tr><td><strong>Job Card Photo</strong></td><td>Optional. Take a photo or choose from gallery. Stored locally.</td></tr>
              </table>
              <h3>Scan Buttons</h3>
              <ul>
                <li><strong>Scan Card</strong> — OCR scans a job card image to extract WIP number and registration simultaneously.</li>
                <li><strong>Scan Reg</strong> — OCR scans a number plate image to extract the registration.</li>
              </ul>
              <h3>Memory Autocomplete</h3>
              <p>As you type in the WIP or Registration field, a dropdown shows matching previous jobs. Tap any suggestion to auto-fill all fields from that job's last entry.</p>
              <div class="formula">1 AW = 5 minutes &nbsp;|&nbsp; 12 AW = 1 hour &nbsp;|&nbsp; 96 AW = 8 hours</div>
              <div class="success-box">
                <strong>✅ On Save:</strong> Widget data is refreshed and the dashboard updates immediately. A process notification confirms success.
              </div>
            </div>

            <div class="section" id="smart-entry">
              <h2>🧠 5. Smart Job Entry (AI)</h2>
              <p>Access via Settings → Quick Links. Describe a job in plain English and the AI extracts the structured data.</p>
              <h3>Example Inputs</h3>
              <ul>
                <li>"12345 ABC123 20 AW green vhc"</li>
                <li>"Job 11111 for ABC456 took 25 AW, orange VHC, brake service"</li>
                <li>"WIP 54321 reg XYZ789 15 hours"</li>
              </ul>
              <p>A confidence score (0–100%) is shown. Below 70% triggers a clarification prompt.</p>
              <h3>Pattern Analysis</h3>
              <p>Tap the chart icon (requires 5+ jobs) to see: avg AW, input speed, most frequent vehicles, and personalised suggestions.</p>
            </div>

            <div class="page-break"></div>

            <div class="section" id="job-records">
              <h2>📋 6. Job Records Tab</h2>
              <p>Browse jobs by month using ← → navigation. Totals bar shows job count, total AWs, and total time. Edit any job or delete with confirmation. VHC colour strip on each card. Long-press for selection mode → bulk PDF export of selected jobs.</p>
            </div>

            <div class="section" id="job-store">
              <h2>🔍 7. Job Store Tab</h2>
              <p>Search all jobs across all time by WIP, reg, or notes. Filters: date range (All Time/Today/This Week/This Month), VHC status. Sort: Newest, Oldest, Highest AW, Lowest AW, WIP A–Z, WIP Z–A. Live totals bar for filtered results.</p>
            </div>

            <div class="section" id="media">
              <h2>📸 8. Media Tab</h2>
              <p>3-column photo grid of all job card images. Vehicle reg overlaid on each thumbnail. Stats bar: photo count + storage used (MB). Tap for full-screen view with WIP + reg. Long-press to delete (with confirmation). Photos stored locally, not included in JSON exports.</p>
            </div>

            <div class="section" id="insights">
              <h2>📈 9. Insights Tab</h2>
              <p>6 sub-tabs across configurable date ranges (Today/7d/30d/This Month/Custom). Optional shift filter.</p>
              <h3>Sub-Tabs</h3>
              <ul>
                <li><strong>Overview</strong> — KPI cards + quick drilldowns: Biggest AW, No Tags, Has Notes, Comebacks</li>
                <li><strong>Job Mix</strong> — job types ranked by keyword from notes: Service/MOT/Repair/Diagnostic/etc.</li>
                <li><strong>Efficiency</strong> — avg AW/day, total time</li>
                <li><strong>Repeats</strong> — top 20 most-repeated regs with visit count, total AW, last seen</li>
                <li><strong>Trends</strong> — bar chart of jobs per day</li>
                <li><strong>Goals</strong> — monthly target progress, remaining hours, required daily pace, best day</li>
              </ul>
              <div class="info-box">
                <strong>ℹ️ Drilldown Modal:</strong> Tap any KPI to see a filtered job list, sortable by Newest/Highest AW/Reg Repeats/Most Notes.
              </div>
            </div>

            <div class="page-break"></div>

            <div class="section" id="stats">
              <h2>⏱️ 10. Time Statistics Tab</h2>
              <p>Live timers: Available Hours Today (counts up from work start minus lunch), Time Elapsed Today (HH:MM:SS), Time Remaining Today (HH:MM:SS).</p>
              <p>Monthly Performance card: large efficiency % with colour, Total AW, Sold Hours, Available Hours, Remaining Hours. Yearly Performance: progress bar for work year (configurable start date), sold vs target vs remaining. Period stats: Day/Week/Month navigable with ← →. All-time totals. 10 most recent jobs.</p>
            </div>

            <div class="section" id="streaks">
              <h2>🔥 11. Streaks</h2>
              <p>Daily streak: consecutive days with ≥1 job logged. Weekly streak: consecutive weeks meeting weekly job target (configurable, default 5/week). Best day this month (highest AW). Most productive day (most jobs). Monthly calendar heatmap: days with jobs highlighted with dot + count. Navigate months with ← →.</p>
            </div>

            <div class="section" id="calendar">
              <h2>📅 12. Performance Calendar</h2>
              <p>4 view modes:</p>
              <ul>
                <li><strong>Day</strong> — efficiency ring + progress ring + jobs list</li>
                <li><strong>Week</strong> — 7 day cards with mini rings</li>
                <li><strong>Month</strong> — full grid with tiny rings per day + month summary rings at top</li>
                <li><strong>Year</strong> — 12 month cards with rings</li>
              </ul>
              <p>Navigate with ← → and Today button. Tap any day to see jobs, sold hours, efficiency.</p>
            </div>

            <div class="section" id="work-schedule">
              <h2>📆 13. Work Schedule</h2>
              <p>Settings → Quick Links → Work Schedule. Fields: working days (Mon–Sun toggle), start/end time, lunch start/end, lunch break minutes, Saturday frequency (None/Every/1-in-2/1-in-3/1-in-4/Custom), Saturday start/end times, next working Saturday date.</p>
              <div class="formula">Daily Hours = (End Time − Start Time) − Lunch Minutes ÷ 60</div>
              <p>Affects: available hours, efficiency, workday progress bar, calendar, PDF exports.</p>
            </div>

            <div class="section" id="absence">
              <h2>🏖️ 14. Absence Logger</h2>
              <p>Types: Holiday, Sickness, Training. Duration: Full Day, Half Day, Custom Hours. Deduction type: past/today absences reduce available hours; future absences reduce target hours. Dashboard shows "Absent" on absence days. Non-working days can be marked Overtime (adds available hours) or Compensation (day off in lieu) from the dashboard calendar.</p>
            </div>

            <div class="page-break"></div>

            <div class="section" id="export">
              <h2>📤 15. Export &amp; Backup</h2>
              <h3>PDF Export</h3>
              <p>Date ranges: Daily/Weekly/Monthly/All Time. Contents: technician name, date range, job table (WIP, Reg, VHC, AW, Hours), day/week/month totals, efficiency progress bars with colour coding.</p>
              <h3>JSON Backup</h3>
              <p>Full backup of all jobs with all fields. Import: select JSON file, progress notification, duplicate detection. Clear All Data: double confirmation required.</p>
              <div class="warning-box">
                <strong>⚠️ Important:</strong> Create regular JSON backups. A forgotten PIN requires reinstalling the app and all data will be lost.
              </div>
            </div>

            <div class="section" id="notifications">
              <h2>🔔 16. Notifications</h2>
              <p>Work schedule: Work Start, Work End, Lunch Start, Lunch End. Performance: Daily Reminder (configurable time), Weekly Report (configurable day), Monthly Report, Target Reminder, Efficiency Alert (configurable threshold, default 75%). Sound: Default or Silent. Vibration: Default/Short/Long/Double. Test Notification button. All notifications rescheduled automatically on schedule change.</p>
            </div>

            <div class="section" id="security">
              <h2>🔐 17. Security</h2>
              <table>
                <tr><th>Feature</th><th>Description</th></tr>
                <tr><td><strong>PIN Protection</strong></td><td>4-digit PIN required on every app open.</td></tr>
                <tr><td><strong>Biometric Login</strong></td><td>Fingerprint or Face ID for instant access (optional).</td></tr>
                <tr><td><strong>Smart Lock Timeout</strong></td><td>&lt;30 min: no lock. 30 min–1 hr: lock but resume last screen. &gt;1 hr: lock and return to home.</td></tr>
                <tr><td><strong>Change PIN</strong></td><td>Settings → Security → Change PIN. Requires current PIN.</td></tr>
              </table>
              <div class="warning-box">
                <strong>⚠️ Forgotten PIN:</strong> There is no PIN recovery. If you forget your PIN you must reinstall the app. Create regular JSON backups to prevent data loss.
              </div>
            </div>

            <div class="section" id="privacy">
              <h2>🔒 18. Privacy &amp; Data</h2>
              <p>All data stored locally (AsyncStorage + device file system). No internet required. No data sent to servers. No analytics, no tracking, no cloud sync.</p>
              <div class="success-box">
                <strong>✅ GDPR Compliant:</strong> Only vehicle regs and job data stored. No customer personal info. Permissions: Camera (optional), Photo Library (optional), Notifications (optional), Biometrics (optional).
              </div>
            </div>

            <div class="section" id="widgets">
              <h2>📱 19. iOS &amp; Android Widgets</h2>
              <h3>iOS Widget</h3>
              <p>SwiftUI WidgetKit home screen widget showing circular progress ring with current time. Updated on every job save, edit, delete, import, or backup. Add via home screen long-press → Widgets → Tech Times.</p>
              <h3>Android Widget</h3>
              <p>Persistent notification in notification shade showing shift progress % and elapsed time with "+ Add Job" action button (deep-links to techtimes://add-job). Android home screen widget showing day progress, elapsed time, last backup timestamp.</p>
            </div>

            <div class="page-break"></div>

            <div class="section" id="appearance">
              <h2>🎨 20. Appearance</h2>
              <p>Dark Mode (workshop backgrounds, OLED battery saving) / Light Mode (bright environments). Background Overlay Strength slider (30%–90%) — controls darkness of background image overlay. Changes apply immediately across all screens.</p>
            </div>

            <div class="section" id="formulas">
              <h2>🔢 21. Formula Settings</h2>
              <table>
                <tr><th>Setting</th><th>Default</th></tr>
                <tr><td>AW to Minutes</td><td>5 minutes</td></tr>
                <tr><td>Efficiency Green Threshold</td><td>65%</td></tr>
                <tr><td>Efficiency Yellow Threshold</td><td>31%</td></tr>
                <tr><td>Default Monthly Target</td><td>180 hours</td></tr>
                <tr><td>Default Daily Hours</td><td>8.5 hours</td></tr>
                <tr><td>Default Lunch Break</td><td>30 minutes</td></tr>
              </table>
            </div>

            <div class="section" id="tips">
              <h2>💡 22. Tips &amp; Best Practices</h2>
              <h3>Daily</h3>
              <ul>
                <li>Check dashboard at start of day</li>
                <li>Log jobs as completed using autocomplete for repeat vehicles</li>
                <li>Use Scan Card for OCR fill</li>
                <li>Review efficiency ring at end of day</li>
                <li>Check streaks card to maintain your streak</li>
              </ul>
              <h3>Weekly / Monthly</h3>
              <ul>
                <li>Check Insights → Repeats for frequent vehicles</li>
                <li>Check Insights → Trends for your most productive days</li>
                <li>Export monthly PDF for records</li>
                <li>Create JSON backup weekly</li>
              </ul>
              <h3>Speed Tips</h3>
              <ul>
                <li>Use VHC colour buttons for fast status entry</li>
                <li>Enable biometric login for instant access</li>
                <li>Use Smart Job Entry for natural language input</li>
                <li>Long-press jobs for bulk PDF export</li>
                <li>Use Job Store for quick lookup across all time</li>
              </ul>
              <h3>Accuracy Tips</h3>
              <ul>
                <li>Double-check WIP numbers (must be exactly 5 digits)</li>
                <li>Log absences promptly to keep efficiency accurate</li>
                <li>Keep work schedule up to date</li>
                <li>Adjust formula thresholds if your workshop targets differ</li>
              </ul>
            </div>

            <div class="section" id="troubleshooting">
              <h2>🔧 23. Troubleshooting</h2>
              <table>
                <tr><th>Issue</th><th>Solution</th></tr>
                <tr><td><strong>Efficiency wrong</strong></td><td>Check work schedule, absence logger, formula settings, and job dates.</td></tr>
                <tr><td><strong>Biometrics not working</strong></td><td>Check device enrollment, app permissions, try disable/re-enable, use PIN fallback.</td></tr>
                <tr><td><strong>Export/PDF not working</strong></td><td>Check storage permissions, free space, try smaller date range, restart app.</td></tr>
                <tr><td><strong>Notifications not appearing</strong></td><td>Check permissions, Do Not Disturb, Android battery optimisation, use Test Notification.</td></tr>
                <tr><td><strong>Import failing</strong></td><td>Ensure valid Tech Times JSON (not PDF/CSV), check file not corrupted, must contain "jobs" array.</td></tr>
                <tr><td><strong>Widget not updating (iOS)</strong></td><td>Save a job or create backup to trigger refresh, remove and re-add widget.</td></tr>
              </table>
            </div>

            <div class="footer">
              <h3>⚙️ Tech Times v1.0.9</h3>
              <p>Secure Personal Job Tracking for Vehicle Technicians</p>
              <p style="margin-top: 10px;">Created by b.rugge — Owner &amp; Creator</p>
              <p style="margin-top: 8px;">© 2025 b.rugge / Tech Times. All rights reserved.</p>
              <p style="margin-top: 8px; font-size: 12px;">Generated: ${currentDate}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      console.log('AboutScreen: PDF generated at', uri);

      const fileName = `TechTimes_Guide_v1.0.9_${now.toISOString().split('T')[0]}.pdf`;
      const cacheDir = FileSystem.cacheDirectory ?? '';
      const destUri = cacheDir + fileName;
      if (uri !== destUri) {
        await FileSystem.copyAsync({ from: uri, to: destUri });
        try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {}
      }
      console.log('AboutScreen: PDF copied to', destUri);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(destUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Tech Times Guide',
          UTI: 'com.adobe.pdf',
        });
        console.log('AboutScreen: PDF shared successfully');
      } else {
        Alert.alert('PDF Saved', `Guide saved to: ${destUri}`);
      }
    } catch (error) {
      console.error('AboutScreen: PDF export failed', error);
      Alert.alert('Export Failed', 'Could not generate PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppBackground>
      <Stack.Screen
        options={{
          title: 'About Tech Times',
          headerStyle: { backgroundColor: theme.card },
          headerTintColor: theme.text,
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Card */}
        <View style={[styles.header, { backgroundColor: theme.card }]}>
          <IconSymbol
            ios_icon_name="wrench.and.screwdriver.fill"
            android_material_icon_name="build"
            size={52}
            color={theme.primary}
          />
          <Text style={[styles.appName, { color: theme.text }]}>Tech Times</Text>
          <Text style={[styles.versionText, { color: theme.primary }]}>Version 1.0.9</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Secure Personal Job Tracking for Vehicle Technicians
          </Text>
          <Text style={[styles.creator, { color: theme.textSecondary }]}>
            Created by b.rugge — Owner &amp; Creator
          </Text>
        </View>

        {/* Export Button */}
        <TouchableOpacity
          style={[styles.exportButton, { backgroundColor: theme.primary }]}
          onPress={handleExportToPDF}
          disabled={exporting}
        >
          <IconSymbol
            ios_icon_name="arrow.down.doc.fill"
            android_material_icon_name="picture_as_pdf"
            size={20}
            color="#fff"
          />
          <Text style={styles.exportButtonText}>
            {exporting ? 'Generating PDF…' : 'Export Complete Guide as PDF'}
          </Text>
        </TouchableOpacity>

        {/* Section 1 — About Tech Times */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>1. About Tech Times</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Tech Times is a fully offline, PIN-secured personal job tracking app built exclusively for vehicle technicians. Every feature is designed around one core unit: the AW (Allocated Work), where 1 AW = 5 minutes of sold labour time.
          </Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            The app tracks jobs, calculates efficiency in real time, monitors monthly targets, and generates professional PDF reports — all without any internet connection, cloud storage, or external servers. Your data never leaves your device.
          </Text>
          <View style={[styles.successBox, { backgroundColor: theme.background, borderLeftColor: '#4caf50' }]}>
            <Text style={[styles.text, { color: theme.text, marginBottom: 0 }]}>
              ✅ 100% offline. No cloud. No tracking. No servers. Your data stays on your device.
            </Text>
          </View>
        </View>

        {/* Section 2 — Core Concept & The AW System */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>2. Core Concept &amp; The AW System</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            The AW (Allocated Work) is the fundamental unit of Tech Times. Every job is measured in AWs, and all efficiency calculations derive from this unit.
          </Text>
          <View style={[styles.formulaBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Text style={[styles.formulaText, { color: theme.text }]}>1 AW = 5 minutes</Text>
            <Text style={[styles.formulaText, { color: theme.text }]}>Sold Hours = Total AW × 5 ÷ 60</Text>
            <Text style={[styles.formulaText, { color: theme.text }]}>Efficiency = Sold Hours ÷ Available Hours × 100</Text>
            <Text style={[styles.formulaText, { color: theme.text }]}>Available Hours = Working Days Elapsed × Daily Hours − Absences</Text>
            <Text style={[styles.formulaText, { color: theme.text }]}>Target Hours = Working Days in Month × Daily Hours</Text>
          </View>
          <Text style={[styles.subsectionTitle, { color: theme.text }]}>Efficiency Colour Thresholds</Text>
          <View style={styles.thresholdRow}>
            <View style={[styles.thresholdBadge, { backgroundColor: '#1b5e20' }]}>
              <Text style={styles.thresholdText}>≥65% — Excellent</Text>
            </View>
          </View>
          <View style={styles.thresholdRow}>
            <View style={[styles.thresholdBadge, { backgroundColor: '#e65100' }]}>
              <Text style={styles.thresholdText}>≥31% — Good</Text>
            </View>
          </View>
          <View style={styles.thresholdRow}>
            <View style={[styles.thresholdBadge, { backgroundColor: '#b71c1c' }]}>
              <Text style={styles.thresholdText}>&lt;31% — Needs Improvement</Text>
            </View>
          </View>
        </View>

        {/* Section 3 — Dashboard */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>3. Dashboard</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Real-time command centre. Auto-refreshes every 30 seconds and on every return from adding a job.
          </Text>
          <Text style={[styles.subsectionTitle, { color: theme.text }]}>Components</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            • Live clock (updates every second) + date{'\n'}
            • Streaks card (current streak, best streak, best day this month) — tappable{'\n'}
            • Workday progress bar with lunch break overlay — states: Before Work / Working / Lunch Break / Work Complete / Absent / Not a Work Day{'\n'}
            • Today's Live Progress rings (3 concentric): inner = daily target hours (static), middle = time elapsed (live, every minute), outer = sold hours today vs daily target (updates as you add jobs). Outer ring turns yellow if within 15% behind pace, red if more than 15% behind{'\n'}
            • Monthly Target ring — sold hours vs monthly target, tappable{'\n'}
            • Efficiency ring — sold hours ÷ available hours × 100, tappable{'\n'}
            • Monthly Breakdown card: Total AW, Sold Hours, Target Hours, Available Hours, Efficiency %{'\n'}
            • 4 stat tiles: Total AWs, Time Logged, Jobs Done, Hours Remaining — all tappable{'\n'}
            • Today card and This Week card — both tappable{'\n'}
            • Add New Job button{'\n'}
            • Performance Calendar quick link{'\n'}
            • Landscape/tablet: auto 2-column layout
          </Text>
        </View>

        {/* Section 4 — Adding Jobs */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>4. Adding Jobs</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Fields: WIP Number (5 digits required), Vehicle Registration (auto-uppercase), AW Value (0–100, live time preview), VHC Status (Green/Orange/Red/None), Date &amp; Time (editable, defaults to now), Notes (optional), Job Card Photo (optional, camera or gallery).
          </Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Scan Card button (OCR extracts WIP + reg from job card image). Scan Reg button (OCR extracts reg from number plate). Memory autocomplete: typing in WIP or Reg shows matching previous jobs, tap to auto-fill all fields. On save: widget data refreshed, dashboard updates immediately.
          </Text>
        </View>

        {/* Section 5 — Smart Job Entry */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>5. Smart Job Entry (AI)</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Natural language parsing. Examples:
          </Text>
          <View style={[styles.infoBox, { backgroundColor: theme.background, borderLeftColor: theme.primary }]}>
            <Text style={[styles.text, { color: theme.text, marginBottom: 0 }]}>
              "12345 ABC123 20 AW green vhc"{'\n'}
              "Job 11111 for ABC456 took 25 AW, orange VHC, brake service"
            </Text>
          </View>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Confidence score shown (0–100%). Below 70% triggers clarification prompt. Chart icon shows pattern analysis (requires 5+ jobs): avg AW, input speed, most frequent vehicles.
          </Text>
        </View>

        {/* Section 6 — Job Records */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>6. Job Records Tab</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Browse jobs by month (← → navigation). Totals bar: job count, total AWs, total time. Edit any job. Delete with confirmation. VHC colour strip on each card. Long-press for selection mode → bulk PDF export of selected jobs.
          </Text>
        </View>

        {/* Section 7 — Job Store */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>7. Job Store Tab</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Search all jobs across all time by WIP, reg, or notes. Filters: date range (All Time/Today/This Week/This Month), VHC status. Sort: Newest, Oldest, Highest AW, Lowest AW, WIP A–Z, WIP Z–A. Live totals bar for filtered results.
          </Text>
        </View>

        {/* Section 8 — Media */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>8. Media Tab</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            3-column photo grid of all job card images. Vehicle reg overlaid on each thumbnail. Stats bar: photo count + storage used (MB). Tap for full-screen view with WIP + reg. Long-press to delete (with confirmation). Photos stored locally, not included in JSON exports.
          </Text>
        </View>

        {/* Section 9 — Insights */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>9. Insights Tab</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            6 sub-tabs across configurable date ranges (Today/7d/30d/This Month/Custom). Optional shift filter. Sub-tabs: Overview (KPI cards + quick drilldowns: Biggest AW, No Tags, Has Notes, Comebacks), Job Mix (job types ranked by keyword from notes: Service/MOT/Repair/Diagnostic/etc.), Efficiency (avg AW/day, total time), Repeats (top 20 most-repeated regs with visit count, total AW, last seen), Trends (bar chart of jobs per day), Goals (monthly target progress, remaining hours, required daily pace, best day).
          </Text>
          <View style={[styles.infoBox, { backgroundColor: theme.background, borderLeftColor: theme.primary }]}>
            <Text style={[styles.text, { color: theme.text, marginBottom: 0 }]}>
              Drilldown modal: tap any KPI to see filtered job list, sort by Newest/Highest AW/Reg Repeats/Most Notes.
            </Text>
          </View>
        </View>

        {/* Section 10 — Time Statistics */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>10. Time Statistics Tab</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Live timers: Available Hours Today (counts up from work start minus lunch), Time Elapsed Today (HH:MM:SS), Time Remaining Today (HH:MM:SS). Monthly Performance card: large efficiency % with colour, Total AW, Sold Hours, Available Hours, Remaining Hours. Yearly Performance: progress bar for work year (configurable start date), sold vs target vs remaining. Period stats: Day/Week/Month navigable with ← →. All-time totals. 10 most recent jobs.
          </Text>
        </View>

        {/* Section 11 — Streaks */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>11. Streaks</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Daily streak: consecutive days with ≥1 job logged. Weekly streak: consecutive weeks meeting weekly job target (configurable, default 5/week). Best day this month (highest AW). Most productive day (most jobs). Monthly calendar heatmap: days with jobs highlighted with dot + count. Navigate months with ← →.
          </Text>
        </View>

        {/* Section 12 — Performance Calendar */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>12. Performance Calendar</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            4 view modes: Day (efficiency ring + progress ring + jobs list), Week (7 day cards with mini rings), Month (full grid with tiny rings per day + month summary rings at top), Year (12 month cards with rings). Navigate with ← → and Today button. Tap any day to see jobs, sold hours, efficiency.
          </Text>
        </View>

        {/* Section 13 — Work Schedule */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>13. Work Schedule</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Settings → Quick Links → Work Schedule. Fields: working days (Mon–Sun toggle), start/end time, lunch start/end, lunch break minutes, Saturday frequency (None/Every/1-in-2/1-in-3/1-in-4/Custom), Saturday start/end times, next working Saturday date.
          </Text>
          <View style={[styles.formulaBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Text style={[styles.formulaText, { color: theme.text }]}>Daily Hours = (End − Start) − Lunch ÷ 60</Text>
          </View>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Affects: available hours, efficiency, workday progress bar, calendar, PDF exports.
          </Text>
        </View>

        {/* Section 14 — Absence Logger */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>14. Absence Logger</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Types: Holiday, Sickness, Training. Duration: Full Day, Half Day, Custom Hours. Deduction type: past/today absences reduce available hours; future absences reduce target hours. Dashboard shows "Absent" on absence days. Non-working days can be marked Overtime (adds available hours) or Compensation (day off in lieu) from the dashboard calendar.
          </Text>
        </View>

        {/* Section 15 — Export & Backup */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>15. Export &amp; Backup</Text>
          <Text style={[styles.subsectionTitle, { color: theme.text }]}>PDF Export</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Date ranges: Daily/Weekly/Monthly/All Time. Contents: technician name, date range, job table (WIP, Reg, VHC, AW, Hours), day/week/month totals, efficiency progress bars with colour coding.
          </Text>
          <Text style={[styles.subsectionTitle, { color: theme.text }]}>JSON Backup</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Full backup of all jobs with all fields. Import: select JSON file, progress notification, duplicate detection. Clear All Data: double confirmation required.
          </Text>
          <View style={[styles.warningBox, { backgroundColor: theme.background, borderLeftColor: '#ff9800' }]}>
            <Text style={[styles.text, { color: theme.text, marginBottom: 0 }]}>
              ⚠️ Create regular JSON backups. A forgotten PIN requires reinstalling the app and all data will be lost.
            </Text>
          </View>
        </View>

        {/* Section 16 — Notifications */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>16. Notifications</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Work schedule: Work Start, Work End, Lunch Start, Lunch End. Performance: Daily Reminder (configurable time), Weekly Report (configurable day), Monthly Report, Target Reminder, Efficiency Alert (configurable threshold, default 75%). Sound: Default or Silent. Vibration: Default/Short/Long/Double. Test Notification button. All notifications rescheduled automatically on schedule change.
          </Text>
        </View>

        {/* Section 17 — Security */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>17. Security</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            4-digit PIN on every open. Optional biometric (fingerprint/Face ID). Smart lock timeout: &lt;30 min = no lock, 30 min–1 hr = lock but resume last screen, &gt;1 hr = lock and return to home. Change PIN requires current PIN.
          </Text>
          <View style={[styles.warningBox, { backgroundColor: theme.background, borderLeftColor: '#ff9800' }]}>
            <Text style={[styles.text, { color: theme.text, marginBottom: 0 }]}>
              ⚠️ Warning: forgotten PIN requires reinstall — create regular JSON backups.
            </Text>
          </View>
        </View>

        {/* Section 18 — Privacy & Data */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>18. Privacy &amp; Data</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            All data stored locally (AsyncStorage + device file system). No internet required. No data sent to servers. No analytics, no tracking, no cloud sync. GDPR compliant: only vehicle regs and job data stored, no customer personal info.
          </Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Permissions: Camera (optional, for photos/OCR), Photo Library (optional), Notifications (optional), Biometrics (optional).
          </Text>
        </View>

        {/* Section 19 — Widgets */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>19. iOS &amp; Android Widgets</Text>
          <Text style={[styles.subsectionTitle, { color: theme.text }]}>iOS</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            SwiftUI WidgetKit home screen widget showing circular progress ring with current time. Updated on every job save, edit, delete, import, or backup. Add via home screen long-press → Widgets → Tech Times.
          </Text>
          <Text style={[styles.subsectionTitle, { color: theme.text }]}>Android</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Persistent notification in notification shade showing shift progress % and elapsed time with "+ Add Job" action button (deep-links to techtimes://add-job). Android home screen widget showing day progress, elapsed time, last backup timestamp.
          </Text>
        </View>

        {/* Section 20 — Appearance */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>20. Appearance</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Dark Mode (workshop backgrounds, OLED battery saving) / Light Mode (bright environments). Background Overlay Strength slider (30%–90%) — controls darkness of background image overlay. Changes apply immediately across all screens.
          </Text>
        </View>

        {/* Section 21 — Formula Settings */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>21. Formula Settings</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            AW to Minutes (default 5), Efficiency Green Threshold (default 65%), Efficiency Yellow Threshold (default 31%), Default Monthly Target (default 180h), Default Daily Hours (default 8.5h), Default Lunch Break (default 30 min).
          </Text>
        </View>

        {/* Section 22 — Tips & Best Practices */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>22. Tips &amp; Best Practices</Text>
          <Text style={[styles.subsectionTitle, { color: theme.text }]}>Daily</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            • Check dashboard at start of day{'\n'}
            • Log jobs as completed, use autocomplete for repeat vehicles{'\n'}
            • Use Scan Card for OCR fill{'\n'}
            • Review efficiency ring at end of day{'\n'}
            • Check streaks card
          </Text>
          <Text style={[styles.subsectionTitle, { color: theme.text }]}>Weekly / Monthly</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            • Check Insights → Repeats for frequent vehicles{'\n'}
            • Check Insights → Trends for productive days{'\n'}
            • Export monthly PDF{'\n'}
            • Create JSON backup weekly
          </Text>
          <Text style={[styles.subsectionTitle, { color: theme.text }]}>Speed Tips</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            • VHC colour buttons, biometric login, Smart Job Entry{'\n'}
            • Long-press for bulk export, Job Store for quick lookup
          </Text>
          <Text style={[styles.subsectionTitle, { color: theme.text }]}>Accuracy Tips</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            • Double-check WIP numbers (5 digits){'\n'}
            • Log absences promptly, keep schedule up to date{'\n'}
            • Adjust formula thresholds if needed
          </Text>
        </View>

        {/* Section 23 — Troubleshooting */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>23. Troubleshooting</Text>
          <Text style={[styles.subsectionTitle, { color: theme.text }]}>Efficiency wrong</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>Check work schedule, absence logger, formula settings, job dates.</Text>
          <Text style={[styles.subsectionTitle, { color: theme.text }]}>Biometrics not working</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>Check device enrollment, app permissions, try disable/re-enable, use PIN fallback.</Text>
          <Text style={[styles.subsectionTitle, { color: theme.text }]}>Export/PDF not working</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>Check storage permissions, free space, try smaller date range, restart app.</Text>
          <Text style={[styles.subsectionTitle, { color: theme.text }]}>Notifications not appearing</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>Check permissions, Do Not Disturb, Android battery optimisation, use Test Notification.</Text>
          <Text style={[styles.subsectionTitle, { color: theme.text }]}>Import failing</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>Ensure valid Tech Times JSON (not PDF/CSV), check file not corrupted, must contain "jobs" array.</Text>
          <Text style={[styles.subsectionTitle, { color: theme.text }]}>Widget not updating (iOS)</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>Save a job or create backup to trigger refresh, remove and re-add widget.</Text>
        </View>

        {/* Footer */}
        <View style={[styles.footer, { backgroundColor: theme.card }]}>
          <Text style={[styles.footerText, { color: theme.text, fontWeight: 'bold', fontSize: 16 }]}>Tech Times v1.0.9</Text>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>Secure Personal Job Tracking for Vehicle Technicians</Text>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>Created by b.rugge — Owner &amp; Creator</Text>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>© 2025 Tech Times. All rights reserved.</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: 16 },
  header: { alignItems: 'center', padding: 28, borderRadius: 16, marginBottom: 20 },
  appName: { fontSize: 28, fontWeight: 'bold', marginTop: 12 },
  versionText: { fontSize: 15, fontWeight: '600', marginTop: 4 },
  subtitle: { fontSize: 14, textAlign: 'center', marginTop: 6, fontStyle: 'italic', paddingHorizontal: 20 },
  creator: { fontSize: 12, marginTop: 8 },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
  },
  exportButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  section: { padding: 20, borderRadius: 12, marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 14 },
  subsectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 14, marginBottom: 8 },
  text: { fontSize: 14, lineHeight: 24, marginBottom: 8 },
  formulaBox: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 12,
  },
  formulaText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 13,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '600',
  },
  thresholdRow: { marginBottom: 6 },
  thresholdBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  thresholdText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  infoBox: { padding: 16, borderRadius: 8, borderLeftWidth: 4, marginTop: 12 },
  warningBox: { padding: 16, borderRadius: 8, borderLeftWidth: 4, marginTop: 8, marginBottom: 4 },
  successBox: { padding: 16, borderRadius: 8, borderLeftWidth: 4, marginTop: 8, marginBottom: 4 },
  footer: { padding: 24, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  footerText: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
