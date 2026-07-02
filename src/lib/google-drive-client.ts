/**
 * Google Drive Client
 * Handles folder creation, document uploads with compression, archival, and restoration
 */

import { google } from 'googleapis'
import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'
import * as zlib from 'zlib'
import { promisify } from 'util'

const gzip = promisify(zlib.gzip)

interface GoogleDriveConfig {
  serviceAccountKey: any
  rootFolderId: string
}

let drive: any = null
let config: GoogleDriveConfig | null = null

/**
 * Initialize Google Drive client
 */
export function initGoogleDrive(serviceAccountKey: string, rootFolderId: string) {
  try {
    if (!serviceAccountKey || !rootFolderId) {
      throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_DRIVE_FOLDER_ID env vars')
    }

    const keyData = JSON.parse(serviceAccountKey)

    const auth = new google.auth.GoogleAuth({
      credentials: keyData,
      scopes: ['https://www.googleapis.com/auth/drive'],
    })

    drive = google.drive({ version: 'v3', auth })
    config = { serviceAccountKey: keyData, rootFolderId }

    console.log('[Google Drive] ✅ Client initialized successfully')
  } catch (err) {
    console.error('[Google Drive] ❌ Initialization error:', err instanceof Error ? err.message : String(err))
    throw err
  }
}

/**
 * Ensure Drive client is initialized
 */
function ensureInitialized() {
  if (!drive || !config) {
    throw new Error('Google Drive client not initialized. Call initGoogleDrive() first.')
  }
}

/**
 * Create a folder in Google Drive
 */
async function createFolder(folderName: string, parentFolderId: string): Promise<string> {
  ensureInitialized()

  try {
    const response = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      },
      fields: 'id',
    })

    console.log(`[Google Drive] Created folder: ${folderName} (ID: ${response.data.id})`)
    return response.data.id!
  } catch (err) {
    console.error(`[Google Drive] Failed to create folder ${folderName}:`, err)
    throw err
  }
}

/**
 * Move a folder to Archive
 */
async function moveToArchive(folderId: string, archiveFolderId: string): Promise<void> {
  ensureInitialized()

  try {
    await drive.files.update({
      fileId: folderId,
      addParents: archiveFolderId,
      removeParents: config!.rootFolderId,
      fields: 'id, parents',
    })

    console.log(`[Google Drive] Moved folder ${folderId} to Archive`)
  } catch (err) {
    console.error(`[Google Drive] Failed to archive folder:`, err)
    throw err
  }
}

/**
 * Restore a folder from Archive
 */
async function restoreFromArchive(folderId: string, archiveFolderId: string): Promise<void> {
  ensureInitialized()

  try {
    await drive.files.update({
      fileId: folderId,
      addParents: config!.rootFolderId,
      removeParents: archiveFolderId,
      fields: 'id, parents',
    })

    console.log(`[Google Drive] Restored folder ${folderId} from Archive`)
  } catch (err) {
    console.error(`[Google Drive] Failed to restore folder:`, err)
    throw err
  }
}

/**
 * Compress file based on type
 */
async function compressFile(
  file: Buffer,
  mimeType: string,
  fileName: string
): Promise<{ data: Buffer; compressionRatio: number }> {
  try {
    let compressedData = file
    let ratio = 0

    if (mimeType.startsWith('image/')) {
      // Image compression using sharp
      if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
        compressedData = await sharp(file).jpeg({ quality: 75, progressive: true }).toBuffer()
      } else if (mimeType === 'image/png') {
        compressedData = await sharp(file).png({ compressionLevel: 9 }).toBuffer()
      } else if (mimeType === 'image/webp' || mimeType === 'image/gif') {
        compressedData = await sharp(file).webp({ quality: 75 }).toBuffer()
      }
    } else if (
      mimeType === 'application/pdf' ||
      mimeType.includes('word') ||
      mimeType.includes('excel') ||
      mimeType === 'application/zip'
    ) {
      // Use gzip for PDF, Word, Excel, and archives
      compressedData = await gzip(file, { level: 9 })
    } else if (mimeType.startsWith('text/')) {
      // Text files compress very well
      compressedData = await gzip(file, { level: 9 })
    }

    // Calculate compression ratio
    ratio = Math.round(((file.length - compressedData.length) / file.length) * 100)

    console.log(
      `[Compression] ${fileName}: ${file.length} bytes → ${compressedData.length} bytes (${ratio}% saved)`
    )

    return { data: compressedData, compressionRatio: ratio }
  } catch (err) {
    console.warn(`[Compression] Failed to compress ${fileName}, using original:`, err)
    return { data: file, compressionRatio: 0 }
  }
}

