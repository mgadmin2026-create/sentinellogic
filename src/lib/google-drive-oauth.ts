/**
 * Zentrales Google-Drive-System-Konto
 *
 * EIN gemeinsames OAuth-Token (Tabelle google_drive_system_token, Zeile id=1) haelt
 * alle Dokumente. Egal welcher Mitarbeiter hochlaedt -> alles landet zentral im Drive
 * dieses einen Kontos. Kein per-User-Token, kein Service Account.
 *
 * Setup einmalig: Admin verbindet in /einstellungen/dokumente das System-Konto.
 */

import { google } from 'googleapis'
import type { drive_v3 } from 'googleapis'
import sharp from 'sharp'
import { Readable } from 'stream'
import * as zlib from 'zlib'
import { promisify } from 'util'
import { refreshAccessToken } from './google-oauth'
import { createServerClient } from './supabase/server'

const gzip = promisify(zlib.gzip)

const ROOT_FOLDER_NAME = 'SentinelLogic Dokumente'

export interface SystemToken {
  access_token: string | null
  refresh_token: string | null
  expires_at: string | null
  scope: string | null
  root_folder_id: string | null
  connected_email: string | null
}

/**
 * System-Token aus der DB laden (Service-Role). Null wenn noch nicht verbunden.
 */
export async function getSystemToken(): Promise<SystemToken | null> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('google_drive_system_token')
    .select('access_token, refresh_token, expires_at, scope, root_folder_id, connected_email')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    console.error('[Google Drive] Failed to read system token:', error)
    return null
  }
  if (!data || !data.access_token) return null
  return data as SystemToken
}

/**
 * OAuth2-Client fuer eine gegebene Access-Token bauen.
 */
export function buildDriveClient(accessToken: string): drive_v3.Drive {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET
  )
  oauth2Client.setCredentials({ access_token: accessToken })
  return google.drive({ version: 'v3', auth: oauth2Client })
}

/**
 * Drive-Client des System-Kontos. Erneuert das Access-Token automatisch wenn abgelaufen.
 * Wirft, wenn das System-Konto noch nicht verbunden ist.
 */
export async function getSystemDriveClient(): Promise<{
  drive: drive_v3.Drive
  rootFolderId: string | null
}> {
  const token = await getSystemToken()

  if (!token || !token.access_token) {
    throw new Error(
      'Google Drive ist noch nicht verbunden. Bitte in Einstellungen → Dokumente das System-Konto verbinden.'
    )
  }

  let accessToken = token.access_token

  // Token abgelaufen? -> refreshen
  if (token.expires_at && new Date(token.expires_at) < new Date(Date.now() + 60_000)) {
    if (!token.refresh_token) {
      throw new Error('Refresh-Token fehlt. Bitte Google Drive erneut verbinden.')
    }
    console.log('[Google Drive] System-Token abgelaufen, erneuere...')
    const refreshed = await refreshAccessToken(token.refresh_token)
    accessToken = refreshed.accessToken

    const supabase = createServerClient()
    await supabase
      .from('google_drive_system_token')
      .update({
        access_token: refreshed.accessToken,
        expires_at: refreshed.expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
  }

  return { drive: buildDriveClient(accessToken), rootFolderId: token.root_folder_id }
}

/**
 * Root-Ordner "SentinelLogic Dokumente" finden oder anlegen.
 * Wird beim Verbinden des Kontos aufgerufen und die ID gespeichert.
 */
export async function findOrCreateRootFolder(drive: drive_v3.Drive): Promise<string> {
  const res = await drive.files.list({
    q: `name='${ROOT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false and 'root' in parents`,
    spaces: 'drive',
    fields: 'files(id, name)',
    pageSize: 1,
  })

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!
  }

  const created = await drive.files.create({
    requestBody: {
      name: ROOT_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  })
  console.log(`[Google Drive] Root-Ordner angelegt: ${ROOT_FOLDER_NAME} (${created.data.id})`)
  return created.data.id!
}

/**
 * Kontakt-Ordner innerhalb des Root-Ordners finden oder anlegen.
 */
export async function findOrCreateContactFolder(
  drive: drive_v3.Drive,
  rootFolderId: string,
  kontaktId: string,
  kontaktName: string
): Promise<{ id: string; name: string }> {
  const folderName = `${kontaktName} (${kontaktId.slice(0, 8)})`
  const escapedName = folderName.replace(/'/g, "\\'")

  const res = await drive.files.list({
    q: `name='${escapedName}' and mimeType='application/vnd.google-apps.folder' and trashed=false and '${rootFolderId}' in parents`,
    spaces: 'drive',
    fields: 'files(id, name)',
    pageSize: 1,
  })

  if (res.data.files && res.data.files.length > 0) {
    return { id: res.data.files[0].id!, name: folderName }
  }

  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [rootFolderId],
    },
    fields: 'id',
  })
  console.log(`[Google Drive] Kontakt-Ordner angelegt: ${folderName} (${created.data.id})`)
  return { id: created.data.id!, name: folderName }
}

