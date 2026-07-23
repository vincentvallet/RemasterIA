# RemasterIA

RemasterIA est une galerie interactive permettant de comparer des captures originales de jeux vidéo avec leurs réinterprétations créées par intelligence artificielle.

Le site public est entièrement statique :

* aucune base de données ;
* aucun compte utilisateur ;
* aucune administration en ligne ;
* aucune fonction serveur ;
* aucun démarrage à froid ;
* déploiement automatique sur Netlify après publication sur GitHub.

Les créations sont préparées avec **RemasterIA Studio**, une interface locale qui optimise, organise et publie automatiquement les images.

---

# Ajouter des images avec RemasterIA Studio

RemasterIA Studio est la méthode officielle pour ajouter des créations.

Il prend en charge :

* l’organisation des dossiers ;
* le nommage des fichiers ;
* la conversion en WebP ;
* la compression ;
* le redimensionnement ;
* la création des miniatures ;
* la numérotation des scènes ;
* la mise à jour du manifeste ;
* la création du commit Git ;
* l’envoi vers GitHub.

## 1. Ouvrir le projet

Dans Windows PowerShell :

```powershell
cd "C:\Users\Vicen\Documents\RemasterIA"
```

Adaptez le chemin si le projet se trouve dans un autre dossier.

## 2. Lancer le studio

```bash
npm run studio
```

Le navigateur s’ouvre normalement sur :

```text
http://127.0.0.1:4174
```

Si le port `4174` est déjà utilisé, le studio choisit automatiquement le prochain port disponible.

Le studio écoute uniquement sur l’ordinateur local. Il n’est pas accessible depuis Internet ni depuis un autre appareil du réseau.

## 3. Ajouter une création

Dans l’interface :

1. saisissez le nom du jeu ;
2. choisissez un jeu existant ou créez-en un nouveau ;
3. déposez l’image originale ;
4. déposez l’image remasterisée ;
5. renseignez éventuellement l’outil IA utilisé ;
6. vérifiez les dimensions et les proportions ;
7. contrôlez le résultat avec le comparateur avant/après ;
8. si les ratios diffèrent, choisissez explicitement si le remaster doit être adapté ;
9. cliquez sur **Ajouter à la galerie**.

Le studio :

* applique l’orientation EXIF ;
* redimensionne uniquement les images trop grandes ;
* conserve les proportions ;
* convertit les images en WebP ;
* utilise une compression adaptative ;
* génère une miniature ;
* calcule le prochain numéro disponible ;
* met à jour `data/gallery.json` ;
* conserve l’ajout uniquement sur l’ordinateur tant qu’il n’est pas publié.

## Exemple de fichiers produits

```text
public/gallery/
  another-world/
    001-original.webp
    001-remaster.webp
    001-thumbnail.webp
```

Vous n’avez pas besoin de créer les dossiers ni de renommer les fichiers manuellement.

---

# Traitement des images

Le studio accepte les formats suivants :

* JPEG ;
* PNG ;
* WebP ;
* AVIF ;
* TIFF non animé.

## Dimensions

Le côté le plus long est limité à :

```text
2560 pixels
```

Les images plus petites ne sont jamais agrandies.

## Compression WebP

Le studio teste plusieurs niveaux de qualité :

```text
84 → 82 → 78 → 74
```

Il conserve le meilleur compromis entre qualité visuelle et poids du fichier.

## Miniatures

Une miniature WebP de 480 pixels maximum est créée automatiquement à partir de l’image remasterisée.

Elle est utilisée dans :

* la recherche ;
* la navigation visuelle ;
* le bandeau de miniatures.

## Proportions

Le studio compare automatiquement les ratios des deux images.

Lorsque les proportions diffèrent, il permet de :

* conserver les images telles quelles ;
* adapter explicitement le remaster au format de l’original.

Aucun recadrage n’est appliqué sans confirmation.

---

# Ajouter à la galerie ou publier

## Ajouter à la galerie

Le bouton **Ajouter à la galerie** :

* écrit les fichiers sur l’ordinateur ;
* crée la miniature ;
* met à jour le manifeste ;
* permet de tester immédiatement la création en local ;
* ne crée pas de commit ;
* ne fait pas de push ;
* ne déclenche pas encore Netlify.

Il est possible d’ajouter plusieurs créations avant de les publier.

## Publier les créations

Le bouton **Publier les créations** :