/**
 * Upload file to Google Drive
 */
async function uploadFileToDrive(
  fileName: string,
  fileData: Buffer,
  mimeType: string,
  folderId: string
): Promise<string> {
  ensureInitialized()

  try {
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: mimeType,
        parents: [folderId],
      },
      media: {
        mimeType: mimeType,
        body: fileData,
      },
      fields: 'id',
    })

    console.log(`[Google Drive] Uploaded: ${fileName} (ID: ${response.data.id})`)
    return response.data.id!
  } catch (err) {
    console.error(`[Google Drive] Failed to upload ${fileName}:`, err)
    throw err
  }
}

/**
 * Find or create contact folder (Lazy)
 */
export async function findOrCreateContactFolder(
  kontaktId: string,
  kontaktName: string
): Promise<string> {
  ensureInitialized()

  const folderName = `kontakt-${kontaktId}_${kontaktName}`

  try {
    // Search for existing folder
    const response = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${config!.rootFolderId}' in parents and trashed=false`,
      spaces: 'drive',
      fields: 'files(id, name)',
      pageSize: 1,
    })

    if (response.data.files && response.data.files.length > 0) {
      console.log(`[Google Drive] Found existing folder: ${folderName}`)
      return response.data.files[0].id!
    }

    // Create new folder (Lazy)
    return await createFolder(folderName, config!.rootFolderId)
  } catch (err) {
    console.error(`[Google Drive] Failed to find/create contact folder:`, err)
    throw err
  }
}

/**
 * Ensure Archive folder exists
 */
async function ensureArchiveFolder(): Promise<string> {
  ensureInitialized()

  try {
    const response = await drive.files.list({
      q: `name='Archiv' and mimeType='application/vnd.google-apps.folder' and '${config!.rootFolderId}' in parents and trashed=false`,
      spaces: 'drive',
      fields: 'files(id)',
      pageSize: 1,
    })

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id!
    }

    // Create Archive folder
    return await createFolder('Archiv', config!.rootFolderId)
  } catch (err) {
    console.error(`[Google Drive] Failed to ensure Archive folder:`, err)
    throw err
  }
}

/**
 * Main upload function - compress + upload + return metrics
 */
export async function uploadDocumentToGoogleDrive(
  file: Buffer,
  fileName: string,
  mimeType: string,
  kontaktId: string,
  kontaktName: string
): Promise<{
  fileId: string
  fileName: string
  ordnerId: string
  ordnerName: string
  originalSize: number
  compressedSize: number
  compressionRatio: number
}> {
  ensureInitialized()

  try {
    const originalSize = file.length

    // Compress file
    const { data: compressedData, compressionRatio } = await compressFile(file, mimeType, fileName)
    const compressedSize = compressedData.length

    // Find or create contact folder
    const ordnerId = await findOrCreateContactFolder(kontaktId, kontaktName)
    const ordnerName = `kontakt-${kontaktId}_${kontaktName}`

    // Upload compressed file
    const fileId = await uploadFileToDrive(fileName, compressedData, mimeType, ordnerId)

    return {
      fileId,
      fileName,
      ordnerId,
      ordnerName,
      originalSize,
      compressedSize,
      compressionRatio,
    }
  } catch (err) {
    console.error(`[Google Drive] Upload failed for ${fileName}:`, err)
    throw err
  }
}

/**
 * Archive contact folder (on contact deletion)
 */
export async function archiveContactFolder(ordnerId: string): Promise<void> {
  ensureInitialized()

  try {
    const archiveFolderId = await ensureArchiveFolder()
    await moveToArchive(ordnerId, archiveFolderId)
  } catch (err) {
    console.error(`[Google Drive] Failed to archive folder:`, err)
    throw err
  }
}

/**
 * Restore contact folder (on contact recovery)
 */
export async function restoreContactFolder(ordnerId: string): Promise<void> {
  ensureInitialized()

  try {
    const archiveFolderId = await ensureArchiveFolder()
    await restoreFromArchive(ordnerId, archiveFolderId)
  } catch (err) {
    console.error(`[Google Drive] Failed to restore folder:`, err)
    throw err
  }
}
