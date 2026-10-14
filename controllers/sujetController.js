import path from "path"
import { Readable } from "stream"
import { pipeline } from "stream/promises"
import { prisma } from "../utils/prisma.js"
import { contenuCorrespondExtension, nomOriginal } from "../middlewares/envoiFichier.js"
import { envoyerSurCloudinary, adresseFichier, supprimerDeCloudinary } from "../utils/cloudinary.js"
import { verifierCoherence } from "../utils/coherenceSujet.js"

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
    // Matière et niveau sont du texte libre : "algo" trouve aussi "Algorithmique"
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
    if (!contenuCorrespondExtension(fichier)) return "Fichier invalide : son contenu ne correspond pas à un fichier PDF, DOC ou DOCX."
    return verifierCoherence(sujet, nomOriginal(fichier))
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
        return res.status(400).json({ message: erreur })
    }

    // Le fichier n'est envoyé en ligne qu'une fois toutes les vérifications passées
    const fichier = await envoyerSurCloudinary(req.file.buffer, req.file.originalname)

    try {
        const nouveauSujet = await prisma.sujet.create({
            data: {
                ...sujet,
                description: sujet.description || null,
                fichier,
                utilisateurId: req.utilisateur.id,
            },
            include: AVEC_AUTEUR,
        })
        res.status(201).json(nouveauSujet)
    } catch (erreurBase) {
        // Le sujet n'a pas pu être enregistré : on retire le fichier déjà envoyé en ligne
        await supprimerDeCloudinary(fichier).catch(console.error)
        throw erreurBase
    }
}

// Retrouver un sujet et récupérer son fichier sur Cloudinary.
// Répond directement en cas de problème et renvoie null.
async function trouverSujetAvecFichier(req, res) {
    const id = Number(req.params.id)
    const sujet = Number.isInteger(id) ? await prisma.sujet.findUnique({ where: { id } }) : null
    if (!sujet) {
        res.status(404).json({ message: "Ce sujet n'existe pas." })
        return null
    }

    const reponse = await fetch(adresseFichier(sujet.fichier))
    if (!reponse.ok) {
        console.error(`Cloudinary a répondu ${reponse.status} pour le fichier ${sujet.fichier}`)
        res.status(404).json({ message: "Le fichier de ce sujet est introuvable." })
        return null
    }
    return { sujet, reponse }
}

// Transmettre au navigateur le fichier reçu de Cloudinary
async function transmettreFichier(reponse, res) {
    const taille = reponse.headers.get("content-length")
    if (taille) res.set("Content-Length", taille)
    res.set("X-Content-Type-Options", "nosniff")
    await pipeline(Readable.fromWeb(reponse.body), res)
}

// Afficher le fichier dans le navigateur (bouton « Voir »)
export async function voirFichier(req, res) {
    const trouve = await trouverSujetAvecFichier(req, res)
    if (!trouve) return

    res.type(path.extname(trouve.sujet.fichier))
    await transmettreFichier(trouve.reponse, res)
}

// Télécharger le fichier et compter le téléchargement (bouton « Télécharger »)
export async function telechargerSujet(req, res) {
    const trouve = await trouverSujetAvecFichier(req, res)
    if (!trouve) return
    const { sujet, reponse } = trouve

    await prisma.sujet.update({
        where: { id: sujet.id },
        data: { telechargements: { increment: 1 } },
    })

    // Le fichier téléchargé porte le titre du sujet, sans les caractères interdits dans un nom de fichier
    const nomTelechargement = sujet.titre.replace(/[\\/:*?"<>|]/g, "-") + path.extname(sujet.fichier)
    res.attachment(nomTelechargement)
    await transmettreFichier(reponse, res)
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
    // Le sujet est déjà supprimé : un problème côté Cloudinary ne doit pas faire échouer la demande
    await supprimerDeCloudinary(sujet.fichier).catch(console.error)
    res.json({ message: "Le sujet a été supprimé." })
}
