# Guide RemasterIA Studio

Le studio évite toute manipulation manuelle des noms, dossiers, conversions, fichiers JSON et commandes Git.

## Ajouter plusieurs scènes

Lancez `npm run studio`. Choisissez un titre proposé ou saisissez un nouveau jeu. Les variantes de casse, accents, espaces, tirets et underscores sont rapprochées pour éviter les doublons. Déposez les deux images, vérifiez l’alignement et choisissez explicitement un recadrage centré uniquement si leurs proportions diffèrent.

Le bouton **Ajouter à la galerie** optimise et enregistre la scène. Vous pouvez répéter l’opération : chaque scène reste locale et figure dans **Créations prêtes à être publiées**.

Le bouton **Retirer** est réservé à ces fichiers non suivis par Git. Une création déjà publiée ne peut pas être supprimée depuis le studio.

## Publier

**Publier les créations** vérifie le manifeste et Git, ajoute uniquement la galerie et son manifeste, crée un commit puis pousse la branche active vers `origin`. Les autres modifications du projet et les secrets ne sont jamais ajoutés. Après un push réussi, le studio indique seulement que Netlify devrait démarrer un déploiement ; il ne prétend pas connaître sa fin.

## Entretien

Utilisez `npm run gallery:check` pour un diagnostic sans écriture. `npm run gallery:rebuild` répare le manifeste depuis les fichiers complets. Avant de convertir l’ancienne galerie, commencez toujours par `npm run gallery:migrate -- --dry-run`.
