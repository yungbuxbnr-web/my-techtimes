
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  copyAsync,
  deleteAsync,
} from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// Relative directory name (no absolute path stored — reconstructed at runtime)
const IMAGE_DIR_NAME = 'job_images/';
const IMAGES_KEY = '@techtimes_images';

/**
 * Always compute the absolute image directory from the current documentDirectory.
 * This handles Android path changes between app installs/updates.
 */
function getImageDir(): string {
  return (documentDirectory ?? '') + IMAGE_DIR_NAME;
}

/**
 * Convert an absolute stored URI to a relative path for storage.
 * Strips the documentDirectory prefix so paths survive reinstalls.
 */
function toRelativePath(absoluteUri: string): string {
  const base = documentDirectory ?? '';
  if (absoluteUri.startsWith(base)) {
    return absoluteUri.slice(base.length);
  }
  // Already relative or unknown format — return as-is
  return absoluteUri;
}

/**
 * Convert a stored path (possibly relative) back to an absolute URI.
 */
function toAbsoluteUri(storedPath: string): string {
  // If it already looks absolute (file:// or content://) return as-is
  if (storedPath.startsWith('file://') || storedPath.startsWith('content://') || storedPath.startsWith('/')) {
    // Check if it starts with a known absolute prefix that may be stale
    const base = documentDirectory ?? '';
    if (base && !storedPath.startsWith(base)) {
      // Path is absolute but doesn't match current documentDirectory.
      // Try to remap: extract the relative portion after 'job_images/'
      const marker = IMAGE_DIR_NAME;
      const idx = storedPath.indexOf(marker);
      if (idx !== -1) {
        const relative = storedPath.slice(idx); // e.g. "job_images/job_xxx.jpg"
        console.log('ImageStorage: Remapping stale path to:', base + relative);
        return base + relative;
      }
    }
    return storedPath;
  }
  // Relative path — prepend current documentDirectory
  return (documentDirectory ?? '') + storedPath;
}

export interface StoredImage {
  id: string;
  jobId: string;
  uri: string;        // Stored as relative path; use toAbsoluteUri() before displaying
  fileName: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  createdAt: string;
}

export async function ensureImageDir(): Promise<void> {
  try {
    const dir = getImageDir();
    const dirInfo = await getInfoAsync(dir);
    if (!dirInfo.exists) {
      console.log('ImageStorage: Creating image directory:', dir);
      await makeDirectoryAsync(dir, { intermediates: true });
    }
  } catch (error) {
    console.error('ImageStorage: Error ensuring image directory:', error);
    throw error;
  }
}

export async function saveJobImage(jobId: string, sourceUri: string): Promise<StoredImage> {
  try {
    console.log('ImageStorage: Saving job image for jobId:', jobId, 'sourceUri:', sourceUri);
    await ensureImageDir();

    const manipResult = await manipulateAsync(
      sourceUri,
      [{ resize: { width: 1920 } }],
      { compress: 0.82, format: SaveFormat.JPEG }
    );

    const fileName = `${IMAGE_DIR_NAME}job_${jobId}_${Date.now()}.jpg`;
    const destUri = (documentDirectory ?? '') + fileName;

    await copyAsync({ from: manipResult.uri, to: destUri });

    const fileInfo = await getInfoAsync(destUri);
    const fileSizeBytes = fileInfo.exists ? ((fileInfo as any).size ?? 0) : 0;

    const storedImage: StoredImage = {
      id: Date.now().toString(),
      jobId,
      uri: fileName, // Store relative path
      fileName,
      width: manipResult.width,
      height: manipResult.height,
      fileSizeBytes,
      createdAt: new Date().toISOString(),
    };

    console.log('ImageStorage: Image saved successfully:', storedImage.id, 'size:', fileSizeBytes, 'relative path:', fileName);
    return storedImage;
  } catch (error) {
    console.error('ImageStorage: Error saving job image:', error);
    throw error;
  }
}

export async function getJobImages(jobId: string): Promise<StoredImage[]> {
  try {
    console.log('ImageStorage: Getting images for jobId:', jobId);
    const all = await getAllImages();
    return all.filter(img => img.jobId === jobId);
  } catch (error) {
    console.error('ImageStorage: Error getting job images:', error);
    return [];
  }
}

