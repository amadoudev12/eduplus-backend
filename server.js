import "dotenv/config"
import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import routesAuth from "./routes/auth.js"
import routesSujets from "./routes/sujets.js"

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
    console.error("Il manque DATABASE_URL ou JWT_SECRET dans le fichier backend/.env")
    process.exit(1)
}

const app = express()
const PORT = process.env.PORT || 4000

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
        return res.status(400).json({ message: "Le fichier est trop volumineux (10 Mo maximum)." })
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
    console.log(`Backend EduPlus démarré sur http://localhost:${PORT}`)
})
