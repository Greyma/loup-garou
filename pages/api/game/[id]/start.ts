import { NextApiRequest, NextApiResponse } from "next";
import { GameState } from "@/types";

const games: Record<string, GameState> = {};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (req.method === "POST") {
    const game = games[id as string];
    if (game) {
      game.phase = "night"; // Commence par la phase nuit
      games[id as string] = game;
      res.status(200).json(game);
    } else {
      res.status(404).json({ message: "Partie non trouvée" });
    }
  } else {
    res.status(405).json({ message: "Méthode non autorisée" });
  }
}