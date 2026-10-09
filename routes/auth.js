import { Router } from "express"
import rateLimit from "express-rate-limit"
import { inscription, connexion, deconnexion, moi } from "../controllers/authController.js"

const routes = Router()

// Limiter le nombre d'essais pour éviter qu'on devine les mots de passe
const limiteTentatives = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    message: { message: "Trop de tentatives. Réessaie dans quelques minutes." },
})

routes.post("/inscription", limiteTentatives, inscription)
routes.post("/connexion", limiteTentatives, connexion)
routes.post("/deconnexion", deconnexion)
routes.get("/moi", moi)

export default routes
