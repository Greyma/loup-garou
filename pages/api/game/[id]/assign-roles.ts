import { NextApiRequest, NextApiResponse } from "next";
import { GameState, Role } from "@/types";

const games: Record<string, GameState> = {};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (req.method === "POST") {
    const game = games[id as string];
    if (game) {
      const roles: Role[] = ["villageois", "loup-garou", "sorcière", "voyante"];
      const shuffledRoles = [...roles].sort(() => Math.random() - 0.5);

      game.players = game.players.map((player, index) => ({
        ...player,
        role: shuffledRoles[index % shuffledRoles.length],
      }));

      games[id as string] = game;
      res.status(200).json(game);
    } else {
      res.status(404).json({ message: "Partie non trouvée" });
    }
  } else {
    res.status(405).json({ message: "Méthode non autorisée" });
  }
}