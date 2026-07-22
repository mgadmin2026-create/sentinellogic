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
import { notifyAdminsOfDriveTokenFailure } from './drive-token-alert'

const gzip = promisify(zlib.gzip)

const ROOT_FOLDER_NAME = 'SentinelLogic Dokumente'

/**
 * Normalisiert Vor- und Nachname für Ordnernamen:
 * - Lowercase
 * - Umlaute ersetzen (ä→ae, ö→oe, ü→ue)
 * - Spaces durch Underscore
 * - Sonderzeichen entfernen
 */
function normalizeContactName(firstName: string, lastName: string): string {
  const normalize = (str: string) => {
    return str
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
  }
  const fn = normalize(firstName)
  const ln = normalize(lastName)
  if (fn && ln) return `${fn}_${ln}`
  if (ln) return ln
  if (fn) return fn
  return 'unnamed'
}

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
    try {
      const refreshed = await refreshAccessToken(token.refresh_token)
      accessToken = refreshed.accessToken

      const supabase = createServerClient()
      await supabase
        .from('google_drive_system_token')
        .update({
          access_token: refreshed.accessToken,
          expires_at: refreshed.expiresAt,
          updated_at: new Date().toISOString(),
          last_failure_notified_at: null,
        })
        .eq('id', 1)
      console.log('[Google Drive] Token erfolgreich erneuert')
    } catch (refreshErr) {
      console.error('[Google Drive] Token-Refresh fehlgeschlagen:', refreshErr)
      const message = refreshErr instanceof Error ? refreshErr.message : String(refreshErr)
      // Admins per Mail alarmieren statt dass ein Mitarbeiter das zufällig beim
      // nächsten Upload/E-Mail-Versand entdeckt. Cooldown-gesteuert; bewusst awaited,
      // damit der Alarm auf Vercel nicht durch Function-Termination verloren geht.
      await notifyAdminsOfDriveTokenFailure(message)
      throw new Error(
        'Google Drive Token-Refresh fehlgeschlagen. Bitte Google Drive in Einstellungen → Dokumente erneut verbinden.'
      )
    }
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
 * Format: {vorname_nachname} ({kontakt_id_kurz})
 */
export async function findOrCreateContactFolder(
  drive: drive_v3.Drive,
  rootFolderId: string,
  kontaktId: string,
  firstName: string,
  lastName: string
): Promise<{ id: string; name: string }> {
  const normalizedName = normalizeContactName(firstName, lastName)
  const folderName = `${normalizedName} (${kontaktId.slice(0, 8)})`
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
 * Generischer Unterordner: unter parentId finden oder anlegen.
 */
async function findOrCreateSubfolder(
  drive: drive_v3.Drive,
  parentId: string,
  name: string
): Promise<string> {
  const escapedName = name.replace(/'/g, "\\'")
  const res = await drive.files.list({
    q: `name='${escapedName}' and mimeType='application/vnd.google-apps.folder' and trashed=false and '${parentId}' in parents`,
    spaces: 'drive',
    fields: 'files(id, name)',
    pageSize: 1,
  })

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!
  }

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  })
  console.log(`[Google Drive] Unterordner angelegt: ${name} (${created.data.id})`)
  return created.data.id!
}

/**
 * Kategorie-Ordner (max. 2 Ebenen, z.B. "KFZ-Versicherung/Vertrag") unterhalb des
 * Kontakt-Ordners aufloesen. Lazy: Ordner entstehen erst beim ersten Upload.
 * Drive-IDs werden in drive_ordner_map persistiert, damit Umbenennungen in der
 * Config spaeter auf alle bestehenden Drive-Ordner propagiert werden koennen.
 */
async function resolveKategorieFolder(
  drive: drive_v3.Drive,
  kontaktId: string,
  contactFolderId: string,
  kategoriePfad: string
): Promise<string> {
  const segments = kategoriePfad
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 2)

  if (segments.length === 0) return contactFolderId

  const supabase = createServerClient()
  let parentId = contactFolderId
  let pfadSoFar = ''

  for (const segment of segments) {
    pfadSoFar = pfadSoFar ? `${pfadSoFar}/${segment}` : segment

    // Fast path: bekannte Drive-ID aus dem Mapping
    let folderId: string | null = null
    try {
      const { data } = await supabase
        .from('drive_ordner_map')
        .select('drive_folder_id')
        .eq('kontakt_id', kontaktId)
        .eq('pfad', pfadSoFar)
        .maybeSingle()
      folderId = data?.drive_folder_id ?? null
    } catch {
      // Tabelle fehlt o.ae. -> Drive-Suche uebernimmt
    }

    if (!folderId) {
      folderId = await findOrCreateSubfolder(drive, parentId, segment)
      try {
        await supabase.from('drive_ordner_map').upsert(
          {
            kontakt_id: kontaktId,
            pfad: pfadSoFar,
            drive_folder_id: folderId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'kontakt_id,pfad' }
        )
      } catch (err) {
        console.warn('[Google Drive] drive_ordner_map upsert fehlgeschlagen:', err)
      }
    }

    parentId = folderId
  }

  return parentId
}