1. vérifie la galerie ;
2. sélectionne uniquement les fichiers autorisés ;
3. crée un commit Git ;
4. envoie le commit vers GitHub ;
5. laisse Netlify détecter le nouveau commit ;
6. déclenche automatiquement un nouveau déploiement.

Le studio limite le commit à :

```text
public/gallery/
data/gallery.json
```

Il n’exécute jamais :

```bash
git add .
```

Il est recommandé de regrouper plusieurs créations dans un même commit afin de limiter le nombre de déploiements Netlify.

---

# Manifeste de la galerie

Le fichier principal de données est :

```text
data/gallery.json
```

Il contient notamment :

* les jeux ;
* les scènes ;
* les chemins des images ;
* les numéros ;
* les miniatures ;
* l’outil IA utilisé ;
* les dates de création.

Ce fichier est mis à jour automatiquement par RemasterIA Studio.

Il ne doit pas être modifié manuellement dans le fonctionnement normal.

---

# Vérifier la galerie

## Vérification

```bash
npm run gallery:check
```

Cette commande contrôle :

* les fichiers manquants ;
* les paires incomplètes ;
* les miniatures absentes ;
* les doublons ;
* les numéros invalides ;
* les erreurs du manifeste.

## Reconstruction

```bash
npm run gallery:rebuild
```

Cette commande parcourt `public/gallery` et reconstruit le manifeste à partir des fichiers présents.

## Migration de l’ancien format

Pour afficher un aperçu sans modifier les fichiers :

```bash
npm run gallery:migrate -- --dry-run
```

Pour lancer réellement la migration :

```bash
npm run gallery:migrate
```

Une sauvegarde locale des anciens fichiers peut être conservée dans :

```text
.gallery-migration-backup/
```

Ce dossier est ignoré par Git.

---

# Installation

## Prérequis

* Node.js 24 ;
* npm ;
* Git ;
* un compte GitHub ;
* un site Netlify connecté au dépôt GitHub.

## Installer les dépendances

```bash
npm install
```

## Créer la configuration locale

Dans Windows PowerShell :

```powershell
Copy-Item .env.example .env.local
```

## Variables d’environnement

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
STUDIO_MAX_FILE_MB=30
```

### `NEXT_PUBLIC_SITE_URL`

Cette variable sert à générer les URL absolues utilisées notamment par :

* `sitemap.xml` ;
* `robots.txt`.

En production, elle doit contenir l’adresse publique finale du site.

Exemple :

```env
NEXT_PUBLIC_SITE_URL=https://remasteria.netlify.app
```

Ne terminez pas l’URL par une barre oblique.

### `STUDIO_MAX_FILE_MB`

Cette variable définit la taille maximale autorisée pour chaque image envoyée au studio local.

Exemple :

```env
STUDIO_MAX_FILE_MB=30
```

---

# Lien VibeCodeClub

Le site affiche le message :

> Partagez vos RemasterIA sur le Discord de VibeCodeClub.fr

Seul `VibeCodeClub.fr` est cliquable.

Le lien est centralisé dans :

```text
src/config/site.ts
```

Il pointe vers :

```text
https://vibecodeclub.fr
```

Aucune variable d’environnement n’est nécessaire pour ce lien.

---

# Lancer le projet

## Site public en développement

```bash
npm run dev
```

Adresse locale habituelle :

```text
http://localhost:3000
```

## Studio local

```bash
npm run studio
```

Adresse locale habituelle :

```text
http://127.0.0.1:4174
```

## Build de production

```bash
npm run build
```

Le build statique est généré dans :

```text
out/
```

---

# Prérequis pour publier sur GitHub

Le bouton **Publier les créations** ne fonctionne que si :

1. Git est installé ;
2. le dossier RemasterIA est un dépôt Git ;
3. le dépôt contient au moins un commit ;
4. un dépôt GitHub existe ;
5. un remote nommé `origin` est configuré ;
6. l’ordinateur est authentifié auprès de GitHub ;
7. Netlify est connecté à ce dépôt ;
8. Netlify surveille la branche utilisée, généralement `main`.

## Vérifier Git

```powershell
git --version
git status
git remote -v
git branch --show-current
```

* `git --version` vérifie que Git est installé ;
* `git status` vérifie que le projet est un dépôt Git ;
* `git remote -v` affiche l’adresse GitHub configurée ;
* `git branch --show-current` affiche la branche active.

---

# Créer le premier commit

Avant le premier commit, vérifiez que les fichiers secrets sont ignorés.

Le fichier `.gitignore` doit notamment contenir :

```gitignore
.env
.env.local
.env.*.local
node_modules
.next
out
.gallery-migration-backup
```

Vérifiez que `.env.local` est ignoré :

```powershell
git check-ignore .env.local
```

La commande doit afficher :

```text
.env.local
```

Initialisez ensuite le dépôt si nécessaire :

```powershell
cd "C:\Users\Vicen\Documents\RemasterIA"

