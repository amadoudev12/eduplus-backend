// DONNÉES DE DÉVELOPPEMENT UNIQUEMENT
// Ce script remplit la base avec des données fictives pour tester EduPlus.
// On peut le relancer sans risque : il ne supprime rien et ne crée pas de doublons.
import "dotenv/config"
import fs from "fs"
import path from "path"
import bcrypt from "bcryptjs"
import { prisma } from "../utils/prisma.js"
import { DOSSIER_FICHIERS } from "../middlewares/envoiFichier.js"

const MOT_DE_PASSE_TEST = "motdepasse123"

const sujets = [
    { titre: "Baccalauréat blanc de mathématiques", description: "Suites numériques, fonctions logarithmes et probabilités.", type: "examen", annee: 2025, matiere: "Mathématiques", niveau: "Terminale" },
    { titre: "Exercices sur les fractions", description: "Série d'exercices pour s'entraîner à additionner et simplifier des fractions.", type: "exercice", annee: 2024, matiere: "Mathématiques", niveau: "6e" },
    { titre: "Devoir de thermodynamique", description: "Introduction aux lois de la thermodynamique.", type: "devoir", annee: 2025, matiere: "Physique-Chimie", niveau: "Première" },
    { titre: "Interrogation sur la cellule", description: "Structure de la cellule animale et végétale.", type: "interrogation", annee: 2023, matiere: "SVT", niveau: "Seconde" },
    { titre: "Commentaire composé : texte classique", description: "Étude d'un texte classique en profondeur.", type: "devoir", annee: 2024, matiere: "Français", niveau: "Première" },
    { titre: "BEPC blanc d'anglais", description: "Compréhension de texte et expression écrite.", type: "examen", annee: 2025, matiere: "Anglais", niveau: "3e" },
    { titre: "Concours d'entrée : épreuve de mathématiques", description: null, type: "concours", annee: 2022, matiere: "Mathématiques", niveau: "Terminale" },
    { titre: "Partiel d'algèbre linéaire", description: "Matrices et systèmes d'équations linéaires.", type: "examen", annee: 2025, matiere: "Algèbre", niveau: "Licence 1" },
]

async function remplirLaBase() {
    const motDePasse = await bcrypt.hash(MOT_DE_PASSE_TEST, 10)

    await prisma.utilisateur.createMany({
        data: [
            { nom: "Test", prenom: "Admin", email: "admin@eduplus.dev", motDePasse, role: "admin" },
            { nom: "Test", prenom: "Élève", email: "eleve@eduplus.dev", motDePasse, niveau: "Terminale", etablissement: "Lycée de test" },
        ],
        skipDuplicates: true,
    })

    // Les sujets fictifs ne sont ajoutés que si la base n'en contient encore aucun
    if ((await prisma.sujet.count()) > 0) {
        console.log("La base contient déjà des sujets : aucun sujet fictif ajouté.")
        return
    }

    const eleve = await prisma.utilisateur.findUnique({ where: { email: "eleve@eduplus.dev" } })

    for (const [numero, sujet] of sujets.entries()) {
        // Chaque sujet fictif reçoit sa propre copie du PDF d'exemple
        const fichier = `exemple-${numero + 1}.pdf`
        fs.copyFileSync(path.join(import.meta.dirname, "sujet-exemple.pdf"), path.join(DOSSIER_FICHIERS, fichier))

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
