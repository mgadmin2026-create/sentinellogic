// Wähl-Konfiguration für die Placetel-Telefonie.
//
// Weg B (entschieden am 27.07.2026): Der Anruf wird direkt am Arbeitsplatz vom
// Placetel Softphone Plus ausgelöst, nicht serverseitig über die Placetel-API.
//
// Das exakte lokale Kommando von Softphone Plus ist herstellerseitig nicht
// öffentlich dokumentiert. Deshalb ist sowohl die Methode als auch die URL über
// system_config konfigurierbar — eine Korrektur nach dem Test am Arbeitsplatz
// ist damit eine Einstellung und kein neues Deployment.
import { createServerClient } from '@/lib/supabase/server'

export type DialMethod = 'tel' | 'local_http' | 'placetel_api'

export interface DialConfig {
  method: DialMethod
  /** Nur für 'local_http'. Platzhalter {nummer} = URL-kodierte E.164-Rufnummer. */
  urlTemplate: string
  enabled: boolean
}

export const DEFAULT_DIAL_CONFIG: DialConfig = {
  method: 'tel',
  urlTemplate: 'http://127.0.0.1:8080/make_call?number={nummer}',
  enabled: true,
}

const VALID_METHODS = new Set<DialMethod>(['tel', 'local_http', 'placetel_api'])

/**
 * Nur lokale Ziele zulassen. Ein frei konfigurierbares URL-Template dürfte sonst
 * die Rufnummer an einen beliebigen fremden Host schicken.
 */
export function isAllowedLocalDialUrl(rawUrl: string): boolean {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return false
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false

  const host = url.hostname.toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1'
}

export function parseDialConfig(raw: unknown): DialConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_DIAL_CONFIG

  const value = raw as Record<string, unknown>
  const method = typeof value.method === 'string' && VALID_METHODS.has(value.method as DialMethod)
    ? (value.method as DialMethod)
    : DEFAULT_DIAL_CONFIG.method

  const urlTemplate = typeof value.url_template === 'string' && value.url_template.trim()
    ? value.url_template.trim()
    : DEFAULT_DIAL_CONFIG.urlTemplate

  return {
    method,
    urlTemplate,
    enabled: value.enabled !== false,
  }
}

export async function getDialConfig(): Promise<DialConfig> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('system_config')
    .select('config')
    .eq('key', 'placetel_dial')
    .maybeSingle()

  if (error || !data) return DEFAULT_DIAL_CONFIG
  return parseDialConfig(data.config)
}

export interface DialCommand {
  /** 'tel' = Protokoll-Handler öffnen, 'http' = lokales Kommando absetzen */
  scheme: 'tel' | 'http'
  url: string
}

/**
 * Baut das Kommando, das der Browser am Arbeitsplatz ausführt.
 * Die Rufnummer muss bereits serverseitig validiert und normalisiert sein.
 */
export function buildDialCommand(config: DialConfig, normalizedPhone: string): DialCommand | null {
  if (config.method === 'tel') {
    return { scheme: 'tel', url: `tel:${normalizedPhone}` }
  }

  if (config.method === 'local_http') {
    const url = config.urlTemplate.replace('{nummer}', encodeURIComponent(normalizedPhone))
    if (!isAllowedLocalDialUrl(url)) return null
    return { scheme: 'http', url }
  }

  return null
}
