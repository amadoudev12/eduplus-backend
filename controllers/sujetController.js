import fs from "fs"
import path from "path"
import { prisma } from "../utils/prisma.js"
import { DOSSIER_FICHIERS, supprimerFichier } from "../middlewares/envoiFichier.js"

const TYPES_SUJET = ["devoir", "exercice", "examen", "interrogation", "concours", "autre"]
const ANNEE_MIN = 1990

// Chaque sujet est renvoyé avec le nom de son auteur
const AVEC_AUTEUR = {
    utilisateur: { select: { id: true, prenom: true, nom: true } },
}

// Récupérer les sujets correspondant aux filtres (tous les filtres peuvent être combinés)
export async function listerSujets(req, res) {
    const { recherche, matiere, niveau, type, annee } = req.query
    const filtres = {}

    if (recherche) {
        const texte = String(recherche).trim()
        filtres.OR = [
            { titre: { contains: texte, mode: "insensitive" } },
            { description: { contains: texte, mode: "insensitive" } },
        ]
    }
    // Matière et niveau sont du texte libre : "math" trouve aussi "Mathématiques"
    if (matiere) filtres.matiere = { contains: String(matiere).trim(), mode: "insensitive" }
    if (niveau) filtres.niveau = { contains: String(niveau).trim(), mode: "insensitive" }
    if (annee) filtres.annee = Number(annee)
    if (type) filtres.type = type

    const anneeValide = !annee || Number.isInteger(filtres.annee)
    if (!anneeValide || (type && !TYPES_SUJET.includes(type))) {
        return res.status(400).json({ message: "Les filtres de recherche ne sont pas valides." })
    }

    const sujets = await prisma.sujet.findMany({
        where: filtres,
        include: AVEC_AUTEUR,
        orderBy: { dateCreation: "desc" },
    })
    res.json(sujets)
}

// Sujets publiés par l'utilisateur connecté
export async function listerMesSujets(req, res) {
    const sujets = await prisma.sujet.findMany({
        where: { utilisateurId: req.utilisateur.id },
        include: AVEC_AUTEUR,
        orderBy: { dateCreation: "desc" },
    })
    res.json(sujets)
}

// Vérifier les informations du formulaire de dépôt. Renvoie un message d'erreur, ou null si tout va bien
function verifierSujet(sujet, fichier) {
    if (!sujet.titre) return "Le titre est obligatoire."
    if (sujet.titre.length > 150) return "Le titre est trop long (150 caractères maximum)."
    if (sujet.description.length > 1000) return "La description est trop longue (1000 caractères maximum)."
    if (!sujet.matiere) return "La matière est obligatoire."
    if (!sujet.niveau) return "Le niveau est obligatoire."
    if (sujet.matiere.length > 60 || sujet.niveau.length > 60) return "La matière ou le niveau est trop long (60 caractères maximum)."
    if (!TYPES_SUJET.includes(sujet.type)) return "Le type de sujet n'est pas valide."

    const anneeActuelle = new Date().getFullYear()
    if (!Number.isInteger(sujet.annee) || sujet.annee < ANNEE_MIN || sujet.annee > anneeActuelle) {
        return `L'année doit être comprise entre ${ANNEE_MIN} et ${anneeActuelle}.`
    }
    if (!fichier) return "Le fichier du sujet est obligatoire."
    return null
}

export async function creerSujet(req, res) {
    const sujet = {
        titre: String(req.body.titre || "").trim(),
        description: String(req.body.description || "").trim(),
        type: req.body.type,
        annee: Number(req.body.annee),
        matiere: String(req.body.matiere || "").trim(),
        niveau: String(req.body.niveau || "").trim(),
    }

    const erreur = verifierSujet(sujet, req.file)
    if (erreur) {
        // Le fichier a déjà été enregistré par multer : on le retire puisque le sujet est refusé
        supprimerFichier(req.file?.filename)
        return res.status(400).json({ message: erreur })
    }

    try {
        const nouveauSujet = await prisma.sujet.create({
            data: {
                ...sujet,
                description: sujet.description || null,
                fichier: req.file.filename,
                utilisateurId: req.utilisateur.id,
            },
            include: AVEC_AUTEUR,
        })
        res.status(201).json(nouveauSujet)
    } catch (erreurBase) {
        supprimerFichier(req.file.filename)
        throw erreurBase
    }
}

// Retrouver un sujet et vérifier que son fichier est bien présent sur le disque.
// Répond directement en cas de problème et renvoie null.
async function trouverSujetAvecFichier(req, res) {
    const id = Number(req.params.id)
    const sujet = Number.isInteger(id) ? await prisma.sujet.findUnique({ where: { id } }) : null
    if (!sujet) {
        res.status(404).json({ message: "Ce sujet n'existe pas." })
        return null
    }
    if (!fs.existsSync(path.join(DOSSIER_FICHIERS, sujet.fichier))) {
        res.status(404).json({ message: "Le fichier de ce sujet est introuvable." })
        return null
    }
    return sujet
}

// Afficher le fichier dans le navigateur (bouton « Voir »)
export async function voirFichier(req, res) {
    const sujet = await trouverSujetAvecFichier(req, res)
    if (!sujet) return

    res.set("X-Content-Type-Options", "nosniff")
    res.sendFile(path.join(DOSSIER_FICHIERS, sujet.fichier))
}

// Télécharger le fichier et compter le téléchargement (bouton « Télécharger »)
export async function telechargerSujet(req, res) {
    const sujet = await trouverSujetAvecFichier(req, res)
    if (!sujet) return

    await prisma.sujet.update({
        where: { id: sujet.id },
        data: { telechargements: { increment: 1 } },
    })

    // Le fichier téléchargé porte le titre du sujet, sans les caractères interdits dans un nom de fichier
    const nomTelechargement = sujet.titre.replace(/[\\/:*?"<>|]/g, "-") + path.extname(sujet.fichier)
    res.set("X-Content-Type-Options", "nosniff")
    res.download(path.join(DOSSIER_FICHIERS, sujet.fichier), nomTelechargement)
}

// Seul l'auteur du sujet ou un administrateur peut le supprimer
export async function supprimerSujet(req, res) {
    const id = Number(req.params.id)
    const sujet = Number.isInteger(id) ? await prisma.sujet.findUnique({ where: { id } }) : null
    if (!sujet) {
        return res.status(404).json({ message: "Ce sujet n'existe pas." })
    }

    const estAuteur = sujet.utilisateurId === req.utilisateur.id
    if (!estAuteur && req.utilisateur.role !== "admin") {
        return res.status(403).json({ message: "Vous ne pouvez supprimer que vos propres sujets." })
    }

    await prisma.sujet.delete({ where: { id } })
    supprimerFichier(sujet.fichier)
    res.json({ message: "Le sujet a été supprimé." })
}
