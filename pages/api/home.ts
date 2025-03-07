import axios, { AxiosResponse } from "axios";

const API_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api`; // URL du backend

// Interface pour la réponse de création/rejoindre une partie
interface GameResponse {
  code: string;
}

// Interface pour les erreurs API
interface ApiError {
  error: string;
}

// Inscription d’un utilisateur
export const registerUser = async (username: string, password: string): Promise<AxiosResponse<{ token: string }>> => {
  return axios.post(`${API_URL}/auth/register`, { username, password });
};


// Rejoindre une partie existante
export const joinGame = async (gameCode: string): Promise<string> => {
  const res: Response = await fetch(`${API_URL}/game/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify({ code: gameCode }),
  });
  if (!res.ok) {
    const errorData: ApiError = await res.json();
    throw new Error(errorData.error || "Erreur lors de la tentative de rejoindre la partie");
  }
  const data: GameResponse = await res.json();
  if (!data.code) throw new Error("Code de partie non reçu");
  return data.code; // Retourne directement le code
};

export const WatchGame = async (gameCode: string): Promise<string> => {
  const res: Response = await fetch(`${API_URL}/game/watch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify({ code: gameCode }),
  });
  if (!res.ok) {
    const errorData: ApiError = await res.json();
    throw new Error(errorData.error || "Erreur lors de la tentative de rejoindre la partie");
  }
  const data: GameResponse = await res.json();
  if (!data.code) throw new Error("Code de partie non reçu");
  return data.code; // Retourne directement le code
};

// Récupérer les infos d’une partie
export const getGame = async (code: string): Promise<AxiosResponse<any>> => {
  return axios.get(`${API_URL}/game/${code}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });
};


export interface Role {
  name: string;
  count?: number;
  description?: string;
}

export const createGame = async (): Promise<string> => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/game/create`, {
    method: "POST",
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });
  if (!res.ok) {
    const errorData: { error: string } = await res.json();
    throw new Error(errorData.error || "Erreur lors de la création de la partie");
  }
  const data: { code: string } = await res.json();
  if (!data.code) throw new Error("Code de partie non reçu");
  return data.code;
};

export const startGame = async (gameCode: string): Promise<{ message: string; code: string }> => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/game/start/${gameCode}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });
  if (!res.ok) {
    const errorData: { error: string } = await res.json();
    throw new Error(errorData.error || "Erreur lors du démarrage de la partie");
  }
  return await res.json();
};

export const addRole = async (name: string, description: string): Promise<Role> => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/roles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}` },
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) {
    const errorData: { error: string } = await res.json();
    throw new Error(errorData.error || "Erreur lors de l’ajout du rôle");
  }
  return await res.json();
};


const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    if (!config.headers) {
      config.headers = {};
    }
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const loginUser = async (username: string, password: string): Promise<string> => {
  const response = await api.post<{ token: string }>("/auth/login", { username, password });
  return response.data.token;
};

export interface Role {
  name: string;
  count?: number;
  description?: string;
}

export const getRoles = async (): Promise<Role[]> => {
  const response = await api.get<Role[]>("/roles");
  return response.data;
};