git init
git add .
git status
git commit -m "Initial RemasterIA release"
git branch -M main
```

Examinez attentivement `git status` avant le commit afin de vérifier qu’aucun fichier personnel ou secret n’est inclus.

---

# Connecter le projet à GitHub

Créez un dépôt GitHub vide, par exemple :

```text
remasteria
```

Lors de sa création, n’ajoutez pas automatiquement :

* de README ;
* de licence ;
* de `.gitignore`.

Ajoutez ensuite le dépôt distant :

```powershell
git remote add origin https://github.com/VOTRE-COMPTE/remasteria.git
```

Envoyez le premier commit :

```powershell
git push -u origin main
```

Si un remote existe déjà :

```powershell
git remote -v
```

Pour corriger son adresse :

```powershell
git remote set-url origin https://github.com/VOTRE-COMPTE/remasteria.git
```

---

# Authentification GitHub

RemasterIA Studio n’utilise aucun token GitHub dans le navigateur.

Il utilise l’authentification Git déjà configurée sur l’ordinateur.

Lors du premier push manuel, GitHub peut demander :

* une connexion dans le navigateur ;
* une authentification avec Git Credential Manager ;
* une configuration SSH.

Une fois le premier push manuel réussi, le bouton **Publier les créations** doit pouvoir effectuer les prochains push automatiquement.

---

# Déploiement automatique Netlify

Le workflow complet est :

```text
RemasterIA Studio
→ images WebP optimisées
→ mise à jour de data/gallery.json
→ commit Git
→ push GitHub
→ build Netlify
→ nouvelle galerie en ligne
```

Le studio ne peut pas confirmer la fin du déploiement Netlify sans utiliser l’API Netlify.

Après le push, il indique simplement que les fichiers ont été envoyés sur GitHub et que Netlify devrait démarrer automatiquement un nouveau déploiement.

Consultez l’interface Netlify pour suivre la progression.

---

# Dépannage

## Le projet n’est pas un dépôt Git

Vérifiez :

```bash
git status
```

Si nécessaire :

```bash
git init
```

## Aucun commit initial

```bash
git add .
git status
git commit -m "Initial RemasterIA release"
```

Vérifiez avant le commit qu’aucun secret ou fichier personnel n’est inclus.

## Aucun remote `origin`

Vérifiez :

```bash
git remote -v
```

Ajoutez-le :

```bash
git remote add origin https://github.com/VOTRE-COMPTE/remasteria.git
```

## GitHub refuse le push

Testez manuellement :

```bash
git push origin HEAD
```

Une authentification GitHub peut être nécessaire.

## La branche distante contient de nouvelles modifications

Récupérez-les manuellement :

```bash
git pull --rebase
```

Le studio n’exécute pas automatiquement cette commande.

## Netlify ne se met pas à jour

Vérifiez :

* que le nouveau commit apparaît sur GitHub ;
* que Netlify surveille le bon dépôt ;
* que Netlify surveille la bonne branche ;
* que la commande de build est `npm run build` ;
* que le dossier publié est `out` ;
* que le journal Netlify ne contient pas d’erreur ;
* que `NEXT_PUBLIC_SITE_URL` est correctement configurée.

---

# Maintenance et vérifications

```bash
npm run gallery:check
npm run lint
npm run typecheck
npm test
npm run build
```

Le build final doit produire :

```text
out/index.html
```



//////







OLD README :
# RemasterIA

RemasterIA est une galerie avant/après consacrée aux images de jeux originales et remasterisées. Le site public est statique, sans compte ni base de données. Les créations sont préparées avec un studio strictement local, publiées dans GitHub avec Git, puis déployées automatiquement par Netlify.

# Ajouter des images avec RemasterIA Studio

RemasterIA Studio est la méthode officielle pour ajouter des créations. Il gère les dossiers, les noms de fichiers, l’optimisation WebP, les miniatures et le manifeste JSON.

## Étape 1 — Ouvrir le projet

Dans Windows PowerShell :

```powershell
cd "C:\Users\Vicen\Documents\RemasterIA"
```

Adaptez ce chemin si le projet se trouve dans un autre dossier.

## Étape 2 — Lancer le studio

```bash
npm run studio
```

Le navigateur s’ouvre normalement sur :

```text
http://127.0.0.1:4174
```

Si le port 4174 est déjà utilisé, le studio choisit automatiquement le prochain port disponible. Il écoute uniquement sur l’ordinateur local.

## Étape 3 — Ajouter une création

Dans l’interface :

1. saisissez le nom du jeu ;
2. choisissez un jeu existant ou créez-en un nouveau ;
3. déposez l’image originale ;
4. déposez l’image remasterisée ;
5. renseignez éventuellement l’outil IA utilisé ;
6. vérifiez les dimensions et les proportions ;
7. contrôlez le résultat avec le comparateur avant/après ;
8. si les ratios diffèrent, choisissez explicitement si le remaster doit être recadré ;
9. cliquez sur **Ajouter à la galerie**.

Cet ajout :

- applique l’orientation EXIF ;
- redimensionne uniquement les images trop grandes ;
- convertit et compresse les images en WebP ;
- crée une miniature ;
- choisit automatiquement le prochain numéro libre ;
- met à jour `data/gallery.json` ;
- reste local et ne publie encore rien sur Internet.

Exemple de fichiers produits :

```text
public/gallery/
  another-world/
    001-original.webp
    001-remaster.webp
    001-thumbnail.webp
