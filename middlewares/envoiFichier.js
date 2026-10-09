import fs from "fs"
import path from "path"
import crypto from "crypto"
import multer from "multer"

// Dossier où sont enregistrés les fichiers des sujets
export const DOSSIER_FICHIERS = path.join(import.meta.dirname, "..", "fichiers")
fs.mkdirSync(DOSSIER_FICHIERS, { recursive: true })

const EXTENSIONS_AUTORISEES = [".pdf", ".doc", ".docx"]
const TAILLE_MAX = 10 * 1024 * 1024 // 10 Mo

const stockage = multer.diskStorage({
    destination: DOSSIER_FICHIERS,
    // On donne un nom unique au fichier pour ne jamais écraser celui d'un autre sujet
    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase()
        cb(null, Date.now() + "-" + crypto.randomBytes(6).toString("hex") + extension)
    },
})

function filtrerFichier(req, file, cb) {
    const extension = path.extname(file.originalname).toLowerCase()
    if (!EXTENSIONS_AUTORISEES.includes(extension)) {
        const erreur = new Error("Fichier invalide : seuls les fichiers PDF, DOC et DOCX sont acceptés.")
        erreur.fichierInvalide = true
        return cb(erreur)
    }
    cb(null, true)
}

// Reçoit un seul fichier envoyé dans le champ "fichier" du formulaire
export const envoiFichier = multer({
    storage: stockage,
    fileFilter: filtrerFichier,
    limits: { fileSize: TAILLE_MAX },
}).single("fichier")

export function supprimerFichier(nomFichier) {
    if (!nomFichier) return
    fs.rmSync(path.join(DOSSIER_FICHIERS, nomFichier), { force: true })
}
