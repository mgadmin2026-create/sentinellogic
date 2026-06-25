require('dotenv').config({ path: '.env.local' })

module.exports = {
  apps: [
    {
      name: 'dialfire-sync',
      script: './scripts/dialfire-sync.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        DIALFIRE_API_KEY: process.env.DIALFIRE_API_KEY,
        DIALFIRE_CAMPAIGN_ID: process.env.DIALFIRE_CAMPAIGN_ID,
        WEBHOOK_URL: process.env.WEBHOOK_URL || 'http://localhost:3000/api/webhooks/dialfire-sync',
        POLL_INTERVAL: process.env.POLL_INTERVAL || '60000',
      },
      error_file: '.pm2/dialfire-sync-error.log',
      out_file: '.pm2/dialfire-sync-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
}
