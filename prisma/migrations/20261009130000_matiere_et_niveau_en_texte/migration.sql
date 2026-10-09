-- La matière et le niveau deviennent du texte libre (élèves et étudiants).
-- Les noms déjà enregistrés sont recopiés avant de supprimer les anciennes tables.

-- Sujets
ALTER TABLE "Sujet" ADD COLUMN "matiere" TEXT, ADD COLUMN "niveau" TEXT;
UPDATE "Sujet" SET
    "matiere" = (SELECT "nom" FROM "Matiere" WHERE "Matiere"."id" = "Sujet"."matiereId"),
    "niveau" = (SELECT "nom" FROM "Niveau" WHERE "Niveau"."id" = "Sujet"."niveauId");
ALTER TABLE "Sujet" ALTER COLUMN "matiere" SET NOT NULL, ALTER COLUMN "niveau" SET NOT NULL;
ALTER TABLE "Sujet" DROP COLUMN "matiereId", DROP COLUMN "niveauId";

-- Utilisateurs
ALTER TABLE "Utilisateur" ADD COLUMN "niveau" TEXT;
UPDATE "Utilisateur" SET "niveau" = (SELECT "nom" FROM "Niveau" WHERE "Niveau"."id" = "Utilisateur"."niveauId");
ALTER TABLE "Utilisateur" DROP COLUMN "niveauId";

-- Anciennes tables
DROP TABLE "Matiere";
DROP TABLE "Niveau";
