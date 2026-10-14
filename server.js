import "dotenv/config"
import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import routesAuth from "./routes/auth.js"
import routesSujets from "./routes/sujets.js"

const variablesManquantes = ["DATABASE_URL", "JWT_SECRET", "CLOUDINARY_URL"].filter((nom) => !process.env[nom])
if (variablesManquantes.length > 0) {
    console.error(`Variable(s) d'environnement manquante(s) : ${variablesManquantes.join(", ")} (en local : fichier .env, en ligne : onglet Environment de Render)`)
    process.exit(1)
}

const app = express()
const PORT = process.env.PORT || 4000

// En ligne, les demandes traversent Vercel puis les serveurs de Render avant d'arriver ici.
// Sans ce réglage, tous les visiteurs auraient la même adresse IP (celle du dernier serveur traversé)
// et partageraient la même limite de tentatives de connexion.
if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 3)
}

// Seul le frontend a le droit d'appeler l'API (avec le cookie de session)
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }))
app.use(express.json())
app.use(cookieParser())

// Si la requête n'a pas de contenu, on met un objet vide pour pouvoir lire req.body sans erreur
app.use((req, res, next) => {
    req.body = req.body || {}
    next()
})

app.use("/api/auth", routesAuth)
app.use("/api/sujets", routesSujets)

app.use((req, res) => {
    res.status(404).json({ message: "Cette adresse n'existe pas." })
})

// Toutes les erreurs non prévues arrivent ici
app.use((erreur, req, res, next) => {
    if (erreur.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "Le fichier est trop volumineux (5 Mo maximum)." })
    }
    if (erreur.fichierInvalide) {
        return res.status(400).json({ message: erreur.message })
    }
    if (erreur.type === "entity.parse.failed") {
        return res.status(400).json({ message: "Les données envoyées ne sont pas valides." })
    }

    console.error(erreur)
    res.status(500).json({ message: "Erreur du serveur. Réessaie dans un instant." })
})

app.listen(PORT, () => {
    console.log(`Backend EduPlus démarré`)
})
