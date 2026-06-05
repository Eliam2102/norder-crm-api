import 'dotenv/config'
import pkg from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const { PrismaClient } = pkg

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function check() {
  try {
    const user = await prisma.user.findUnique({ where: { email: 'test@example.com' } })
    console.log("Success:", user)
  } catch (err) {
    console.error("Prisma error name:", err.name)
    console.error("Prisma error message:", err.message)
    console.error("Prisma error code:", err.code)
    console.error("Prisma error meta:", err.meta)
  } finally {
    await prisma.$disconnect()
  }
}

check()
