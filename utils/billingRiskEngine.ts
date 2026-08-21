
import { Job } from './offlineStorage';
import { BillingRecord } from './billingStorage';
import { normaliseBillingStatus, awToHours } from './billingEngine';

export type RiskLevel = 'none' | 'low' | 'medium' | 'high';

export interface BillingRisk {
  riskLevel: RiskLevel;
  reasons: string[];
  ageDays: number;
}

export function getBillingRiskForJob(
  job: Job,
  billingRecord: BillingRecord | null,
  now: Date
): BillingRisk {
  const reasons: string[] = [];
  const jobDate = new Date(job.createdAt);
  const ageDays = Math.floor((now.getTime() - jobDate.getTime()) / (1000 * 60 * 60 * 24));
  const hours = awToHours(job.aw ?? 0);
  const status = billingRecord ? normaliseBillingStatus(billingRecord.billingStatus) : null;

  // Missing billing record
  if (!billingRecord) {
    reasons.push('No billing record linked to this job');
  }

  // Open job checks
  if (status === 'open' || !billingRecord) {
    if (hours >= 3) reasons.push(`${hours.toFixed(1)}h recorded but job is still Open`);
    if (ageDays >= 8) reasons.push(`Job has been Open for ${ageDays} days`);
    else if (ageDays >= 4) reasons.push(`Job has been Open for ${ageDays} days`);
    else if (ageDays >= 2) reasons.push(`Job open since yesterday`);
  }

  // Zero billed snapshot on positive recorded hours
  if (billingRecord && status === 'billed') {
    if ((billingRecord.billedHours ?? 0) === 0 && hours > 0) {
      reasons.push(`Billed snapshot shows 0h but job has ${hours.toFixed(1)}h recorded`);
    }
    if ((billingRecord.billedAW ?? 0) === 0 && (job.aw ?? 0) > 0) {
      reasons.push(`Billed snapshot shows 0 AW but job has ${job.aw} AW recorded`);
    }
  }

  // Recorded/billed discrepancy (billed job edited after billing)
  if (billingRecord && status === 'billed') {
    const diff = hours - (billingRecord.billedHours ?? 0);
    if (Math.abs(diff) > 0.1) {
      reasons.push(`Billing difference: ${diff > 0 ? '+' : ''}${diff.toFixed(1)}h (recorded vs billed snapshot)`);
    }
  }

  // Reopened billed job (has billing history but currently open)
  if (billingRecord && status === 'open' && (billingRecord.billedHours ?? 0) > 0) {
    reasons.push('Job was previously billed but has been reopened');
  }

  // Determine risk level
  let riskLevel: RiskLevel = 'none';
  if (reasons.length > 0) {
    if (!billingRecord || ageDays >= 8 || (status === 'open' && hours >= 5)) {
      riskLevel = 'high';
    } else if (ageDays >= 4 || (status === 'open' && hours >= 3)) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }
  }

  return { riskLevel, reasons, ageDays };
}

export function getRiskColour(
  level: RiskLevel,
  theme: {
    chartGreen: string;
    chartYellow: string;
    chartRed: string;
    primary: string;
    textSecondary: string;
  }
): string {
  switch (level) {
    case 'high': return theme.chartRed;
    case 'medium': return theme.chartYellow;
    case 'low': return theme.primary;
    default: return theme.textSecondary;
  }
}

export function getRiskLabel(level: RiskLevel): string {
  switch (level) {
    case 'high': return 'High Risk';
    case 'medium': return 'Attention';
    case 'low': return 'Low Risk';
    default: return '';
  }
}
