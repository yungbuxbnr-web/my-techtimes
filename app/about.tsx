
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
  console.log('AboutScreen: Rendering about page');
  const { theme } = useThemeContext();
  const router = useRouter();
  const [exporting, setExporting] = useState(false);

  const handleExportToPDF = async () => {
    console.log('AboutScreen: Exporting about info to PDF');
    setExporting(true);
    
    try {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              padding: 20px;
              line-height: 1.6;
              color: #333;
            }
            h1 {
              color: #ff6b35;
              border-bottom: 3px solid #ff6b35;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            h2 {
              color: #ff6b35;
              margin-top: 30px;
              margin-bottom: 15px;
            }
            h3 {
              color: #555;
              margin-top: 20px;
              margin-bottom: 10px;
            }
            p {
              margin-bottom: 12px;
            }
            ul {
              margin-left: 20px;
              margin-bottom: 15px;
            }
            li {
              margin-bottom: 8px;
            }
            .section {
              margin-bottom: 30px;
            }
            .highlight {
              background-color: #fff3e0;
              padding: 15px;
              border-left: 4px solid #ff6b35;
              margin: 15px 0;
            }
            .formula {
              background-color: #f5f5f5;
              padding: 10px;
              border-radius: 5px;
              font-family: monospace;
              margin: 10px 0;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 2px solid #ddd;
              text-align: center;
              color: #888;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <h1>TechTimes - Complete User Guide</h1>
          <p><strong>Version:</strong> 1.0.0</p>
          <p><strong>Generated:</strong> ${new Date().toLocaleDateString('en-GB', { 
            day: '2-digit', 
            month: 'long', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</p>

          <div class="section">
            <h2>📱 About TechTimes</h2>
            <p>TechTimes is a secure, offline-first personal job tracking application designed specifically for vehicle technicians. Track your work hours, monitor efficiency, and manage your productivity—all while keeping your data private and secure on your device.</p>
            
            <div class="highlight">
              <strong>Key Features:</strong>
              <ul>
                <li>✅ Fully offline - all data stored locally on your device</li>
                <li>🔒 PIN and biometric security</li>
                <li>📊 Real-time efficiency tracking</li>
                <li>📅 Customizable work schedule</li>
                <li>📈 Comprehensive statistics and reports</li>
                <li>📤 Export to PDF, JSON, and CSV</li>
                <li>🔔 Smart notifications and reminders</li>
              </ul>
            </div>
          </div>

          <div class="section">
            <h2>🚀 Getting Started</h2>
            
            <h3>First-Time Setup</h3>
            <ol>
              <li><strong>Enter Your Name:</strong> Set your technician name for personalized reports</li>
              <li><strong>Create a PIN:</strong> Choose a 4-digit PIN to secure your data</li>
              <li><strong>Configure Work Schedule:</strong> Set your working days and hours</li>
              <li><strong>Set Monthly Target:</strong> Define your monthly hours target</li>
            </ol>

            <h3>Security Features</h3>
            <ul>
              <li><strong>PIN Protection:</strong> Your data is protected by a 4-digit PIN</li>
              <li><strong>Biometric Login:</strong> Use fingerprint or Face ID for quick access (optional)</li>
              <li><strong>Lock on Resume:</strong> Automatically lock the app when returning from background</li>
              <li><strong>Change PIN:</strong> Update your PIN anytime in Settings</li>
            </ul>
          </div>

          <div class="section">
            <h2>📝 Adding Jobs</h2>
            
            <h3>Job Entry Fields</h3>
            <ul>
              <li><strong>WIP Number:</strong> 5-digit work in progress number (required)</li>
              <li><strong>Vehicle Registration:</strong> Vehicle reg number (required, auto-uppercase)</li>
              <li><strong>AW Value:</strong> Allocated Work units from 0-100 (required)</li>
              <li><strong>Notes:</strong> Optional notes about the job</li>
              <li><strong>VHC Status:</strong> Vehicle Health Check status (GREEN/AMBER/RED/N/A)</li>
            </ul>

            <h3>Understanding AW (Allocated Work)</h3>
            <div class="formula">
              1 AW = 5 minutes = 0.0833 hours
            </div>
            <p>Example: A job with 12 AW = 12 × 5 = 60 minutes = 1 hour</p>

            <h3>Quick Tips</h3>
            <ul>
              <li>Jobs are automatically timestamped when saved</li>
              <li>Use "Save & Add Another" to quickly log multiple jobs</li>
              <li>Edit or delete jobs from the Jobs screen</li>
              <li>Search jobs by WIP number or vehicle registration</li>
            </ul>
          </div>

          <div class="section">
            <h2>⚙️ Work Schedule Configuration</h2>
            
            <h3>Customizing Your Schedule</h3>
            <p>Navigate to <strong>Settings → Edit Work Schedule</strong> to configure:</p>
            
            <ul>
              <li><strong>Working Days:</strong> Select which days you work (Mon-Sun)</li>
              <li><strong>Start Time:</strong> Your daily start time (24-hour format)</li>
              <li><strong>End Time:</strong> Your daily end time (24-hour format)</li>
              <li><strong>Lunch Break:</strong> Unpaid break time in minutes</li>
              <li><strong>Saturday Frequency:</strong> How often you work Saturdays
                <ul>
                  <li>None - No Saturday work</li>
                  <li>Every Saturday</li>
                  <li>1 in 2 - Every other Saturday</li>
                  <li>1 in 3 - Every third Saturday</li>
                  <li>1 in 4 - Every fourth Saturday</li>
                  <li>Custom - Pick specific Saturday dates</li>
                </ul>
              </li>
              <li><strong>Next Working Saturday:</strong> Set the date of your next working Saturday</li>
            </ul>

            <h3>How It Affects Calculations</h3>
            <p>Your work schedule directly impacts:</p>
            <ul>
              <li>Available hours calculation</li>
              <li>Efficiency percentage</li>
              <li>Monthly target tracking</li>
              <li>Calendar view working days</li>
            </ul>

            <div class="formula">
              Daily Working Hours = (End Time - Start Time) - Lunch Break
            </div>
          </div>

          <div class="section">
            <h2>📊 Understanding Efficiency</h2>
            
            <h3>Efficiency Calculation</h3>
            <div class="formula">
              Efficiency % = (Sold Hours ÷ Available Hours) × 100
            </div>

            <h3>Components Explained</h3>
            <ul>
              <li><strong>Sold Hours:</strong> Total hours from all jobs (AW × 5 minutes)</li>
              <li><strong>Available Hours:</strong> Working days × Daily working hours</li>
              <li><strong>Working Days:</strong> Only counts days you've configured as working days</li>
            </ul>

            <h3>Efficiency Ratings</h3>
            <ul>
              <li>🟢 <strong>90%+:</strong> Excellent - Green indicator</li>
              <li>🟡 <strong>75-89%:</strong> Good - Yellow indicator</li>
              <li>🔴 <strong>Below 75%:</strong> Needs improvement - Red indicator</li>
            </ul>

            <h3>Example Calculation</h3>
            <p>If you work Mon-Fri, 8.5 hours/day, and it's the 10th working day of the month:</p>
            <div class="formula">
              Available Hours = 10 days × 8.5 hours = 85 hours<br>
              Sold Hours = 840 AW × 5 minutes ÷ 60 = 70 hours<br>
              Efficiency = (70 ÷ 85) × 100 = 82.4%
            </div>
          </div>

          <div class="section">
            <h2>📈 Statistics & Reports</h2>
            
            <h3>Dashboard View</h3>
            <ul>
              <li><strong>Live Clock:</strong> Synced with device time</li>
              <li><strong>Monthly Target Ring:</strong> Progress toward monthly hours target</li>
              <li><strong>Efficiency Ring:</strong> Current month efficiency percentage</li>
              <li><strong>Today's Stats:</strong> Jobs and hours logged today</li>
              <li><strong>This Week:</strong> Weekly totals</li>
              <li><strong>Monthly Breakdown:</strong> Detailed monthly statistics</li>
            </ul>

            <h3>Time Stats Page</h3>
            <ul>
              <li><strong>Available Hours Timer:</strong> Counts total available hours as they increase (8am-5pm)</li>
              <li><strong>Time Elapsed:</strong> Hours worked so far today</li>
              <li><strong>Time Remaining:</strong> Hours left in the workday</li>
              <li><strong>Live Sync:</strong> All stats tick and count live, synced with the home page clock</li>
            </ul>

            <h3>Stats Screen</h3>
            <ul>
              <li>Period statistics (Today, Week, Month)</li>
              <li>All-time totals</li>
              <li>Recent jobs list</li>
              <li>Efficiency trends</li>
            </ul>
          </div>

          <div class="section">
            <h2>📅 Calendar View</h2>
            
            <h3>View Modes</h3>
            <ul>
              <li><strong>Day View:</strong> Detailed view of a single day with efficiency circles and job list</li>
              <li><strong>Week View:</strong> Swipeable week view with mini efficiency indicators</li>
              <li><strong>Month View:</strong> Full month calendar with efficiency circles on each day</li>
              <li><strong>Year View:</strong> Overview of all 12 months</li>
            </ul>

            <h3>Efficiency Circles</h3>
            <p>Each day shows two circles:</p>
            <ul>
              <li><strong>Outer Circle (Efficiency):</strong> Sold hours vs available hours for that day</li>
              <li><strong>Inner Circle (Progress):</strong> Progress toward daily target</li>
            </ul>

            <h3>Navigation</h3>
            <ul>
              <li>Use ← → arrows to navigate between periods</li>
              <li>Tap "Today" to jump to current date</li>
              <li>Tap any day to view detailed information</li>
              <li>Swipe left/right in week view</li>
            </ul>
          </div>

          <div class="section">
            <h2>📤 Export & Backup</h2>
            
            <h3>Export Options</h3>
            <ul>
              <li><strong>PDF Reports:</strong> Stylish formatted reports with groupings
                <ul>
                  <li>Daily: Single day with totals</li>
                  <li>Weekly: Week with day-by-day breakdown</li>
                  <li>Monthly: Full month with week and day totals</li>
                  <li>Entire: All jobs with complete groupings</li>
                </ul>
              </li>
              <li><strong>JSON Export:</strong> Structured data for backup or transfer</li>
              <li><strong>CSV Export:</strong> Spreadsheet-compatible format</li>
            </ul>

            <h3>PDF Report Contents</h3>
            <ul>
              <li>Your name and date range</li>
              <li>Job details: WIP number, vehicle reg, work done, hours</li>
              <li>Day totals</li>
              <li>Week totals (Monday-Saturday)</li>
              <li>Month totals</li>
              <li>Summary calculations</li>
            </ul>

            <h3>Import Jobs</h3>
            <ul>
              <li>Import jobs from JSON files</li>
              <li>Progress window shows each job being added</li>
              <li>Retains all original data and timestamps</li>
              <li>Duplicate detection</li>
            </ul>

            <h3>Backup & Restore</h3>
            <ul>
              <li><strong>Create Backup:</strong> Exports all app data (jobs, settings, schedule)</li>
              <li><strong>Restore Backup:</strong> Imports complete backup file</li>
              <li>Backup includes: jobs, schedule, profile, absences, settings</li>
              <li>Share backups to cloud storage or other devices</li>
            </ul>
          </div>

          <div class="section">
            <h2>🔔 Notifications</h2>
            
            <h3>Notification Settings</h3>
            <p>Customize which notifications you receive in <strong>Settings → Notification Settings</strong>:</p>
            
            <ul>
              <li><strong>Daily Reminder:</strong> Reminds you to log jobs at a set time</li>
              <li><strong>Weekly Report:</strong> Summary of your week's performance</li>
              <li><strong>Monthly Report:</strong> End-of-month statistics</li>
              <li><strong>Target Reminder:</strong> Alerts when approaching monthly target</li>
              <li><strong>Efficiency Alert:</strong> Notifies when efficiency drops below threshold</li>
            </ul>

            <h3>Configurable Options</h3>
            <ul>
              <li>Set daily reminder time (e.g., 8:00 AM)</li>
              <li>Choose weekly report day (e.g., Monday)</li>
              <li>Set low efficiency threshold (e.g., 75%)</li>
              <li>Enable/disable each notification type individually</li>
            </ul>
          </div>

          <div class="section">
            <h2>🎨 Appearance</h2>
            
            <h3>Theme Options</h3>
            <ul>
              <li><strong>Dark Workshop:</strong> Dark theme with automotive backgrounds</li>
              <li><strong>Light Workshop:</strong> Light theme with bright workshop images</li>
            </ul>

            <h3>Overlay Strength</h3>
            <p>Adjust the background overlay darkness for optimal readability:</p>
            <ul>
              <li>Slider from 0% (no overlay) to 60% (dark overlay)</li>
              <li>Default: 35% for dark mode, 15% for light mode</li>
              <li>Applies to all screens consistently</li>
            </ul>
          </div>

          <div class="section">
            <h2>🔒 Privacy & Security</h2>
            
            <h3>Data Storage</h3>
            <ul>
              <li>All data stored locally on your device</li>
              <li>No internet connection required</li>
              <li>No data sent to external servers</li>
              <li>GDPR compliant - only stores vehicle registrations and job data</li>
              <li>No customer personal information stored</li>
            </ul>

            <h3>Security Features</h3>
            <ul>
              <li>PIN-protected access</li>
              <li>Optional biometric authentication</li>
              <li>Automatic lock on app resume</li>
              <li>Secure storage for sensitive data</li>
            </ul>

            <h3>Permissions</h3>
            <ul>
              <li><strong>Notifications:</strong> For reminders and alerts</li>
              <li><strong>Storage:</strong> To save and export your data</li>
              <li><strong>Biometrics:</strong> For fingerprint/Face ID login (optional)</li>
            </ul>
          </div>

          <div class="section">
            <h2>💡 Tips & Best Practices</h2>
            
            <h3>Daily Workflow</h3>
            <ol>
              <li>Start your day by checking the dashboard</li>
              <li>Log jobs as you complete them</li>
              <li>Review efficiency at end of day</li>
              <li>Check weekly stats every Monday</li>
              <li>Export monthly reports for records</li>
            </ol>

            <h3>Maximizing Efficiency</h3>
            <ul>
              <li>Log jobs immediately after completion</li>
              <li>Use accurate AW values</li>
              <li>Review efficiency trends weekly</li>
              <li>Adjust work schedule if patterns change</li>
              <li>Set realistic monthly targets</li>
            </ul>

            <h3>Data Management</h3>
            <ul>
              <li>Create weekly backups</li>
              <li>Export monthly reports for records</li>
              <li>Use search to find specific jobs quickly</li>
              <li>Review and clean old data periodically</li>
            </ul>
          </div>

          <div class="section">
            <h2>❓ Troubleshooting</h2>
            
            <h3>Common Issues</h3>
            
            <h4>Forgot PIN</h4>
            <p>If you forget your PIN, you'll need to reinstall the app. Make sure to create regular backups!</p>

            <h4>Efficiency Seems Wrong</h4>
            <ul>
              <li>Check your work schedule settings</li>
              <li>Verify working days are correct</li>
              <li>Ensure start/end times are accurate</li>
              <li>Check for any absences that should be logged</li>
            </ul>

            <h4>Biometrics Not Working</h4>
            <ul>
              <li>Ensure biometrics are enrolled on your device</li>
              <li>Check app permissions in device settings</li>
              <li>Try disabling and re-enabling in app settings</li>
            </ul>

            <h4>Export Not Working</h4>
            <ul>
              <li>Check storage permissions</li>
              <li>Ensure sufficient storage space</li>
              <li>Try exporting smaller date ranges</li>
            </ul>
          </div>

          <div class="section">
            <h2>📞 Support</h2>
            <p>TechTimes is designed to be intuitive and self-contained. All features work offline without requiring external support.</p>
            
            <h3>Self-Help Resources</h3>
            <ul>
              <li>This comprehensive guide (export as PDF for reference)</li>
              <li>In-app hints and tooltips</li>
              <li>Settings descriptions</li>
            </ul>
          </div>

          <div class="footer">
            <p><strong>TechTimes v1.0.0</strong></p>
            <p>Secure Personal Job Tracking for Vehicle Technicians</p>
            <p>© 2024 TechTimes. All rights reserved.</p>
            <p>This document was generated from the TechTimes app.</p>
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      
      const fileName = `TechTimes_User_Guide_${new Date().toISOString().split('T')[0]}.pdf`;
      const newUri = FileSystem.documentDirectory + fileName;
      
      await FileSystem.moveAsync({
        from: uri,
        to: newUri,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(newUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share TechTimes User Guide',
        });
      }

      Alert.alert('Success', 'User guide exported as PDF');
    } catch (error) {
      console.error('AboutScreen: Error exporting PDF:', error);
      Alert.alert('Error', 'Failed to export user guide');
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
              size={48}
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
              size={20}
              color="#fff"
            />
            <Text style={styles.exportButtonText}>
              {exporting ? 'Exporting...' : 'Export Full Guide as PDF'}
            </Text>
          </TouchableOpacity>

          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>📱 About</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              TechTimes is a secure, offline-first personal job tracking application designed specifically for vehicle technicians. Track your work hours, monitor efficiency, and manage your productivity—all while keeping your data private and secure on your device.
            </Text>
          </View>

          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>✨ Key Features</Text>
            <View style={styles.featureList}>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>✅ Fully offline - all data stored locally</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>🔒 PIN and biometric security</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>📊 Real-time efficiency tracking</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>📅 Customizable work schedule with Saturday frequency</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>📈 Comprehensive statistics and live timers</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>📤 Export to PDF, JSON, and CSV</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>🔔 Customizable notifications</Text>
              <Text style={[styles.feature, { color: theme.textSecondary }]}>📆 Calendar view with efficiency circles</Text>
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>🚀 Quick Start Guide</Text>
            <Text style={[styles.subsectionTitle, { color: theme.text }]}>1. First-Time Setup</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              • Enter your technician name{'\n'}
              • Create a 4-digit PIN{'\n'}
              • Configure your work schedule{'\n'}
              • Set your monthly target hours
            </Text>

            <Text style={[styles.subsectionTitle, { color: theme.text }]}>2. Adding Jobs</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              • WIP Number: 5-digit work in progress number{'\n'}
              • Vehicle Reg: Vehicle registration (auto-uppercase){'\n'}
              • AW Value: Allocated Work units (0-100){'\n'}
              • Notes: Optional job notes{'\n'}
              • VHC Status: Vehicle Health Check status
            </Text>

            <Text style={[styles.subsectionTitle, { color: theme.text }]}>3. Understanding AW</Text>
            <Text style={[styles.formula, { color: theme.text, backgroundColor: theme.background }]}>
              1 AW = 5 minutes = 0.0833 hours
            </Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              Example: 12 AW = 60 minutes = 1 hour
            </Text>
          </View>

          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>⚙️ Work Schedule</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              Navigate to Settings → Edit Work Schedule to configure:
            </Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              • <Text style={{ fontWeight: 'bold' }}>Working Days:</Text> Select which days you work{'\n'}
              • <Text style={{ fontWeight: 'bold' }}>Start/End Time:</Text> Your daily hours{'\n'}
              • <Text style={{ fontWeight: 'bold' }}>Lunch Break:</Text> Unpaid break time{'\n'}
              • <Text style={{ fontWeight: 'bold' }}>Saturday Frequency:</Text> None, Every, 1-in-2, 1-in-3, 1-in-4, or Custom{'\n'}
              • <Text style={{ fontWeight: 'bold' }}>Next Working Saturday:</Text> Set the date of your next working Saturday
            </Text>
          </View>

          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>📊 Efficiency Calculation</Text>
            <Text style={[styles.formula, { color: theme.text, backgroundColor: theme.background }]}>
              Efficiency % = (Sold Hours ÷ Available Hours) × 100
            </Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              • <Text style={{ fontWeight: 'bold' }}>Sold Hours:</Text> Total hours from all jobs{'\n'}
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
              • <Text style={{ fontWeight: 'bold' }}>Day View:</Text> Detailed single day with efficiency circles{'\n'}
              • <Text style={{ fontWeight: 'bold' }}>Week View:</Text> Swipeable week with mini indicators{'\n'}
              • <Text style={{ fontWeight: 'bold' }}>Month View:</Text> Full calendar with efficiency circles{'\n'}
              • <Text style={{ fontWeight: 'bold' }}>Year View:</Text> Overview of all 12 months
            </Text>
            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Efficiency Circles</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              Each day shows two circles:{'\n'}
              • Outer: Efficiency (sold vs available){'\n'}
              • Inner: Progress toward daily target
            </Text>
          </View>

          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>📤 Export & Backup</Text>
            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Export Options</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              • <Text style={{ fontWeight: 'bold' }}>PDF Reports:</Text> Daily, Weekly, Monthly, or Entire{'\n'}
              • <Text style={{ fontWeight: 'bold' }}>JSON Export:</Text> Structured data for backup{'\n'}
              • <Text style={{ fontWeight: 'bold' }}>CSV Export:</Text> Spreadsheet-compatible
            </Text>
            <Text style={[styles.subsectionTitle, { color: theme.text }]}>PDF Report Contents</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              • Your name and date range{'\n'}
              • Job details with WIP, reg, hours{'\n'}
              • Day, week, and month totals{'\n'}
              • Summary calculations
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
              • <Text style={{ fontWeight: 'bold' }}>Monthly Report:</strong> End-of-month statistics{'\n'}
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
              • GDPR compliant{'\n'}
              • PIN and biometric protection{'\n'}
              • Automatic lock on resume
            </Text>
          </View>

          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>💡 Tips & Best Practices</Text>
            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Daily Workflow</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              1. Check dashboard at start of day{'\n'}
              2. Log jobs as you complete them{'\n'}
              3. Review efficiency at end of day{'\n'}
              4. Check weekly stats every Monday{'\n'}
              5. Export monthly reports for records
            </Text>
            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Maximizing Efficiency</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              • Log jobs immediately after completion{'\n'}
              • Use accurate AW values{'\n'}
              • Review efficiency trends weekly{'\n'}
              • Adjust work schedule if patterns change{'\n'}
              • Set realistic monthly targets
            </Text>
          </View>

          <View style={[styles.footer, { backgroundColor: theme.card }]}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              TechTimes v1.0.0{'\n'}
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
    padding: 24,
    borderRadius: 16,
    marginBottom: 20,
  },
  appName: {
    fontSize: 32,
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
    marginTop: 8,
    fontStyle: 'italic',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
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
    marginBottom: 12,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  featureList: {
    gap: 8,
  },
  feature: {
    fontSize: 14,
    lineHeight: 22,
  },
  formula: {
    padding: 12,
    borderRadius: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 13,
    marginVertical: 8,
  },
  footer: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
