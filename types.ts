import { Key } from "react";

export type Role = "villageois" | "loup-garou" | "sorcière" | "voyante";

export interface Player {
  id: string;
  name: string;
  role: Role;
  isAlive: boolean;
}

export interface GameState {
  id: Key | null | undefined;
  players: Player[];
  name :string;
  phase: "night" | "day" | "waiting";
  narratorId: string | null;
}