```

Vous n’avez pas à créer les dossiers ni à renommer les fichiers manuellement.

## Ajouter à la galerie ou publier

### Ajouter à la galerie

Le bouton **Ajouter à la galerie** :

- écrit les fichiers sur l’ordinateur ;
- met à jour le manifeste ;
- permet de vérifier la création localement ;
- ne crée pas de commit ;
- ne fait pas de push ;
- ne met pas encore Netlify à jour.

### Publier les créations

Le bouton **Publier les créations** :

- vérifie la galerie et le manifeste ;
- sélectionne uniquement `public/gallery/` et `data/gallery.json` ;
- refuse de continuer si d’autres fichiers sont déjà préparés dans Git ;
- crée un commit Git ;
- envoie le commit sur la branche GitHub active avec `git push origin HEAD` ;
- laisse Netlify détecter ce nouveau commit et démarrer un déploiement.

Il est recommandé d’ajouter plusieurs créations avant de publier. Elles seront regroupées dans un seul commit et un seul déploiement Netlify.

# Prérequis pour publier sur GitHub

Le bouton de publication fonctionne uniquement si :

1. Git est installé ;
2. le dossier RemasterIA est un dépôt Git ;
3. le dépôt contient au moins un commit ;
4. un dépôt GitHub existe ;
5. un remote nommé `origin` relie le projet à GitHub ;
6. cet ordinateur est authentifié auprès de GitHub ;
7. Netlify est connecté à ce dépôt GitHub ;
8. Netlify surveille la branche envoyée par le studio.

Le studio refuse proprement de publier lorsqu’un de ces prérequis manque.

## Vérifier Git

Depuis le dossier du projet :

```powershell
git --version
git status
git remote -v
git branch --show-current
```

- `git --version` vérifie que Git est installé.
- `git status` vérifie que le dossier est un dépôt et affiche ses changements.
- `git remote -v` affiche l’adresse du dépôt GitHub.
- `git branch --show-current` affiche la branche active.

## Créer le premier commit

Le dépôt local actuel peut ne contenir encore aucun commit. Vérifiez d’abord que les secrets sont ignorés. Le fichier `.gitignore` doit conserver au minimum :

```gitignore
.env
.env.local
.env.*.local
node_modules
.next
out
```

Contrôlez spécifiquement `.env.local` :

```powershell
git check-ignore .env.local
```

La commande doit afficher :

```text
.env.local
```

Si elle ne retourne rien, corrigez `.gitignore` avant tout commit.

Initialisez ensuite Git si nécessaire et créez le premier commit :

```powershell
cd "C:\Users\Vicen\Documents\RemasterIA"

