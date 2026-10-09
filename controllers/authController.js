import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { prisma } from "../utils/prisma.js"
import { trouverUtilisateurConnecte } from "../middlewares/verifierConnexion.js"

const DUREE_SESSION = 7 * 24 * 60 * 60 * 1000 // 7 jours
const FORMAT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const OPTIONS_COOKIE = {
    httpOnly: true, // le JavaScript du navigateur ne peut pas lire le cookie
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
}

// Créer le jeton de session et le placer dans un cookie
function ouvrirSession(res, utilisateurId) {
    const jeton = jwt.sign({ utilisateurId }, process.env.JWT_SECRET, { expiresIn: "7d" })
    res.cookie("jeton", jeton, { ...OPTIONS_COOKIE, maxAge: DUREE_SESSION })
}

// Ne jamais renvoyer le mot de passe au frontend
function sansMotDePasse(utilisateur) {
    const { motDePasse, ...reste } = utilisateur
    return reste
}

export async function inscription(req, res) {
    const nom = String(req.body.nom || "").trim()
    const prenom = String(req.body.prenom || "").trim()
    const email = String(req.body.email || "").trim().toLowerCase()
    const motDePasse = String(req.body.motDePasse || "")
    const etablissement = String(req.body.etablissement || "").trim()
    const niveau = String(req.body.niveau || "").trim()

    if (!nom || !prenom || !email || !motDePasse) {
        return res.status(400).json({ message: "Le nom, le prénom, l'email et le mot de passe sont obligatoires." })
    }
    if (!FORMAT_EMAIL.test(email)) {
        return res.status(400).json({ message: "L'adresse email n'est pas valide." })
    }
    if (motDePasse.length < 8) {
        return res.status(400).json({ message: "Le mot de passe doit contenir au moins 8 caractères." })
    }
    // bcrypt ignore tout ce qui dépasse 72 octets
    if (Buffer.byteLength(motDePasse) > 72) {
        return res.status(400).json({ message: "Le mot de passe est trop long." })
    }

    if (niveau.length > 60 || etablissement.length > 100) {
        return res.status(400).json({ message: "La classe ou l'établissement est trop long." })
    }

    const dejaInscrit = await prisma.utilisateur.findUnique({ where: { email } })
    if (dejaInscrit) {
        return res.status(409).json({ message: "Un compte existe déjà avec cette adresse email." })
    }

    const utilisateur = await prisma.utilisateur.create({
        data: {
            nom,
            prenom,
            email,
            motDePasse: await bcrypt.hash(motDePasse, 10),
            niveau: niveau || null,
            etablissement: etablissement || null,
        },
    })

    ouvrirSession(res, utilisateur.id)
    res.status(201).json({ utilisateur: sansMotDePasse(utilisateur) })
}

export async function connexion(req, res) {
    const email = String(req.body.email || "").trim().toLowerCase()
    const motDePasse = String(req.body.motDePasse || "")

    if (!email || !motDePasse) {
        return res.status(400).json({ message: "L'email et le mot de passe sont obligatoires." })
    }

    // Même message si l'email n'existe pas ou si le mot de passe est faux,
    // pour ne pas révéler quels emails ont un compte
    const utilisateur = await prisma.utilisateur.findUnique({ where: { email } })
    const motDePasseCorrect = utilisateur && (await bcrypt.compare(motDePasse, utilisateur.motDePasse))
    if (!motDePasseCorrect) {
        return res.status(401).json({ message: "Email ou mot de passe incorrect." })
    }

    ouvrirSession(res, utilisateur.id)
    res.json({ utilisateur: sansMotDePasse(utilisateur) })
}

export function deconnexion(req, res) {
    res.clearCookie("jeton", OPTIONS_COOKIE)
    res.json({ message: "Vous êtes déconnecté." })
}

// Renvoie l'utilisateur connecté, ou null si personne n'est connecté
export async function moi(req, res) {
    const utilisateur = await trouverUtilisateurConnecte(req)
    res.json({ utilisateur })
}