/**
 * Datei je nach Typ komprimieren (Bilder via sharp, Dokumente/Text via gzip).
 */
async function compressFile(
  file: Buffer,
  mimeType: string,
  fileName: string
): Promise<{ data: Buffer; compressionRatio: number }> {
  try {
    let compressedData = file

    if (mimeType.startsWith('image/')) {
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
      mimeType.includes('sheet') ||
      mimeType.includes('presentation') ||
      mimeType === 'application/zip'
    ) {
      compressedData = await gzip(file, { level: 9 })
    } else if (mimeType.startsWith('text/')) {
      compressedData = await gzip(file, { level: 9 })
    }

    let ratio = Math.round(((file.length - compressedData.length) / file.length) * 100)
    ratio = Math.max(0, Math.min(100, ratio))

    // Komprimierung hat nichts gebracht (z.B. bereits komprimiertes Format) -> Original nehmen
    if (compressedData.length >= file.length) {
      return { data: file, compressionRatio: 0 }
    }

    console.log(`[Compression] ${fileName}: ${file.length}B → ${compressedData.length}B (${ratio}%)`)
    return { data: compressedData, compressionRatio: ratio }
  } catch (err) {
    console.error(`[Compression] Error compressing ${fileName}:`, err)
    return { data: file, compressionRatio: 0 }
  }
}

export interface UploadResult {
  fileId: string
  fileName: string
  ordnerId: string
  ordnerName: string
  webViewLink: string | null
  originalSize: number
  compressedSize: number
  compressionRatio: number
}

/**
 * Dokument ins zentrale System-Konto hochladen (mit Kompression).
 * Legt bei Bedarf Root- und Kontakt-Ordner an.
 */
export async function uploadDocumentToGoogleDrive(
  file: Buffer,
  fileName: string,
  mimeType: string,
  kontaktId: string,
  kontaktName: string
): Promise<UploadResult> {
  const { drive, rootFolderId } = await getSystemDriveClient()

  // Root-Ordner sicherstellen (falls beim Verbinden nicht gespeichert)
  let root = rootFolderId
  if (!root) {
    root = await findOrCreateRootFolder(drive)
    const supabase = createServerClient()
    await supabase
      .from('google_drive_system_token')
      .update({ root_folder_id: root, updated_at: new Date().toISOString() })
      .eq('id', 1)
  }

  const folder = await findOrCreateContactFolder(drive, root, kontaktId, kontaktName)

  const { data: compressedData, compressionRatio } = await compressFile(file, mimeType, fileName)

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folder.id],
    },
    media: {
      mimeType: mimeType,
      body: Readable.from(compressedData),
    },
    fields: 'id, webViewLink',
  })

  console.log(`[Google Drive] ✅ Hochgeladen: ${fileName} (ID: ${response.data.id})`)

  return {
    fileId: response.data.id!,
    fileName: fileName,
    ordnerId: folder.id,
    ordnerName: folder.name,
    webViewLink: response.data.webViewLink ?? null,
    originalSize: file.length,
    compressedSize: compressedData.length,
    compressionRatio: compressionRatio,
  }
}
