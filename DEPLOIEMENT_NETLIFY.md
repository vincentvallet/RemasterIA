# Déployer RemasterIA sur Netlify

RemasterIA est un site Next.js entièrement exporté en fichiers statiques.

Il ne nécessite :

* aucune base de données ;
* aucune fonction serveur ;
* aucune API publique ;
* aucun serveur Node.js permanent.

Le site est publié depuis GitHub. Chaque nouveau commit sur la branche de production déclenche automatiquement un nouveau build Netlify.

---

# Architecture de publication

```text
RemasterIA Studio
→ images WebP optimisées
→ manifeste local
→ commit Git
→ push GitHub
→ build Netlify
→ nouvelle galerie en ligne
```

Le studio local prépare les images et crée le commit.

GitHub stocke le projet et les créations.

Netlify construit et publie le site statique.

---

# Configuration détectée

La configuration finale est :

```text
Commande de build : npm run build
Dossier publié : out
Version Node.js : 24
Branche recommandée : main
```

Le fichier `next.config.ts` utilise :

```typescript
output: "export"
```

Le build Next.js génère donc le site statique dans :

```text
out/
```

Netlify ne doit pas publier `.next`.

---

# Prérequis

Avant de connecter Netlify, vérifiez que :

* le projet possède un dépôt Git local ;
* un premier commit existe ;
* le dépôt est envoyé sur GitHub ;
* un remote `origin` est configuré ;
* la branche principale est généralement `main`.

Vérifications utiles :

```bash
git status
git remote -v
git branch --show-current
git log --oneline -n 5
```

---

# Créer le premier dépôt GitHub

Depuis le dossier du projet :

```powershell
cd "C:\Users\Vicen\Documents\RemasterIA"
```

Initialisez Git si nécessaire :

```powershell
git init
```

Vérifiez que `.env.local` est ignoré :

```powershell
git check-ignore .env.local
```

Préparez le premier commit :

```powershell
git add .
git status
git commit -m "Initial RemasterIA release"
git branch -M main
```

Créez ensuite un dépôt GitHub vide, par exemple :

```text
remasteria
```

N’ajoutez pas automatiquement de README, de licence ou de `.gitignore` depuis GitHub.

Connectez le dépôt :

```powershell
git remote add origin https://github.com/VOTRE-COMPTE/remasteria.git
```

Envoyez le premier commit :

```powershell
git push -u origin main
```

---

# Connecter GitHub à Netlify

## 1. Importer le dépôt

Dans Netlify :

1. ouvrez votre tableau de bord ;
2. choisissez **Add new project** ;
3. choisissez l’import depuis Git ;
4. sélectionnez GitHub ;
5. autorisez Netlify à accéder au dépôt si nécessaire ;
6. sélectionnez le dépôt `remasteria`.

## 2. Sélectionner la branche

Choisissez la branche de production :

```text
main
```

Utilisez une autre branche uniquement si votre dépôt est volontairement organisé autrement.

## 3. Vérifier les paramètres de build

Netlify doit utiliser :

```text
Build command : npm run build
Publish directory : out
Node version : 24
```

Ces valeurs sont normalement lues depuis `netlify.toml`.

Ne configurez pas `.next` comme dossier publié.

## 4. Lancer le premier déploiement

Enregistrez les paramètres puis lancez le premier déploiement.

À la fin du build, vérifiez que :

* le déploiement est marqué comme réussi ;
* la page d’accueil s’affiche ;
* le logo RemasterIA apparaît ;
* les images de la galerie se chargent ;
* le comparateur avant/après fonctionne ;
* les miniatures se chargent ;
* le lien VibeCodeClub fonctionne.

---

# Variables d’environnement Netlify

Ajoutez dans Netlify :

```env
NEXT_PUBLIC_SITE_URL=https://votre-site.netlify.app
STUDIO_MAX_FILE_MB=30
```

## `NEXT_PUBLIC_SITE_URL`

Cette variable doit contenir l’adresse publique finale du site.

Exemple Netlify :

```env
NEXT_PUBLIC_SITE_URL=https://remasteria.netlify.app
```

Exemple avec un domaine personnalisé :

```env
NEXT_PUBLIC_SITE_URL=https://remasteria.fr
```

Ne terminez pas l’URL par une barre oblique.

Cette valeur sert notamment à générer les URL absolues de :

* `sitemap.xml` ;
* `robots.txt`.

## `STUDIO_MAX_FILE_MB`

Cette variable définit la taille maximale autorisée pour chaque image dans le studio local.

Elle n’est pas indispensable à l’affichage du site public, mais peut rester documentée avec la configuration générale du projet.

---

# Lien VibeCodeClub

Le lien communautaire est fixé directement dans :

```text
src/config/site.ts
```

URL utilisée :

```text
https://vibecodeclub.fr
```

Le message affiché sur le site est :

> Partagez vos RemasterIA sur le Discord de VibeCodeClub.fr

Aucune variable Netlify supplémentaire n’est nécessaire.

---

# Mettre la galerie à jour

L’ajout d’images s’effectue avec RemasterIA Studio.

## 1. Lancer le studio

```bash
npm run studio
```

## 2. Ajouter les créations

Dans l’interface :

1. saisissez le nom du jeu ;
2. déposez l’image originale ;
3. déposez l’image remasterisée ;
4. vérifiez le comparateur ;
5. cliquez sur **Ajouter à la galerie**.

Vous pouvez répéter l’opération pour plusieurs créations.

## 3. Publier

Cliquez sur :

```text
Publier les créations
```

Le studio :

