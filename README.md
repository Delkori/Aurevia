# Aurevia — Suivi de patrimoine personnel

Une app inspirée de Finary : dashboard de patrimoine net, actifs avec cours en
direct (actions/ETF/crypto via Yahoo Finance), objectifs financiers, budget
avec générateur automatique (règle 50/30/20) et diagramme de Sankey, et un
simulateur de projection de patrimoine à long terme.

Stack : **Next.js 16 · Drizzle ORM · Postgres · Tailwind CSS**. Pensée pour
tourner en serverless sur Vercel — pas de backend séparé, pas de Redis.

## 1. Créer une base Postgres gratuite (Neon)

1. Va sur [neon.tech](https://neon.tech) et crée un compte (gratuit).
2. Crée un nouveau projet → une base est créée automatiquement.
3. Copie la **Connection string** (elle ressemble à
   `postgresql://user:password@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`).

   *(Alternative : tu peux aussi utiliser Vercel Postgres directement depuis
   l'onglet "Storage" de ton projet Vercel, ou Supabase.)*

## 2. Configurer le projet en local

```bash
# décompresse le zip, puis :
cd aurevia
npm install

cp .env.example .env.local
```

Ouvre `.env.local` et remplis :

```
DATABASE_NEON_URL=postgresql://... (ta connection string Neon)
APP_PASSWORD=choisis-un-mot-de-passe
SESSION_SECRET=          # openssl rand -base64 32
```

`SESSION_SECRET` signe le cookie de session. S'il est absent, `APP_PASSWORD`
sert de clé — ça marche, mais changer le mot de passe déconnecte alors toutes
les sessions ouvertes.

## 3. Créer les tables dans la base

```bash
npm run db:push
```

Cette commande synchronise le schéma défini dans `src/db/schema.ts` avec ta
base Postgres. (Une migration SQL initiale est aussi disponible dans
`drizzle/0000_rich_wiccan.sql` si tu préfères l'exécuter toi-même.)

## 4. Lancer en local

```bash
npm run dev
```

Ouvre http://localhost:3000, entre le mot de passe défini dans
`APP_PASSWORD`, et commence à ajouter tes actifs.

## 5. Déployer sur Vercel

1. Pousse le projet sur un repo GitHub (`git init`, `git add .`,
   `git commit -m "init"`, crée un repo sur GitHub, `git push`).
2. Sur vercel.com, clique **Add New → Project**, choisis ton repo.
3. Dans **Environment Variables**, ajoute `DATABASE_NEON_URL`, `APP_PASSWORD` et
   `SESSION_SECRET` (les mêmes valeurs que dans `.env.local`).
4. Clique **Deploy**. C'est tout — Vercel détecte Next.js automatiquement.

À chaque `git push`, Vercel redéploie automatiquement.

### Instantané quotidien

`vercel.json` déclare un cron qui appelle `/api/cron/snapshot` chaque nuit à 2 h
UTC pour enregistrer le patrimoine du jour. C'est ce qui rend la courbe
d'historique indépendante de l'ouverture de l'app. Vercel génère et injecte
`CRON_SECRET` automatiquement ; la route refuse tout appel sans ce jeton.

## Développement

```bash
npm run check      # lint + typecheck + tests
npm test           # tests unitaires seuls (node --test)
npm run typecheck  # tsc --noEmit
```

Les tests couvrent les fonctions qui produisent les chiffres : valorisation et
conversion de devises, quotes-parts, projection, échéances, signature de
session. Le build ne nécessite aucune base de données — la CI GitHub Actions
(`.github/workflows/ci.yml`) le vérifie à chaque push.

`npm run lint` remonte des avertissements connus sur `GalaxyView` (lecture de
refs pendant le rendu) : c'est de la dette identifiée, documentée dans
`eslint.config.mjs`, pas un oubli.

## Ajouter un actif : comment trouver le bon ticker

Pour les actions/ETF/crypto, le champ "Ticker" doit correspondre au symbole
Yahoo Finance :

- Actions US : `AAPL`, `MSFT`, `TSLA`
- ETF européens (Euronext Paris) : suffixe `.PA`, ex `CW8.PA` (MSCI World Amundi)
- Crypto : `BTC-USD`, `ETH-USD`
- Tu peux vérifier le bon symbole en cherchant sur finance.yahoo.com

Pour l'immobilier, le cash, ou tout ce qui n'a pas de cours de bourse, choisis
le type correspondant et saisis la valeur manuellement — tu pourras la mettre
à jour à la main quand tu veux.

## Structure du projet

```
src/
  app/            pages (dashboard, actifs, objectifs, budget, login)
  app/api/        routes API (CRUD + récupération des cours)
  components/     Sidebar, graphiques (courbe patrimoine, répartition)
  db/             schéma Drizzle + connexion Postgres
  lib/            calcul plus-values, formatage, cours en direct, auth
```

## Idées pour aller plus loin

- Ajouter un vrai système multi-utilisateurs (NextAuth) si tu veux le
  partager avec quelqu'un d'autre
- Ajouter l'import CSV de relevés bancaires pour le budget
- Découper `GalaxyView` (1 600 lignes) et activer `reactCompiler: true`
- Mettre le cache des cours en base, pour qu'il survive aux démarrages à froid
  et serve de dernier prix connu quand Yahoo est indisponible
