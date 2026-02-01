
import { Job } from './api';
import { validateWipNumber, validateAW } from './jobCalculations';

/**
 * AI-Powered Input Brain
 * Intelligently processes, validates, and suggests corrections for user input
 */

export interface ProcessedInput {
  wipNumber?: string;
  vehicleReg?: string;
  aw?: number;
  notes?: string;
  vhcStatus?: 'NONE' | 'GREEN' | 'ORANGE' | 'RED';
  confidence: number;
  suggestions?: string[];
  needsClarification?: boolean;
  clarificationQuestion?: string;
  corrections?: InputCorrection[];
}

export interface InputCorrection {
  field: string;
  original: string;
  suggestion: string;
  reason: string;
  confidence: number;
}

export interface SmartSuggestion {
  value: string;
  context: string;
  confidence: number;
  usageCount: number;
}

/**
 * Process natural language input and extract job data
 * Examples:
 * - "12345 ABC123 20 AW green vhc"
 * - "WIP 54321 reg XYZ789 15 hours"
 * - "Job 11111 for ABC456 took 25 AW, orange VHC"
 */
export function processNaturalLanguageInput(
  input: string,
  recentJobs: Job[] = []
): ProcessedInput {
  console.log('InputBrain: Processing natural language input:', input);
  
  const result: ProcessedInput = {
    confidence: 0,
    suggestions: [],
  };

  // Normalize input
  const normalizedInput = input.toUpperCase().trim();
  
  // Extract WIP number (5 digits)
  const wipMatch = normalizedInput.match(/\b(\d{5})\b/);
  if (wipMatch) {
    result.wipNumber = wipMatch[1];
    result.confidence += 0.25;
    console.log('InputBrain: Extracted WIP:', result.wipNumber);
  }

  // Extract vehicle registration (common UK patterns)
  // Patterns: ABC123, AB12CDE, A123BCD, etc.
  const regPatterns = [
    /\b([A-Z]{2}\d{2}\s?[A-Z]{3})\b/, // AB12 CDE
    /\b([A-Z]\d{1,3}\s?[A-Z]{3})\b/,  // A123 BCD
    /\b([A-Z]{3}\s?\d{1,4}[A-Z]?)\b/, // ABC 123 or ABC123D
    /\b([A-Z]{2,3}\d{2,4})\b/,         // ABC123 or AB1234
  ];

  for (const pattern of regPatterns) {
    const regMatch = normalizedInput.match(pattern);
    if (regMatch) {
      result.vehicleReg = regMatch[1].replace(/\s/g, '');
      result.confidence += 0.25;
      console.log('InputBrain: Extracted registration:', result.vehicleReg);
      break;
    }
  }

  // Extract AW value
  const awPatterns = [
    /(\d{1,3})\s*AW/i,           // "20 AW"
    /AW\s*(\d{1,3})/i,           // "AW 20"
    /(\d{1,3})\s*HOURS?/i,       // "20 hours"
    /HOURS?\s*(\d{1,3})/i,       // "hours 20"
  ];

  for (const pattern of awPatterns) {
    const awMatch = input.match(pattern);
    if (awMatch) {
      const awValue = parseInt(awMatch[1], 10);
      if (validateAW(awValue)) {
        result.aw = awValue;
        result.confidence += 0.25;
        console.log('InputBrain: Extracted AW:', result.aw);
        break;
      }
    }
  }

  // Extract VHC status
  if (/GREEN|PASS/i.test(input)) {
    result.vhcStatus = 'GREEN';
    result.confidence += 0.1;
    console.log('InputBrain: Extracted VHC: GREEN');
  } else if (/ORANGE|AMBER|ADVISORY/i.test(input)) {
    result.vhcStatus = 'ORANGE';
    result.confidence += 0.1;
    console.log('InputBrain: Extracted VHC: ORANGE');
  } else if (/RED|FAIL|DANGEROUS/i.test(input)) {
    result.vhcStatus = 'RED';
    result.confidence += 0.1;
    console.log('InputBrain: Extracted VHC: RED');
  }

  // Extract notes (everything that's not WIP, reg, AW, or VHC)
  let notes = input;
  if (result.wipNumber) {
    notes = notes.replace(result.wipNumber, '');
  }
  if (result.vehicleReg) {
    notes = notes.replace(new RegExp(result.vehicleReg, 'gi'), '');
  }
  if (result.aw) {
    notes = notes.replace(new RegExp(`${result.aw}\\s*(AW|hours?)`, 'gi'), '');
  }
  if (result.vhcStatus) {
    notes = notes.replace(new RegExp(result.vhcStatus, 'gi'), '');
  }
  
  notes = notes.replace(/WIP|REG|VHC/gi, '').trim();
  if (notes.length > 3) {
    result.notes = notes;
    console.log('InputBrain: Extracted notes:', result.notes);
  }

  // Generate suggestions based on confidence
  if (result.confidence < 0.5) {
    result.needsClarification = true;
    
    if (!result.wipNumber) {
      result.clarificationQuestion = 'Could not find a 5-digit WIP number. Please provide the WIP number.';
    } else if (!result.vehicleReg) {
      result.clarificationQuestion = 'Could not find a vehicle registration. Please provide the registration.';
    } else if (result.aw === undefined) {
      result.clarificationQuestion = 'Could not find AW value. Please specify the hours (e.g., "20 AW").';
    }
  }

  // Provide smart suggestions based on recent jobs
  if (result.wipNumber && !result.vehicleReg) {
    const matchingJob = recentJobs.find(j => j.wipNumber === result.wipNumber);
    if (matchingJob) {
      result.suggestions?.push(`Did you mean ${matchingJob.vehicleReg}? (Previously used with WIP ${result.wipNumber})`);
      result.vehicleReg = matchingJob.vehicleReg;
      result.confidence += 0.15;
    }
  }

  if (result.vehicleReg && !result.wipNumber) {
    const matchingJob = recentJobs.find(j => j.vehicleReg.toUpperCase() === result.vehicleReg?.toUpperCase());
    if (matchingJob) {
      result.suggestions?.push(`Did you mean WIP ${matchingJob.wipNumber}? (Previously used with ${result.vehicleReg})`);
    }
  }

  console.log('InputBrain: Processing complete. Confidence:', result.confidence);
  return result;
}

