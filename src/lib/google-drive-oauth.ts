/**
 * Google Drive Client using OAuth (User's Google Account)
 * Uses user's own Google Drive instead of Service Account
 */

import { google } from 'googleapis'
import sharp from 'sharp'
import { Readable } from 'stream'
import * as zlib from 'zlib'
import { promisify } from 'util'
import { refreshAccessToken } from './google-oauth'
import { createServerClient } from './supabase/server'

const gzip = promisify(zlib.gzip)

/**
 * Get Google Drive client with OAuth token
 */
export async function getGoogleDriveClient(userId: string) {
  const supabase = createServerClient()

  // Get stored OAuth tokens
  const { data: tokenData, error: tokenError } = await supabase
    .from('google_oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .single()

  if (tokenError || !tokenData) {
    throw new Error('No Google OAuth token found. User must authenticate first.')
  }

  // Check if token expired
  if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
    console.log('[Google Drive OAuth] Token expired, refreshing...')

    if (!tokenData.refresh_token) {
      throw new Error('Refresh token missing. User must re-authenticate.')
    }

    // Refresh token
    const refreshed = await refreshAccessToken(tokenData.refresh_token)

    // Update in database
    await supabase
      .from('google_oauth_tokens')
      .update({
        access_token: refreshed.accessToken,
        expires_at: refreshed.expiresAt,
      })
      .eq('user_id', userId)

    tokenData.access_token = refreshed.accessToken
  }

  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET
  )

  oauth2Client.setCredentials({
    access_token: tokenData.access_token,
  })

  return google.drive({ version: 'v3', auth: oauth2Client })
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
      compressedData = await gzip(file, { level: 9 })
    } else if (mimeType.startsWith('text/')) {
      compressedData = await gzip(file, { level: 9 })
    }

    ratio = Math.round(((file.length - compressedData.length) / file.length) * 100)
    ratio = Math.max(0, Math.min(100, ratio))

    console.log(
      `[Compression] ${fileName}: ${file.length}B → ${compressedData.length}B (${ratio}%)`
    )

    return { data: compressedData, compressionRatio: ratio }
  } catch (err) {
    console.error(`[Compression] Error compressing ${fileName}:`, err)
    return { data: file, compressionRatio: 0 }
  }
}

/**
 * Find or create contact folder in user's Drive
 */
export async function findOrCreateContactFolder(
  userId: string,
  kontaktId: string,
  kontaktName: string
): Promise<string> {
  const drive = await getGoogleDriveClient(userId)
  const folderName = `kontakt-${kontaktId}_${kontaktName}`

  try {
    // Search for existing folder in user's Drive root
    const response = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      spaces: 'drive',
      fields: 'files(id, name)',
      pageSize: 1,
    })

    if (response.data.files && response.data.files.length > 0) {
      console.log(`[Google Drive] Found existing folder: ${folderName}`)
      return response.data.files[0].id!
    }

    // Create new folder
    const createResponse = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
    })

    console.log(`[Google Drive] Created folder: ${folderName} (ID: ${createResponse.data.id})`)
    return createResponse.data.id!
  } catch (err) {
    console.error(`[Google Drive] Failed to find/create contact folder:`, err)
    throw err
  }
}

/**
 * Upload document to Google Drive with compression
 */
export async function uploadDocumentToGoogleDrive(
  userId: string,
  file: Buffer,
  fileName: string,
  mimeType: string,
  kontaktId: string,
  kontaktName: string
): Promise<{
  fileId: string
  ordnerId: string
  ordnerName: string
  originalSize: number
  compressedSize: number
  compressionRatio: number
}> {
  try {
    const drive = await getGoogleDriveClient(userId)

    // Get or create contact folder
    const ordnerId = await findOrCreateContactFolder(userId, kontaktId, kontaktName)
    const ordnerName = `kontakt-${kontaktId}_${kontaktName}`

    // Compress file
    const { data: compressedData, compressionRatio } = await compressFile(
      file,
      mimeType,
      fileName
    )

    // Upload to Drive
    const stream = Readable.from(compressedData)

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: mimeType,
        parents: [ordnerId],
      },
      media: {
        mimeType: mimeType,
        body: stream,
      },
      fields: 'id',
    })

    console.log(`[Google Drive] ✅ Uploaded: ${fileName} (ID: ${response.data.id})`)

    return {
      fileId: response.data.id!,
      fileName: fileName,
      ordnerId: ordnerId,
      ordnerName: ordnerName,
      originalSize: file.length,
      compressedSize: compressedData.length,
      compressionRatio: compressionRatio,
    }
  } catch (err) {
    console.error(`[Google Drive OAuth] Upload error:`, err)
    throw err
  }
}
