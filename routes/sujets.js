import { Router } from "express"
import { verifierConnexion } from "../middlewares/verifierConnexion.js"
import { envoiFichier } from "../middlewares/envoiFichier.js"
import {
    listerSujets,
    listerMesSujets,
    creerSujet,
    voirFichier,
    telechargerSujet,
    supprimerSujet,
} from "../controllers/sujetController.js"

const routes = Router()

// Routes publiques
routes.get("/", listerSujets)
routes.get("/:id/fichier", voirFichier)
routes.get("/:id/telecharger", telechargerSujet)

// Routes réservées aux utilisateurs connectés
routes.get("/mes-sujets", verifierConnexion, listerMesSujets)
routes.post("/", verifierConnexion, envoiFichier, creerSujet)
routes.delete("/:id", verifierConnexion, supprimerSujet)

export default routes
