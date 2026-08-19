
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { api, Job } from '@/utils/api';
import { billingStorage, BillingRecord } from '@/utils/billingStorage';

type Severity = 'error' | 'warning';

interface Issue {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  recommendation: string;
  jobId?: string;
  wipNumber?: string;
}

interface ScanResult {
  errors: Issue[];
  warnings: Issue[];
  scannedAt: string;
}

function runScan(jobs: Job[], billing: BillingRecord[]): ScanResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const billingByJobId = new Map<string, BillingRecord>();
  billing.forEach(r => billingByJobId.set(r.jobId, r));
  const jobIds = new Set(jobs.map(j => j.id));

  // Missing billing links
  jobs.forEach(j => {
    if (!billingByJobId.has(j.id)) {
      warnings.push({
        id: `no-billing-${j.id}`,
        severity: 'warning',
        title: 'Missing Billing Link',
        description: `WIP ${j.wipNumber} (${j.vehicleReg}) has no billing record.`,
        recommendation: 'Open the billing tab and create a billing record for this job.',
        jobId: j.id,
        wipNumber: j.wipNumber,
      });
    }
  });

  // Orphan billing records
  billing.forEach(r => {
    if (!jobIds.has(r.jobId)) {
      errors.push({
        id: `orphan-${r.id}`,
        severity: 'error',
        title: 'Orphan Billing Record',
        description: `Billing record for job ID ${r.jobId} (WIP: ${r.wipNumber || 'unknown'}) has no matching job.`,
        recommendation: 'This billing record references a deleted job. Review and remove if no longer needed.',
        wipNumber: r.wipNumber,
      });
    }
  });

  // Post-billing edits
  jobs.forEach(j => {
    const br = billingByJobId.get(j.id);
    if (br && br.billingStatus === 'billed' && br.billedAW !== j.aw) {
      errors.push({
        id: `post-edit-${j.id}`,
        severity: 'error',
        title: 'Post-Billing Edit Detected',
        description: `WIP ${j.wipNumber}: billed at ${br.billedAW} AW but job now shows ${j.aw} AW.`,
        recommendation: 'Review and adjust the billing record to match the current job AW.',
        jobId: j.id,
        wipNumber: j.wipNumber,
      });
    }
  });

  // Missing WIP
  jobs.forEach(j => {
    if (!j.wipNumber || !j.wipNumber.trim()) {
      warnings.push({
        id: `no-wip-${j.id}`,
        severity: 'warning',
        title: 'Missing WIP Number',
        description: `A job created on ${j.createdAt.split('T')[0]} has no WIP number.`,
        recommendation: 'Edit the job and add a WIP number for proper tracking.',
        jobId: j.id,
        wipNumber: j.wipNumber,
      });
    }
  });

  // Missing registration
  jobs.forEach(j => {
    if (!j.vehicleReg || !j.vehicleReg.trim()) {
      warnings.push({
        id: `no-reg-${j.id}`,
        severity: 'warning',
        title: 'Missing Vehicle Registration',
        description: `WIP ${j.wipNumber || 'unknown'} has no vehicle registration.`,
        recommendation: 'Edit the job and add the vehicle registration.',
        jobId: j.id,
        wipNumber: j.wipNumber,
      });
    }
  });

  // Invalid AW
  jobs.forEach(j => {
    if (j.aw <= 0) {
      errors.push({
        id: `invalid-aw-${j.id}`,
        severity: 'error',
        title: 'Invalid AW Value',
        description: `WIP ${j.wipNumber} has AW of ${j.aw} which is ≤ 0.`,
        recommendation: 'Edit the job and set a valid AW value.',
        jobId: j.id,
        wipNumber: j.wipNumber,
      });
    }
  });

  // Duplicate WIPs
  const wipCounts = new Map<string, Job[]>();
  jobs.forEach(j => {
    if (!j.wipNumber?.trim()) return;
    const key = j.wipNumber.trim().toUpperCase();
    if (!wipCounts.has(key)) wipCounts.set(key, []);
    wipCounts.get(key)!.push(j);
  });
  wipCounts.forEach((dupes, wip) => {
    if (dupes.length > 1) {
      warnings.push({
        id: `dup-wip-${wip}`,
        severity: 'warning',
        title: 'Duplicate WIP Number',
        description: `WIP ${wip} appears ${dupes.length} times across different jobs.`,
        recommendation: 'Review these jobs and ensure each WIP number is unique.',
        wipNumber: wip,
      });
    }
  });

  return { errors, warnings, scannedAt: new Date().toISOString() };
}

