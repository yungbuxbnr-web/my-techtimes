
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { offlineStorage } from './offlineStorage';
import type { Job, Schedule } from './offlineStorage';

WebBrowser.maybeCompleteAuthSession();

// ─── CONFIGURATION ────────────────────────────────────────────────────────────
// Replace with your real Web OAuth Client ID from Google Cloud Console
// APIs & Services → Credentials → OAuth 2.0 Client IDs → Web client
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com';

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'profile',
  'email',
];

const STORAGE_KEYS = {
  ACCESS_TOKEN: '@gdrive_access_token',
  REFRESH_TOKEN: '@gdrive_refresh_token',
  TOKEN_EXPIRY: '@gdrive_token_expiry',
  USER_EMAIL: '@gdrive_user_email',
  USER_NAME: '@gdrive_user_name',
  FOLDER_ID: '@gdrive_folder_id',
};

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_NAME = 'TechTimesAppData';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface GoogleUser {
  email: string;
  name: string;
}

export interface SyncResult {
  jobsAdded: number;
  jobsUpdated: number;
  scheduleUpdated: boolean;
  error?: string;
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

export function useGoogleAuth() {
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'techtimes' });

  const discovery = AuthSession.useAutoDiscovery('https://accounts.google.com');

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      scopes: SCOPES,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      extraParams: { access_type: 'offline', prompt: 'consent' },
    },
    discovery
  );

  return { request, response, promptAsync, redirectUri };
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
  console.log('GoogleDriveSync: Exchanging auth code for tokens');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('GoogleDriveSync: Token exchange failed:', err);
    throw new Error(`Token exchange failed: ${err}`);
  }
  const data = await res.json();
  console.log('GoogleDriveSync: Token exchange successful');
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in ?? 3600,
  };
}

export async function saveTokens(
  accessToken: string,
  refreshToken: string | undefined,
  expiresIn: number
): Promise<void> {
  console.log('GoogleDriveSync: Saving tokens to storage');
  const expiry = Date.now() + expiresIn * 1000;
  await AsyncStorage.multiSet([
    [STORAGE_KEYS.ACCESS_TOKEN, accessToken],
    [STORAGE_KEYS.TOKEN_EXPIRY, String(expiry)],
    ...(refreshToken ? [[STORAGE_KEYS.REFRESH_TOKEN, refreshToken] as [string, string]] : []),
  ]);
}

export async function getStoredAccessToken(): Promise<string | null> {
  console.log('GoogleDriveSync: Getting stored access token');
  const [token, expiry] = await AsyncStorage.multiGet([
    STORAGE_KEYS.ACCESS_TOKEN,
    STORAGE_KEYS.TOKEN_EXPIRY,
  ]);
  const accessToken = token[1];
  const expiryTime = Number(expiry[1] ?? 0);
  if (!accessToken) {
    console.log('GoogleDriveSync: No access token found');
    return null;
  }
  if (Date.now() > expiryTime - 60_000) {
    console.log('GoogleDriveSync: Token expired, attempting refresh');
    const refreshed = await refreshAccessToken();
    return refreshed;
  }
  return accessToken;
}

async function refreshAccessToken(): Promise<string | null> {
  console.log('GoogleDriveSync: Refreshing access token');
  const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  if (!refreshToken) {
    console.log('GoogleDriveSync: No refresh token available');
    return null;
  }
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: GOOGLE_CLIENT_ID,
        grant_type: 'refresh_token',
      }).toString(),
    });
    if (!res.ok) {
      console.error('GoogleDriveSync: Token refresh failed with status:', res.status);
      return null;
    }
    const data = await res.json();
    const expiry = Date.now() + (data.expires_in ?? 3600) * 1000;
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.ACCESS_TOKEN, data.access_token],
      [STORAGE_KEYS.TOKEN_EXPIRY, String(expiry)],
    ]);
    console.log('GoogleDriveSync: Token refreshed successfully');
    return data.access_token;
  } catch (err) {
    console.error('GoogleDriveSync: Error refreshing token:', err);
    return null;
  }
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUser> {
  console.log('GoogleDriveSync: Fetching Google user info');
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    console.error('GoogleDriveSync: Failed to fetch user info, status:', res.status);
    throw new Error('Failed to fetch user info');
  }
  const data = await res.json();
  console.log('GoogleDriveSync: User info fetched for:', data.email);
  await AsyncStorage.multiSet([
    [STORAGE_KEYS.USER_EMAIL, data.email ?? ''],
    [STORAGE_KEYS.USER_NAME, data.name ?? ''],
  ]);
  return { email: data.email ?? '', name: data.name ?? '' };
}

