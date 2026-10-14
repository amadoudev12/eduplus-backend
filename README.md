# EduPlus — Backend

API de la plateforme EduPlus : comptes, sujets et fichiers.
Le site (Next.js) est dans un dépôt séparé : [plateforme-eduplus](https://github.com/amadoudev12/plateforme-eduplus).

- **Serveur** : Express + Prisma
- **Base de données** : PostgreSQL
- **Fichiers des sujets** : Cloudinary

## Installation

```bash
npm install
```

Copier `.env.example` en `.env`, puis remplir le mot de passe PostgreSQL dans `DATABASE_URL` et choisir une longue valeur aléatoire pour `JWT_SECRET`.

Les fichiers des sujets sont stockés sur [Cloudinary](https://cloudinary.com) : créer un compte gratuit, puis copier la valeur « API environment variable » du tableau de bord dans `CLOUDINARY_URL`.

Créer ensuite la base et ses tables :

```bash
npm run migrer   # crée la base "eduplus" et applique les migrations
npm run seed     # ajoute des données de développement (facultatif)
```

Comptes de test créés par `npm run seed` (développement uniquement) :

| Email | Mot de passe | Rôle |
|---|---|---|
| eleve@eduplus.dev | motdepasse123 | élève |
| admin@eduplus.dev | motdepasse123 | admin |

## Lancer le serveur

```bash
npm run dev   # http://localhost:4000
```

Le site se lance à part, depuis le dépôt du frontend (`npm run dev`, sur http://localhost:3000).

## Mise en ligne sur Render

1. Créer une base PostgreSQL en ligne (par exemple sur [Neon](https://neon.tech)) et copier son adresse de connexion.
2. Sur Render : **New > Blueprint**, choisir ce dépôt. Le fichier `render.yaml` configure le service.
3. Remplir les variables demandées :
   - `DATABASE_URL` : l'adresse de la base créée à l'étape 1
   - `CLOUDINARY_URL` : la même valeur que dans `.env`
   - `FRONTEND_URL` : l'adresse du site sur Vercel
4. Noter l'adresse du service (du type `https://eduplus-backend.onrender.com`) et la donner au frontend dans sa variable `BACKEND_URL`.

Les tables sont créées automatiquement à chaque déploiement (`prisma migrate deploy`).

## Organisation

```text
├── prisma/schema.prisma   tables de la base de données
├── prisma/seed.js         données de développement
├── routes/                adresses de l'API
├── controllers/           ce que fait chaque route
├── middlewares/           vérification de la connexion, réception des fichiers
├── utils/                 connexion à la base, envoi sur Cloudinary, cohérence des sujets
└── server.js              point d'entrée
```

## Routes de l'API

| Méthode | Adresse | Rôle | Connexion requise |
|---|---|---|---|
| POST | `/api/auth/inscription` | Créer un compte | non |
| POST | `/api/auth/connexion` | Se connecter | non |
| POST | `/api/auth/deconnexion` | Se déconnecter | non |
| GET | `/api/auth/moi` | Utilisateur connecté (ou `null`) | non |
| GET | `/api/sujets` | Liste des sujets, filtres `recherche`, `matiere`, `niveau`, `type`, `annee` | non |
| GET | `/api/sujets/mes-sujets` | Sujets de l'utilisateur connecté | oui |
| GET | `/api/sujets/:id/fichier` | Afficher le fichier d'un sujet | non |
| GET | `/api/sujets/:id/telecharger` | Télécharger le fichier d'un sujet | non |
| POST | `/api/sujets` | Déposer un sujet (avec fichier) | oui |
| DELETE | `/api/sujets/:id` | Supprimer un sujet (auteur ou admin) | oui |

## Règles de dépôt d'un sujet

- Fichier PDF, DOC ou DOCX de 5 Mo maximum, dont le contenu correspond bien à l'extension.
- La matière, le titre, la description et le nom du fichier doivent parler de la même matière : un sujet déclaré en « Droit civil » dont le titre ou le fichier cite l'algèbre est refusé. Le contenu du fichier n'est pas analysé. La matière reste libre ; les disciplines reconnues dans les textes sont listées dans `utils/coherenceSujet.js`.
