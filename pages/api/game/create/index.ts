import { NextApiRequest, NextApiResponse } from "next";

// Simule une base de données en mémoire
const games: Record<string, any> = {};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const { name } = req.body;

    // Génère un ID de partie aléatoire
    const gameId = Math.random().toString(36).substring(2, 8);

    // Crée une nouvelle partie
    const newGame = {
      id: gameId,
      name: name || `Partie ${Object.keys(games).length + 1}`,
      status: "waiting",
      players: [],
    };

    // Ajoute la partie à la liste
    games[gameId] = newGame;

    // Retourne la partie créée
    res.status(201).json(newGame);
  } else {
    res.status(405).json({ message: "Méthode non autorisée" });
  }
}