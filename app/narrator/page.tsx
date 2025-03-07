"use client";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import GameList from "@/components/GameList";
import GameCreator from "@/components/GameCreator";
import GameLobby from "@/components/GameLobby";
import { Role, getRoles, loginUser } from "@/pages/api/home"; // Importe loginUser depuis ton api.ts corrigé

// Styles globaux pour les effets spéciaux
const globalStyles = `
  .halloween-bg {
    background-image: 
      radial-gradient(circle at 100% 100%, rgba(255,0,0,0.1) 0%, rgba(0,0,0,0) 20%),
      linear-gradient(45deg, rgba(0,0,0,0.8), rgba(70,0,0,0.8)),
      url('background.avif'); /* Remplacez par votre image */
    background-size: cover;
    background-blend-mode: multiply;
  }

  .mirror-effect {
    transform: perspective(1000px) rotateX(10deg) scale(0.95);
    box-shadow: 0 0 20px rgba(255,0,0,0.4);
    position: relative;
    overflow: hidden;
  }

  .mirror-effect::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    height: 50%;
    background: linear-gradient(to bottom, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.5) 100%);
    pointer-events: none; /* Empêche les interactions */
  }

  @media (max-width: 768px) {
    .responsive-flex {
      flex-direction: column;
    }
  }
`;

interface User {
  id: string;
  name: string;
  role?: string;
}

const NarratorPage = () => {
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameCode, setGameCode] = useState<string>("");
  const [maxPlayers, setMaxPlayers] = useState<number>(6);
  const [roles, setRoles] = useState<Role[]>([]);
  const [players, setPlayers] = useState<User[]>([]);
  const [spectators, setSpectators] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [authError, setAuthError] = useState<string | null>(null);

  // Vérifie l’authentification au chargement
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setIsAuthenticated(true);
      initializeSocketAndRoles(token);
    } else {
      setIsLoading(false); // Pas de token, affiche le formulaire de connexion
    }
  }, [router]);

  // Initialise Socket.io et charge les rôles une fois authentifié
  const initializeSocketAndRoles = (token: string) => {
    const newSocket = io(process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000", {
      auth: { token }, // Optionnel : Passe le token au socket si ton backend le requiert
    });
    setSocket(newSocket);

    getRoles()
      .then((fetchedRoles) => {
        setRoles(fetchedRoles.map((role) => ({ ...role, count: 0 })));
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Erreur récupération rôles :", err);
        alert("Erreur lors du chargement des rôles");
        setIsLoading(false);
      });

    newSocket.on("player_list", (playerList: User[]) => {
      setPlayers(playerList.filter((p) => p.role !== "spectator"));
      setSpectators(playerList.filter((p) => p.role === "spectator"));
    });

    newSocket.on("user_joined", ({ userId, role }: { userId: string; role?: string }) => {
      const userName = `Utilisateur ${userId.slice(0, 4)}`;
      if (role === "spectator") {
        setSpectators((prev) =>
          prev.some((s) => s.id === userId) ? prev : [...prev, { id: userId, name: userName }]
        );
      } else {
        setPlayers((prev) =>
          prev.some((p) => p.id === userId) ? prev : [...prev, { id: userId, name: userName }]
        );
      }
    });

    newSocket.on("user_left", ({ userId }: { userId: string }) => {
      setPlayers((prev) => prev.filter((p) => p.id !== userId));
      setSpectators((prev) => prev.filter((s) => s.id !== userId));
    });

    return () => {
      newSocket.disconnect();
    };
  };

  // Gère la soumission du formulaire de connexion
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = await loginUser(username, password);
      localStorage.setItem("token", token);
      setIsAuthenticated(true);
      setAuthError(null);
      initializeSocketAndRoles(token);
    } catch (err: any) {
      setAuthError(err.message || "Erreur d’authentification");
    }
  };

  // Déconnexion (optionnel)
  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsAuthenticated(false);
    setSocket(null);
    setGameCode("");
    setPlayers([]);
    setSpectators([]);
  };

  if (isLoading) {
    return <div className="min-h-screen text-white flex items-center justify-center">Chargement...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen halloween-bg text-white flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mirror-effect bg-black/80 p-8 rounded-xl border-2 border-red-600 max-w-md w-full"
        >
          <h2 className="text-3xl font-bold text-red-500 mb-6 text-center">Connexion</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-red-200 mb-1">Nom d’utilisateur</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black/50 text-red-200 px-4 py-3 rounded-lg border border-red-600/50 focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Entrez votre nom d’utilisateur"
                required
              />
            </div>
            <div>
              <label className="block text-red-200 mb-1">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/50 text-red-200 px-4 py-3 rounded-lg border border-red-600/50 focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Entrez votre mot de passe"
                required
              />
            </div>
            {authError && <p className="text-red-400 text-center">{authError}</p>}
            <motion.button
              type="submit"
              className="w-full bg-red-800/60 hover:bg-red-700/80 text-red-100 py-3 rounded-lg transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Se connecter
            </motion.button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <style>{globalStyles}</style>
      <div className="min-h-screen halloween-bg text-white p-6">
        <div className="container mx-auto max-w-4xl">
          <motion.h1
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="text-4xl font-bold text-center mb-8 text-red-500"
          >
            Panneau du Narrateur
          </motion.h1>

          <button
            onClick={handleLogout}
            className="absolute top-4 right-4 bg-red-800/60 hover:bg-red-700/80 text-red-100 p-2 rounded-lg transition-all"
          >
            Déconnexion
          </button>

          {!gameCode ? (
            <GameCreator
              socket={socket}
              maxPlayers={maxPlayers}
              setMaxPlayers={setMaxPlayers}
              roles={roles}
              setRoles={setRoles}
              setGameCode={setGameCode}
            />
          ) : (
            <GameLobby
              socket={socket}
              gameCode={gameCode}
              players={players}
              spectators={spectators}
              maxPlayers={maxPlayers}
            />
          )}
        </div>
        <GameList />
      </div>
    </>
  );
};

export default NarratorPage;