/**
 * Validate and suggest corrections for input fields
 */
export function validateAndCorrect(
  wipNumber?: string,
  vehicleReg?: string,
  aw?: number,
  recentJobs: Job[] = []
): InputCorrection[] {
  console.log('InputBrain: Validating input - WIP:', wipNumber, 'Reg:', vehicleReg, 'AW:', aw);
  
  const corrections: InputCorrection[] = [];

  // Validate WIP number
  if (wipNumber) {
    if (!validateWipNumber(wipNumber)) {
      // Check if it's close to a valid WIP (e.g., 4 or 6 digits)
      if (/^\d{4}$/.test(wipNumber)) {
        corrections.push({
          field: 'wipNumber',
          original: wipNumber,
          suggestion: '0' + wipNumber,
          reason: 'WIP number should be 5 digits. Added leading zero.',
          confidence: 0.8,
        });
      } else if (/^\d{6}$/.test(wipNumber)) {
        corrections.push({
          field: 'wipNumber',
          original: wipNumber,
          suggestion: wipNumber.substring(1),
          reason: 'WIP number should be 5 digits. Removed extra digit.',
          confidence: 0.7,
        });
      } else {
        corrections.push({
          field: 'wipNumber',
          original: wipNumber,
          suggestion: '',
          reason: 'WIP number must be exactly 5 digits.',
          confidence: 1.0,
        });
      }
    }
  }

  // Validate vehicle registration
  if (vehicleReg) {
    const cleanReg = vehicleReg.toUpperCase().replace(/\s/g, '');
    
    // Check for common typos (O vs 0, I vs 1, etc.)
    let correctedReg = cleanReg;
    let hasCorrectionthe = false;
    
    // Replace common OCR/typing errors
    const commonErrors: Record<string, string> = {
      'O': '0', // Letter O to number 0 in number positions
      'I': '1', // Letter I to number 1 in number positions
      'S': '5', // Letter S to number 5 in number positions
      'B': '8', // Letter B to number 8 in number positions
    };
    
    // Apply corrections intelligently based on UK reg patterns
    if (/^[A-Z]{2}\d/.test(cleanReg)) {
      // Format: AB12CDE - first 2 are letters, next 2 are numbers
      for (let i = 2; i < 4 && i < cleanReg.length; i++) {
        const char = cleanReg[i];
        if (commonErrors[char]) {
          correctedReg = correctedReg.substring(0, i) + commonErrors[char] + correctedReg.substring(i + 1);
          hasCorrectionthe = true;
        }
      }
    }
    
    if (hasCorrectionthe && correctedReg !== cleanReg) {
      corrections.push({
        field: 'vehicleReg',
        original: vehicleReg,
        suggestion: correctedReg,
        reason: 'Corrected common OCR/typing errors (O→0, I→1, etc.)',
        confidence: 0.75,
      });
    }
    
    // Check against recent jobs for similar registrations
    const similarRegs = recentJobs
      .map(j => j.vehicleReg.toUpperCase())
      .filter(reg => {
        const distance = levenshteinDistance(cleanReg, reg);
        return distance > 0 && distance <= 2; // 1-2 character difference
      });
    
    if (similarRegs.length > 0) {
      corrections.push({
        field: 'vehicleReg',
        original: vehicleReg,
        suggestion: similarRegs[0],
        reason: `Similar to recent registration: ${similarRegs[0]}`,
        confidence: 0.6,
      });
    }
  }

  // Validate AW
  if (aw !== undefined && !validateAW(aw)) {
    if (aw < 0) {
      corrections.push({
        field: 'aw',
        original: aw.toString(),
        suggestion: '0',
        reason: 'AW cannot be negative.',
        confidence: 1.0,
      });
    } else if (aw > 100) {
      // Check if user might have entered minutes instead of AW
      const possibleAW = Math.round(aw / 5);
      if (possibleAW <= 100) {
        corrections.push({
          field: 'aw',
          original: aw.toString(),
          suggestion: possibleAW.toString(),
          reason: `Did you mean ${possibleAW} AW? (${aw} minutes ÷ 5 = ${possibleAW} AW)`,
          confidence: 0.8,
        });
      } else {
        corrections.push({
          field: 'aw',
          original: aw.toString(),
          suggestion: '100',
          reason: 'AW cannot exceed 100. Capped at maximum.',
          confidence: 0.9,
        });
      }
    }
  }

  console.log('InputBrain: Found', corrections.length, 'corrections');
  return corrections;
}

