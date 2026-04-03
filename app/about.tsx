
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
import { Stack, useRouter } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

export default function AboutScreen() {
  console.log('AboutScreen: Rendering comprehensive about page');
  const { theme } = useThemeContext();
  const router = useRouter();
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
            .page-break { page-break-after: always; }
            .footer { margin-top: 50px; padding: 28px; border-radius: 15px; text-align: center; background: linear-gradient(135deg, #f0f4ff 0%, #e0e8ff 100%); }
            .footer h3 { color: #0a0a5e; margin-bottom: 14px; }
            .footer p { color: #555; font-size: 13px; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚙️ Tech Times</h1>
              <div class="subtitle">Complete User Guide &amp; Feature Documentation</div>
              <div class="meta">
                <strong>Version:</strong> 1.0.0 &nbsp;|&nbsp;
                <strong>Generated:</strong> ${currentDate}
              </div>
            </div>

            <div class="toc">
              <h2>📑 Table of Contents</h2>
              <ul>
                <li><a href="#about">1. About Tech Times</a></li>
                <li><a href="#getting-started">2. Getting Started &amp; Setup</a></li>
                <li><a href="#security">3. PIN Security &amp; Biometrics</a></li>
                <li><a href="#dashboard">4. Dashboard</a></li>
                <li><a href="#adding-jobs">5. Adding Jobs</a></li>
                <li><a href="#smart-entry">6. Smart Job Entry (AI-Powered)</a></li>
                <li><a href="#job-records">7. Job Records Tab</a></li>
                <li><a href="#job-store">8. Job Store (Search &amp; Reference)</a></li>
                <li><a href="#media">9. Media — Photo Library</a></li>
                <li><a href="#insights">10. Insights Tab</a></li>
                <li><a href="#stats">11. Time Statistics Tab</a></li>
                <li><a href="#streaks">12. Streaks &amp; Analytics</a></li>
                <li><a href="#work-schedule">13. Work Schedule Configuration</a></li>
                <li><a href="#absence">14. Absence Logger</a></li>
                <li><a href="#calendar">15. Performance Calendar</a></li>
                <li><a href="#efficiency">16. Understanding Efficiency</a></li>
                <li><a href="#formulas">17. Formula Settings</a></li>
                <li><a href="#export">18. Export &amp; Backup</a></li>
                <li><a href="#notifications">19. Notifications</a></li>
                <li><a href="#appearance">20. Appearance &amp; Themes</a></li>
                <li><a href="#widgets">21. Home Screen Widgets (iOS)</a></li>
                <li><a href="#privacy">22. Privacy &amp; Data</a></li>
                <li><a href="#tips">23. Tips &amp; Best Practices</a></li>
                <li><a href="#troubleshooting">24. Troubleshooting</a></li>
              </ul>
            </div>

            <div class="section" id="about">
              <h2>📱 1. About Tech Times</h2>
              <p>Tech Times is a secure, offline-first personal job tracking application designed specifically for vehicle technicians. Track your Allocated Work (AW) units, monitor efficiency, manage your productivity, and analyse your performance — all while keeping your data private and secure on your device.</p>
              <div class="highlight">
                <strong>🎯 Core Purpose:</strong>
                <p>Tech Times helps vehicle technicians log jobs with WIP numbers, vehicle registrations, AW values, and VHC statuses. It calculates real-time efficiency, tracks streaks, and generates professional PDF reports — entirely offline with no cloud dependency.</p>
              </div>
              <div class="feature-grid">
                <div class="feature-card"><strong>🔒 Fully Offline</strong>All data stored locally. No cloud, no servers, complete privacy.</div>
                <div class="feature-card"><strong>🔐 PIN + Biometrics</strong>4-digit PIN and fingerprint/Face ID protect your data.</div>
                <div class="feature-card"><strong>📊 Live Dashboard</strong>Real-time efficiency rings, workday progress bar, and streak tracking.</div>
                <div class="feature-card"><strong>🧠 AI Smart Entry</strong>Natural-language job entry with pattern recognition and autocomplete.</div>
                <div class="feature-card"><strong>📸 Photo Attachments</strong>Attach job card photos; browse all images in the Media gallery.</div>
                <div class="feature-card"><strong>📤 PDF / JSON Export</strong>Daily, weekly, monthly, or all-time reports with efficiency bars.</div>
                <div class="feature-card"><strong>🔔 Smart Notifications</strong>Work start/end, lunch, daily reminders, efficiency alerts.</div>
                <div class="feature-card"><strong>📅 Performance Calendar</strong>Month view with efficiency circles on every working day.</div>
                <div class="feature-card"><strong>🔥 Streaks</strong>Daily and weekly logging streaks with a visual calendar heatmap.</div>
                <div class="feature-card"><strong>📈 Insights Tab</strong>Job mix, repeat regs, trends, goals, and drilldown analysis.</div>
                <div class="feature-card"><strong>🎨 Dark / Light Themes</strong>Workshop-themed backgrounds with adjustable overlay strength.</div>
                <div class="feature-card"><strong>📱 iOS Widgets</strong>Home screen widget showing today's AW, efficiency, and last backup.</div>
              </div>
            </div>

            <div class="page-break"></div>

            <div class="section" id="getting-started">
              <h2>🚀 2. Getting Started &amp; Setup</h2>
              <h3>First-Time Setup Wizard</h3>
              <p>On first launch, the setup wizard guides you through:</p>
              <ol>
                <li><strong>Technician Name</strong> — Used on PDF reports and the dashboard header.</li>
                <li><strong>Create a PIN</strong> — Choose a secure 4-digit PIN (default: 3101). Change it immediately in Settings.</li>
                <li><strong>Work Schedule</strong> — Set your working days, start/end times, lunch break, and Saturday frequency.</li>
                <li><strong>Monthly Target Hours</strong> — Your target sold hours for the month (e.g. 180 h).</li>
                <li><strong>Biometric Login</strong> — Optionally enable fingerprint or Face ID for quick access.</li>
              </ol>
              <div class="success-box">
                <strong>✅ Setup Complete:</strong> After finishing setup, a welcome animation confirms the app is ready. You can revisit all settings at any time from the Settings tab.
              </div>
            </div>

            <div class="section" id="security">
              <h2>🔐 3. PIN Security &amp; Biometrics</h2>
              <table>
                <tr><th>Feature</th><th>Description</th></tr>
                <tr><td><strong>PIN Protection</strong></td><td>4-digit PIN required on every app open. Default: 3101 — change immediately.</td></tr>
                <tr><td><strong>Biometric Login</strong></td><td>Fingerprint or Face ID for instant access (optional, enable in Settings → Security).</td></tr>
                <tr><td><strong>Smart Lock Timeout</strong></td><td>Less than 30 min away: no lock. 30 min–1 hr: lock but resume current page. Over 1 hr: lock and return to home.</td></tr>
                <tr><td><strong>Change PIN</strong></td><td>Settings → Security → Change PIN. Requires current PIN to confirm.</td></tr>
                <tr><td><strong>PIN-only or Biometrics-only</strong></td><td>You can disable PIN if biometrics are enabled, or vice versa — but at least one must remain active.</td></tr>
              </table>
              <div class="warning-box">
                <strong>⚠️ Forgotten PIN:</strong> There is no PIN recovery. If you forget your PIN you must reinstall the app and lose all data. Create regular JSON backups to prevent data loss.
              </div>
            </div>

            <div class="page-break"></div>

            <div class="section" id="dashboard">
              <h2>📱 4. Dashboard</h2>
              <p>The Dashboard (home tab) is your real-time command centre. It auto-refreshes every 30 seconds and reloads instantly when you return from adding a job.</p>
              <h3>Dashboard Components</h3>
              <h4>⏰ Live Clock</h4>
              <p>Large digital clock updating every second, with today's date below it.</p>
              <h4>🔥 Streaks Card</h4>
              <p>Shows your current daily logging streak and best-ever streak. Tap to open the full Streaks &amp; Analytics screen. Displays the best day this month (highest AW). Can be disabled in Settings → Streaks &amp; Analytics.</p>
              <h4>⏱️ Workday Progress Bar</h4>
              <p>A live progress bar spanning your configured work start to end time. A yellow section marks the lunch break window. Shows status: Before Work / Working / Lunch Break / Work Complete / Absent / Not a Work Day.</p>
              <h4>🎯 Monthly Target Ring</h4>
              <p>Circular progress ring showing sold hours vs. your monthly target. Colour-coded green/yellow/red. Tap to open Target Details.</p>
              <h4>📊 Efficiency Ring</h4>
              <p>Current month efficiency (sold hours ÷ available hours × 100). Colour-coded. Tap to open Efficiency Details.</p>
              <h4>📋 Monthly Breakdown Card</h4>
              <p>Shows: Total AW, Total Sold Hours, Monthly Target Hours, Total Available Hours, and Efficiency %.</p>
              <h4>📦 Stat Tiles (2×2 grid)</h4>
              <ul>
                <li><strong>Total AWs</strong> — tap for Total AW Details</li>
                <li><strong>Time Logged</strong> — tap for Time Logged Details</li>
                <li><strong>Jobs Done</strong> — tap for Jobs Done Details</li>
                <li><strong>Hours Remaining</strong> — tap for Hours Remaining Details</li>
              </ul>
              <h4>📅 Performance Calendar Button</h4>
              <p>Quick link to the full Performance Calendar screen.</p>
              <h4>Today &amp; This Week Cards</h4>
              <p>Tap either card for a detailed breakdown of that period.</p>
              <h4>➕ Add New Job Button</h4>
              <p>Opens the Add Job modal directly from the dashboard.</p>
              <h4>Landscape / Tablet Layout</h4>
              <p>On wider screens the dashboard switches to a two-column layout automatically.</p>
              <h4>Overtime / Compensation Days</h4>
              <p>Tap any non-working day on the dashboard mini-calendar to mark it as Overtime or Compensation.</p>
            </div>

            <div class="page-break"></div>

            <div class="section" id="adding-jobs">
              <h2>📝 5. Adding Jobs</h2>
              <p>Tap <strong>Add New Job</strong> on the Dashboard or the <strong>+ Add Job</strong> button in Job Records to open the Add Job modal.</p>
              <h3>Job Fields</h3>
              <table>
                <tr><th>Field</th><th>Details</th></tr>
                <tr><td><strong>WIP Number *</strong></td><td>Exactly 5 digits (e.g. 12345). Validated on save.</td></tr>
                <tr><td><strong>Vehicle Registration *</strong></td><td>Auto-uppercased. Scan button available (camera or gallery OCR).</td></tr>
                <tr><td><strong>AW Value *</strong></td><td>0–100. Select from a scrollable picker. Live time preview shown (e.g. 12 AW = 1h 00m).</td></tr>
                <tr><td><strong>VHC Status</strong></td><td>Colour buttons: Green / Orange / Red. Tap again to deselect (returns to NONE).</td></tr>
                <tr><td><strong>Date &amp; Time</strong></td><td>Defaults to now. Tap date or time button to change. Cannot be set in the future.</td></tr>
                <tr><td><strong>Notes</strong></td><td>Optional free-text notes about the job.</td></tr>
                <tr><td><strong>Job Card Photo</strong></td><td>Optional. Take a photo or choose from gallery. Stored locally and visible in Media tab.</td></tr>
              </table>
              <h3>Scan Buttons</h3>
              <ul>
                <li><strong>Scan Card</strong> (next to WIP) — OCR scans a job card image to extract WIP number and registration simultaneously.</li>
                <li><strong>Scan Reg</strong> (next to Registration) — OCR scans a number plate image to extract the registration.</li>
              </ul>
              <h3>Memory Autocomplete</h3>
              <p>As you type in the WIP or Registration field, a dropdown shows matching previous jobs. Tap any suggestion to auto-fill WIP, Registration, AW, VHC Status, and Notes from that job's last entry. Suggestions are sorted by recency.</p>
              <h3>AW Conversion</h3>
              <div class="formula">1 AW = 5 minutes &nbsp;|&nbsp; 12 AW = 1 hour &nbsp;|&nbsp; 96 AW = 8 hours</div>
              <p>The live time display updates as you change the AW value, showing both HH:MM and decimal hours.</p>
              <h3>Saving</h3>
              <p>Tap <strong>Save Record</strong>. A process notification confirms success. The modal closes and the dashboard updates immediately. Widget data is also refreshed on save.</p>
            </div>

            <div class="page-break"></div>

            <div class="section" id="smart-entry">
              <h2>🧠 6. Smart Job Entry (AI-Powered)</h2>
              <p>Access via Settings → Quick Links or directly. Describe a job in plain English and the AI extracts the structured data.</p>
              <h3>How It Works</h3>
              <p>Type a natural-language description such as:</p>
              <ul>
                <li>"12345 ABC123 20 AW green vhc"</li>
                <li>"WIP 54321 reg XYZ789 15 hours"</li>
                <li>"Job 11111 for ABC456 took 25 AW, orange VHC, brake service"</li>
              </ul>
              <p>The AI parser extracts: WIP Number, Vehicle Registration, AW Value, VHC Status, and Notes. A confidence score (0–100%) is shown. If confidence is below 70% or data is ambiguous, a clarification prompt appears.</p>
              <h3>Pattern Analysis</h3>
              <p>Tap the chart icon in the header (requires at least 5 jobs) to see an AI analysis of your input patterns: average AW, input speed, most frequent vehicles, and personalised suggestions.</p>
              <h3>Saving</h3>
              <p>Review the extracted data, then tap <strong>Save Job</strong>. The form resets for the next entry.</p>
            </div>

            <div class="section" id="job-records">
              <h2>📋 7. Job Records Tab</h2>
              <p>Browse all jobs for the selected month, sorted newest first.</p>
              <h3>Features</h3>
              <ul>
                <li><strong>Month Navigation</strong> — Use ← → arrows to move between months.</li>
                <li><strong>Totals Bar</strong> — Shows job count, total AWs, and total time for the month.</li>
                <li><strong>Edit Job</strong> — Tap Edit on any job card to modify WIP, Reg, AW, VHC, date/time, notes, and photos.</li>
                <li><strong>Delete Job</strong> — Tap the × button with confirmation.</li>
                <li><strong>Photo Badge</strong> — Jobs with attached photos show a "Has photos" indicator.</li>
                <li><strong>VHC Colour Strip</strong> — A coloured left border and badge shows VHC status at a glance.</li>
              </ul>
              <h3>Selection Mode &amp; Bulk Export</h3>
              <p>Long-press any job to enter selection mode. Tap jobs to select/deselect. The selection bar shows total AWs and hours for selected jobs. Tap <strong>Export PDF</strong> to generate a PDF for the selected jobs only.</p>
            </div>

            <div class="section" id="job-store">
              <h2>🔍 8. Job Store (Search &amp; Reference)</h2>
              <p>The Job Store tab provides a searchable, filterable view of <em>all</em> jobs across all time — not limited to a single month.</p>
              <h3>Search</h3>
              <p>Search by WIP number, vehicle registration, or notes text. Results update live as you type.</p>
              <h3>Filters</h3>
              <ul>
                <li><strong>Date Range</strong> — All Time, Today, This Week, This Month.</li>
                <li><strong>VHC Status</strong> — All, No VHC, Green, Orange, Red.</li>
              </ul>
              <h3>Sort Options</h3>
              <p>Newest First, Oldest First, Highest AW, Lowest AW, WIP A–Z, WIP Z–A.</p>
              <h3>Totals Bar</h3>
              <p>Shows live totals (jobs, AWs, hours) for the current filtered/searched result set.</p>
            </div>

            <div class="page-break"></div>

            <div class="section" id="media">
              <h2>📸 9. Media — Photo Library</h2>
              <p>The Media tab is a full-screen photo gallery of all job card images attached to jobs.</p>
              <h3>Features</h3>
              <ul>
                <li><strong>3-Column Grid</strong> — All photos displayed in a responsive grid with vehicle registration overlaid on each thumbnail.</li>
                <li><strong>Stats Bar</strong> — Shows total photo count and total storage used (in MB).</li>
                <li><strong>Full-Screen Viewer</strong> — Tap any photo to view it full-screen with the vehicle reg and WIP number shown in the header.</li>
                <li><strong>Delete Photo</strong> — Long-press any thumbnail to delete it (with confirmation). Cannot be undone.</li>
                <li><strong>Fade-in Animation</strong> — Photos animate in smoothly when the tab loads.</li>
              </ul>
              <div class="info-box">
                <strong>💡 Note:</strong> Photos are stored locally on your device. They are not included in JSON exports but are preserved as long as the app is installed.
              </div>
            </div>

            <div class="section" id="insights">
              <h2>📈 10. Insights Tab</h2>
              <p>Deep analytics across configurable date ranges with six sub-tabs.</p>
              <h3>Date Range Filter</h3>
              <p>Today, 7 Days, 30 Days, This Month, or Custom (pick start and end dates).</p>
              <h3>Shift Filter</h3>
              <p>All Day or My Shift (filters jobs logged within your configured work hours only).</p>
              <h3>Sub-Tabs</h3>
              <table>
                <tr><th>Tab</th><th>What It Shows</th></tr>
                <tr><td><strong>Overview</strong></td><td>KPI cards: Jobs Logged, Total AW, AW Hours, Avg AW/Job, Top Job Type. Quick drilldowns: Biggest AW, No Tags, Has Notes, Comebacks.</td></tr>
                <tr><td><strong>Job Mix</strong></td><td>Ranked list of job types by VHC status (Standard, VHC Green/Orange/Red) with count, %, total AW, and avg AW. Tap any row to drilldown.</td></tr>
                <tr><td><strong>Efficiency</strong></td><td>Average AW per day and total time logged for the period.</td></tr>
                <tr><td><strong>Repeats</strong></td><td>Top 20 most-repeated vehicle registrations with visit count, total AW, and last seen date. Tap to see full history for that reg.</td></tr>
                <tr><td><strong>Trends</strong></td><td>Horizontal scrollable bar chart of jobs per day over the selected period.</td></tr>
                <tr><td><strong>Goals</strong></td><td>Monthly target progress bar, remaining hours, required daily pace, and best day this period.</td></tr>
              </table>
              <h3>Drilldown Modal</h3>
              <p>Tap any KPI card or job type row to open a drilldown list of matching jobs. Sort by: Newest, Highest AW, Reg Repeats, Most Notes.</p>
            </div>

            <div class="page-break"></div>

            <div class="section" id="stats">
              <h2>⏱️ 11. Time Statistics Tab</h2>
              <p>Live timers and navigable period statistics.</p>
              <h3>Live Timers</h3>
              <ul>
                <li><strong>Available Hours Today</strong> — Counts up from your work start time, subtracting lunch break. Stops at end time.</li>
                <li><strong>Time Elapsed Today</strong> — HH:MM:SS since your work start time.</li>
                <li><strong>Time Remaining Today</strong> — HH:MM:SS until your work end time.</li>
              </ul>
              <h3>Monthly Performance Card</h3>
              <p>Large efficiency percentage with colour coding, plus Total AW, Sold Hours, Available Hours, and Remaining Hours.</p>
              <h3>Yearly Performance Card</h3>
              <p>Progress bar for your work year (configurable start date). Shows Sold Hours vs. Target Hours (monthly target × 12) and remaining hours. Tap the date button to change your work year start date (e.g. 1 April for an April–March year).</p>
              <h3>Period Statistics</h3>
              <p>Three navigable cards with ← → arrows:</p>
              <ul>
                <li><strong>Day</strong> — Jobs, AWs, Hours, % for any selected day.</li>
                <li><strong>Week</strong> — Jobs, AWs, Hours, % for any selected week (Sunday–Saturday).</li>
                <li><strong>Month</strong> — Jobs, AWs, Hours, % for any selected month.</li>
              </ul>
              <h3>All Time Stats</h3>
              <p>Lifetime totals: Total Jobs, Total AWs, Total Hours since app installation.</p>
              <h3>Recent Jobs</h3>
              <p>The 10 most recently logged jobs with WIP, reg, date, AW, and time.</p>
            </div>

            <div class="section" id="streaks">
              <h2>🔥 12. Streaks &amp; Analytics</h2>
              <p>Access from the Dashboard streaks card or Settings → Quick Links.</p>
              <h3>Daily Streak</h3>
              <p>Counts consecutive days on which at least 1 job was logged. Shows current streak and best-ever streak.</p>
              <h3>Weekly Streak</h3>
              <p>Counts consecutive weeks meeting your weekly job target (configurable in Settings → Streaks &amp; Analytics, default: 5 jobs/week). Shows current and best weekly streak.</p>
              <h3>Highlights</h3>
              <ul>
                <li><strong>Best Day This Month</strong> — Date with the highest total AW, with job count and time.</li>
                <li><strong>Most Productive Day</strong> — Date with the most jobs logged.</li>
              </ul>
              <h3>Monthly Calendar Heatmap</h3>
              <p>A calendar grid for the selected month. Days with jobs logged are highlighted with a dot and job count. Today is outlined. Navigate months with ← → arrows. Summary shows Total Jobs, Total AWs, and Avg AW/Job for the month.</p>
            </div>

            <div class="page-break"></div>

            <div class="section" id="work-schedule">
              <h2>⚙️ 13. Work Schedule Configuration</h2>
              <p>Settings → Quick Links → Work Schedule</p>
              <table>
                <tr><th>Setting</th><th>Description</th></tr>
                <tr><td><strong>Working Days</strong></td><td>Toggle Mon–Sun. Tap to include/exclude each day.</td></tr>
                <tr><td><strong>Start Time</strong></td><td>Daily work start (24-hour, e.g. 07:00).</td></tr>
                <tr><td><strong>End Time</strong></td><td>Daily work end (24-hour, e.g. 18:00).</td></tr>
                <tr><td><strong>Lunch Start / End</strong></td><td>Lunch break window used for the progress bar overlay.</td></tr>
                <tr><td><strong>Lunch Break (minutes)</strong></td><td>Unpaid break deducted from available hours.</td></tr>
                <tr><td><strong>Saturday Frequency</strong></td><td>No Saturdays, Every Saturday, 1-in-2, 1-in-3, 1-in-4, or Custom Dates.</td></tr>
                <tr><td><strong>Saturday Hours</strong></td><td>Separate start/end times and lunch break for Saturdays (if different from weekdays).</td></tr>
                <tr><td><strong>Next Working Saturday</strong></td><td>Set the date of your next working Saturday for rotation-based patterns.</td></tr>
              </table>
              <div class="formula">Daily Working Hours = (End Time − Start Time) − Lunch Break Minutes ÷ 60</div>
              <p><strong>Example:</strong> 07:00–18:00 with 30 min lunch = (11 h) − 0.5 h = <strong>10.5 h/day</strong></p>
              <p>Your schedule affects: available hours calculations, efficiency %, workday progress bar, calendar working-day highlighting, and PDF export available hours.</p>
            </div>

            <div class="section" id="absence">
              <h2>🏖️ 14. Absence Logger</h2>
              <p>Settings → Quick Links → Absence Logger</p>
              <h3>Absence Types</h3>
              <ul>
                <li><strong>Holiday</strong> — Planned vacation or time off.</li>
                <li><strong>Sickness</strong> — Sick leave or medical appointments.</li>
                <li><strong>Training</strong> — Training courses or professional development.</li>
              </ul>
              <h3>Duration Options</h3>
              <ul>
                <li><strong>Full Day</strong> — Entire working day (uses your configured daily hours for that day).</li>
                <li><strong>Half Day</strong> — Half of your daily working hours.</li>
              </ul>
              <h3>Effect on Calculations</h3>
              <p>Logged absences reduce available hours for that day, which adjusts efficiency calculations. The dashboard workday progress bar shows "Absent" on absence days. Absences are visible in the calendar view.</p>
              <h3>Overtime &amp; Compensation Days</h3>
              <p>Non-working days can be marked as Overtime (adds available hours) or Compensation (marks a day off in lieu) directly from the dashboard calendar.</p>
            </div>

            <div class="page-break"></div>

            <div class="section" id="calendar">
              <h2>📅 15. Performance Calendar</h2>
              <p>Access from the Dashboard → Performance Calendar button.</p>
              <h3>What It Shows</h3>
              <p>A monthly calendar where each working day displays two concentric efficiency circles:</p>
              <ul>
                <li><strong>Outer Circle</strong> — Efficiency for that day (sold hours ÷ available hours). Green ≥ 65%, Yellow ≥ 31%, Red below 31%.</li>
                <li><strong>Inner Circle</strong> — Progress toward the daily target hours.</li>
              </ul>
              <p>Non-working days are greyed out. Absence days show a special indicator. Overtime/compensation days are marked distinctly.</p>
              <h3>Navigation</h3>
              <p>Use ← → arrows to move between months. Tap any day to see a summary (jobs, sold hours, efficiency). Tap a working day to mark it as overtime or compensation if needed.</p>
            </div>

            <div class="section" id="efficiency">
              <h2>📊 16. Understanding Efficiency</h2>
              <div class="formula">Efficiency % = (Sold Hours ÷ Available Hours) × 100</div>
              <table>
                <tr><th>Term</th><th>Definition</th></tr>
                <tr><td><strong>Sold Hours</strong></td><td>Total AW × 5 minutes ÷ 60 = hours billed to jobs.</td></tr>
                <tr><td><strong>Available Hours</strong></td><td>Working days in the period × daily working hours (minus absences).</td></tr>
                <tr><td><strong>Target Hours</strong></td><td>Your configured monthly target (e.g. 180 h). Used for the target ring, not efficiency.</td></tr>
              </table>
              <h3>Colour Thresholds (configurable in Formula Settings)</h3>
              <ul>
                <li><strong style="color:#4CAF50;">🟢 Green — ≥ 65%:</strong> Excellent performance.</li>
                <li><strong style="color:#FF9800;">🟡 Yellow — ≥ 31%:</strong> Good / acceptable performance.</li>
                <li><strong style="color:#f44336;">🔴 Red — below 31%:</strong> Needs improvement.</li>
              </ul>
              <div class="info-box">
                <strong>💡 Example:</strong> 10 working days × 10.5 h = 105 available hours. You logged 840 AW = 70 sold hours. Efficiency = 70 ÷ 105 × 100 = <strong>66.7% (Green)</strong>.
              </div>
            </div>

            <div class="section" id="formulas">
              <h2>🔢 17. Formula Settings</h2>
              <p>Settings → Quick Links → Formula Settings. Customise the core calculation parameters:</p>
              <table>
                <tr><th>Parameter</th><th>Default</th><th>Effect</th></tr>
                <tr><td><strong>AW to Minutes</strong></td><td>5</td><td>How many minutes 1 AW equals. Change if your garage uses a different unit.</td></tr>
                <tr><td><strong>Efficiency Green Threshold</strong></td><td>65%</td><td>Minimum % for green colour coding.</td></tr>
                <tr><td><strong>Efficiency Yellow Threshold</strong></td><td>31%</td><td>Minimum % for yellow colour coding. Below this = red.</td></tr>
                <tr><td><strong>Default Monthly Target</strong></td><td>180 h</td><td>Pre-fills the monthly target for new months.</td></tr>
                <tr><td><strong>Default Daily Hours</strong></td><td>8.5 h</td><td>Fallback if schedule times are not set.</td></tr>
                <tr><td><strong>Default Lunch Break</strong></td><td>30 min</td><td>Fallback lunch break duration.</td></tr>
              </table>
            </div>

            <div class="page-break"></div>

            <div class="section" id="export">
              <h2>📤 18. Export &amp; Backup</h2>
              <p>Settings → Data Management</p>
              <h3>Export Data (PDF or JSON)</h3>
              <p>Choose a period and format:</p>
              <table>
                <tr><th>Period</th><th>Description</th></tr>
                <tr><td><strong>Daily</strong></td><td>All jobs for a single selected day.</td></tr>
                <tr><td><strong>Weekly</strong></td><td>All jobs for a selected Sunday–Saturday week.</td></tr>
                <tr><td><strong>Monthly</strong></td><td>All jobs for a selected month.</td></tr>
                <tr><td><strong>All Time</strong></td><td>Every job ever logged.</td></tr>
              </table>
              <h4>PDF Format</h4>
              <p>Professional report containing: technician name, date range, job table (WIP, Reg, VHC, AW, Hours), day totals, week totals, month totals, and efficiency progress bars with colour coding. Suitable for management reports.</p>
              <h4>JSON Format (Priority / Backup)</h4>
              <p>Structured data file preserving all job fields and timestamps. Use for backup and restore. Can be re-imported into Tech Times.</p>
              <h3>Create Backup (JSON)</h3>
              <p>Exports all jobs to a timestamped JSON file. Share to iCloud, Google Drive, or email. Updates the widget's "last backup" timestamp.</p>
              <h3>Import Jobs (JSON)</h3>
              <p>Select a JSON backup file. A progress notification shows each job being validated and created. Reports success/failure counts. Duplicate detection prevents re-importing the same jobs.</p>
              <h3>Clear All Data</h3>
              <p>Permanently deletes all jobs, settings, and data. Requires double confirmation. Cannot be undone — always backup first.</p>
              <h3>About Page PDF</h3>
              <p>Tap <strong>Export Complete Guide as PDF</strong> on this About page to generate and share this full user guide as a PDF.</p>
            </div>

            <div class="section" id="notifications">
              <h2>🔔 19. Notifications</h2>
              <p>Settings → Quick Links → Notifications</p>
              <h3>Work Schedule Notifications</h3>
              <ul>
                <li><strong>Work Start</strong> — Notifies when your configured work day begins.</li>
                <li><strong>Work End</strong> — Notifies when your work day ends.</li>
                <li><strong>Lunch Start</strong> — Notifies when your lunch break starts.</li>
                <li><strong>Lunch End</strong> — Notifies when your lunch break ends.</li>
              </ul>
              <h3>Performance Notifications</h3>
              <ul>
                <li><strong>Daily Reminder</strong> — Reminds you to log jobs at a configurable time (24-hour format).</li>
                <li><strong>Weekly Report</strong> — Weekly performance summary on a chosen day of the week.</li>
                <li><strong>Monthly Report</strong> — End-of-month statistics summary.</li>
                <li><strong>Target Reminder</strong> — Alert when approaching your monthly target.</li>
                <li><strong>Efficiency Alert</strong> — Alert when efficiency drops below a configurable threshold (default 75%).</li>
              </ul>
              <h3>Sound &amp; Vibration</h3>
              <p>Choose notification sound (Default or Silent) and vibration pattern (Default, Short, Long, Double). Test your settings with the <strong>Test Notification</strong> button. All notifications are rescheduled automatically when you save settings.</p>
            </div>

            <div class="page-break"></div>

            <div class="section" id="appearance">
              <h2>🎨 20. Appearance &amp; Themes</h2>
              <p>Settings → Appearance</p>
              <h3>Dark / Light Mode</h3>
              <ul>
                <li><strong>Dark Mode</strong> — Dark workshop-themed backgrounds. Easier on the eyes in low light. Saves battery on OLED screens.</li>
                <li><strong>Light Mode</strong> — Bright workshop backgrounds. Better visibility in bright environments.</li>
              </ul>
              <h3>Background Overlay Strength</h3>
              <p>A slider (30%–90%) controls how dark the overlay is over the background image. Adjust for the best balance between aesthetics and readability. Changes apply immediately across all screens.</p>
            </div>

            <div class="section" id="widgets">
              <h2>📱 21. Home Screen Widgets (iOS)</h2>
              <p>Tech Times supports iOS home screen widgets that display live data without opening the app.</p>
              <h3>Widget Data</h3>
              <p>The widget is updated automatically whenever you:</p>
              <ul>
                <li>Save a new job</li>
                <li>Edit or delete a job</li>
                <li>Import jobs from a backup</li>
                <li>Create a backup (updates the "last backup" timestamp)</li>
              </ul>
              <p>Widget data includes today's AW total, current efficiency, and last backup time. Add the widget from your iOS home screen long-press menu → Widgets → Tech Times.</p>
            </div>

            <div class="section" id="privacy">
              <h2>🔒 22. Privacy &amp; Data</h2>
              <div class="success-box">
                <strong>✅ Complete Privacy:</strong>
                <ul>
                  <li>All data stored locally on your device using AsyncStorage and the device file system.</li>
                  <li>No internet connection required for any feature.</li>
                  <li>No data sent to external servers, no analytics, no tracking.</li>
                  <li>No cloud synchronisation.</li>
                </ul>
              </div>
              <h3>GDPR Compliance</h3>
              <p>Tech Times only stores vehicle registration numbers and job data. No customer names, addresses, phone numbers, or emails are collected or stored. You own and control all your data. Export or delete it at any time.</p>
              <h3>Permissions Requested</h3>
              <ul>
                <li><strong>Camera</strong> — To take job card photos and scan registrations/job cards (optional).</li>
                <li><strong>Photo Library</strong> — To choose existing photos for job cards (optional).</li>
                <li><strong>Notifications</strong> — For reminders and alerts (optional).</li>
                <li><strong>Biometrics</strong> — For fingerprint/Face ID login (optional).</li>
              </ul>
            </div>

            <div class="page-break"></div>

            <div class="section" id="tips">
              <h2>💡 23. Tips &amp; Best Practices</h2>
              <h3>Daily Workflow</h3>
              <ol>
                <li>Check the dashboard at the start of the day for yesterday's stats and today's target.</li>
                <li>Log jobs as you complete them — use autocomplete for repeat vehicles.</li>
                <li>Use the Scan Card button to OCR-fill WIP and registration from the job card.</li>
                <li>Review efficiency at end of day using the efficiency ring.</li>
                <li>Check the Streaks card to maintain your daily logging streak.</li>
              </ol>
              <h3>Weekly &amp; Monthly</h3>
              <ul>
                <li>Check the Insights → Repeats tab to spot vehicles that return frequently.</li>
                <li>Use Insights → Trends to identify your most and least productive days.</li>
                <li>Export a monthly PDF report for your records or to share with management.</li>
                <li>Create a JSON backup weekly and save it to cloud storage.</li>
              </ul>
              <h3>Speed Tips</h3>
              <ul>
                <li>Use VHC colour buttons — much faster than a dropdown.</li>
                <li>Enable biometric login for instant app access.</li>
                <li>Use Smart Job Entry for rapid natural-language logging.</li>
                <li>Long-press jobs in Job Records to enter selection mode for bulk PDF export.</li>
                <li>Use the Job Store tab to quickly look up any past job by WIP or reg.</li>
              </ul>
              <h3>Accuracy Tips</h3>
              <ul>
                <li>Double-check WIP numbers — they must be exactly 5 digits.</li>
                <li>Log absences promptly so efficiency calculations stay accurate.</li>
                <li>Keep your work schedule up to date if your hours change.</li>
                <li>Adjust formula thresholds in Formula Settings if your garage uses different efficiency targets.</li>
              </ul>
            </div>

            <div class="section" id="troubleshooting">
              <h2>❓ 24. Troubleshooting</h2>
              <h3>Efficiency Seems Wrong</h3>
              <ol>
                <li>Check Settings → Work Schedule — verify working days, start/end times, and lunch break.</li>
                <li>Check Settings → Absence Logger — ensure absences are logged correctly.</li>
                <li>Check Settings → Formula Settings — verify AW-to-minutes and threshold values.</li>
                <li>Confirm jobs are logged on the correct dates.</li>
              </ol>
              <h3>Biometrics Not Working</h3>
              <ul>
                <li>Ensure biometrics are enrolled in your device settings.</li>
                <li>Check app permissions in device settings.</li>
                <li>Try disabling and re-enabling biometrics in Settings → Security.</li>
                <li>Use PIN as fallback.</li>
              </ul>
              <h3>Export / PDF Not Working</h3>
              <ul>
                <li>Check storage permissions in device settings.</li>
                <li>Ensure sufficient free storage space.</li>
                <li>Try a smaller date range (e.g. Daily instead of All Time).</li>
                <li>Restart the app and try again.</li>
              </ul>
              <h3>Notifications Not Appearing</h3>
              <ul>
                <li>Check notification permissions in device settings.</li>
                <li>Ensure Do Not Disturb is not active.</li>
                <li>Check battery optimisation settings (Android may block background notifications).</li>
                <li>Use the Test Notification button in Notification Settings to verify.</li>
              </ul>
              <h3>Import Failing</h3>
              <ul>
                <li>Ensure the file is a valid Tech Times JSON backup (not a PDF or CSV).</li>
                <li>Check the file is not corrupted.</li>
                <li>The file must contain a "jobs" array in the expected format.</li>
              </ul>
              <h3>Widget Not Updating (iOS)</h3>
              <ul>
                <li>Save a new job or create a backup to trigger a widget refresh.</li>
                <li>Remove and re-add the widget from the home screen.</li>
                <li>Ensure the app has been opened at least once after installation.</li>
              </ul>
            </div>

            <div class="footer">
              <h3>Tech Times v1.0.0</h3>
              <p>Secure Personal Job Tracking for Vehicle Technicians</p>
              <p style="margin-top: 12px;">Created by <strong>b.rugge</strong> — Owner &amp; Creator</p>
              <p style="margin-top: 16px; font-size: 12px;">
                Features covered: Dashboard • Job Management • Smart AI Entry • Media Gallery • Insights • Time Statistics<br>
                Streaks • Work Schedule • Absence Logger • Performance Calendar • Efficiency • Formula Settings<br>
                PDF/JSON Export • Notifications • Themes • iOS Widgets • PIN Security • Privacy
              </p>
              <p style="margin-top: 12px; font-size: 11px; color: #888;">Generated: ${currentDate}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      console.log('AboutScreen: Generating PDF from HTML');
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      console.log('AboutScreen: PDF generated at:', uri);

      const fileName = `TechTimes_User_Guide_${new Date().toISOString().split('T')[0]}.pdf`;
      const newUri = FileSystem.documentDirectory + fileName;

      try {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (fileInfo.exists) {
          const destInfo = await FileSystem.getInfoAsync(newUri);
          if (destInfo.exists) {
            await FileSystem.deleteAsync(newUri, { idempotent: true });
          }
          await FileSystem.moveAsync({ from: uri, to: newUri });
          console.log('AboutScreen: PDF moved to:', newUri);
        } else {
          throw new Error('PDF generation failed — source file not found');
        }
      } catch (moveError) {
        console.error('AboutScreen: Error moving PDF file:', moveError);
      }

      const shareUri = await FileSystem.getInfoAsync(newUri).then(info =>
        info.exists ? newUri : uri
      );

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(shareUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Tech Times Complete User Guide',
          UTI: 'com.adobe.pdf',
        });
        console.log('AboutScreen: PDF shared successfully');
        Alert.alert('Success', 'Complete user guide exported as PDF and ready to share!');
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('AboutScreen: Error exporting PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Export Error', `Failed to export user guide: ${errorMessage}\n\nPlease try again.`);
    } finally {
      setExporting(false);
    }
  };

  const exportButtonLabel = exporting ? 'Generating PDF...' : 'Export Complete Guide as PDF';

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'About Tech Times',
          headerStyle: { backgroundColor: theme.card },
          headerTintColor: theme.text,
        }}
      />
      <AppBackground>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.contentContainer,
            Platform.OS === 'android' && { paddingTop: 16 },
          ]}
        >
          {/* ── Header ── */}
          <View style={[styles.header, { backgroundColor: theme.card }]}>
            <IconSymbol
              ios_icon_name="wrench.and.screwdriver.fill"
              android_material_icon_name="build"
              size={56}
              color={theme.primary}
            />
            <Text style={[styles.appName, { color: theme.text }]}>Tech Times</Text>
            <Text style={[styles.version, { color: theme.textSecondary }]}>Version 1.0.0</Text>
            <Text style={[styles.tagline, { color: theme.textSecondary }]}>
              Secure Personal Job Tracking for Vehicle Technicians
            </Text>
          </View>

          {/* ── Export Button ── */}
          <TouchableOpacity
            style={[styles.exportButton, { backgroundColor: theme.primary }]}
            onPress={handleExportToPDF}
            disabled={exporting}
          >
            <IconSymbol
              ios_icon_name="square.and.arrow.up"
              android_material_icon_name="share"
              size={22}
              color="#fff"
            />
            <Text style={styles.exportButtonText}>{exportButtonLabel}</Text>
          </TouchableOpacity>

          {/* ── About ── */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>📱 About Tech Times</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              Tech Times is a secure, offline-first personal job tracking app designed for vehicle technicians. Log jobs with WIP numbers, vehicle registrations, AW values, and VHC statuses. Calculate real-time efficiency, track streaks, and generate professional PDF reports — entirely on your device with no internet required.
            </Text>
            <View style={[styles.infoBox, { backgroundColor: theme.background, borderLeftColor: theme.primary }]}>
              <Text style={[styles.infoText, { color: theme.text }]}>
                <Text style={{ fontWeight: 'bold' }}>Created by: </Text>
                b.rugge — Owner &amp; Creator
              </Text>
            </View>
          </View>

          {/* ── Key Features ── */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>✨ Key Features</Text>
            <View style={styles.featureList}>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>🔒 Fully offline — all data stored locally, no cloud</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>🔐 PIN + biometric (fingerprint/Face ID) security</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>📊 Live dashboard with efficiency rings and workday progress bar</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>🧠 AI-powered Smart Job Entry with natural language parsing</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>🔍 Memory autocomplete — auto-fills from previous jobs</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>📸 Job card photo attachments with a full Media gallery tab</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>📤 PDF and JSON export (daily / weekly / monthly / all time)</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>🔔 Work schedule, daily, weekly, and efficiency notifications</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>📅 Performance calendar with efficiency circles per day</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>🔥 Daily and weekly logging streaks with calendar heatmap</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>📈 Insights tab — job mix, repeat regs, trends, goals, drilldowns</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>⏱️ Live timers — available hours, time elapsed, time remaining</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>📱 iOS home screen widgets with live AW and efficiency data</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>🎨 Dark and light workshop themes with adjustable overlay</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>🔢 Configurable formula settings (AW rate, efficiency thresholds)</Text>
            </View>
          </View>

          {/* ── Dashboard ── */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>📱 Dashboard</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              Your real-time command centre. Auto-refreshes every 30 seconds and instantly on return from adding a job.
            </Text>
            <Text style={[styles.subsectionTitle, { color: theme.text }]}>What's on the Dashboard</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              {'• Live clock (updates every second)\n'}
              {'• Streaks card — current & best daily/weekly streak\n'}
              {'• Workday progress bar with lunch break overlay\n'}
              {'• Monthly Target ring — sold hours vs. target\n'}
              {'• Efficiency ring — sold hours ÷ available hours\n'}
              {'• Monthly Breakdown card (AW, sold hours, available hours, efficiency)\n'}
              {'• Stat tiles: Total AWs, Time Logged, Jobs Done, Hours Remaining\n'}
              {'• Today and This Week summary cards\n'}
              {'• Add New Job button\n'}
              {'• Performance Calendar quick link'}
            </Text>
          </View>

          {/* ── Job Management ── */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>📝 Job Management</Text>

            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Fields Tracked Per Job</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              {'• WIP Number (5 digits, required)\n'}
              {'• Vehicle Registration (auto-uppercase, required)\n'}
              {'• AW Value (0–100, required)\n'}
              {'• VHC Status (Green / Orange / Red / None)\n'}
              {'• Date & Time (editable, defaults to now)\n'}
              {'• Notes (optional free text)\n'}
              {'• Job Card Photo (optional, stored locally)'}
            </Text>

            <Text style={[styles.subsectionTitle, { color: theme.text }]}>AW Conversion</Text>
            <Text style={[styles.formula, { color: theme.text, backgroundColor: theme.background }]}>
              1 AW = 5 min  |  12 AW = 1 h  |  96 AW = 8 h
            </Text>

            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Scan Buttons (OCR)</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              {'• Scan Card — OCR a job card image to extract WIP + registration simultaneously\n'}
              {'• Scan Reg — OCR a number plate image to extract the registration'}
            </Text>

            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Memory Autocomplete</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              Start typing in the WIP or Registration field to see matching previous jobs. Tap a suggestion to auto-fill all fields (WIP, Reg, AW, VHC, Notes) from that job's last entry.
            </Text>

            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Job Records Tab</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              {'• Browse jobs by month with ← → navigation\n'}
              {'• Edit any job (WIP, Reg, AW, VHC, date/time, notes, photos)\n'}
              {'• Delete jobs with confirmation\n'}
              {'• Long-press to enter selection mode for bulk PDF export'}
            </Text>

            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Job Store Tab</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              Search all jobs across all time by WIP, registration, or notes. Filter by date range and VHC status. Sort by date, AW, or WIP number.
            </Text>
          </View>

          {/* ── Smart Job Entry ── */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>🧠 Smart Job Entry (AI)</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              Describe a job in plain English and the AI extracts the structured data:
            </Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              {'Example: "12345 ABC123 20 AW green vhc"\n'}
              {'Example: "Job 11111 for ABC456 took 25 AW, orange VHC, brake service"'}
            </Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              A confidence score is shown. If below 70%, a clarification prompt appears. The AI learns from your previous jobs to improve suggestions over time. Tap the chart icon for a full pattern analysis (requires 5+ jobs).
            </Text>
          </View>

          {/* ── Media ── */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>📸 Media — Photo Library</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              {'• 3-column grid of all job card photos\n'}
              {'• Vehicle registration overlaid on each thumbnail\n'}
              {'• Stats bar: total photo count and storage used (MB)\n'}
              {'• Tap any photo for full-screen view with WIP and reg\n'}
              {'• Long-press to delete a photo (with confirmation)\n'}
              {'• Photos are stored locally and not included in JSON exports'}
            </Text>
          </View>

          {/* ── Insights ── */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>📈 Insights Tab</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              Deep analytics with six sub-tabs across configurable date ranges (Today, 7d, 30d, This Month, Custom). Optional shift filter limits results to your work hours.
            </Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              {'• Overview — KPI cards + quick drilldowns (Biggest AW, No Tags, Has Notes, Comebacks)\n'}
              {'• Job Mix — job types ranked by VHC status with count, %, AW\n'}
              {'• Efficiency — average AW per day and total time logged\n'}
              {'• Repeats — top 20 most-repeated vehicle registrations\n'}
              {'• Trends — bar chart of jobs per day\n'}
              {'• Goals — monthly target progress, remaining hours, required daily pace'}
            </Text>
          </View>

          {/* ── Stats ── */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>⏱️ Time Statistics Tab</Text>
            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Live Timers</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              {'• Available Hours Today — counts up from work start, minus lunch\n'}
              {'• Time Elapsed Today — HH:MM:SS since work start\n'}
              {'• Time Remaining Today — HH:MM:SS until work end'}
            </Text>
            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Period Statistics</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              Navigate any day, week, or month with ← → arrows to see Jobs, AWs, Hours, and Efficiency %. Yearly performance card with configurable work-year start date. All-time totals and 10 most recent jobs.
            </Text>
          </View>

          {/* ── Efficiency ── */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>📊 Efficiency Calculation</Text>
            <Text style={[styles.formula, { color: theme.text, backgroundColor: theme.background }]}>
              Efficiency % = (Sold Hours ÷ Available Hours) × 100
            </Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              {'• Sold Hours = Total AW × 5 min ÷ 60\n'}
              {'• Available Hours = working days × daily hours (minus absences)\n'}
              {'• Target Hours = your monthly target (separate from efficiency)'}
            </Text>
            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Colour Thresholds (configurable)</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              {'🟢 Green — ≥ 65%: Excellent\n'}
              {'🟡 Yellow — ≥ 31%: Good\n'}
              {'🔴 Red — below 31%: Needs improvement'}
            </Text>
          </View>

          {/* ── Work Schedule ── */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>⚙️ Work Schedule</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              Settings → Quick Links → Work Schedule
            </Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              {'• Working days (Mon–Sun toggle)\n'}
              {'• Start / End time (24-hour)\n'}
              {'• Lunch start / end time and duration (minutes)\n'}
              {'• Saturday frequency: None, Every, 1-in-2, 1-in-3, 1-in-4, Custom\n'}
              {'• Separate Saturday start/end times and lunch break\n'}
              {'• Next working Saturday date for rotation patterns'}
            </Text>
            <Text style={[styles.formula, { color: theme.text, backgroundColor: theme.background }]}>
              Daily Hours = (End − Start) − Lunch Break ÷ 60
            </Text>
          </View>

          {/* ── Absence Logger ── */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>🏖️ Absence Logger</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              Settings → Quick Links → Absence Logger
            </Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              {'• Types: Holiday, Sickness, Training\n'}
              {'• Duration: Full Day or Half Day\n'}
              {'• Absences reduce available hours and adjust efficiency calculations\n'}
              {'• Dashboard shows "Absent" on absence days\n'}
              {'• Non-working days can be marked as Overtime or Compensation from the dashboard calendar'}
            </Text>
          </View>

          {/* ── Export ── */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>📤 Export &amp; Backup</Text>

            <Text style={[styles.subsectionTitle, { color: theme.text }]}>PDF Reports</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              {'Periods: Daily, Weekly (Sun–Sat), Monthly, All Time\n'}
              {'Contents: technician name, date range, job table (WIP, Reg, VHC, AW, Hours), day/week/month totals, efficiency progress bars with colour coding.'}
            </Text>

            <Text style={[styles.subsectionTitle, { color: theme.text }]}>JSON Backup &amp; Restore</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              {'• Create Backup — exports all jobs to a timestamped JSON file\n'}
              {'• Import Jobs — select a JSON file; progress notification shows each job being created\n'}
              {'• Duplicate detection prevents re-importing the same jobs\n'}
              {'• Share backups to iCloud, Google Drive, or email'}
            </Text>

            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Bulk Export from Job Records</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              Long-press jobs to enter selection mode, then tap Export PDF to generate a report for selected jobs only.
            </Text>
          </View>

          {/* ── Notifications ── */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>🔔 Notifications</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              Settings → Quick Links → Notifications
            </Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              {'Work Schedule: Work Start, Work End, Lunch Start, Lunch End\n\n'}
              {'Performance: Daily Reminder (configurable time), Weekly Report (configurable day), Monthly Report, Target Reminder, Efficiency Alert (configurable threshold)\n\n'}
              {'Sound: Default or Silent\n'}
              {'Vibration: Default, Short, Long, Double\n\n'}
              {'Use Test Notification to verify your settings before saving.'}
            </Text>
          </View>

          {/* ── Security ── */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>🔒 Security &amp; Privacy</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              {'• 4-digit PIN required on every app open\n'}
              {'• Optional biometric login (fingerprint / Face ID)\n'}
              {'• Smart lock timeout: auto-locks after 30 min–1 hr away\n'}
              {'• All data stored locally — no internet, no cloud, no analytics\n'}
              {'• GDPR compliant — only vehicle regs and job data stored\n'}
              {'• No customer personal information collected'}
            </Text>
            <View style={[styles.warningBox, { backgroundColor: theme.background, borderLeftColor: '#ff9800' }]}>
              <Text style={[styles.text, { color: theme.textSecondary }]}>
                ⚠️ If you forget your PIN, you must reinstall the app. Create regular JSON backups to prevent data loss.
              </Text>
            </View>
          </View>

          {/* ── Widgets ── */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>📱 iOS Home Screen Widgets</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              Tech Times supports iOS home screen widgets showing live data. Widget data updates automatically when you save a job, edit/delete a job, import jobs, or create a backup. Add via iOS home screen long-press → Widgets → Tech Times.
            </Text>
          </View>

          {/* ── Themes ── */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>🎨 Appearance &amp; Themes</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              {'• Dark Mode — workshop backgrounds, easier on eyes in low light\n'}
              {'• Light Mode — bright backgrounds, better in bright environments\n'}
              {'• Background Overlay Strength slider (30%–90%) — adjust readability vs. aesthetics\n'}
              {'• Changes apply immediately across all screens'}
            </Text>
          </View>

          {/* ── Formula Settings ── */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>🔢 Formula Settings</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              Settings → Quick Links → Formula Settings
            </Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              {'• AW to Minutes (default: 5) — change if your garage uses a different unit\n'}
              {'• Efficiency Green Threshold (default: 65%)\n'}
              {'• Efficiency Yellow Threshold (default: 31%)\n'}
              {'• Default Monthly Target (default: 180 h)\n'}
              {'• Default Daily Hours (default: 8.5 h)\n'}
              {'• Default Lunch Break (default: 30 min)'}
            </Text>
          </View>

          {/* ── Footer ── */}
          <View style={[styles.footer, { backgroundColor: theme.card }]}>
            <Text style={[styles.footerTitle, { color: theme.text }]}>Tech Times v1.0.0</Text>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              Secure Personal Job Tracking for Vehicle Technicians
            </Text>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              {'\nCreated by b.rugge — Owner & Creator\n'}
              {'\n© 2024 Tech Times. All rights reserved.'}
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </AppBackground>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    padding: 28,
    borderRadius: 16,
    marginBottom: 20,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    marginTop: 12,
  },
  version: {
    fontSize: 14,
    marginTop: 4,
  },
  tagline: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
    paddingHorizontal: 20,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 14,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    lineHeight: 24,
    marginBottom: 8,
  },
  featureList: {
    gap: 10,
  },
  feature: {
    fontSize: 14,
    lineHeight: 22,
  },
  formula: {
    padding: 14,
    borderRadius: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 13,
    marginVertical: 10,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  infoBox: {
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    marginTop: 12,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
  },
  warningBox: {
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    marginTop: 8,
    marginBottom: 4,
  },
  footer: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  footerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  footerText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