export async function getStoredUser(): Promise<GoogleUser | null> {
  const [[, email], [, name]] = await AsyncStorage.multiGet([
    STORAGE_KEYS.USER_EMAIL,
    STORAGE_KEYS.USER_NAME,
  ]);
  if (!email) return null;
  return { email, name: name ?? '' };
}

export async function signOutGoogle(): Promise<void> {
  console.log('GoogleDriveSync: Signing out Google account');
  await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
  console.log('GoogleDriveSync: Google account disconnected');
}

// ─── DRIVE FOLDER ─────────────────────────────────────────────────────────────

async function getOrCreateFolder(accessToken: string): Promise<string> {
  console.log('GoogleDriveSync: Getting or creating TechTimesAppData folder');
  const cached = await AsyncStorage.getItem(STORAGE_KEYS.FOLDER_ID);
  if (cached) {
    console.log('GoogleDriveSync: Using cached folder id:', cached);
    return cached;
  }

  // Search for existing folder
  const searchRes = await fetch(
    `${DRIVE_API}/files?q=name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!searchRes.ok) {
    const errText = await searchRes.text();
    console.error('GoogleDriveSync: Folder search failed:', errText);
    throw new Error(`Drive folder search failed: ${searchRes.status}`);
  }
  const searchData = await searchRes.json();
  if (searchData.files?.length > 0) {
    const folderId = searchData.files[0].id;
    console.log('GoogleDriveSync: Found existing folder:', folderId);
    await AsyncStorage.setItem(STORAGE_KEYS.FOLDER_ID, folderId);
    return folderId;
  }

  // Create folder
  console.log('GoogleDriveSync: Creating new TechTimesAppData folder');
  const createRes = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  if (!createRes.ok) {
    const errText = await createRes.text();
    console.error('GoogleDriveSync: Folder creation failed:', errText);
    throw new Error(`Drive folder creation failed: ${createRes.status}`);
  }
  const folder = await createRes.json();
  console.log('GoogleDriveSync: Folder created with id:', folder.id);
  await AsyncStorage.setItem(STORAGE_KEYS.FOLDER_ID, folder.id);
  return folder.id;
}

// ─── DRIVE FILE OPS ───────────────────────────────────────────────────────────

async function findFile(
  accessToken: string,
  folderId: string,
  fileName: string
): Promise<string | null> {
  console.log('GoogleDriveSync: Searching for file:', fileName);
  const res = await fetch(
    `${DRIVE_API}/files?q=name='${fileName}' and '${folderId}' in parents and trashed=false&fields=files(id,name,modifiedTime)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    console.error('GoogleDriveSync: File search failed for:', fileName, 'status:', res.status);
    return null;
  }
  const data = await res.json();
  const fileId = data.files?.length > 0 ? data.files[0].id : null;
  console.log('GoogleDriveSync: File', fileName, fileId ? 'found: ' + fileId : 'not found');
  return fileId;
}

async function readDriveFile(accessToken: string, fileId: string): Promise<any> {
  console.log('GoogleDriveSync: Reading Drive file:', fileId);
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    console.error('GoogleDriveSync: Failed to read Drive file:', fileId, 'status:', res.status);
    return null;
  }
  const data = await res.json();
  console.log('GoogleDriveSync: Drive file read successfully');
  return data;
}