git init
git add .
git status
git commit -m "Initial RemasterIA release"
git branch -M main
```

Examinez attentivement `git status` avant le commit. Aucun fichier personnel, `.env` ou `.env.local` ne doit être inclus. `git add .` est indiqué uniquement pour cette initialisation manuelle contrôlée ; le bouton du studio ne l’utilise jamais.

## Connecter le dépôt à GitHub

Créez d’abord un dépôt GitHub vide, par exemple `remasteria`. Lors de sa création, ne demandez pas à GitHub d’ajouter un README, une licence ou un `.gitignore`, car ils existent déjà.

Ajoutez ensuite le remote et envoyez le premier commit :

```powershell
git remote add origin https://github.com/VOTRE-COMPTE/remasteria.git
git push -u origin main
```

Si `origin` existe déjà :

```powershell
git remote -v
```

Pour corriger son URL :

```powershell
git remote set-url origin https://github.com/VOTRE-COMPTE/remasteria.git
```

## Authentification GitHub

RemasterIA Studio ne demande et ne stocke aucun token GitHub dans le navigateur. Il utilise l’authentification Git déjà configurée sur l’ordinateur.

Au premier push, GitHub peut ouvrir une connexion dans le navigateur, utiliser Git Credential Manager ou demander votre configuration SSH. Après un premier push manuel réussi, le bouton **Publier les créations** peut normalement effectuer les push suivants.

# Connecter GitHub à Netlify

Le flux de publication est :

```text
RemasterIA Studio
→ commit Git
→ push GitHub
→ Netlify détecte le commit
→ Netlify reconstruit le site
→ les nouvelles images apparaissent en ligne
```

Dans Netlify :

1. ouvrez le site RemasterIA existant, ou créez un site depuis Git ;
2. connectez le dépôt GitHub `remasteria` ;
3. choisissez la branche de production, généralement `main` ;
4. vérifiez les paramètres de build ci-dessous ;
5. enregistrez la configuration ;
6. lancez un premier déploiement ;
7. contrôlez le résultat et le journal de build.

Configuration réellement définie dans `netlify.toml` :

```text
Commande de build : npm run build
Dossier publié : out
Version Node.js : 24
```

La branche de production n’est pas déclarée dans `netlify.toml` : elle doit être choisie dans Netlify. Après `git branch -M main`, sélectionnez normalement `main`.

## Comment la mise à jour automatique fonctionne

1. Les images sont ajoutées localement.
2. **Publier les créations** crée un commit.
3. Le commit est envoyé vers la branche GitHub active.
4. Netlify surveille la branche de production configurée.
5. Netlify détecte le nouveau commit.
6. Netlify exécute `npm run build`.
7. Le script `prebuild` relit `data/gallery.json` et génère la galerie publique.
8. Les nouvelles images WebP sont incluses.
9. Netlify remplace le site public par la nouvelle version.

Sans l’API Netlify, le studio ne peut pas confirmer la fin du déploiement. Après le push, il indique honnêtement :

> Les fichiers ont été envoyés sur GitHub. Netlify devrait maintenant démarrer automatiquement un nouveau déploiement.

# Configuration

Copiez `.env.example` vers `.env.local` :

```powershell
Copy-Item .env.example .env.local
```

Variables principales :

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
STUDIO_MAX_FILE_MB=30
```

- `NEXT_PUBLIC_SITE_URL` sert au sitemap, au fichier robots et au bouton **Ouvrir le site** du studio.
- `STUDIO_MAX_FILE_MB` limite la taille de chaque image envoyée au studio.

Le lien communautaire est centralisé dans le code et reste fixé à `https://vibecodeclub.fr`.

# Dépannage

## Le projet n’est pas un dépôt Git

```powershell
git init
```

## Aucun commit initial

```powershell
git add .
git status
git commit -m "Initial RemasterIA release"
```

## Aucun remote `origin`

```powershell
git remote -v
git remote add origin https://github.com/VOTRE-COMPTE/remasteria.git
```

## GitHub refuse le push

Testez manuellement :

```powershell
git push origin HEAD
```

Une authentification GitHub ou Git Credential Manager peut être nécessaire.

## La branche distante contient des changements

Examinez la situation puis lancez manuellement, si approprié :

```powershell
git pull --rebase
```

Le studio n’exécute jamais automatiquement cette commande.

## Netlify ne se met pas à jour

Vérifiez :

- le dépôt GitHub connecté ;
- la branche de production ;
- la présence du nouveau commit sur GitHub ;
- le journal de déploiement Netlify ;
- la commande `npm run build` ;
- le dossier publié `out` ;
- les variables d’environnement Netlify.

# Maintenance et vérifications

```bash
npm run gallery:check
npm run gallery:rebuild
npm run gallery:migrate -- --dry-run
npm run lint
npm run typecheck
npm test
npm run build
```

- `gallery:check` vérifie le manifeste et les fichiers sans rien modifier.
- `gallery:rebuild` reconstruit le manifeste depuis les scènes WebP complètes.
- `gallery:migrate -- --dry-run` affiche uniquement un aperçu de migration des anciens fichiers.