/**
 * Generate smart autocomplete suggestions
 */
export function generateSmartSuggestions(
  partialInput: string,
  field: 'wip' | 'reg' | 'notes',
  recentJobs: Job[]
): SmartSuggestion[] {
  console.log('InputBrain: Generating smart suggestions for', field, ':', partialInput);
  
  const suggestions: SmartSuggestion[] = [];
  const upperInput = partialInput.toUpperCase();

  if (field === 'wip') {
    // Suggest WIP numbers that start with the input
    const wipCounts = new Map<string, number>();
    recentJobs.forEach(job => {
      if (job.wipNumber.startsWith(partialInput)) {
        wipCounts.set(job.wipNumber, (wipCounts.get(job.wipNumber) || 0) + 1);
      }
    });

    wipCounts.forEach((count, wip) => {
      const matchingJob = recentJobs.find(j => j.wipNumber === wip);
      suggestions.push({
        value: wip,
        context: matchingJob ? `${matchingJob.vehicleReg} - ${matchingJob.aw} AW` : '',
        confidence: Math.min(0.9, 0.5 + (count * 0.1)),
        usageCount: count,
      });
    });
  } else if (field === 'reg') {
    // Suggest registrations that contain the input
    const regCounts = new Map<string, number>();
    recentJobs.forEach(job => {
      const reg = job.vehicleReg.toUpperCase();
      if (reg.includes(upperInput)) {
        regCounts.set(job.vehicleReg, (regCounts.get(job.vehicleReg) || 0) + 1);
      }
    });

    regCounts.forEach((count, reg) => {
      const matchingJob = recentJobs.find(j => j.vehicleReg === reg);
      suggestions.push({
        value: reg,
        context: matchingJob ? `WIP ${matchingJob.wipNumber} - ${matchingJob.aw} AW` : '',
        confidence: Math.min(0.9, 0.5 + (count * 0.1)),
        usageCount: count,
      });
    });
  } else if (field === 'notes') {
    // Suggest common notes/phrases
    const notesMap = new Map<string, number>();
    recentJobs.forEach(job => {
      if (job.notes && job.notes.toLowerCase().includes(partialInput.toLowerCase())) {
        notesMap.set(job.notes, (notesMap.get(job.notes) || 0) + 1);
      }
    });

    notesMap.forEach((count, note) => {
      suggestions.push({
        value: note,
        context: '',
        confidence: Math.min(0.8, 0.4 + (count * 0.1)),
        usageCount: count,
      });
    });
  }

  // Sort by confidence and usage count
  suggestions.sort((a, b) => {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    return b.usageCount - a.usageCount;
  });

  console.log('InputBrain: Generated', suggestions.length, 'suggestions');
  return suggestions.slice(0, 5); // Return top 5
}

