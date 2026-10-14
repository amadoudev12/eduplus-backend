// Vérifie que les informations d'un sujet parlent toutes de la même matière.
// On ne lit pas le contenu du fichier : on compare seulement les textes saisis
// (matière, titre, description) et le nom du fichier.

// Disciplines reconnues dans un texte (cherchées en minuscules et sans accents).
// Chaque discipline regroupe ses spécialités : « Algèbre » et « Mathématiques » vont ensemble.
// La matière saisie par l'utilisateur reste libre : une matière absente de cette liste est quand même vérifiée
// (voir « matiereReprise » plus bas).
const DISCIPLINES = [
    { nom: "Mathématiques", mots: /\b(math\w*|algebre|geometrie|arithmetique|topologie|analyse (reelle|complexe|numerique|fonctionnelle))\b/ },
    { nom: "Informatique", mots: /\b(informatique|algo\w*|programmation|bases? de donnees|structures? de donnees|genie logiciel|systemes? d exploitation|reseaux informatiques|intelligence artificielle)\b/ },
    { nom: "Physique", mots: /\b((?<!education )(?<!activite )physiques?|mecanique|thermodynamique|electromagnetisme|optique|electronique)\b/ },
    { nom: "Chimie", mots: /\b(chimie|biochimie)\b/ },
    { nom: "Biologie et santé", mots: /\b(biolog\w*|microbiologie|biochimie|genetique|physiologie|anatomie|medecine|pharmac\w*)\b/ },
    { nom: "Droit", mots: /^droit$|\b(droits? (civil|penal|constitutionnel|administratif|commercial|international|public|prive|fiscal|social|foncier|des|du|de)|juridiques?)\b/ },
    { nom: "Économie et gestion", mots: /\b(econom\w*|microeconomie|macroeconomie|comptabilite|marketing|management)\b/ },
    { nom: "Sociologie", mots: /\bsociolog\w*\b/ },
    { nom: "Psychologie", mots: /\bpsycholog\w*\b/ },
    { nom: "Science politique", mots: /\bsciences? politiques?\b/ },
    { nom: "Philosophie", mots: /\b(philosophie|philo)\b/ },
    { nom: "Histoire", mots: /\bhistoire\b/ },
    { nom: "Géographie", mots: /\bgeographie\b/ },
    { nom: "Lettres", mots: /\b(francais|litterature|linguistique)\b/ },
    { nom: "Anglais", mots: /\b(anglais|english)\b/ },
    { nom: "Espagnol", mots: /\bespagnol\b/ },
    { nom: "Allemand", mots: /\ballemand\b/ },
]

// Un mot de la matière ne compte que s'il est assez long pour avoir un sens ("de", "des", "et" sont ignorés)
const LONGUEUR_MIN_MOT = 4

// "Algèbre_L1-Info.pdf" devient "algebre l1 info pdf"
function simplifier(texte) {
    return (texte || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
}

// Liste des disciplines citées dans un texte déjà simplifié
function disciplinesCitees(texte) {
    return DISCIPLINES.filter((discipline) => discipline.mots.test(texte)).map((discipline) => discipline.nom)
}

// Vrai si le texte reprend au moins un mot important de la matière ("econometrie" est trouvé dans "td d econometrie").
// On compare le début des mots pour accepter les pluriels et les accords.
function partagentUnMot(matiere, texte) {
    const motsTexte = texte.split(" ")
    return matiere
        .split(" ")
        .filter((mot) => mot.length >= LONGUEUR_MIN_MOT)
        .some((mot) => motsTexte.some((motTexte) => motTexte.startsWith(mot.slice(0, 6))))
}

// Renvoie un message d'erreur si deux informations citent des matières différentes, ou null si tout concorde.
// Un titre, une description ou un nom de fichier qui ne cite aucune discipline n'est jamais en conflit avec les autres.
export function verifierCoherence(sujet, nomFichier) {
    const informations = [
        { libelle: "la matière", texte: sujet.matiere, estLaMatiere: true },
        { libelle: "le titre", texte: sujet.titre },
        { libelle: "la description", texte: sujet.description },
        { libelle: "le nom du fichier", texte: nomFichier },
    ].map((information) => {
        const texte = simplifier(information.texte)
        return { ...information, texte, disciplines: disciplinesCitees(texte) }
    })

    // Matière absente de la liste (ex : « Statistiques ») : il suffit qu'un des autres textes reprenne un de ses mots
    const [matiere, ...autres] = informations
    const matiereReprise = autres.some((autre) => partagentUnMot(matiere.texte, autre.texte))

    for (const [position, premiere] of informations.entries()) {
        for (const seconde of informations.slice(position + 1)) {
            if (seconde.disciplines.length === 0) continue

            let concordent = true
            if (premiere.disciplines.length > 0) {
                concordent = premiere.disciplines.some((discipline) => seconde.disciplines.includes(discipline))
            } else if (premiere.estLaMatiere) {
                // Sinon, un texte qui cite une discipline alors que rien ne reprend la matière est en conflit avec elle
                concordent = matiereReprise
            }

            if (!concordent) {
                const indique = premiere.disciplines.join(", ") || sujet.matiere
                return `Les informations ne concordent pas : ${premiere.libelle} indique « ${indique} » alors que ${seconde.libelle} indique « ${seconde.disciplines.join(", ")} ». Corrige-les pour qu'ils parlent de la même matière.`
            }
        }
    }
    return null
}