* vérifie la galerie ;
* ajoute uniquement `public/gallery/` et `data/gallery.json` ;
* crée un commit Git ;
* exécute `git push origin HEAD`.

Netlify détecte ensuite automatiquement le nouveau commit sur GitHub et lance un nouveau déploiement.

---

# Fonctionnement du déploiement automatique

1. les images sont ajoutées localement ;
2. le studio les convertit en WebP ;
3. le manifeste `data/gallery.json` est mis à jour ;
4. le studio crée un commit ;
5. le commit est envoyé sur GitHub ;
6. Netlify détecte le nouveau commit ;
7. Netlify exécute `npm run build` ;
8. Next.js génère le dossier `out` ;
9. Netlify publie le contenu de `out` ;
10. la nouvelle galerie remplace la précédente.

Le studio ne peut pas confirmer la fin du build Netlify sans utiliser l’API Netlify.

Pour suivre le déploiement, consultez :

```text
Netlify → Deploys
```

---

# Vérifier un déploiement

Après publication, vérifiez :

* que le commit apparaît sur GitHub ;
* que Netlify a détecté le commit ;
* que le build est réussi ;
* que le site utilise bien la dernière version ;
* que les nouvelles miniatures sont visibles ;
* que les nouvelles scènes sont accessibles ;
* que le comparateur fonctionne ;
* que le cache du navigateur ne masque pas la nouvelle version.

En cas de cache, rechargez la page avec :

```text
Ctrl + F5
```

---

# Dépannage

## Netlify ne détecte pas le commit

Vérifiez :

* que le commit apparaît sur GitHub ;
* que Netlify est connecté au bon dépôt ;
* que la bonne branche est surveillée ;
* que le push a été effectué sur cette branche.

Commandes utiles :

```bash
git branch --show-current
git remote -v
git log --oneline -n 5
```

## Le build Netlify échoue

Consultez le journal du déploiement.

Vérifiez :

```text
Commande de build : npm run build
Dossier publié : out
Version Node.js : 24
```

Testez également le build localement :

```bash
npm run build
```

Le fichier suivant doit exister :

```text
out/index.html
```

## Le site est vide après le déploiement

Vérifiez que le dossier publié est :

```text
out
```

et non :

```text
.next
```

## Les nouvelles images n’apparaissent pas

Vérifiez :

```bash
npm run gallery:check
```

Puis contrôlez que les nouveaux fichiers sont présents sur GitHub dans :

```text
public/gallery/
```

et que le manifeste a été mis à jour :

```text
data/gallery.json
```

## Le bouton de publication refuse le push

Vérifiez :

```bash
git status
git remote -v
git branch --show-current
```

Testez manuellement :

```bash
git push origin HEAD
```

Une authentification GitHub peut être nécessaire sur l’ordinateur.

## La branche distante contient de nouvelles modifications

Récupérez-les manuellement :

```bash
git pull --rebase
```

Le studio ne réalise pas automatiquement cette opération.

---

# Domaine personnalisé

Une fois le site fonctionnel sur l’adresse Netlify :

1. ouvrez le site dans Netlify ;
2. ouvrez **Domain management** ;
3. ajoutez le domaine souhaité ;
4. suivez les instructions DNS ;
5. attendez l’activation du certificat HTTPS ;
6. remplacez `NEXT_PUBLIC_SITE_URL` par l’adresse finale ;
7. relancez un déploiement.

Exemple :

```env
NEXT_PUBLIC_SITE_URL=https://remasteria.fr
```

---

# Vérifications finales

Avant une mise en production :

```bash
npm run gallery:check
npm run lint
npm run typecheck
npm test
npm run build
```

Résultat attendu :

```text
Galerie valide
Lint réussi
TypeScript réussi
Tests réussis
Build réussi
out/index.html présent
```




//////



OLD DEPLOIEMENT NETLIFY :
# Déployer RemasterIA sur Netlify

RemasterIA est publié depuis son dépôt GitHub. Les nouvelles créations sont préparées avec `npm run studio`, regroupées dans un commit par le bouton **Publier les créations**, puis détectées automatiquement par Netlify.

```text
RemasterIA Studio
→ images WebP optimisées
→ manifeste local
→ commit Git
→ push GitHub
→ build Netlify
→ nouvelle galerie en ligne
```

## Configuration détectée

Netlify lit directement `netlify.toml` :

```text
Commande de build : npm run build
Dossier publié : out
Version Node.js : 24
```

La branche de production n’est pas fixée dans le fichier. Choisissez dans Netlify la branche du dépôt destinée à la production, généralement `main`.

## Connexion initiale

1. Envoyez le premier commit du projet vers un dépôt GitHub.
2. Dans Netlify, choisissez **Add new project** puis importez ce dépôt.
3. Sélectionnez la branche de production.
4. Vérifiez les paramètres de build ci-dessus.
5. Ajoutez les variables d’environnement nécessaires.
6. Lancez un premier déploiement et consultez son journal.

Variables usuelles :

```env
NEXT_PUBLIC_SITE_URL=https://votre-site.netlify.app
STUDIO_MAX_FILE_MB=30
```

Ne placez jamais de secrets dans un fichier suivi par Git.

## Mises à jour

Ajoutez les créations avec RemasterIA Studio. Le bouton **Ajouter à la galerie** reste local. Lorsque les créations sont prêtes, utilisez **Publier les créations** : le studio ajoute uniquement `public/gallery/` et `data/gallery.json`, crée le commit et exécute `git push origin HEAD`.

Netlify détecte ensuite le commit sur la branche surveillée et exécute le build. Le studio ne peut pas confirmer la fin du déploiement sans utiliser l’API Netlify ; consultez Netlify pour suivre sa progression.
