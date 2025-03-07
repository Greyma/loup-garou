Voici un fichier `README.md` qui résume ton projet, en supposant qu'il s'agit d'un jeu de Loup-Garou en ligne avec un frontend Next.js (TypeScript) et un backend Node.js (JavaScript), séparés dans deux dépôts distincts. Je vais inclure une description générale, les prérequis, l’installation, et l’utilisation, en me basant sur ce qu’on a construit ensemble.

---

# Loup-Garou en Ligne

Loup-Garou en Ligne est une application web multijoueur qui permet de jouer au célèbre jeu de société Loup-Garou (Werewolf). Le projet est composé de deux parties principales :
- **Frontend** : Une interface utilisateur développée avec Next.js (TypeScript) pour une expérience fluide et interactive.
- **Backend** : Une API et un serveur WebSocket développés avec Node.js, Express, et MongoDB pour gérer les parties, les rôles, et les interactions en temps réel.

Le narrateur (admin) peut créer des parties, définir les rôles disponibles (stockés dans la base de données), et lancer le jeu, tandis que les joueurs et spectateurs rejoignent via un code de partie unique.

---

## Fonctionnalités

- **Création de parties** : Le narrateur configure le nombre maximum de joueurs et les rôles disponibles.
- **Gestion des rôles** : Les rôles sont récupérés et ajoutés dans une base MongoDB par le narrateur.
- **Chat vocal** : Communication en temps réel via WebRTC et Socket.io (namespace `/voice-chat`).
- **Joueurs vs Spectateurs** : Les rôles sont distribués uniquement aux joueurs, les spectateurs observent sans rôle.
- **Interface moderne** : Animations avec Framer Motion et design responsive.

---

## Architecture

- **Frontend** :
  - Next.js (TypeScript)
  - Socket.io-client pour la communication en temps réel
  - Framer Motion pour les animations
  - Appels API via `fetch`

- **Backend** :
  - Node.js avec Express
  - MongoDB (Mongoose) pour la persistance des données (utilisateurs, parties, rôles)
  - Socket.io pour la gestion des événements en temps réel
  - WebRTC pour le chat vocal

- **Dépôts séparés** :
  - Frontend : `frontend-loup-garou` (ex. `http://localhost:3000`)
  - Backend : `backend-loup-garou` (ex. `http://localhost:5000`)

---

## Prérequis

- **Node.js** : Version 18.x ou supérieure
- **MongoDB** : Instance locale ou distante (ex. MongoDB Atlas)
- **npm** : Pour installer les dépendances

---

## Installation

### Backend (`backend-loup-garou`)

1. Clone le dépôt :
   ```bash
   git clone <url-du-repo-backend>
   cd backend-loup-garou
   ```

2. Installe les dépendances :
   ```bash
   npm install
   ```

3. Configure les variables d’environnement dans un fichier `.env` :
   ```
   PORT=5000
   MONGO_URI=mongodb://127.0.0.1:27017/loup-garou
   JWT_SECRET=ma_super_secret_key
   ```

4. Initialise les rôles dans MongoDB (facultatif, pour les données de départ) :
   ```javascript
   const mongoose = require("mongoose");
   const Role = require("./models/Role.js");

   mongoose.connect(process.env.MONGO_URI).then(async () => {
     await Role.insertMany([
       { name: "Loup-Garou", description: "Tue les villageois la nuit" },
       { name: "Villageois", description: "Cherche les loups" },
       { name: "Voyante", description: "Voit le rôle d’un joueur" },
     ]);
     console.log("Rôles ajoutés");
     mongoose.disconnect();
   });
   ```

5. Lance le serveur :
   ```bash
   npm start
   ```

   Le backend sera accessible sur `http://localhost:5000`.

---

### Frontend (`frontend-loup-garou`)

1. Clone le dépôt :
   ```bash
   git clone <url-du-repo-frontend>
   cd frontend-loup-garou
   ```

2. Installe les dépendances :
   ```bash
   npm install
   ```

3. Configure les variables d’environnement dans un fichier `.env.local` :
   ```
   NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
   ```

4. Lance le serveur de développement :
   ```bash
   npm run dev
   ```

   Le frontend sera accessible sur `http://localhost:3000`.

---

## Utilisation

### En tant que Narrateur (Admin)
1. Accède à `http://localhost:3000/narrator`.
2. Connecte-toi avec un nom d’utilisateur (le système JWT génère un token).
3. Récupère les rôles disponibles depuis la base de données.
4. Ajoute de nouveaux rôles si nécessaire (ex. "Sorcière") avec une description.
5. Configure le nombre maximum de joueurs et ajuste les comptes des rôles.
6. Crée une partie pour obtenir un code (ex. `ABC123`).
7. Partage le code avec les joueurs/spectateurs.
8. Une fois les joueurs connectés, clique sur "Lancer la partie" pour distribuer les rôles (uniquement aux joueurs).

### En tant que Joueur ou Spectateur
1. Accède à `http://localhost:3000`.
2. Entre ton nom, choisis ton rôle (joueur ou spectateur), et utilise le code fourni par le narrateur.
3. Rejoins la partie et attends que le narrateur la lance.
   - Les joueurs reçoivent un rôle (ex. Loup-Garou, Villageois).
   - Les spectateurs observent sans rôle.

---

## Structure des fichiers

### Backend
```
backend-loup-garou/
├── models/
│   ├── GameRoom.js
│   ├── Player.js
│   ├── Role.js
│   └── User.js
├── sockets/
│   └── gameSocket.js
├── api/
│   └── game.js
├── server.js
├── .env
└── package.json
```

### Frontend
```
frontend-loup-garou/
├── pages/
│   ├── index.tsx
│   ├── game/[id].tsx
│   └── narrator.tsx
├── components/
│   ├── Chat.tsx
│   └── VoiceChat.tsx
├── .env.local
└── package.json
```

---

## Déploiement

- **Backend** :
  - Héberge sur une plateforme comme Render, Heroku, ou AWS.
  - Configure `MONGO_URI` avec une base MongoDB distante (ex. Atlas).
  - Mets à jour le port si nécessaire (`PORT` dans `.env`).

- **Frontend** :
  - Déploie sur Vercel ou Netlify.
  - Mets à jour `NEXT_PUBLIC_BACKEND_URL` dans les variables d’environnement de la plateforme pour pointer vers l’URL publique du backend.

---

## Problèmes connus et solutions

- **Erreur "Failed to fetch"** :
  - Vérifie que `NEXT_PUBLIC_BACKEND_URL` correspond à l’URL du backend.
  - Assure-toi que le backend est en marche et que CORS est configuré (`origin: "http://localhost:3000"`).
  - Vérifie les logs console (frontend et backend) pour plus de détails.

- **Rôles non affichés** :
  - Initialise la base MongoDB avec des rôles si elle est vide.

---

## Contribution

1. Fork le dépôt.
2. Crée une branche pour ta fonctionnalité (`git checkout -b feature/nouvelle-fonction`).
3. Commit tes changements (`git commit -m "Ajoute nouvelle fonctionnalité"`).
4. Push ta branche (`git push origin feature/nouvelle-fonction`).
5. Ouvre une Pull Request.

---

## Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails (à créer si nécessaire).

---

Ce README résume tout ce qu’on a construit, avec des instructions claires pour installer et utiliser le projet. Si tu veux ajouter des sections spécifiques (ex. captures d’écran, roadmap), fais-moi signe !