export default function DataQualityScreen() {
  console.log('DataQualityScreen: Rendering');
  const { theme } = useThemeContext();
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [expandedSection, setExpandedSection] = useState<'errors' | 'warnings' | null>('errors');

  const PT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 16;

  const handleScan = useCallback(async () => {
    console.log('DataQualityScreen: Starting scan');
    setScanning(true);
    try {
      const [jobs, billing] = await Promise.all([api.getAllJobs(), billingStorage.getAllRecords()]);
      console.log('DataQualityScreen: Scanning', jobs.length, 'jobs and', billing.length, 'billing records');
      const result = runScan(jobs, billing);
      console.log('DataQualityScreen: Scan complete —', result.errors.length, 'errors,', result.warnings.length, 'warnings');
      setScanResult(result);
    } finally {
      setScanning(false);
    }
  }, []);

  const handleReview = (issue: Issue) => {
    console.log('DataQualityScreen: Review pressed for issue', issue.id, issue.title);
    if (issue.jobId) {
      router.push({
        pathname: '/add-job-modal',
        params: { editId: issue.jobId },
      });
    }
  };

  return (
    <AppBackground>
      <View style={[styles.header, { paddingTop: PT }]}>
        <TouchableOpacity
          onPress={() => {
            console.log('DataQualityScreen: Back button pressed');
            router.back();
          }}
          style={styles.iconBtn}
        >
          <IconSymbol
            ios_icon_name="chevron.left"
            android_material_icon_name="chevron-left"
            size={24}
            color={theme.primary}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Data Quality</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!scanResult && !scanning ? (
          <View style={styles.preScan}>
            <View style={[styles.preScanIcon, { backgroundColor: theme.card }]}>
              <IconSymbol
                ios_icon_name="magnifyingglass.circle"
                android_material_icon_name="search"
                size={48}
                color={theme.primary}
              />
            </View>
            <Text style={[styles.preScanTitle, { color: theme.text }]}>Data Quality Scanner</Text>
            <Text style={[styles.preScanDesc, { color: theme.textSecondary }]}>
              Scan your jobs and billing records for missing data, orphan records, post-billing edits, and duplicate WIP numbers.
            </Text>
            <TouchableOpacity
              style={[styles.scanBtn, { backgroundColor: theme.primary }]}
              onPress={handleScan}
            >
              <Text style={styles.scanBtnText}>Run Scan</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {scanning ? (
          <View style={styles.preScan}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.preScanDesc, { color: theme.textSecondary, marginTop: 16 }]}>
              Scanning data...
            </Text>
          </View>
        ) : null}

        {scanResult && !scanning ? (
          <>
            <View style={[styles.summaryRow, { backgroundColor: theme.card }]}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryCount, { color: theme.chartRed }]}>
                  {scanResult.errors.length}
                </Text>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Errors</Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryCount, { color: theme.chartYellow }]}>
                  {scanResult.warnings.length}
                </Text>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Warnings</Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryCount, { color: scanResult.errors.length === 0 && scanResult.warnings.length === 0 ? theme.chartGreen : theme.text }]}>
                  {scanResult.errors.length === 0 && scanResult.warnings.length === 0 ? '✓' : '!'}
                </Text>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Status</Text>
              </View>
            </View>

            <Text style={[styles.scannedAt, { color: theme.textSecondary }]}>
              Scanned: {scanResult.scannedAt.replace('T', ' ').split('.')[0]}
            </Text>

            {(['errors', 'warnings'] as const).map(section => {
              const items = scanResult[section];
              const isExpanded = expandedSection === section;
              const sectionColor = section === 'errors' ? theme.chartRed : theme.chartYellow;
              const sectionLabel = section === 'errors' ? 'Errors' : 'Warnings';
              return (
                <View key={section} style={{ marginBottom: 12 }}>
                  <TouchableOpacity
                    style={[styles.sectionHeader, { backgroundColor: theme.card, borderColor: theme.border }]}
                    onPress={() => {
                      console.log('DataQualityScreen: Toggle section', section);
                      setExpandedSection(isExpanded ? null : section);
                    }}
                  >
                    <View style={[styles.sectionDot, { backgroundColor: sectionColor }]} />
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                      {sectionLabel}
                    </Text>
                    <View style={[styles.sectionBadge, { backgroundColor: sectionColor }]}>
                      <Text style={styles.sectionBadgeText}>{items.length}</Text>
                    </View>
                    <IconSymbol
                      ios_icon_name={isExpanded ? 'chevron.up' : 'chevron.down'}
                      android_material_icon_name={isExpanded ? 'expand-less' : 'expand-more'}
                      size={16}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                  {isExpanded ? (
                    items.length === 0 ? (
                      <View style={[styles.issueCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <Text style={[{ fontSize: 14 }, { color: theme.chartGreen }]}>
                          No {sectionLabel.toLowerCase()} found.
                        </Text>
                      </View>
                    ) : (
                      items.map(issue => (
                        <View
                          key={issue.id}
                          style={[styles.issueCard, { backgroundColor: theme.card, borderColor: theme.border, borderLeftColor: sectionColor }]}
                        >
                          <Text style={[styles.issueTitle, { color: theme.text }]}>{issue.title}</Text>
                          <Text style={[styles.issueDesc, { color: theme.textSecondary }]}>{issue.description}</Text>
                          <Text style={[styles.issueRec, { color: theme.primary }]}>{issue.recommendation}</Text>
                          {issue.jobId ? (
                            <TouchableOpacity
                              style={[styles.reviewBtn, { borderColor: theme.primary }]}
                              onPress={() => handleReview(issue)}
                            >
                              <Text style={[styles.reviewBtnText, { color: theme.primary }]}>Review Job</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      ))
                    )
                  ) : null}
                </View>
              );
            })}

            <TouchableOpacity
              style={[styles.scanBtn, { backgroundColor: theme.primary, marginTop: 8 }]}
              onPress={handleScan}
            >
              <Text style={styles.scanBtnText}>Re-scan</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 100 },
  preScan: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  preScanIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  preScanTitle: { fontSize: 22, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  preScanDesc: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  scanBtn: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, alignItems: 'center' },
  scanBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  summaryRow: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    alignItems: 'center',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryCount: { fontSize: 28, fontWeight: '700' },
  summaryLabel: { fontSize: 12, marginTop: 2 },
  summaryDivider: { width: 1, height: 40 },
  scannedAt: { fontSize: 12, marginBottom: 16, textAlign: 'center' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  sectionBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  sectionBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  issueCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 12,
    marginTop: 6,
  },
  issueTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  issueDesc: { fontSize: 13, marginBottom: 4 },
  issueRec: { fontSize: 12, marginBottom: 8 },
  reviewBtn: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  reviewBtnText: { fontSize: 13, fontWeight: '600' },
});
