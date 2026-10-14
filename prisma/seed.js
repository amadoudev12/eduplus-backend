// DONNÉES DE DÉVELOPPEMENT UNIQUEMENT
// Ce script remplit la base avec des données fictives pour tester EduPlus.
// On peut le relancer sans risque : il ne supprime rien et ne crée pas de doublons.
import "dotenv/config"
import fs from "fs"
import path from "path"
import bcrypt from "bcryptjs"
import { prisma } from "../utils/prisma.js"
import { envoyerSurCloudinary } from "../utils/cloudinary.js"

const MOT_DE_PASSE_TEST = "motdepasse123"

const sujets = [
    { titre: "Partiel d'algèbre linéaire", description: "Matrices, déterminants et systèmes d'équations linéaires.", type: "examen", annee: 2025, matiere: "Algèbre", niveau: "Licence 1" },
    { titre: "TD d'algorithmique : les tris", description: "Tri par insertion, tri fusion et calcul de complexité.", type: "exercice", annee: 2024, matiere: "Algorithmique", niveau: "Licence 1" },
    { titre: "Cas pratique sur la responsabilité civile", description: "Responsabilité du fait personnel et du fait des choses.", type: "devoir", annee: 2025, matiere: "Droit civil", niveau: "Licence 2" },
    { titre: "Interrogation de microéconomie", description: "Théorie du consommateur et élasticités.", type: "interrogation", annee: 2023, matiere: "Microéconomie", niveau: "Licence 1" },
    { titre: "Examen de bases de données", description: "Modèle relationnel et requêtes SQL.", type: "examen", annee: 2024, matiere: "Bases de données", niveau: "Licence 3" },
    { titre: "Partiel de thermodynamique", description: "Premier et second principes.", type: "examen", annee: 2025, matiere: "Thermodynamique", niveau: "Licence 2" },
    { titre: "Concours d'entrée en master : épreuve d'analyse", description: null, type: "concours", annee: 2022, matiere: "Analyse", niveau: "Master 1" },
    { titre: "Devoir de droit constitutionnel", description: "Commentaire d'un article de la Constitution.", type: "devoir", annee: 2025, matiere: "Droit constitutionnel", niveau: "Licence 1" },
]

async function remplirLaBase() {
    const motDePasse = await bcrypt.hash(MOT_DE_PASSE_TEST, 10)

    await prisma.utilisateur.createMany({
        data: [
            { nom: "Test", prenom: "Admin", email: "admin@eduplus.dev", motDePasse, role: "admin" },
            { nom: "Test", prenom: "Étudiant", email: "eleve@eduplus.dev", motDePasse, niveau: "Licence 2", etablissement: "Université de test" },
        ],
        skipDuplicates: true,
    })

    // Les sujets fictifs ne sont ajoutés que si la base n'en contient encore aucun
    if ((await prisma.sujet.count()) > 0) {
        console.log("La base contient déjà des sujets : aucun sujet fictif ajouté.")
        return
    }

    const eleve = await prisma.utilisateur.findUnique({ where: { email: "eleve@eduplus.dev" } })

    const pdfExemple = fs.readFileSync(path.join(import.meta.dirname, "sujet-exemple.pdf"))

    for (const sujet of sujets) {
        // Chaque sujet fictif reçoit sa propre copie du PDF d'exemple sur Cloudinary
        const fichier = await envoyerSurCloudinary(pdfExemple, "sujet-exemple.pdf")

        await prisma.sujet.create({
            data: {
                titre: sujet.titre,
                description: sujet.description,
                type: sujet.type,
                annee: sujet.annee,
                fichier,
                utilisateur: { connect: { id: eleve.id } },
                matiere: sujet.matiere,
                niveau: sujet.niveau,
            },
        })
    }

    console.log(`${sujets.length} sujets fictifs ajoutés.`)
    console.log(`Comptes de test : admin@eduplus.dev et eleve@eduplus.dev (mot de passe : ${MOT_DE_PASSE_TEST})`)
}

remplirLaBase()
    .catch((erreur) => {
        console.error(erreur)
        process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