async function writeDriveFile(
  accessToken: string,
  folderId: string,
  fileName: string,
  fileId: string | null,
  content: any
): Promise<void> {
  const body = JSON.stringify(content, null, 2);

  if (fileId) {
    console.log('GoogleDriveSync: Updating existing Drive file:', fileName, fileId);
    const res = await fetch(`${DRIVE_UPLOAD_API}/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body,
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('GoogleDriveSync: File update failed:', errText);
      throw new Error(`Drive file update failed: ${res.status}`);
    }
    console.log('GoogleDriveSync: File updated successfully:', fileName);
  } else {
    console.log('GoogleDriveSync: Creating new Drive file:', fileName);
    const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
    const boundary = 'techtimes_boundary';
    const multipart = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      metadata,
      `--${boundary}`,
      'Content-Type: application/json',
      '',
      body,
      `--${boundary}--`,
    ].join('\r\n');

    const res = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipart,
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('GoogleDriveSync: File creation failed:', errText);
      throw new Error(`Drive file creation failed: ${res.status}`);
    }
    console.log('GoogleDriveSync: File created successfully:', fileName);
  }
}

// ─── SYNC LOGIC ───────────────────────────────────────────────────────────────

function mergeJobs(
  localJobs: Job[],
  driveJobs: Job[]
): { merged: Job[]; added: number; updated: number } {
  console.log('GoogleDriveSync: Merging jobs — local:', localJobs.length, 'drive:', driveJobs.length);
  const map = new Map<string, Job>();
  let added = 0;
  let updated = 0;

  for (const job of localJobs) map.set(job.id, job);

  for (const driveJob of driveJobs) {
    const local = map.get(driveJob.id);
    if (!local) {
      map.set(driveJob.id, driveJob);
      added++;
    } else {
      const localTime = new Date(local.updatedAt ?? local.createdAt).getTime();
      const driveTime = new Date(driveJob.updatedAt ?? driveJob.createdAt).getTime();
      if (driveTime > localTime) {
        map.set(driveJob.id, driveJob);
        updated++;
      }
    }
  }

  const merged = Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  console.log('GoogleDriveSync: Merge result — added:', added, 'updated:', updated, 'total:', merged.length);
  return { merged, added, updated };
}

function mergeSchedule(
  local: Schedule,
  drive: Schedule & { _updatedAt?: string }
): { merged: Schedule & { _updatedAt?: string }; updated: boolean } {
  const localTime = new Date((local as any)._updatedAt ?? 0).getTime();
  const driveTime = new Date(drive._updatedAt ?? 0).getTime();
  console.log('GoogleDriveSync: Merging schedule — local time:', localTime, 'drive time:', driveTime);
  if (driveTime > localTime) {
    console.log('GoogleDriveSync: Drive schedule is newer, using drive version');
    return { merged: drive, updated: true };
  }
  console.log('GoogleDriveSync: Local schedule is up to date');
  return {
    merged: { ...local, _updatedAt: (local as any)._updatedAt ?? new Date().toISOString() },
    updated: false,
  };
}

export async function runGoogleDriveSync(): Promise<SyncResult> {
  console.log('GoogleDriveSync: Starting full sync');
  const accessToken = await getStoredAccessToken();
  if (!accessToken) {
    console.error('GoogleDriveSync: No access token — user not signed in');
    throw new Error('Not signed in to Google');
  }

  const folderId = await getOrCreateFolder(accessToken);

  // ── Jobs sync ──
  console.log('GoogleDriveSync: Syncing jobs');
  const localJobs: Job[] = await offlineStorage.getAllJobs();
  const jobsFileId = await findFile(accessToken, folderId, 'jobs.json');
  const driveJobs: Job[] = jobsFileId
    ? (await readDriveFile(accessToken, jobsFileId)) ?? []
    : [];

  const { merged: mergedJobs, added: jobsAdded, updated: jobsUpdated } = mergeJobs(localJobs, driveJobs);

  if (jobsAdded > 0 || jobsUpdated > 0) {
    console.log('GoogleDriveSync: Saving merged jobs to local storage');
    await offlineStorage.saveJobs(mergedJobs);
  }
  console.log('GoogleDriveSync: Writing jobs to Drive');
  await writeDriveFile(accessToken, folderId, 'jobs.json', jobsFileId, mergedJobs);

  // ── Schedule sync ──
  console.log('GoogleDriveSync: Syncing schedule');
  const localSchedule: Schedule = await offlineStorage.getSchedule();
  const schedFileId = await findFile(accessToken, folderId, 'schedule.json');
  const driveSchedule = schedFileId
    ? (await readDriveFile(accessToken, schedFileId)) ?? {}
    : {};

  const { merged: mergedSchedule, updated: scheduleUpdated } = mergeSchedule(
    localSchedule,
    driveSchedule
  );

  if (scheduleUpdated) {
    console.log('GoogleDriveSync: Saving updated schedule to local storage');
    await offlineStorage.saveSchedule(mergedSchedule);
  }
  console.log('GoogleDriveSync: Writing schedule to Drive');
  await writeDriveFile(accessToken, folderId, 'schedule.json', schedFileId, {
    ...mergedSchedule,
    _updatedAt: new Date().toISOString(),
  });

  console.log('GoogleDriveSync: Sync complete — jobsAdded:', jobsAdded, 'jobsUpdated:', jobsUpdated, 'scheduleUpdated:', scheduleUpdated);
  return { jobsAdded, jobsUpdated, scheduleUpdated };
}
