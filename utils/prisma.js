import { PrismaClient } from "@prisma/client"

// Une seule connexion à la base pour tout le backend
export const prisma = new PrismaClient()
