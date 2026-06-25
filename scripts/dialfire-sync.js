#!/usr/bin/env node
/**
 * Dialfire Sync Script
 * Polls Dialfire API for contact updates and sends them to Supabase via webhook
 *
 * Usage: node scripts/dialfire-sync.js
 * Environment variables required:
 *   - DIALFIRE_API_KEY
 *   - DIALFIRE_CAMPAIGN_ID
 *   - WEBHOOK_URL (defaults to http://localhost:3000/api/webhooks/dialfire-sync)
 *   - POLL_INTERVAL (defaults to 60000ms = 1 minute)
 */

const https = require('https')
const http = require('http')

const DIALFIRE_API_URL = 'https://api.dialfire.com'
const DIALFIRE_API_KEY = process.env.DIALFIRE_API_KEY
const DIALFIRE_CAMPAIGN_ID = process.env.DIALFIRE_CAMPAIGN_ID
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/api/webhooks/dialfire-sync'
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '60000', 10) // 1 minute default

let lastSyncTime = null
let contactsCache = new Map()

/**
 * Fetch contacts from Dialfire API
 */
async function fetchDialfireContacts() {
  return new Promise((resolve, reject) => {
    const url = `${DIALFIRE_API_URL}/api/campaigns/${DIALFIRE_CAMPAIGN_ID}/contacts`
    const options = {
      headers: {
        'Authorization': `Bearer ${DIALFIRE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }

    https.get(url, options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        // Check for HTTP errors
        if (res.statusCode !== 200) {
          return reject(new Error(`Dialfire API returned ${res.statusCode}: ${data}`))
        }

        try {
          const parsed = JSON.parse(data)
          const contacts = Array.isArray(parsed) ? parsed : parsed.data || []
          resolve(contacts)
        } catch (err) {
          reject(new Error(`Failed to parse Dialfire response: ${err.message}\nRaw: ${data.substring(0, 200)}`))
        }
      })
    }).on('error', reject)
  })
}

/**
 * Send contact update to webhook
 */
async function sendToWebhook(contact) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      contact: contact,
      state: 'updated',
    })

    const url = new URL(WEBHOOK_URL)
    const isHttps = url.protocol === 'https:'
    const client = isHttps ? https : http

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }

    const req = client.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, status: res.statusCode })
        } else {
          reject(new Error(`Webhook returned ${res.statusCode}: ${data}`))
        }
      })
    })

    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

/**
 * Main sync loop
 */
async function syncLoop() {
  try {
    console.log(`[${new Date().toISOString()}] Polling Dialfire...`)

    // Fetch contacts from Dialfire
    const contacts = await fetchDialfireContacts()
    console.log(`[Dialfire] Fetched ${contacts.length} contacts`)

    // Check for new/updated contacts
    let syncedCount = 0
    for (const contact of contacts) {
      const contactId = contact.$id
      const cached = contactsCache.get(contactId)

      // Compare versions to detect updates
      if (!cached || cached.$version !== contact.$version) {
        console.log(`[Webhook] Syncing contact ${contactId}...`)
        try {
          await sendToWebhook(contact)
          contactsCache.set(contactId, contact)
          syncedCount++
        } catch (err) {
          console.error(`[Webhook] Failed to sync ${contactId}: ${err.message}`)
        }
      }
    }

    if (syncedCount > 0) {
      console.log(`[Sync] Successfully synced ${syncedCount} contacts`)
    } else {
      console.log(`[Sync] No new updates`)
    }

    lastSyncTime = new Date().toISOString()
  } catch (err) {
    console.error(`[Error] Sync failed: ${err.message}`)
  }
}

/**
 * Start polling
 */
function start() {
  if (!DIALFIRE_API_KEY) {
    console.error('❌ DIALFIRE_API_KEY not set')
    process.exit(1)
  }
  if (!DIALFIRE_CAMPAIGN_ID) {
    console.error('❌ DIALFIRE_CAMPAIGN_ID not set')
    process.exit(1)
  }

  console.log('🚀 Dialfire Sync Script Started')
  console.log(`   Campaign: ${DIALFIRE_CAMPAIGN_ID}`)
  console.log(`   Webhook: ${WEBHOOK_URL}`)
  console.log(`   Poll Interval: ${POLL_INTERVAL}ms`)
  console.log('---')

  // Run immediately
  syncLoop()

  // Then run on interval
  setInterval(syncLoop, POLL_INTERVAL)
}

start()