/**
 * Returns all images with their URIs resolved to absolute paths for display.
 * Filters out any images whose files no longer exist on disk.
 */
export async function getAllImages(): Promise<StoredImage[]> {
  try {
    console.log('ImageStorage: Getting all images');
    const raw = await AsyncStorage.getItem(IMAGES_KEY);
    if (!raw) return [];
    const parsed: StoredImage[] = JSON.parse(raw);

    // Resolve all URIs to absolute paths and verify files exist
    const resolved: StoredImage[] = [];
    for (const img of parsed) {
      const absoluteUri = toAbsoluteUri(img.uri);
      try {
        const info = await getInfoAsync(absoluteUri);
        if (info.exists) {
          resolved.push({ ...img, uri: absoluteUri });
        } else {
          console.warn('ImageStorage: File no longer exists, skipping:', absoluteUri);
        }
      } catch {
        // If we can't check, include it anyway (display will fail gracefully)
        resolved.push({ ...img, uri: absoluteUri });
      }
    }

    return resolved.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error('ImageStorage: Error getting all images:', error);
    return [];
  }
}

export async function saveImageRecord(image: StoredImage): Promise<void> {
  try {
    console.log('ImageStorage: Saving image record:', image.id);
    const raw = await AsyncStorage.getItem(IMAGES_KEY);
    const existing: StoredImage[] = raw ? JSON.parse(raw) : [];
    // Store with relative path
    const toStore: StoredImage = { ...image, uri: toRelativePath(image.uri) };
    existing.push(toStore);
    await AsyncStorage.setItem(IMAGES_KEY, JSON.stringify(existing));
    console.log('ImageStorage: Image record saved, total records:', existing.length);
  } catch (error) {
    console.error('ImageStorage: Error saving image record:', error);
    throw error;
  }
}

export async function deleteJobImage(imageId: string): Promise<void> {
  try {
    console.log('ImageStorage: Deleting image:', imageId);
    const raw = await AsyncStorage.getItem(IMAGES_KEY);
    const existing: StoredImage[] = raw ? JSON.parse(raw) : [];
    const target = existing.find(img => img.id === imageId);
    if (target) {
      const absoluteUri = toAbsoluteUri(target.uri);
      await deleteAsync(absoluteUri, { idempotent: true });
      console.log('ImageStorage: File deleted:', absoluteUri);
    }
    const updated = existing.filter(img => img.id !== imageId);
    await AsyncStorage.setItem(IMAGES_KEY, JSON.stringify(updated));
    console.log('ImageStorage: Image record removed');
  } catch (error) {
    console.error('ImageStorage: Error deleting job image:', error);
    throw error;
  }
}

export async function deleteAllJobImages(jobId: string): Promise<void> {
  try {
    console.log('ImageStorage: Deleting all images for jobId:', jobId);
    const raw = await AsyncStorage.getItem(IMAGES_KEY);
    const existing: StoredImage[] = raw ? JSON.parse(raw) : [];
    const toDelete = existing.filter(img => img.jobId === jobId);
    for (const img of toDelete) {
      const absoluteUri = toAbsoluteUri(img.uri);
      await deleteAsync(absoluteUri, { idempotent: true });
      console.log('ImageStorage: Deleted file:', absoluteUri);
    }
    const updated = existing.filter(img => img.jobId !== jobId);
    await AsyncStorage.setItem(IMAGES_KEY, JSON.stringify(updated));
    console.log('ImageStorage: All images deleted for jobId:', jobId, 'count:', toDelete.length);
  } catch (error) {
    console.error('ImageStorage: Error deleting all job images:', error);
    throw error;
  }
}

export async function getImageStorageStats(): Promise<{
  count: number;
  totalSizeBytes: number;
  totalSizeMB: string;
}> {
  try {
    console.log('ImageStorage: Getting storage stats');
    const all = await getAllImages();
    const totalSizeBytes = all.reduce((sum, img) => sum + img.fileSizeBytes, 0);
    const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(2);
    console.log('ImageStorage: Stats — count:', all.length, 'totalSizeMB:', totalSizeMB);
    return { count: all.length, totalSizeBytes, totalSizeMB };
  } catch (error) {
    console.error('ImageStorage: Error getting storage stats:', error);
    return { count: 0, totalSizeBytes: 0, totalSizeMB: '0.00' };
  }
}
