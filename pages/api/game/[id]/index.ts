import { NextApiRequest, NextApiResponse } from "next";
import { GameState } from "@/types";

const games: Record<string, GameState> = {};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (req.method === "GET") {
    const game = games[id as string];
    if (game) {
      res.status(200).json(game);
    } else {
      res.status(404).json({ message: "Partie non trouvée" });
    }
  } else {
    res.status(405).json({ message: "Méthode non autorisée" });
  }
}