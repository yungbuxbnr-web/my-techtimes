
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
    console.log('AboutScreen: Exporting comprehensive user guide to PDF');
    setExporting(true);
    
    try {
      const now = new Date();
      const currentDate = now.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric',
      }) + ' ' + now.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              padding: 30px;
              line-height: 1.7;
              color: #2c3e50;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              border-radius: 20px;
              padding: 40px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            .header {
              text-align: center;
              padding: 30px 0;
              border-bottom: 4px solid #ff6b35;
              margin-bottom: 40px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              border-radius: 15px;
              box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
            }
            .header h1 {
              font-size: 42px;
              margin-bottom: 10px;
              font-weight: 800;
              text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
            }
            .header .subtitle {
              font-size: 18px;
              opacity: 0.95;
              margin-top: 10px;
              font-weight: 500;
            }
            .header .meta {
              font-size: 14px;
              margin-top: 15px;
              opacity: 0.85;
            }
            .toc {
              background: #f8f9fa;
              padding: 25px;
              border-radius: 12px;
              margin-bottom: 40px;
              border-left: 5px solid #667eea;
            }
            .toc h2 {
              color: #667eea;
              margin-bottom: 15px;
              font-size: 22px;
            }
            .toc ul {
              list-style: none;
              padding-left: 0;
            }
            .toc li {
              padding: 8px 0;
              border-bottom: 1px solid #e0e0e0;
            }
            .toc li:last-child {
              border-bottom: none;
            }
            .toc a {
              color: #667eea;
              text-decoration: none;
              font-weight: 500;
              transition: color 0.3s;
            }
            .section {
              margin-bottom: 50px;
              page-break-inside: avoid;
            }
            h2 {
              color: #667eea;
              font-size: 32px;
              margin-bottom: 20px;
              padding-bottom: 10px;
              border-bottom: 3px solid #667eea;
              font-weight: 700;
            }
            h3 {
              color: #764ba2;
              font-size: 24px;
              margin-top: 30px;
              margin-bottom: 15px;
              font-weight: 600;
            }
            h4 {
              color: #555;
              font-size: 18px;
              margin-top: 20px;
              margin-bottom: 12px;
              font-weight: 600;
            }
            p {
              margin-bottom: 15px;
              font-size: 15px;
              line-height: 1.8;
            }
            ul, ol {
              margin-left: 25px;
              margin-bottom: 20px;
            }
            li {
              margin-bottom: 10px;
              font-size: 15px;
              line-height: 1.7;
            }
            .highlight {
              background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
              padding: 20px;
              border-left: 5px solid #ff6b35;
              border-radius: 8px;
              margin: 20px 0;
              box-shadow: 0 4px 12px rgba(255, 107, 53, 0.1);
            }
            .highlight strong {
              color: #ff6b35;
              font-size: 16px;
            }
            .info-box {
              background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
              padding: 20px;
              border-left: 5px solid #2196F3;
              border-radius: 8px;
              margin: 20px 0;
              box-shadow: 0 4px 12px rgba(33, 150, 243, 0.1);
            }
            .warning-box {
              background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
              padding: 20px;
              border-left: 5px solid #ff9800;
              border-radius: 8px;
              margin: 20px 0;
              box-shadow: 0 4px 12px rgba(255, 152, 0, 0.1);
            }
            .success-box {
              background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
              padding: 20px;
              border-left: 5px solid #4caf50;
              border-radius: 8px;
              margin: 20px 0;
              box-shadow: 0 4px 12px rgba(76, 175, 80, 0.1);
            }
            .formula {
              background: #f5f5f5;
              padding: 15px;
              border-radius: 8px;
              font-family: 'Courier New', monospace;
              font-size: 14px;
              margin: 15px 0;
              border: 2px solid #e0e0e0;
              text-align: center;
              font-weight: bold;
            }
            .feature-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 15px;
              margin: 20px 0;
            }
            .feature-card {
              background: #f8f9fa;
              padding: 15px;
              border-radius: 10px;
              border-left: 4px solid #667eea;
            }
            .feature-card strong {
              color: #667eea;
              display: block;
              margin-bottom: 8px;
              font-size: 16px;
            }
            .step-number {
              display: inline-block;
              background: #667eea;
              color: white;
              width: 30px;
              height: 30px;
              border-radius: 50%;
              text-align: center;
              line-height: 30px;
              margin-right: 10px;
              font-weight: bold;
            }
            .footer {
              margin-top: 60px;
              padding-top: 30px;
              border-top: 3px solid #667eea;
              text-align: center;
              background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
              padding: 30px;
              border-radius: 15px;
            }
            .footer h3 {
              color: #667eea;
              margin-bottom: 15px;
            }
            .footer p {
              color: #666;
              font-size: 13px;
              line-height: 1.6;
            }
            .icon {
              font-size: 24px;
              margin-right: 8px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            th, td {
              padding: 12px;
              text-align: left;
              border-bottom: 1px solid #e0e0e0;
            }
            th {
              background: #667eea;
              color: white;
              font-weight: 600;
            }
            tr:hover {
              background: #f8f9fa;
            }
            .page-break {
              page-break-after: always;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔧 TechTimes</h1>
              <div class="subtitle">Complete User Guide & Feature Documentation</div>
              <div class="meta">
                <strong>Version:</strong> 1.0.0<br>
                <strong>Generated:</strong> ${currentDate}
              </div>
            </div>

            <div class="toc">
              <h2>📑 Table of Contents</h2>
              <ul>
                <li><a href="#about">1. About TechTimes</a></li>
                <li><a href="#getting-started">2. Getting Started</a></li>
                <li><a href="#security">3. Security Features</a></li>
                <li><a href="#adding-jobs">4. Adding Jobs</a></li>
                <li><a href="#smart-features">5. Smart Features</a></li>
                <li><a href="#work-schedule">6. Work Schedule Configuration</a></li>
                <li><a href="#efficiency">7. Understanding Efficiency</a></li>
                <li><a href="#dashboard">8. Dashboard Overview</a></li>
                <li><a href="#statistics">9. Statistics & Reports</a></li>
                <li><a href="#calendar">10. Calendar View</a></li>
                <li><a href="#absences">11. Absence Logging</a></li>
                <li><a href="#export">12. Export & Backup</a></li>
                <li><a href="#notifications">13. Notifications</a></li>
                <li><a href="#appearance">14. Appearance & Themes</a></li>
                <li><a href="#privacy">15. Privacy & Security</a></li>
                <li><a href="#tips">16. Tips & Best Practices</a></li>
                <li><a href="#troubleshooting">17. Troubleshooting</a></li>
              </ul>
            </div>

            <div class="section" id="about">
              <h2>📱 1. About TechTimes</h2>
              <p>TechTimes is a secure, offline-first personal job tracking application designed specifically for vehicle technicians. Track your work hours, monitor efficiency, and manage your productivity—all while keeping your data private and secure on your device.</p>
              
              <div class="highlight">
                <strong>🎯 Core Purpose:</strong>
                <p>TechTimes helps vehicle technicians track their Allocated Work (AW) units, calculate efficiency, and monitor productivity without compromising data privacy. Everything runs locally on your device with no internet connection required.</p>
              </div>

              <h3>✨ Key Features</h3>
              <div class="feature-grid">
                <div class="feature-card">
                  <strong>🔒 Fully Offline</strong>
                  All data stored locally on your device. No cloud, no servers, complete privacy.
                </div>
                <div class="feature-card">
                  <strong>🔐 Secure Access</strong>
                  PIN and biometric authentication protect your sensitive work data.
                </div>
                <div class="feature-card">
                  <strong>📊 Real-Time Tracking</strong>
                  Live efficiency calculations and progress monitoring throughout your workday.
                </div>
                <div class="feature-card">
                  <strong>📅 Smart Scheduling</strong>
                  Customizable work schedule with Saturday frequency options.
                </div>
                <div class="feature-card">
                  <strong>📈 Comprehensive Stats</strong>
                  Daily, weekly, monthly, and all-time statistics with visual progress indicators.
                </div>
                <div class="feature-card">
                  <strong>📤 Multiple Export Formats</strong>
                  Export to PDF, JSON, and CSV for reports and backups.
                </div>
                <div class="feature-card">
                  <strong>🔔 Smart Notifications</strong>
                  Customizable reminders and alerts to keep you on track.
                </div>
                <div class="feature-card">
                  <strong>📆 Visual Calendar</strong>
                  Day, week, month, and year views with efficiency circles.
                </div>
                <div class="feature-card">
                  <strong>💡 Smart Autocomplete</strong>
                  Intelligent suggestions for repeat jobs to speed up data entry.
                </div>
                <div class="feature-card">
                  <strong>📸 Image Attachments</strong>
                  Attach job card photos to each job record for reference.
                </div>
                <div class="feature-card">
                  <strong>🎨 Themed Interface</strong>
                  Dark and light workshop themes with adjustable overlay.
                </div>
                <div class="feature-card">
                  <strong>⏱️ Live Time Tracking</strong>
                  Real-time workday progress bar with lunch break visualization.
                </div>
              </div>

              <div class="info-box">
                <strong>💡 GDPR Compliant:</strong> TechTimes only stores vehicle registration numbers and job data. No customer names, addresses, phone numbers, or emails are collected or stored.
              </div>
            </div>

            <div class="page-break"></div>

            <div class="section" id="getting-started">
              <h2>🚀 2. Getting Started</h2>
              
              <h3>First-Time Setup</h3>
              <p><span class="step-number">1</span><strong>Enter Your Name:</strong> Set your technician name for personalized reports and exports.</p>
              <p><span class="step-number">2</span><strong>Create a PIN:</strong> Choose a secure 4-digit PIN to protect your data (default: 3101).</p>
              <p><span class="step-number">3</span><strong>Configure Work Schedule:</strong> Set your working days, hours, and lunch break.</p>
              <p><span class="step-number">4</span><strong>Set Monthly Target:</strong> Define your monthly hours target for progress tracking.</p>

              <div class="success-box">
                <strong>✅ Setup Complete Animation:</strong> After completing setup, you'll see a welcome animation with an exploded engine view confirming your app is ready to use!
              </div>
            </div>

            <div class="section" id="security">
              <h2>🔐 3. Security Features</h2>
              
              <table>
                <tr>
                  <th>Feature</th>
                  <th>Description</th>
                </tr>
                <tr>
                  <td><strong>PIN Protection</strong></td>
                  <td>4-digit PIN required to access the app. Default: 3101 (change immediately in Settings)</td>
                </tr>
                <tr>
                  <td><strong>Biometric Login</strong></td>
                  <td>Use fingerprint or Face ID for quick access (optional, enable in Settings)</td>
                </tr>
                <tr>
                  <td><strong>Lock on Resume</strong></td>
                  <td>Automatically lock when returning from background (default: ON)</td>
                </tr>
                <tr>
                  <td><strong>Change PIN</strong></td>
                  <td>Update your PIN anytime in Settings (requires current PIN)</td>
                </tr>
                <tr>
                  <td><strong>Double Back Exit</strong></td>
                  <td>Press back twice to exit or minimize the app (prevents accidental exits)</td>
                </tr>
              </table>

              <div class="warning-box">
                <strong>⚠️ Important:</strong> If you forget your PIN, you'll need to reinstall the app and lose all data. Create regular backups to prevent data loss!
              </div>
            </div>

            <div class="page-break"></div>

            <div class="section" id="adding-jobs">
              <h2>📝 4. Adding Jobs</h2>
              
              <h3>Job Entry Fields</h3>
              <ul>
                <li><strong>WIP Number:</strong> 5-digit work in progress number (required, validated)</li>
                <li><strong>Vehicle Registration:</strong> Vehicle reg number (required, auto-uppercase)</li>
                <li><strong>AW Value:</strong> Allocated Work units from 0-100 (required)</li>
                <li><strong>Notes:</strong> Optional notes about the job</li>
                <li><strong>VHC Status:</strong> Vehicle Health Check status (GREEN/ORANGE/RED/N/A)</li>
                <li><strong>Job Card Photo:</strong> Optional photo attachment of the job card</li>
                <li><strong>Date & Time:</strong> Automatically captured when saved (editable)</li>
              </ul>

              <h3>📐 Understanding AW (Allocated Work)</h3>
              <div class="formula">
                1 AW = 5 minutes = 0.0833 hours
              </div>
              
              <p><strong>Examples:</strong></p>
              <ul>
                <li>6 AW = 6 × 5 = 30 minutes = 0.5 hours</li>
                <li>12 AW = 12 × 5 = 60 minutes = 1 hour</li>
                <li>24 AW = 24 × 5 = 120 minutes = 2 hours</li>
                <li>48 AW = 48 × 5 = 240 minutes = 4 hours</li>
                <li>96 AW = 96 × 5 = 480 minutes = 8 hours</li>
              </ul>

              <h3>🎨 VHC Status Color Buttons</h3>
              <p>Quick-select VHC status with color-coded buttons for faster entry:</p>
              <ul>
                <li><strong style="color: #4CAF50;">🟢 GREEN:</strong> Vehicle in good condition, no issues found</li>
                <li><strong style="color: #FF9800;">🟠 ORANGE:</strong> Minor issues, advisory work recommended</li>
                <li><strong style="color: #f44336;">🔴 RED:</strong> Critical issues, immediate attention required</li>
                <li><strong>⚪ N/A:</strong> No VHC performed or not applicable</li>
              </ul>

              <div class="info-box">
                <strong>💡 Tip:</strong> Using color buttons is much faster than dropdown menus. Simply tap the appropriate color and continue to the next field!
              </div>

              <h3>📸 Image Attachment</h3>
              <p>Attach a photo of the job card to each job record:</p>
              <ul>
                <li>Tap the camera icon to take a photo or select from gallery</li>
                <li>Photos are stored locally with the job</li>
                <li>View attached photos in job details</li>
                <li>Remove photos if needed</li>
                <li>Useful for verification and reference</li>
              </ul>

              <h3>✅ Saving Jobs</h3>
              <p>After entering job details, tap <strong>"Save Record"</strong> to save the job. The form will clear automatically, allowing you to quickly add another job without navigating away.</p>
            </div>

            <div class="page-break"></div>

            <div class="section" id="smart-features">
              <h2>💡 5. Smart Features</h2>
              
              <h3>🔍 Smart Autocomplete & Memory</h3>
              <p>TechTimes remembers your previous jobs and provides intelligent autocomplete suggestions to speed up data entry:</p>
              
              <h4>How It Works</h4>
              <ul>
                <li><strong>WIP Autocomplete:</strong> Start typing a WIP number to see matching previous jobs</li>
                <li><strong>Registration Autocomplete:</strong> Start typing a vehicle reg to see matching vehicles</li>
                <li><strong>Auto-Fill:</strong> Selecting a suggestion auto-fills both WIP and registration</li>
                <li><strong>Recent First:</strong> Most recent matching jobs appear at the top</li>
                <li><strong>Fast Entry:</strong> Quickly re-enter repeat jobs without typing everything</li>
                <li><strong>Live Updates:</strong> Suggestions update as you type</li>
              </ul>

              <h4>Benefits</h4>
              <ul>
                <li>Save time on repeat customers</li>
                <li>Reduce typing errors</li>
                <li>Maintain consistency in data entry</li>
                <li>Quick access to job history</li>
              </ul>

              <div class="success-box">
                <strong>✅ Pro Tip:</strong> For regular customers, just type the first 2-3 characters of the WIP or registration, and the autocomplete will show you the full details!
              </div>

              <h3>⏱️ Live Workday Progress Bar</h3>
              <p>The dashboard displays a real-time progress bar showing your position in the workday:</p>
              <ul>
                <li><strong>Start Time:</strong> Bar begins at your configured work start time</li>
                <li><strong>Lunch Break:</strong> Different color section shows lunch period</li>
                <li><strong>End Time:</strong> Bar completes at your configured work end time</li>
                <li><strong>Live Sync:</strong> Updates in real-time throughout the day</li>
                <li><strong>Visual Feedback:</strong> Instantly see how much of your workday remains</li>
              </ul>

              <h3>🚗 Startup Animation</h3>
              <p>TechTimes features a professional car drive-by animation on startup, setting the automotive workshop theme from the moment you open the app.</p>
            </div>

            <div class="page-break"></div>

            <div class="section" id="work-schedule">
              <h2>⚙️ 6. Work Schedule Configuration</h2>
              
              <p>Navigate to <strong>Settings → Edit Work Schedule</strong> to configure your working pattern.</p>

              <h3>Schedule Settings</h3>
              <table>
                <tr>
                  <th>Setting</th>
                  <th>Description</th>
                </tr>
                <tr>
                  <td><strong>Working Days</strong></td>
                  <td>Select which days you work (Monday-Sunday). Tap to toggle each day.</td>
                </tr>
                <tr>
                  <td><strong>Start Time</strong></td>
                  <td>Your daily start time in 24-hour format (e.g., 08:00)</td>
                </tr>
                <tr>
                  <td><strong>End Time</strong></td>
                  <td>Your daily end time in 24-hour format (e.g., 17:00)</td>
                </tr>
                <tr>
                  <td><strong>Lunch Break</strong></td>
                  <td>Unpaid break time in minutes (e.g., 30 minutes)</td>
                </tr>
                <tr>
                  <td><strong>Saturday Frequency</strong></td>
                  <td>How often you work Saturdays (None, Every, 1-in-2, 1-in-3, 1-in-4, Custom)</td>
                </tr>
                <tr>
                  <td><strong>Next Working Saturday</strong></td>
                  <td>Set the date of your next working Saturday (for custom patterns)</td>
                </tr>
              </table>

              <h3>📅 Saturday Frequency Options</h3>
              <ul>
                <li><strong>None:</strong> You don't work Saturdays</li>
                <li><strong>Every Saturday:</strong> You work every Saturday</li>
                <li><strong>1 in 2:</strong> You work every other Saturday (alternating weeks)</li>
                <li><strong>1 in 3:</strong> You work every third Saturday</li>
                <li><strong>1 in 4:</strong> You work every fourth Saturday</li>
                <li><strong>Custom:</strong> Pick specific Saturday dates manually</li>
              </ul>

              <h3>📊 How Schedule Affects Calculations</h3>
              <p>Your work schedule directly impacts:</p>
              <ul>
                <li><strong>Available Hours:</strong> Calculated based on working days × daily hours</li>
                <li><strong>Efficiency Percentage:</strong> Sold hours ÷ Available hours × 100</li>
                <li><strong>Monthly Target Tracking:</strong> Progress toward your monthly hours goal</li>
                <li><strong>Calendar View:</strong> Working days highlighted, non-working days grayed out</li>
                <li><strong>Statistics:</strong> All stats respect your configured working pattern</li>
                <li><strong>Workday Progress Bar:</strong> Syncs with your start/end times and lunch break</li>
              </ul>

              <div class="formula">
                Daily Working Hours = (End Time - Start Time) - Lunch Break
              </div>

              <p><strong>Example:</strong> If you work 08:00-17:00 with 30 minutes lunch:</p>
              <div class="formula">
                Daily Hours = (17:00 - 08:00) - 0.5 = 9 - 0.5 = 8.5 hours
              </div>
            </div>

            <div class="page-break"></div>

            <div class="section" id="efficiency">
              <h2>📊 7. Understanding Efficiency</h2>
              
              <h3>Efficiency Calculation</h3>
              <div class="formula">
                Efficiency % = (Sold Hours ÷ Available Hours) × 100
              </div>

              <h3>Components Explained</h3>
              <table>
                <tr>
                  <th>Component</th>
                  <th>Description</th>
                </tr>
                <tr>
                  <td><strong>Sold Hours</strong></td>
                  <td>Total hours from all jobs (AW × 5 minutes ÷ 60)</td>
                </tr>
                <tr>
                  <td><strong>Available Hours</strong></td>
                  <td>Working days × Daily working hours (based on your schedule)</td>
                </tr>
                <tr>
                  <td><strong>Working Days</strong></td>
                  <td>Only counts days you've configured as working days in your schedule</td>
                </tr>
              </table>

              <h3>🎯 Efficiency Ratings</h3>
              <ul>
                <li><strong style="color: #4CAF50;">🟢 90%+ = Excellent (Green):</strong> Outstanding performance, exceeding expectations</li>
                <li><strong style="color: #FF9800;">🟡 75-89% = Good (Yellow):</strong> Solid performance, meeting standards</li>
                <li><strong style="color: #f44336;">🔴 Below 75% = Needs Improvement (Red):</strong> Below target, review workflow</li>
              </ul>

              <h3>📈 Example Calculation</h3>
              <div class="info-box">
                <p><strong>Scenario:</strong> You work Monday-Friday, 8.5 hours/day, and it's the 10th working day of the month.</p>
                <p><strong>Step 1:</strong> Calculate Available Hours</p>
                <div class="formula">Available Hours = 10 days × 8.5 hours = 85 hours</div>
                <p><strong>Step 2:</strong> Calculate Sold Hours (you've logged 840 AW)</p>
                <div class="formula">Sold Hours = 840 AW × 5 minutes ÷ 60 = 70 hours</div>
                <p><strong>Step 3:</strong> Calculate Efficiency</p>
                <div class="formula">Efficiency = (70 ÷ 85) × 100 = 82.4%</div>
                <p><strong>Result:</strong> 🟡 Good performance (Yellow indicator)</p>
              </div>

              <h3>💡 Improving Efficiency</h3>
              <ul>
                <li>Log jobs immediately after completion to avoid forgetting</li>
                <li>Ensure AW values are accurate and reflect actual work done</li>
                <li>Review efficiency trends weekly to identify patterns</li>
                <li>Adjust work schedule if your actual hours differ from configured hours</li>
                <li>Set realistic monthly targets based on historical performance</li>
                <li>Use the workday progress bar to pace yourself throughout the day</li>
              </ul>
            </div>

            <div class="page-break"></div>

            <div class="section" id="dashboard">
              <h2>📱 8. Dashboard Overview</h2>
              
              <h3>Main Dashboard Components</h3>
              
              <h4>⏰ Live Clock</h4>
              <p>Displays current time synced with your device clock, updating every second.</p>

              <h4>🎯 Monthly Target Ring</h4>
              <p>Circular progress indicator showing your progress toward the monthly hours target:</p>
              <ul>
                <li>Green fill shows hours completed</li>
                <li>Gray shows remaining hours</li>
                <li>Percentage displayed in center</li>
                <li>Updates in real-time as you log jobs</li>
              </ul>

              <h4>📊 Efficiency Ring</h4>
              <p>Current month efficiency percentage with color coding:</p>
              <ul>
                <li>Green: 90%+ efficiency</li>
                <li>Yellow: 75-89% efficiency</li>
                <li>Red: Below 75% efficiency</li>
                <li>Shows sold hours vs available hours</li>
              </ul>

              <h4>⏱️ Workday Progress Bar</h4>
              <p>Live progress bar showing your position in the current workday:</p>
              <ul>
                <li>Starts at your configured work start time</li>
                <li>Different color section for lunch break</li>
                <li>Ends at your configured work end time</li>
                <li>Updates every second for real-time tracking</li>
                <li>Synced with your work schedule settings</li>
              </ul>

              <h4>📈 Quick Stats Cards</h4>
              <ul>
                <li><strong>Today:</strong> Jobs logged and hours worked today</li>
                <li><strong>This Week:</strong> Weekly totals (Monday-Saturday)</li>
                <li><strong>This Month:</strong> Monthly breakdown with efficiency</li>
              </ul>

              <h4>🔗 Quick Action Buttons</h4>
              <ul>
                <li>Add Job - Quick access to job entry</li>
                <li>View Jobs - Browse all job records</li>
                <li>Calendar - View calendar with efficiency circles</li>
                <li>Statistics - Detailed stats breakdown</li>
              </ul>
            </div>

            <div class="page-break"></div>

            <div class="section" id="statistics">
              <h2>📈 9. Statistics & Reports</h2>
              
              <h3>⏱️ Time Stats Page</h3>
              <p>Access detailed time tracking with live updates:</p>
              <ul>
                <li><strong>Available Hours Timer:</strong> Counts total available hours as they increase (8am-5pm)</li>
                <li><strong>Time Elapsed:</strong> Hours worked so far today</li>
                <li><strong>Time Remaining:</strong> Hours left in the workday</li>
                <li><strong>Live Sync:</strong> All stats tick and count live, synced with the home page clock</li>
                <li><strong>Real-Time Updates:</strong> Updates every second for accurate tracking</li>
              </ul>

              <h3>📊 Stats Screen</h3>
              <p>Comprehensive statistics across different time periods:</p>
              
              <h4>Today's Stats</h4>
              <ul>
                <li>Jobs logged today</li>
                <li>Total AW and hours</li>
                <li>Current efficiency</li>
                <li>Time elapsed and remaining</li>
              </ul>

              <h4>Weekly Stats</h4>
              <ul>
                <li>Week totals (Monday-Saturday)</li>
                <li>Jobs per day breakdown</li>
                <li>Weekly efficiency</li>
                <li>Navigate between weeks with arrows</li>
              </ul>

              <h4>Monthly Stats</h4>
              <ul>
                <li>Monthly totals and efficiency</li>
                <li>Progress toward target</li>
                <li>Available vs sold hours</li>
                <li>Navigate between months</li>
              </ul>

              <h4>All-Time Stats</h4>
              <ul>
                <li>Lifetime totals since app installation</li>
                <li>Total jobs logged</li>
                <li>Total AW and hours</li>
                <li>Historical performance</li>
              </ul>

              <h3>📅 Period Navigation</h3>
              <p>Navigate through different time periods:</p>
              <ul>
                <li>Use ← → arrows to move between days, weeks, or months</li>
                <li>Tap "Today" to jump to the current date</li>
                <li>View historical data to track progress over time</li>
                <li>Swipe gestures for quick navigation</li>
              </ul>
            </div>

            <div class="page-break"></div>

            <div class="section" id="calendar">
              <h2>📅 10. Calendar View</h2>
              
              <h3>View Modes</h3>
              <table>
                <tr>
                  <th>Mode</th>
                  <th>Description</th>
                </tr>
                <tr>
                  <td><strong>Day View</strong></td>
                  <td>Detailed view of a single day with efficiency circles and complete job list</td>
                </tr>
                <tr>
                  <td><strong>Week View</strong></td>
                  <td>Swipeable week view (Monday-Sunday) with mini efficiency indicators</td>
                </tr>
                <tr>
                  <td><strong>Month View</strong></td>
                  <td>Full month calendar grid with efficiency circles on each day</td>
                </tr>
                <tr>
                  <td><strong>Year View</strong></td>
                  <td>Overview of all 12 months with monthly totals</td>
                </tr>
              </table>

              <h3>🎯 Efficiency Circles</h3>
              <p>Each day displays two concentric circles:</p>
              <ul>
                <li><strong>Outer Circle (Efficiency):</strong> Shows sold hours vs available hours for that day
                  <ul>
                    <li>Green: 90%+ efficiency</li>
                    <li>Yellow: 75-89% efficiency</li>
                    <li>Red: Below 75% efficiency</li>
                  </ul>
                </li>
                <li><strong>Inner Circle (Progress):</strong> Shows progress toward daily target hours
                  <ul>
                    <li>Fills as you log jobs throughout the day</li>
                    <li>Complete circle = target reached</li>
                  </ul>
                </li>
              </ul>

              <h3>🗓️ Navigation</h3>
              <ul>
                <li>Use ← → arrows to navigate between periods</li>
                <li>Tap "Today" button to jump to current date</li>
                <li>Tap any day to view detailed information</li>
                <li>Swipe left/right in week view to move between weeks</li>
                <li>Working days are highlighted, non-working days are grayed out</li>
              </ul>

              <h3>📊 Day Details</h3>
              <p>Tapping a day shows:</p>
              <ul>
                <li>Complete list of jobs logged that day</li>
                <li>Total AW and hours for the day</li>
                <li>Efficiency percentage</li>
                <li>Available hours for that day</li>
                <li>Quick access to edit or delete jobs</li>
                <li>Job card photos if attached</li>
              </ul>
            </div>

            <div class="page-break"></div>

            <div class="section" id="absences">
              <h2>🏖️ 11. Absence Logging</h2>
              
              <p>Navigate to <strong>Settings → Absence Logger</strong> to record time off.</p>

              <h3>Absence Types</h3>
              <ul>
                <li><strong>Holiday:</strong> Planned vacation or time off</li>
                <li><strong>Sickness:</strong> Sick leave or medical appointments</li>
                <li><strong>Training:</strong> Training courses or professional development</li>
              </ul>

              <h3>Absence Options</h3>
              <table>
                <tr>
                  <th>Option</th>
                  <th>Description</th>
                </tr>
                <tr>
                  <td><strong>Full Day</strong></td>
                  <td>Entire working day absent (uses daily working hours)</td>
                </tr>
                <tr>
                  <td><strong>Half Day</strong></td>
                  <td>Half of your daily working hours</td>
                </tr>
                <tr>
                  <td><strong>Multiple Days</strong></td>
                  <td>Specify number of consecutive days</td>
                </tr>
                <tr>
                  <td><strong>Custom Hours</strong></td>
                  <td>Enter specific number of hours</td>
                </tr>
              </table>

              <h3>Deduction Types</h3>
              <ul>
                <li><strong>Deduct from Target:</strong> Reduces your monthly target hours (e.g., paid holiday)</li>
                <li><strong>Deduct from Available:</strong> Reduces available hours but not target (e.g., unpaid leave)</li>
              </ul>

              <h3>How Absences Affect Calculations</h3>
              <ul>
                <li>Absences automatically adjust efficiency calculations</li>
                <li>Calendar view shows absence days with special indicators</li>
                <li>Monthly stats reflect absence deductions</li>
                <li>Helps maintain accurate efficiency tracking</li>
              </ul>

              <div class="info-box">
                <strong>💡 Tip:</strong> Log absences as soon as they're planned to keep your efficiency calculations accurate throughout the month.
              </div>
            </div>

            <div class="page-break"></div>

            <div class="section" id="export">
              <h2>📤 12. Export & Backup</h2>
              
              <h3>Export Options</h3>
              
              <h4>📄 PDF Reports</h4>
              <p>Generate stylish, formatted PDF reports with efficiency progress bars:</p>
              <ul>
                <li><strong>Daily:</strong> Single day report with all jobs and totals</li>
                <li><strong>Weekly:</strong> Week report with day-by-day breakdown and week total</li>
                <li><strong>Monthly:</strong> Full month with day totals, week totals, and month total</li>
                <li><strong>Entire:</strong> All jobs with complete groupings by day, week, and month</li>
              </ul>

              <p><strong>PDF Report Contents:</strong></p>
              <ul>
                <li>Your technician name and date range</li>
                <li>Job details: WIP number, vehicle reg, VHC status, AW, hours</li>
                <li>Day totals with job count, total AW, and total hours</li>
                <li>Week totals (Monday-Saturday groupings)</li>
                <li>Month totals with summary calculations</li>
                <li>Efficiency progress bars showing sold vs available hours</li>
                <li>Color-coded efficiency indicators</li>
                <li>Professional formatting suitable for management reports</li>
              </ul>

              <h4>📊 JSON Export</h4>
              <p>Structured data format for backup or transfer:</p>
              <ul>
                <li>Complete job data with all fields</li>
                <li>Preserves original timestamps</li>
                <li>Can be imported back into TechTimes</li>
                <li>Suitable for data migration or archiving</li>
                <li>Includes export date and version info</li>
              </ul>

              <h4>📋 CSV Export</h4>
              <p>Spreadsheet-compatible format:</p>
              <ul>
                <li>Open in Excel, Google Sheets, or Numbers</li>
                <li>Columns: Date, WIP, Vehicle Reg, AW, Minutes, Hours, Notes</li>
                <li>Easy to analyze with spreadsheet tools</li>
                <li>Suitable for custom reporting</li>
              </ul>

              <h3>📥 Import Jobs</h3>
              <p>Import jobs from JSON files:</p>
              <ul>
                <li>Select a JSON backup file</li>
                <li>Progress window shows each job being added</li>
                <li>Retains all original data and timestamps</li>
                <li>Duplicate detection prevents re-importing same jobs</li>
                <li>Validation ensures data integrity</li>
                <li>Error reporting for any issues</li>
              </ul>

              <h3>💾 Backup & Restore</h3>
              <div class="warning-box">
                <strong>⚠️ Important:</strong> Create regular backups to prevent data loss!
              </div>
              
              <p><strong>Create Backup:</strong></p>
              <ul>
                <li>Exports all app data to a JSON file</li>
                <li>Includes: jobs, schedule, profile, absences, settings</li>
                <li>Share to cloud storage (Google Drive, iCloud, Dropbox)</li>
                <li>Keep multiple backup versions for safety</li>
                <li>Timestamped filenames for easy identification</li>
              </ul>

              <p><strong>Restore Backup:</strong></p>
              <ul>
                <li>Select a backup JSON file</li>
                <li>Confirmation prompt before overwriting current data</li>
                <li>Imports complete backup with all settings</li>
                <li>Useful for transferring to a new device</li>
                <li>Validates backup file before restoring</li>
              </ul>

              <h3>📤 Sharing Options</h3>
              <p>All exports open the share menu, allowing you to:</p>
              <ul>
                <li>Save to device storage</li>
                <li>Share via email</li>
                <li>Upload to cloud storage</li>
                <li>Send via messaging apps</li>
                <li>Print directly (PDF reports)</li>
              </ul>
            </div>

            <div class="page-break"></div>

            <div class="section" id="notifications">
              <h2>🔔 13. Notifications</h2>
              
              <p>Navigate to <strong>Settings → Notification Settings</strong> to customize alerts.</p>

              <h3>Notification Types</h3>
              <table>
                <tr>
                  <th>Notification</th>
                  <th>Description</th>
                  <th>Configurable Options</th>
                </tr>
                <tr>
                  <td><strong>Daily Reminder</strong></td>
                  <td>Reminds you to log jobs at a set time</td>
                  <td>Time (e.g., 8:00 AM), Enable/Disable</td>
                </tr>
                <tr>
                  <td><strong>Weekly Report</strong></td>
                  <td>Summary of your week's performance</td>
                  <td>Day of week (e.g., Monday), Enable/Disable</td>
                </tr>
                <tr>
                  <td><strong>Monthly Report</strong></td>
                  <td>End-of-month statistics</td>
                  <td>Enable/Disable</td>
                </tr>
                <tr>
                  <td><strong>Target Reminder</strong></td>
                  <td>Alerts when approaching monthly target</td>
                  <td>Threshold percentage, Enable/Disable</td>
                </tr>
                <tr>
                  <td><strong>Efficiency Alert</strong></td>
                  <td>Notifies when efficiency drops below threshold</td>
                  <td>Threshold percentage (e.g., 75%), Enable/Disable</td>
                </tr>
              </table>

              <h3>⚙️ Notification Settings</h3>
              <ul>
                <li><strong>Sound:</strong> Choose notification sound (Default, Alert, Bell, Chime)</li>
                <li><strong>Vibration:</strong> Select vibration pattern (Default, Short, Long, Double)</li>
                <li><strong>Priority:</strong> Set notification priority (High, Default, Low)</li>
                <li><strong>Test Notification:</strong> Send a test notification to verify settings</li>
                <li><strong>Days Active:</strong> Choose which days to receive notifications</li>
              </ul>

              <div class="info-box">
                <strong>💡 Tip:</strong> Enable Daily Reminder to build a habit of logging jobs consistently. Set it for the end of your workday to ensure nothing is missed.
              </div>
            </div>

            <div class="page-break"></div>

            <div class="section" id="appearance">
              <h2>🎨 14. Appearance & Themes</h2>
              
              <h3>Theme Options</h3>
              <ul>
                <li><strong>Dark Workshop:</strong> Dark theme with automotive workshop backgrounds
                  <ul>
                    <li>Easier on the eyes in low-light conditions</li>
                    <li>Saves battery on OLED screens</li>
                    <li>Professional dark aesthetic</li>
                  </ul>
                </li>
                <li><strong>Light Workshop:</strong> Light theme with bright workshop images
                  <ul>
                    <li>Better visibility in bright environments</li>
                    <li>Clean, modern appearance</li>
                    <li>High contrast for readability</li>
                  </ul>
                </li>
              </ul>

              <h3>🎚️ Overlay Strength</h3>
              <p>Adjust the background overlay darkness for optimal readability:</p>
              <ul>
                <li>Slider from 0% (no overlay) to 60% (dark overlay)</li>
                <li>Default: 35% for dark mode, 15% for light mode</li>
                <li>Applies to all screens consistently</li>
                <li>Find the perfect balance between aesthetics and readability</li>
                <li>Changes apply immediately</li>
              </ul>

              <h3>🖼️ Background Images</h3>
              <p>All screens feature automotive-themed backgrounds:</p>
              <ul>
                <li>Workshop bays and tool benches</li>
                <li>Engine bays and diagnostics</li>
                <li>Vehicle ramps and lifts</li>
                <li>Professional automotive environment</li>
                <li>Consistent theme throughout the app</li>
              </ul>
            </div>

            <div class="page-break"></div>

            <div class="section" id="privacy">
              <h2>🔒 15. Privacy & Security</h2>
              
              <h3>Data Storage</h3>
              <div class="success-box">
                <strong>✅ Complete Privacy:</strong>
                <ul>
                  <li>All data stored locally on your device</li>
                  <li>No internet connection required</li>
                  <li>No data sent to external servers</li>
                  <li>No cloud synchronization</li>
                  <li>No analytics or tracking</li>
                  <li>No third-party services</li>
                </ul>
              </div>

              <h3>🛡️ GDPR Compliance</h3>
              <p>TechTimes is designed with privacy in mind:</p>
              <ul>
                <li><strong>Minimal Data Collection:</strong> Only stores vehicle registrations and job data</li>
                <li><strong>No Personal Information:</strong> No customer names, addresses, phone numbers, or emails</li>
                <li><strong>User Control:</strong> You own and control all your data</li>
                <li><strong>Right to Delete:</strong> Clear all data anytime in Settings</li>
                <li><strong>Data Portability:</strong> Export your data in standard formats</li>
                <li><strong>Transparency:</strong> Clear documentation of what data is stored</li>
              </ul>

              <h3>🔐 Security Features</h3>
              <table>
                <tr>
                  <th>Feature</th>
                  <th>Protection Level</th>
                </tr>
                <tr>
                  <td><strong>PIN Protection</strong></td>
                  <td>4-digit PIN required to access app</td>
                </tr>
                <tr>
                  <td><strong>Biometric Authentication</strong></td>
                  <td>Fingerprint or Face ID for quick secure access</td>
                </tr>
                <tr>
                  <td><strong>Automatic Lock</strong></td>
                  <td>Locks when app goes to background</td>
                </tr>
                <tr>
                  <td><strong>Secure Storage</strong></td>
                  <td>Data encrypted on device</td>
                </tr>
                <tr>
                  <td><strong>Double Back Exit</strong></td>
                  <td>Prevents accidental app closure</td>
                </tr>
              </table>

              <h3>📱 Permissions</h3>
              <p>TechTimes requests minimal permissions:</p>
              <ul>
                <li><strong>Notifications:</strong> For reminders and alerts (optional)</li>
                <li><strong>Storage:</strong> To save and export your data</li>
                <li><strong>Camera:</strong> To attach job card photos (optional)</li>
                <li><strong>Biometrics:</strong> For fingerprint/Face ID login (optional)</li>
              </ul>

              <p>All permissions can be reviewed and managed in Settings → Permissions.</p>
            </div>

            <div class="page-break"></div>

            <div class="section" id="tips">
              <h2>💡 16. Tips & Best Practices</h2>
              
              <h3>📋 Daily Workflow</h3>
              <ol>
                <li><strong>Morning:</strong> Check dashboard to see yesterday's stats and today's target</li>
                <li><strong>During Day:</strong> Log jobs as you complete them (use autocomplete for speed)</li>
                <li><strong>Lunch Break:</strong> Quick review of morning efficiency</li>
                <li><strong>End of Day:</strong> Review efficiency and ensure all jobs are logged</li>
                <li><strong>Weekly:</strong> Check weekly stats every Monday to track trends</li>
                <li><strong>Monthly:</strong> Export monthly report for records and review</li>
              </ol>

              <h3>📈 Maximizing Efficiency</h3>
              <ul>
                <li><strong>Immediate Logging:</strong> Log jobs right after completion to avoid forgetting</li>
                <li><strong>Accurate AW Values:</strong> Use precise AW values from job cards</li>
                <li><strong>Weekly Reviews:</strong> Review efficiency trends to identify patterns</li>
                <li><strong>Schedule Accuracy:</strong> Keep work schedule updated if patterns change</li>
                <li><strong>Realistic Targets:</strong> Set achievable monthly targets based on history</li>
                <li><strong>Use Autocomplete:</strong> Speed up data entry with smart suggestions</li>
                <li><strong>Attach Photos:</strong> Take job card photos for reference and verification</li>
                <li><strong>Monitor Progress Bar:</strong> Use the workday progress bar to pace yourself</li>
              </ul>

              <h3>💾 Data Management</h3>
              <ul>
                <li><strong>Weekly Backups:</strong> Create backups every week</li>
                <li><strong>Cloud Storage:</strong> Save backups to Google Drive or iCloud</li>
                <li><strong>Monthly Exports:</strong> Export PDF reports for permanent records</li>
                <li><strong>Search Function:</strong> Use search to find specific jobs quickly</li>
                <li><strong>Data Cleanup:</strong> Review and clean old data periodically</li>
                <li><strong>Multiple Backups:</strong> Keep several backup versions for safety</li>
                <li><strong>Test Restores:</strong> Occasionally test restoring from backup</li>
              </ul>

              <h3>⚡ Speed Tips</h3>
              <ul>
                <li>Use VHC color buttons instead of dropdown for faster entry</li>
                <li>Enable biometric login for instant access</li>
                <li>Use autocomplete suggestions for repeat jobs</li>
                <li>Set up daily reminders to build consistent habits</li>
                <li>Keep the app open during the day for quick logging</li>
                <li>Use "Save Record" to quickly add multiple jobs</li>
                <li>Tap efficiency circles in calendar for quick day details</li>
              </ul>

              <h3>🎯 Accuracy Tips</h3>
              <ul>
                <li>Double-check WIP numbers before saving</li>
                <li>Verify vehicle registrations match job cards</li>
                <li>Use correct VHC status colors</li>
                <li>Add notes for unusual jobs or issues</li>
                <li>Attach job card photos for verification</li>
                <li>Review daily totals before end of day</li>
              </ul>
            </div>

            <div class="page-break"></div>

            <div class="section" id="troubleshooting">
              <h2>❓ 17. Troubleshooting</h2>
              
              <h3>🔑 Forgot PIN</h3>
              <div class="warning-box">
                <strong>⚠️ Important:</strong> If you forget your PIN, you'll need to reinstall the app and lose all data. There is no PIN recovery option for security reasons.
                <p><strong>Prevention:</strong> Create regular backups and store them safely!</p>
              </div>

              <h3>📊 Efficiency Seems Wrong</h3>
              <p>If your efficiency percentage doesn't look right:</p>
              <ol>
                <li>Check your work schedule settings (Settings → Edit Work Schedule)</li>
                <li>Verify working days are correct (Monday-Friday, etc.)</li>
                <li>Ensure start/end times are accurate</li>
                <li>Check lunch break duration</li>
                <li>Verify Saturday frequency setting</li>
                <li>Look for any absences that should be logged</li>
                <li>Confirm jobs are logged on correct dates</li>
                <li>Review the Formulas screen for calculation details</li>
              </ol>

              <h3>🔐 Biometrics Not Working</h3>
              <p>If fingerprint or Face ID isn't working:</p>
              <ul>
                <li>Ensure biometrics are enrolled on your device (check device settings)</li>
                <li>Check app permissions in device settings</li>
                <li>Try disabling and re-enabling biometrics in app settings</li>
                <li>Restart the app</li>
                <li>Use PIN as fallback if biometrics fail</li>
                <li>Verify device biometric sensor is working in other apps</li>
              </ul>

              <h3>📤 Export Not Working</h3>
              <p>If you can't export data:</p>
              <ul>
                <li>Check storage permissions in device settings</li>
                <li>Ensure sufficient storage space on device</li>
                <li>Try exporting smaller date ranges</li>
                <li>Restart the app and try again</li>
                <li>Check if sharing is available on your device</li>
                <li>Try a different export format (PDF, JSON, CSV)</li>
              </ul>

              <h3>🔔 Notifications Not Appearing</h3>
              <p>If notifications aren't showing:</p>
              <ul>
                <li>Check notification permissions in device settings</li>
                <li>Ensure notifications are enabled in app settings</li>
                <li>Check Do Not Disturb mode on your device</li>
                <li>Verify notification times are set correctly</li>
                <li>Send a test notification to verify settings</li>
                <li>Check battery optimization settings (may block notifications)</li>
              </ul>

              <h3>📱 App Performance Issues</h3>
              <p>If the app is slow or laggy:</p>
              <ul>
                <li>Close and restart the app</li>
                <li>Check available device storage</li>
                <li>Clear old jobs if you have thousands of records</li>
                <li>Export and backup data, then clear all data for fresh start</li>
                <li>Ensure device OS is up to date</li>
                <li>Check if other apps are consuming resources</li>
              </ul>

              <h3>📥 Import Failing</h3>
              <p>If job import isn't working:</p>
              <ul>
                <li>Verify the JSON file is valid TechTimes format</li>
                <li>Check file isn't corrupted</li>
                <li>Ensure file has correct structure (jobs array)</li>
                <li>Try importing smaller batches</li>
                <li>Check error messages for specific issues</li>
                <li>Verify file was exported from TechTimes</li>
              </ul>

              <h3>⏱️ Workday Progress Bar Not Updating</h3>
              <p>If the progress bar isn't moving:</p>
              <ul>
                <li>Check your work schedule is configured correctly</li>
                <li>Verify start and end times are set</li>
                <li>Ensure current time is within your work hours</li>
                <li>Restart the app to refresh</li>
                <li>Check device time and date settings</li>
              </ul>

              <h3>🔍 Autocomplete Not Showing Suggestions</h3>
              <p>If autocomplete isn't working:</p>
              <ul>
                <li>Ensure you have previously logged jobs</li>
                <li>Type at least 2-3 characters to trigger suggestions</li>
                <li>Check that jobs exist with matching WIP/registration</li>
                <li>Restart the app to refresh data</li>
              </ul>
            </div>

            <div class="footer">
              <h3>📞 Support & Information</h3>
              <p>TechTimes is designed to be intuitive and self-contained. All features work offline without requiring external support.</p>
              
              <p><strong>Self-Help Resources:</strong></p>
              <ul style="list-style: none; padding: 0;">
                <li>✅ This comprehensive user guide (export as PDF for reference)</li>
                <li>✅ In-app hints and tooltips throughout the interface</li>
                <li>✅ Settings descriptions and help text</li>
                <li>✅ Formula explanations in the Formulas screen</li>
                <li>✅ About page with quick reference information</li>
              </ul>

              <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #ddd;">
                <p><strong>TechTimes v1.0.0</strong></p>
                <p>Secure Personal Job Tracking for Vehicle Technicians</p>
                <p>© 2024 TechTimes. All rights reserved.</p>
                <p style="margin-top: 15px; font-size: 12px;">
                  This comprehensive guide was generated from the TechTimes app.<br>
                  Keep this PDF for reference and share with colleagues.<br>
                  <br>
                  <strong>Features Covered:</strong> Job Tracking • Efficiency Monitoring • Work Schedule • Calendar Views<br>
                  Statistics • Export & Backup • Notifications • Themes • Privacy & Security<br>
                  <br>
                  <strong>Remember:</strong> Create regular backups to protect your data!
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      console.log('AboutScreen: Generating PDF from HTML');
      const { uri } = await Print.printToFileAsync({ 
        html,
        base64: false,
      });
      
      console.log('AboutScreen: PDF generated at:', uri);
      
      const fileName = `TechTimes_User_Guide_${new Date().toISOString().split('T')[0]}.pdf`;
      const newUri = FileSystem.documentDirectory + fileName;
      
      console.log('AboutScreen: Moving PDF to permanent location:', newUri);
      
      try {
        // Check if file exists at source
        const fileInfo = await FileSystem.getInfoAsync(uri);
        console.log('AboutScreen: Source file info:', fileInfo);
        
        if (fileInfo.exists) {
          // Delete destination if it exists
          const destInfo = await FileSystem.getInfoAsync(newUri);
          if (destInfo.exists) {
            console.log('AboutScreen: Deleting existing destination file');
            await FileSystem.deleteAsync(newUri, { idempotent: true });
          }
          
          // Move the file
          await FileSystem.moveAsync({
            from: uri,
            to: newUri,
          });
          console.log('AboutScreen: File moved successfully');
        } else {
          console.error('AboutScreen: Source file does not exist');
          throw new Error('PDF generation failed - file not found');
        }
      } catch (moveError) {
        console.error('AboutScreen: Error moving file:', moveError);
        // If move fails, try to use the original URI
        console.log('AboutScreen: Using original URI for sharing');
      }

      console.log('AboutScreen: Opening share menu for PDF');
      const shareUri = await FileSystem.getInfoAsync(newUri).then(info => info.exists ? newUri : uri);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(shareUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share TechTimes Complete User Guide',
          UTI: 'com.adobe.pdf',
        });
        console.log('AboutScreen: PDF shared successfully');
        Alert.alert('Success', 'Complete user guide exported as PDF and ready to share!');
      } else {
        console.error('AboutScreen: Sharing not available');
        Alert.alert('Error', 'Sharing is not available on this device');
      }
      
      console.log('AboutScreen: PDF export successful');
    } catch (error) {
      console.error('AboutScreen: Error exporting PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Export Error', `Failed to export user guide: ${errorMessage}\n\nPlease try again.`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'About TechTimes',
          headerStyle: { backgroundColor: theme.card },
          headerTintColor: theme.text,
        }}
      />
      <AppBackground>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.contentContainer, Platform.OS === 'android' && { paddingTop: 16 }]}
        >
          <View style={[styles.header, { backgroundColor: theme.card }]}>
            <IconSymbol
              ios_icon_name="info.circle.fill"
              android_material_icon_name="info"
              size={56}
              color={theme.primary}
            />
            <Text style={[styles.appName, { color: theme.text }]}>TechTimes</Text>
            <Text style={[styles.version, { color: theme.textSecondary }]}>Version 1.0.0</Text>
            <Text style={[styles.tagline, { color: theme.textSecondary }]}>
              Secure Personal Job Tracking for Vehicle Technicians
            </Text>
          </View>

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
            <Text style={styles.exportButtonText}>
              {exporting ? 'Generating PDF...' : 'Export Complete Guide as PDF'}
            </Text>
          </TouchableOpacity>

          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>📱 About TechTimes</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              TechTimes is a secure, offline-first personal job tracking application designed specifically for vehicle technicians. Track your work hours, monitor efficiency, and manage your productivity—all while keeping your data private and secure on your device.
            </Text>
            <View style={[styles.infoBox, { backgroundColor: theme.background, borderLeftColor: theme.primary }]}>
              <Text style={[styles.infoText, { color: theme.text }]}>
                <Text style={{ fontWeight: 'bold' }}>🎯 Core Purpose: </Text>
                Track Allocated Work (AW) units, calculate efficiency, and monitor productivity without compromising data privacy. Everything runs locally on your device with no internet connection required.
              </Text>
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>✨ Key Features</Text>
            <View style={styles.featureList}>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>🔒 Fully offline - all data stored locally</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>🔐 PIN and biometric security</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>📊 Real-time efficiency tracking with live timers</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>📅 Customizable work schedule with Saturday frequency</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>📈 Comprehensive statistics (day/week/month/year)</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>📤 Export to PDF, JSON, and CSV</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>🔔 Customizable notifications and reminders</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>📆 Calendar view with efficiency circles</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>💡 Smart autocomplete for repeat jobs</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>📸 Optional job card photo attachments</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>🎨 Dark and light workshop themes</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>⏱️ Live workday progress bar with lunch break</Text>
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>🚀 Quick Start Guide</Text>
            
            <Text style={[styles.subsectionTitle, { color: theme.text }]}>1. First-Time Setup</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              • Enter your technician name for personalized reports{'\n'}
              • Create a secure 4-digit PIN (default: 3101){'\n'}
              • Configure your work schedule (days, hours, lunch){'\n'}
              • Set your monthly target hours{'\n'}
              • Enable biometric login (optional)
            </Text>

            <Text style={[styles.subsectionTitle, { color: theme.text }]}>2. Adding Jobs</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              • <Text style={{ fontWeight: 'bold' }}>WIP Number:</Text> 5-digit work in progress number{'\n'}
              • <Text style={{ fontWeight: 'bold' }}>Vehicle Reg:</Text> Vehicle registration (auto-uppercase){'\n'}
              • <Text style={{ fontWeight: 'bold' }}>AW Value:</Text> Allocated Work units (0-100){'\n'}
              • <Text style={{ fontWeight: 'bold' }}>VHC Status:</Text> Color-coded buttons (Green/Orange/Red/N/A){'\n'}
              • <Text style={{ fontWeight: 'bold' }}>Notes:</Text> Optional job notes{'\n'}
              • <Text style={{ fontWeight: 'bold' }}>Photo:</Text> Optional job card photo attachment
            </Text>

            <Text style={[styles.subsectionTitle, { color: theme.text }]}>3. Understanding AW</Text>
            <Text style={[styles.formula, { color: theme.text, backgroundColor: theme.background }]}>
              1 AW = 5 minutes = 0.0833 hours
            </Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              Examples:{'\n'}
              • 6 AW = 30 minutes = 0.5 hours{'\n'}
              • 12 AW = 60 minutes = 1 hour{'\n'}
              • 24 AW = 120 minutes = 2 hours
            </Text>
          </View>

          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>💡 Smart Features</Text>
            
            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Autocomplete & Memory</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              TechTimes remembers your previous jobs and provides intelligent suggestions:{'\n'}
              • Start typing WIP or registration to see matches{'\n'}
              • Auto-fills both fields when you select a suggestion{'\n'}
              • Most recent jobs appear first{'\n'}
              • Speeds up data entry for repeat customers
            </Text>

            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Live Workday Progress</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              Real-time progress bar on dashboard:{'\n'}
              • Shows your position in the workday{'\n'}
              • Different color for lunch break{'\n'}
              • Synced with your work schedule{'\n'}
              • Updates every second
            </Text>
          </View>

          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>⚙️ Work Schedule</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              Navigate to Settings → Edit Work Schedule to configure:
            </Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              • <Text style={{ fontWeight: 'bold' }}>Working Days:</Text> Select which days you work (Mon-Sun){'\n'}
              • <Text style={{ fontWeight: 'bold' }}>Start/End Time:</Text> Your daily hours (24-hour format){'\n'}
              • <Text style={{ fontWeight: 'bold' }}>Lunch Break:</Text> Unpaid break time in minutes{'\n'}
              • <Text style={{ fontWeight: 'bold' }}>Saturday Frequency:</Text> None, Every, 1-in-2, 1-in-3, 1-in-4, or Custom{'\n'}
              • <Text style={{ fontWeight: 'bold' }}>Next Working Saturday:</Text> Set the date of your next working Saturday
            </Text>
            <Text style={[styles.formula, { color: theme.text, backgroundColor: theme.background }]}>
              Daily Hours = (End - Start) - Lunch Break
            </Text>
          </View>

          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>📊 Efficiency Calculation</Text>
            <Text style={[styles.formula, { color: theme.text, backgroundColor: theme.background }]}>
              Efficiency % = (Sold Hours ÷ Available Hours) × 100
            </Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              • <Text style={{ fontWeight: 'bold' }}>Sold Hours:</Text> Total hours from all jobs (AW × 5 ÷ 60){'\n'}
              • <Text style={{ fontWeight: 'bold' }}>Available Hours:</Text> Working days × Daily hours{'\n'}
              • <Text style={{ fontWeight: 'bold' }}>Working Days:</Text> Only counts configured working days
            </Text>
            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Efficiency Ratings</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              🟢 90%+ = Excellent (Green){'\n'}
              🟡 75-89% = Good (Yellow){'\n'}
              🔴 Below 75% = Needs Improvement (Red)
            </Text>
          </View>

          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>📈 Statistics & Reports</Text>
            
            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Dashboard</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              • Live clock synced with device time{'\n'}
              • Monthly target progress ring{'\n'}
              • Efficiency ring with color coding{'\n'}
              • Today's and this week's stats{'\n'}
              • Workday progress bar with lunch break{'\n'}
              • Monthly breakdown
            </Text>

            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Time Stats Page</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              • Available hours timer (counts 8am-5pm){'\n'}
              • Time elapsed in the day{'\n'}
              • Time remaining in the day{'\n'}
              • All stats tick live, synced with home clock
            </Text>

            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Stats Screen</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              • Period statistics (Today, Week, Month){'\n'}
              • All-time totals{'\n'}
              • Recent jobs list{'\n'}
              • Efficiency trends
            </Text>
          </View>

          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>📅 Calendar View</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              • <Text style={{ fontWeight: 'bold' }}>Day View:</Text> Detailed single day with efficiency circles and job list{'\n'}
              • <Text style={{ fontWeight: 'bold' }}>Week View:</Text> Swipeable week with mini indicators{'\n'}
              • <Text style={{ fontWeight: 'bold' }}>Month View:</Text> Full calendar with efficiency circles{'\n'}
              • <Text style={{ fontWeight: 'bold' }}>Year View:</Text> Overview of all 12 months
            </Text>
            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Efficiency Circles</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              Each day shows two circles:{'\n'}
              • <Text style={{ fontWeight: 'bold' }}>Outer:</Text> Efficiency (sold vs available){'\n'}
              • <Text style={{ fontWeight: 'bold' }}>Inner:</Text> Progress toward daily target
            </Text>
          </View>

          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>📤 Export & Backup</Text>
            
            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Export Options</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              • <Text style={{ fontWeight: 'bold' }}>PDF Reports:</Text> Daily, Weekly, Monthly, or Entire with efficiency bars{'\n'}
              • <Text style={{ fontWeight: 'bold' }}>JSON Export:</Text> Structured data for backup{'\n'}
              • <Text style={{ fontWeight: 'bold' }}>CSV Export:</Text> Spreadsheet-compatible
            </Text>
            
            <Text style={[styles.subsectionTitle, { color: theme.text }]}>PDF Report Contents</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              • Your name and date range{'\n'}
              • Job details with WIP, reg, VHC, hours{'\n'}
              • Day, week, and month totals{'\n'}
              • Efficiency progress bars{'\n'}
              • Professional formatting
            </Text>
            
            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Import & Backup</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              • Import jobs from JSON files{'\n'}
              • Create full app backups{'\n'}
              • Restore from backup files{'\n'}
              • Share to cloud storage
            </Text>
          </View>

          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>🔔 Notifications</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              Customize notifications in Settings → Notification Settings:
            </Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              • <Text style={{ fontWeight: 'bold' }}>Daily Reminder:</Text> Set time for daily job logging reminder{'\n'}
              • <Text style={{ fontWeight: 'bold' }}>Weekly Report:</Text> Choose day for weekly summary{'\n'}
              • <Text style={{ fontWeight: 'bold' }}>Monthly Report:</Text> End-of-month statistics{'\n'}
              • <Text style={{ fontWeight: 'bold' }}>Target Reminder:</Text> Alerts when approaching target{'\n'}
              • <Text style={{ fontWeight: 'bold' }}>Efficiency Alert:</Text> Notifies when below threshold
            </Text>
          </View>

          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>🔒 Privacy & Security</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              • All data stored locally on your device{'\n'}
              • No internet connection required{'\n'}
              • No data sent to external servers{'\n'}
              • GDPR compliant - only vehicle regs and job data{'\n'}
              • PIN and biometric protection{'\n'}
              • Automatic lock on resume{'\n'}
              • No customer personal information stored
            </Text>
          </View>

          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>💡 Tips & Best Practices</Text>
            
            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Daily Workflow</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              1. Check dashboard at start of day{'\n'}
              2. Log jobs as you complete them{'\n'}
              3. Use autocomplete for repeat jobs{'\n'}
              4. Review efficiency at end of day{'\n'}
              5. Check weekly stats every Monday{'\n'}
              6. Export monthly reports for records
            </Text>
            
            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Maximizing Efficiency</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              • Log jobs immediately after completion{'\n'}
              • Use accurate AW values{'\n'}
              • Review efficiency trends weekly{'\n'}
              • Adjust work schedule if patterns change{'\n'}
              • Set realistic monthly targets{'\n'}
              • Use VHC color buttons for speed{'\n'}
              • Attach job card photos for reference
            </Text>
            
            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Data Management</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              • Create weekly backups{'\n'}
              • Save backups to cloud storage{'\n'}
              • Export monthly PDF reports{'\n'}
              • Use search to find specific jobs{'\n'}
              • Keep multiple backup versions
            </Text>
          </View>

          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>❓ Troubleshooting</Text>
            
            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Forgot PIN</Text>
            <View style={[styles.warningBox, { backgroundColor: theme.background, borderLeftColor: '#ff9800' }]}>
              <Text style={[styles.text, { color: theme.textSecondary }]}>
                If you forget your PIN, you'll need to reinstall the app and lose all data. Create regular backups to prevent data loss!
              </Text>
            </View>
            
            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Efficiency Seems Wrong</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              • Check work schedule settings{'\n'}
              • Verify working days are correct{'\n'}
              • Ensure start/end times are accurate{'\n'}
              • Check lunch break duration{'\n'}
              • Verify Saturday frequency setting
            </Text>
            
            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Biometrics Not Working</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              • Ensure biometrics are enrolled on device{'\n'}
              • Check app permissions in device settings{'\n'}
              • Try disabling and re-enabling in app settings{'\n'}
              • Use PIN as fallback
            </Text>
            
            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Export Not Working</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              • Check storage permissions{'\n'}
              • Ensure sufficient storage space{'\n'}
              • Try exporting smaller date ranges{'\n'}
              • Restart the app and try again
            </Text>
          </View>

          <View style={[styles.footer, { backgroundColor: theme.card }]}>
            <Text style={[styles.footerTitle, { color: theme.text }]}>📞 Support & Information</Text>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              TechTimes is designed to be intuitive and self-contained. All features work offline without requiring external support.
            </Text>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              {'\n'}Self-Help Resources:{'\n'}
              ✅ This comprehensive guide (export as PDF){'\n'}
              ✅ In-app hints and tooltips{'\n'}
              ✅ Settings descriptions{'\n'}
              ✅ Formula explanations
            </Text>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              {'\n'}TechTimes v1.0.0{'\n'}
              © 2024 TechTimes. All rights reserved.{'\n'}
              Secure Personal Job Tracking for Vehicle Technicians
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
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 14,
  },
  subsectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 10,
  },
  text: {
    fontSize: 14,
    lineHeight: 24,
    marginBottom: 10,
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
    marginBottom: 12,
  },
  footer: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  footerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  footerText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
