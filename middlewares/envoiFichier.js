import path from "path"
import multer from "multer"

const EXTENSIONS_AUTORISEES = [".pdf", ".doc", ".docx"]
const TAILLE_MAX = 5 * 1024 * 1024 // 5 Mo

// Premiers octets attendus au début du fichier, pour refuser un fichier renommé (ex : une image en .pdf)
const SIGNATURES = {
    ".pdf": [0x25, 0x50, 0x44, 0x46], // %PDF
    ".doc": [0xd0, 0xcf, 0x11, 0xe0],
    ".docx": [0x50, 0x4b, 0x03, 0x04],
}

function filtrerFichier(req, file, cb) {
    const extension = path.extname(file.originalname).toLowerCase()
    if (!EXTENSIONS_AUTORISEES.includes(extension)) {
        const erreur = new Error("Fichier invalide : seuls les fichiers PDF, DOC et DOCX sont acceptés.")
        erreur.fichierInvalide = true
        return cb(erreur)
    }
    cb(null, true)
}

// Reçoit un seul fichier envoyé dans le champ "fichier" du formulaire.
// Il est gardé en mémoire (req.file.buffer) le temps d'être envoyé sur Cloudinary
export const envoiFichier = multer({
    storage: multer.memoryStorage(),
    fileFilter: filtrerFichier,
    limits: { fileSize: TAILLE_MAX },
}).single("fichier")

// Vérifier que le contenu du fichier correspond bien à son extension
export function contenuCorrespondExtension(fichier) {
    const signature = SIGNATURES[path.extname(fichier.originalname).toLowerCase()]
    return Boolean(signature) && signature.every((octet, position) => fichier.buffer[position] === octet)
}

// multer lit le nom du fichier en latin1 : on le remet en UTF-8 pour retrouver les accents
export function nomOriginal(fichier) {
    return Buffer.from(fichier.originalname, "latin1").toString("utf8")
}
