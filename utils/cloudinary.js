import path from "path"
import crypto from "crypto"
import { v2 as cloudinary } from "cloudinary"

// Les identifiants du compte sont lus automatiquement dans la variable CLOUDINARY_URL
cloudinary.config({ secure: true })

// Dossier Cloudinary où sont rangés les fichiers des sujets
const DOSSIER_CLOUDINARY = "eduplus/sujets"

// Les PDF et documents Word sont des fichiers « bruts » pour Cloudinary (ni image, ni vidéo)
const TYPE_RESSOURCE = "raw"

// Envoyer un fichier sur Cloudinary. Renvoie son identifiant, à enregistrer dans la base
export function envoyerSurCloudinary(contenu, nomOriginal) {
    // On donne un nom unique au fichier pour ne jamais écraser celui d'un autre sujet
    const extension = path.extname(nomOriginal).toLowerCase()
    const identifiant = `${DOSSIER_CLOUDINARY}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}${extension}`

    return new Promise((resolve, reject) => {
        const envoi = cloudinary.uploader.upload_stream(
            { resource_type: TYPE_RESSOURCE, public_id: identifiant },
            (erreur, resultat) => (erreur ? reject(erreur) : resolve(resultat.public_id)),
        )
        envoi.end(contenu)
    })
}

// Adresse de téléchargement d'un fichier à partir de son identifiant.
// Elle est signée avec la clé secrète et ne reste valable qu'une heure : Cloudinary bloque
// la diffusion publique des PDF sur les comptes gratuits, mais pas ce téléchargement signé.
// Elle ne doit donc jamais être envoyée au navigateur : c'est le backend qui récupère le fichier.
export function adresseFichier(identifiant) {
    return cloudinary.utils.private_download_url(identifiant, "", { resource_type: TYPE_RESSOURCE, type: "upload" })
}

export async function supprimerDeCloudinary(identifiant) {
    if (!identifiant) return
    await cloudinary.uploader.destroy(identifiant, { resource_type: TYPE_RESSOURCE, invalidate: true })
}
