import { createApp } from './app.js'
import { env } from './config/env.js'
import { connectDb } from './db/connect.js'
import { logger } from './utils/logger.js'
import { ensureSeedData } from './scripts/seedData.js'

async function main() {
  await connectDb()
  await ensureSeedData()

  const app = createApp()
  app.listen(env.PORT, () => {
    logger.info(`jpr-backend listening on http://localhost:${env.PORT}`)
  })
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start server')
  process.exit(1)
})
