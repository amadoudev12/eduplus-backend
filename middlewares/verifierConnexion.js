import jwt from "jsonwebtoken"
import { prisma } from "../utils/prisma.js"

// Retrouver l'utilisateur connecté grâce au cookie "jeton" (null si personne n'est connecté)
export async function trouverUtilisateurConnecte(req) {
    const jeton = req.cookies.jeton
    if (!jeton) return null

    try {
        const contenu = jwt.verify(jeton, process.env.JWT_SECRET)
        return await prisma.utilisateur.findUnique({
            where: { id: contenu.utilisateurId },
            omit: { motDePasse: true },
        })
    } catch (erreur) {
        // Jeton expiré ou modifié : on considère que personne n'est connecté
        if (erreur instanceof jwt.JsonWebTokenError) return null
        throw erreur
    }
}

// À placer devant les routes réservées aux utilisateurs connectés
export async function verifierConnexion(req, res, next) {
    const utilisateur = await trouverUtilisateurConnecte(req)
    if (!utilisateur) {
        return res.status(401).json({ message: "Vous devez être connecté pour faire cette action." })
    }

    req.utilisateur = utilisateur
    next()
}