/**
 * Datei je nach Typ komprimieren (Bilder via sharp, Dokumente/Text via gzip).
 */
async function compressFile(
  file: Buffer,
  mimeType: string,
  fileName: string
): Promise<{ data: Buffer; compressionRatio: number }> {
  // Komprimierung deaktiviert - Dateien werden unverändert hochgeladen
  return { data: file, compressionRatio: 0 }
}

export interface UploadResult {
  fileId: string
  fileName: string
  ordnerId: string
  ordnerName: string
  kontaktOrdnerId: string
  kategorie: string
  webViewLink: string | null
  originalSize: number
  compressedSize: number
  compressionRatio: number
}

/**
 * Dokument ins zentrale System-Konto hochladen (mit Kompression).
 * Legt bei Bedarf Root-, Kontakt- und Kategorie-Ordner an.
 * kategoriePfad z.B. "KFZ-Versicherung/Vertrag"; Default "Sonstiges".
 */
export async function uploadDocumentToGoogleDrive(
  file: Buffer,
  fileName: string,
  mimeType: string,
  kontaktId: string,
  firstName: string,
  lastName: string,
  kategoriePfad: string = 'Sonstiges'
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

  const folder = await findOrCreateContactFolder(drive, root, kontaktId, firstName, lastName)

  // Kategorie-Unterordner (max. 2 Ebenen) aufloesen; Datei landet dort
  const kategorie = kategoriePfad.trim() || 'Sonstiges'
  const targetFolderId = await resolveKategorieFolder(drive, kontaktId, folder.id, kategorie)

  const { data: compressedData, compressionRatio } = await compressFile(file, mimeType, fileName)

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [targetFolderId],
    },
    media: {
      mimeType: mimeType,
      body: Readable.from(compressedData),
    },
    fields: 'id, webViewLink',
  })

  console.log(`[Google Drive] ✅ Hochgeladen: ${fileName} → ${kategorie} (ID: ${response.data.id})`)

  return {
    fileId: response.data.id!,
    fileName: fileName,
    ordnerId: targetFolderId,
    ordnerName: folder.name,
    kontaktOrdnerId: folder.id,
    kategorie,
    webViewLink: response.data.webViewLink ?? null,
    originalSize: file.length,
    compressedSize: compressedData.length,
    compressionRatio: compressionRatio,
  }
}

export interface OrdnerstrukturNode {
  name: string
  children?: OrdnerstrukturNode[]
}

export interface Ordnerstruktur {
  privat: OrdnerstrukturNode[]
  gewerbe: OrdnerstrukturNode[]
}

export const DEFAULT_ORDNERSTRUKTUR: Ordnerstruktur = {
  privat: [
    { name: 'Lebensversicherung' },
    { name: 'KFZ-Versicherung' },
    { name: 'Haftpflichtversicherung' },
  ],
  gewerbe: [
    { name: 'Betriebshaftpflicht' },
    { name: 'Firmenrechtsschutz' },
    { name: 'KFZ-Versicherung' },
  ],
}

/**
 * Ordnerstruktur fuer einen Kontakt-Typ aus system_config laden (Fallback: Default).
 */
export async function getOrdnerstruktur(): Promise<Ordnerstruktur> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('system_config')
    .select('config')
    .eq('key', 'dokument_ordnerstruktur')
    .maybeSingle()

  const cfg = data?.config as Partial<Ordnerstruktur> | null
  if (!cfg || (!Array.isArray(cfg.privat) && !Array.isArray(cfg.gewerbe))) {
    return DEFAULT_ORDNERSTRUKTUR
  }
  return {
    privat: Array.isArray(cfg.privat) ? cfg.privat : [],
    gewerbe: Array.isArray(cfg.gewerbe) ? cfg.gewerbe : [],
  }
}

