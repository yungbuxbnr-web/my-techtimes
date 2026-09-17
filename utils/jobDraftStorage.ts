
import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAFTS_KEY = '@techtimes_job_drafts';
const MAX_DRAFTS = 10;

export interface JobDraft {
  draftId: string;
  createdAt: string;
  updatedAt: string;
  wipNumber: string;
  vehicleReg: string;
  notes: string;
  aw: string;
  hours: string;
  vhcStatus: string;
  jobFinished: boolean;
  workDate: string;
  editId?: string;
  savedSuccessfully: boolean;
}

async function loadDrafts(): Promise<JobDraft[]> {
  try {
    const raw = await AsyncStorage.getItem(DRAFTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveDrafts(drafts: JobDraft[]): Promise<void> {
  await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

export const jobDraftStorage = {
  async saveDraft(
    draft: Omit<JobDraft, 'createdAt' | 'updatedAt'> & { draftId?: string }
  ): Promise<JobDraft> {
    const drafts = await loadDrafts();
    const now = new Date().toISOString();
    const existingIdx = draft.draftId ? drafts.findIndex(d => d.draftId === draft.draftId) : -1;

    if (existingIdx >= 0) {
      const updated: JobDraft = {
        ...drafts[existingIdx],
        ...draft,
        draftId: drafts[existingIdx].draftId,
        createdAt: drafts[existingIdx].createdAt,
        updatedAt: now,
      };
      drafts[existingIdx] = updated;
      await saveDrafts(drafts);
      return updated;
    } else {
      const newDraft: JobDraft = {
        ...draft,
        draftId: draft.draftId || `draft_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        createdAt: now,
        updatedAt: now,
        savedSuccessfully: draft.savedSuccessfully ?? false,
      };
      drafts.unshift(newDraft);
      // Keep max drafts
      const trimmed = drafts.slice(0, MAX_DRAFTS);
      await saveDrafts(trimmed);
      return newDraft;
    }
  },

  async getDraft(draftId: string): Promise<JobDraft | null> {
    const drafts = await loadDrafts();
    return drafts.find(d => d.draftId === draftId) ?? null;
  },

  async getAllDrafts(): Promise<JobDraft[]> {
    return loadDrafts();
  },

  async markDraftSaved(draftId: string): Promise<void> {
    const drafts = await loadDrafts();
    const updated = drafts.map(d =>
      d.draftId === draftId ? { ...d, savedSuccessfully: true, updatedAt: new Date().toISOString() } : d
    );
    await saveDrafts(updated);
  },

  async deleteDraft(draftId: string): Promise<void> {
    const drafts = await loadDrafts();
    await saveDrafts(drafts.filter(d => d.draftId !== draftId));
  },

  async getUnsavedDrafts(): Promise<JobDraft[]> {
    const drafts = await loadDrafts();
    return drafts
      .filter(d => !d.savedSuccessfully)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  async cleanupSavedDrafts(): Promise<void> {
    const drafts = await loadDrafts();
    await saveDrafts(drafts.filter(d => !d.savedSuccessfully));
  },
};
