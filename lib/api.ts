import axios from "axios";

const API_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api`; // URL du backend

// Interface pour la réponse de création/rejoindre une partie
interface GameResponse {
  code: string;
}

// Interface pour les données d'une partie
interface GameData {
  id: string;
  name: string;
  players: string[];
  spectators: string[];
  status: string;
}

// Interface pour un rôle
export interface Role {
  name: string;
  count?: number;
  description?: string;
}

// Instance axios avec configuration de base et intercepteur pour le token
const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      if (config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  }
  return config;
});

// Inscription d'un utilisateur
export const registerUser = async (username: string, password: string): Promise<string> => {
  const response = await api.post<{ token: string }>("/auth/register", { username, password });
  return response.data.token;
};

// Connexion d'un utilisateur
export const loginUser = async (username: string, password: string): Promise<string> => {
  const response = await api.post<{ token: string }>("/auth/login", { username, password });
  return response.data.token;
};

// Rejoindre une partie existante
export const joinGame = async (gameCode: string): Promise<string> => {
  const response = await api.post<GameResponse>("/game/join", { code: gameCode });
  if (!response.data.code) throw new Error("Code de partie non reçu");
  return response.data.code;
};

// Regarder une partie en tant que spectateur
export const watchGame = async (gameCode: string): Promise<string> => {
  const response = await api.post<GameResponse>("/game/watch", { code: gameCode });
  if (!response.data.code) throw new Error("Code de partie non reçu");
  return response.data.code;
};

// Récupérer les infos d'une partie
export const getGame = async (code: string): Promise<GameData> => {
  const response = await api.get<GameData>(`/game/${code}`);
  return response.data;
};

// Créer une nouvelle partie
export const createGame = async (): Promise<string> => {
  const response = await api.post<GameResponse>("/game/create");
  if (!response.data.code) throw new Error("Code de partie non reçu");
  return response.data.code;
};

// Démarrer une partie
export const startGame = async (gameCode: string): Promise<{ message: string; code: string }> => {
  const response = await api.post<{ message: string; code: string }>(`/game/start/${gameCode}`);
  return response.data;
};

// Ajouter un rôle
export const addRole = async (name: string, description: string): Promise<Role> => {
  const response = await api.post<Role>("/roles", { name, description });
  return response.data;
};

// Récupérer la liste des rôles
export const getRoles = async (): Promise<Role[]> => {
  const response = await api.get<Role[]>("/roles");
  return response.data;
};

// Gestion des erreurs globales (optionnel)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || "Erreur inattendue";
    return Promise.reject(new Error(message));
  }
);