/**
 * Umbenennung einer Kategorie auf alle bestehenden Drive-Ordner propagieren.
 * Nur Kontakte des angegebenen Typs (privat/gewerbe) sind betroffen — dieselbe
 * Kategorie kann in beiden Strukturen existieren und darf nicht global umbenannt werden.
 * Benennt die Drive-Ordner (exakter Pfad) um und zieht Pfade in
 * drive_ordner_map + dokumente_metadata.kategorie nach (inkl. Unterpfade).
 */
export async function renameKategorieFolders(
  kontaktTyp: 'privat' | 'gewerbe',
  oldPfad: string,
  newPfad: string
): Promise<{ renamed: number; failed: number }> {
  const supabase = createServerClient()
  const newName = newPfad.split('/').pop()!

  // Kontakte des betroffenen Typs
  const { data: typKontakte, error: typError } = await supabase
    .from('contacts')
    .select('id')
    .eq('kontakt_typ', kontaktTyp)
  if (typError) throw new Error(`Kontakte lesen fehlgeschlagen: ${typError.message}`)
  const typIds = new Set((typKontakte ?? []).map((k) => k.id))

  // Alle betroffenen Mapping-Zeilen: exakter Pfad + Unterpfade
  const { data: allRows, error } = await supabase
    .from('drive_ordner_map')
    .select('id, kontakt_id, pfad, drive_folder_id')
    .or(`pfad.eq.${oldPfad},pfad.like.${oldPfad}/%`)

  if (error) throw new Error(`drive_ordner_map lesen fehlgeschlagen: ${error.message}`)
  const rows = (allRows ?? []).filter((r) => typIds.has(r.kontakt_id))

  let renamed = 0
  let failed = 0

  if (rows.length > 0) {
    const { drive } = await getSystemDriveClient()

    for (const row of rows) {
      const isExact = row.pfad === oldPfad
      // Drive-Umbenennung nur fuer den Ordner selbst; Kinder behalten ihren Namen
      if (isExact) {
        try {
          await drive.files.update({
            fileId: row.drive_folder_id,
            requestBody: { name: newName },
          })
          renamed++
        } catch (err) {
          console.error(`[Google Drive] Rename fehlgeschlagen (${row.drive_folder_id}):`, err)
          failed++
          continue
        }
      }

      const updatedPfad = isExact ? newPfad : `${newPfad}${row.pfad.slice(oldPfad.length)}`
      await supabase
        .from('drive_ordner_map')
        .update({ pfad: updatedPfad, updated_at: new Date().toISOString() })
        .eq('id', row.id)
    }
  }

  await renameKategorieMetadata(typIds, oldPfad, newPfad)
  return { renamed, failed }
}

/**
 * dokumente_metadata.kategorie von oldPfad (inkl. Unterpfade) auf newPfad umziehen —
 * nur fuer die uebergebenen Kontakt-IDs.
 */
async function renameKategorieMetadata(
  kontaktIds: Set<string>,
  oldPfad: string,
  newPfad: string
): Promise<void> {
  if (kontaktIds.size === 0) return
  const supabase = createServerClient()
  const ids = Array.from(kontaktIds)

  const { data: affected } = await supabase
    .from('dokumente_metadata')
    .select('id, kategorie')
    .or(`kategorie.eq.${oldPfad},kategorie.like.${oldPfad}/%`)
    .in('kontakt_id', ids)

  for (const doc of affected ?? []) {
    const updated =
      doc.kategorie === oldPfad ? newPfad : `${newPfad}${doc.kategorie.slice(oldPfad.length)}`
    await supabase.from('dokumente_metadata').update({ kategorie: updated }).eq('id', doc.id)
  }
}

/**
 * Datei in Google Drive umbenennen
 */
export async function renameFileInGoogleDrive(fileId: string, newName: string): Promise<void> {
  const { drive } = await getSystemDriveClient()

  try {
    await drive.files.update({
      fileId,
      requestBody: { name: newName },
    })
    console.log(`[Google Drive] ✅ Datei umbenannt: ${fileId} → ${newName}`)
  } catch (err) {
    console.error(`[Google Drive] Fehler beim Umbenennen (${fileId}):`, err)
    throw new Error(err instanceof Error ? err.message : 'Fehler beim Umbenennen')
  }
}

/**
 * Datei aus Google Drive löschen
 */
export async function deleteFileFromGoogleDrive(fileId: string): Promise<void> {
  const { drive } = await getSystemDriveClient()

  try {
    await drive.files.delete({ fileId })
    console.log(`[Google Drive] ✅ Datei gelöscht: ${fileId}`)
  } catch (err) {
    console.error(`[Google Drive] Fehler beim Löschen (${fileId}):`, err)
    throw new Error(err instanceof Error ? err.message : 'Fehler beim Löschen')
  }
}
