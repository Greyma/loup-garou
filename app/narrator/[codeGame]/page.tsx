"use client";
import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import GameSupervisor from "@/components/GameSupervisor";
import { loginUser } from "@/lib/api";
import { motion } from "framer-motion";

// Styles globaux pour les effets spéciaux
const globalStyles = `
  .halloween-bg {
    background-image: 
      radial-gradient(circle at 100% 100%, rgba(255,0,0,0.1) 0%, rgba(0,0,0,0) 20%),
      linear-gradient(45deg, rgba(0,0,0,0.8), rgba(70,0,0,0.8)),
      url('/background.avif'); /* Préfixé avec / pour un chemin public */
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
    transform: rotateX(180deg) translateY(100%);
    pointer-events: none;
  }
`;

const buttonVariants = {
  hover: { scale: 1.05, boxShadow: "0 0 10px rgba(255, 0, 0, 0.5)" },
  tap: { scale: 0.95 },
};

const NarratorSupervisorPage = () => {
  const router = useRouter();
  const params = useParams();
  const codeGame = params && Array.isArray(params.codeGame) ? params.codeGame[0] : params?.codeGame || "";
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setIsAuthenticated(true);
      initializeSocket(token);
    } else {
      setIsLoading(false); // Affiche le formulaire si pas de token
    }

    // Nettoyage au démontage
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [codeGame]); // Dépendance uniquement sur codeGame pour éviter des initialisations multiples

  const initializeSocket = (token: string) => {
    if (!codeGame) {
      router.push("/narrator");
      return;
    }

    const newSocket = io(process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001", {
      auth: { token },
      reconnectionAttempts: 5, // Tentatives de reconnexion
    });
    setSocket(newSocket);

    // Enregistrer le socket comme narrateur AVANT de rejoindre la room
    newSocket.emit("set_role", { role: "narrator" });

    newSocket.emit("join_room", codeGame);

    newSocket.on("connect", () => {
      console.log("Socket connecté pour :", codeGame);
      setIsLoading(false);
    });

    newSocket.on("connect_error", (err) => {
      console.error("Erreur Socket.io :", err.message);
      setIsLoading(false);
      setAuthError("Connexion au serveur échouée");
    });

    newSocket.on("disconnect", () => {
      console.log("Socket déconnecté");
    });

    // Pas besoin de retourner une fonction de nettoyage ici, elle est gérée dans useEffect
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const token = await loginUser(username, password);
      localStorage.setItem("token", token);
      setIsAuthenticated(true);
      setAuthError(null);
      initializeSocket(token);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setAuthError(err.message || "Erreur d’authentification");
        setIsLoading(false);
      } else {
        setAuthError("Erreur d’authentification");
        setIsLoading(false);
      }
  };
};

  if (isLoading) {
    return (
      <div className="min-h-screen text-red-200 flex items-center justify-center halloween-bg">
        <h1>Chargement en cours...</h1>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <style>{globalStyles}</style>
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
                variants={buttonVariants}
                whileHover="hover"
                whileTap="tap"
                className="w-full bg-red-800/60 hover:bg-red-700/80 text-red-100 py-3 rounded-lg transition-all"
              >
                Se connecter
              </motion.button>
            </form>
          </motion.div>
        </div>
      </>
    );
  }

    if (!codeGame) {
      return (
        <div className="min-h-screen text-red-200 flex items-center justify-center halloween-bg">
          <h1>Code de partie manquant</h1>
        </div>
      );
    }

      return <GameSupervisor socket={socket} gameCode={Array.isArray(codeGame) ? codeGame[0] : codeGame} />;
  
};

export default NarratorSupervisorPage;