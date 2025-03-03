import { NextApiRequest, NextApiResponse } from "next";
import { GameState, Player } from "@/types";

const games: Record<string, GameState> = {};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (req.method === "POST") {
    const game = games[id as string];
    if (game) {
      const { name } = req.body;
      const newPlayer: Player = {
        id: Math.random().toString(36).substring(2, 8), // Génère un ID aléatoire
        name,
        role: "villageois", // Par défaut
        isAlive: true,
      };

      game.players.push(newPlayer);
      games[id as string] = game;
      res.status(200).json(newPlayer);
    } else {
      res.status(404).json({ message: "Partie non trouvée" });
    }
  } else {
    res.status(405).json({ message: "Méthode non autorisée" });
  }
}