/**
 * Calculate Levenshtein distance between two strings
 * (measures how different two strings are)
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Analyze input patterns and provide intelligent feedback
 */
export function analyzeInputPattern(
  recentInputs: { wipNumber: string; vehicleReg: string; aw: number; timestamp: string }[]
): {
  averageAW: number;
  commonRegistrations: string[];
  inputSpeed: 'fast' | 'normal' | 'slow';
  suggestions: string[];
} {
  console.log('InputBrain: Analyzing input patterns from', recentInputs.length, 'recent inputs');
  
  const avgAW = recentInputs.reduce((sum, input) => sum + input.aw, 0) / recentInputs.length || 0;
  
  const regCounts = new Map<string, number>();
  recentInputs.forEach(input => {
    regCounts.set(input.vehicleReg, (regCounts.get(input.vehicleReg) || 0) + 1);
  });
  
  const commonRegs = Array.from(regCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reg]) => reg);
  
  // Calculate input speed (time between entries)
  let inputSpeed: 'fast' | 'normal' | 'slow' = 'normal';
  if (recentInputs.length >= 2) {
    const timeDiffs: number[] = [];
    for (let i = 1; i < recentInputs.length; i++) {
      const diff = new Date(recentInputs[i].timestamp).getTime() - new Date(recentInputs[i - 1].timestamp).getTime();
      timeDiffs.push(diff);
    }
    const avgDiff = timeDiffs.reduce((sum, diff) => sum + diff, 0) / timeDiffs.length;
    
    if (avgDiff < 60000) { // Less than 1 minute
      inputSpeed = 'fast';
    } else if (avgDiff > 300000) { // More than 5 minutes
      inputSpeed = 'slow';
    }
  }
  
  const suggestions: string[] = [];
  
  if (avgAW > 0) {
    suggestions.push(`Your average AW is ${avgAW.toFixed(1)}. Consider this when estimating job times.`);
  }
  
  if (commonRegs.length > 0) {
    suggestions.push(`Frequent vehicles: ${commonRegs.join(', ')}. These may be repeat customers.`);
  }
  
  if (inputSpeed === 'fast') {
    suggestions.push('You\'re entering jobs quickly! Make sure all details are accurate.');
  } else if (inputSpeed === 'slow') {
    suggestions.push('Take your time - accuracy is more important than speed.');
  }
  
  console.log('InputBrain: Pattern analysis complete');
  return {
    averageAW: avgAW,
    commonRegistrations: commonRegs,
    inputSpeed,
    suggestions,
  };
}
