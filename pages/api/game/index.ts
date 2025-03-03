import { NextApiRequest, NextApiResponse } from "next";

// Simule une base de données en mémoire
const games: Record<string, any> = {
  "abc123": {
    id: "abc123",
    name: "Partie 1",
    phase: "night",
    players: [],
  },
  "def456": {
    id: "def456",
    name: "Partie 2",
    phase: "waiting",
    players: [],
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    // Retourne la liste des parties
    res.status(200).json(Object.values(games));
  } else {
    res.status(405).json({ message: "Méthode non autorisée" });
  }
}