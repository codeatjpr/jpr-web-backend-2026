import 'dotenv/config'
import { connectDb } from '../db/connect.js'
import { ensureSeedData } from './seedData.js'
import { logger } from '../utils/logger.js'
import mongoose from 'mongoose'

async function run() {
  await connectDb()
  await ensureSeedData()
  logger.info('Seed complete')
  await mongoose.disconnect()
}

run().catch(async (err) => {
  logger.error({ err }, 'Seed failed')
  await mongoose.disconnect()
  process.exit(1)
})
