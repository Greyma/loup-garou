"use client";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { registerUser, loginUser, joinGame, watchGame } from "@/pages/api/home";

// Ajout de styles globaux pour les effets spéciaux
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
  }

  @media (max-width: 768px) {
    .responsive-flex {
      flex-direction: column;
    }
  }
`;

const buttonVariants = {
  hover: { scale: 1.1, textShadow: "0 0 10px #ff0000" },
  tap: { scale: 0.95 },
};


const Home: React.FC = () => {
  const [isNameModalOpen, setNameModalOpen] = useState(true);
  const [isRoleModalOpen, setRoleModalOpen] = useState(false);
  const [isCodeModalOpen, setCodeModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [code, setCode] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const router = useRouter();
  useEffect(() => {
     const token = localStorage.getItem("token");
     if (token) {
       setNameModalOpen(false);
       setRoleModalOpen(true);
     } else {
       setNameModalOpen(true);
     }
 
     const newSocket = io(process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000");
     setSocket(newSocket);
 
     return () => {
       newSocket.disconnect();
     };
   }, [router]);
 
   const handleNameSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!name.trim()) return;
 
     try {
       await registerUser(name, name); // À améliorer avec un vrai mot de passe
       const res = await loginUser(name, name) as { data: { token: string } } | string;
       const token = typeof res === 'string' ? res : res.data.token;
       localStorage.setItem("token", token);
       setNameModalOpen(false);
       setRoleModalOpen(true);
     } catch (err) {
       console.error("Erreur d’authentification :", err);
       alert("Erreur lors de la connexion. Veuillez réessayer.");
     }
   };
 
   const handleRoleSubmit = (e: React.FormEvent) => {
     e.preventDefault();
     if (!role) return;
     setRoleModalOpen(false);
     setCodeModalOpen(true);
   };
 
 
   const handleJoinGame = async () => {
     if (!socket || !code.trim()) {
       alert("Veuillez entrer un code valide.");
       return;
     }
     try {
       const gameCode: string = await joinGame(code);
       console.log("Code reçu (joinGame) :", gameCode); // Log pour débogage
       socket.emit("join_room", gameCode);
       router.push(`/game/${gameCode}`);
     } catch (err) {
       if (err instanceof Error) {
         console.error("Erreur rejoindre partie :", err);
         alert("Erreur : " + (err.message || "Erreur inconnue"));
       } else {
         console.error("Erreur inconnue :", err);
         alert("Erreur inconnue");
       }
     }
   };
 
   const handleWatchGame = async () => {
     if (!socket || !code.trim()) {
       alert("Veuillez entrer un code valide.");
       return;
     }
     try {
       const gameCode: string = await watchGame(code);
       console.log("Code reçu (joinGame) :", gameCode); // Log pour débogage
       socket.emit("join_room", gameCode);
       router.push(`/game/${gameCode}`);
     } catch (err) {
      if (err instanceof Error) {
        console.error("Erreur rejoindre partie :", err);
        alert("Erreur : " + (err.message || "Erreur inconnue"));
      } else {
        console.error("Erreur inconnue :", err);
        alert("Erreur inconnue");
      }
    }
   };
 

  return (
    <>
      <style>{globalStyles}</style>
      <div className="min-h-screen halloween-bg relative overflow-hidden">
        {/* Ajoutez votre image ici */}
        <div className="absolute inset-0 z-0 opacity-20">
          <img src="background.avif" alt="background" className="w-full h-full object-cover" />
        </div>
          {/* Les modales restylisées */}
          {isNameModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
            >
              <motion.div
                className="mirror-effect bg-black/80 p-8 rounded-xl border-2 border-red-600 w-full max-w-md"
                initial={{ y: -50 }}
                animate={{ y: 0 }}
              >
                <h2 className="text-3xl text-red-500 mb-6 text-center">Entrez votre nom</h2>
                <form onSubmit={handleNameSubmit}>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black/50 text-red-200 px-4 py-3 rounded-lg border border-red-600/50 focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Votre nom"
                    required
                  />
                  <motion.button
                    className="w-full mt-6 bg-red-800/60 hover:bg-red-700/80 text-red-100 py-3 rounded-lg transition-all"
                    variants={buttonVariants}
                    whileHover="hover"
                    whileTap="tap"
                  >
                    Suivant
                  </motion.button>
                </form>
              </motion.div>
            </motion.div>
          )}

          {/* Les autres modales suivent le même style... */}
          {isRoleModalOpen && (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
  >
    <motion.div
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="mirror-effect bg-black/80 p-8 rounded-xl border-2 border-red-600 w-full max-w-md"
    >
      <h2 className="text-3xl text-red-500 mb-6 text-center">Choisissez votre rôle</h2>
      <form onSubmit={handleRoleSubmit}>
        <div className="space-y-4">
          <label className="flex items-center bg-black/50 p-4 rounded-lg border border-red-600/30 hover:bg-red-900/40 transition-colors cursor-pointer">
            <input
              type="radio"
              value="player"
              checked={role === "player"}
              onChange={() => setRole("player")}
              className="form-radio text-red-600 focus:ring-red-500"
            />
            <span className="ml-3 text-red-200">Joueur</span>
          </label>
          <label className="flex items-center bg-black/50 p-4 rounded-lg border border-red-600/30 hover:bg-red-900/40 transition-colors cursor-pointer">
            <input
              type="radio"
              value="spectator"
              checked={role === "spectator"}
              onChange={() => setRole("spectator")}
              className="form-radio text-red-600 focus:ring-red-500"
            />
            <span className="ml-3 text-red-200">Spectateur</span>
          </label>
        </div>
        <motion.button
          type="submit"
          className="w-full mt-6 bg-red-800/60 hover:bg-red-700/80 text-red-100 py-3 rounded-lg transition-all"
          variants={buttonVariants}
          whileHover="hover"
          whileTap="tap"
        >
          Confirmer
        </motion.button>
      </form>
    </motion.div>
  </motion.div>
)}

{isCodeModalOpen && (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
  >
    <motion.div
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="mirror-effect bg-black/80 p-8 rounded-xl border-2 border-red-600 w-full max-w-md"
    >
      <h2 className="text-3xl text-red-500 mb-6 text-center">
        {role === "player" ? "Rejoindre ou créer une partie" : "Rejoindre en spectateur"}
      </h2>
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Entrez le code de la partie"
        className="w-full bg-black/50 text-red-200 px-4 py-3 rounded-lg border border-red-600/50 focus:outline-none focus:ring-2 focus:ring-red-500 mb-6"
      />
      <div className="flex gap-4 responsive-flex">
        {role === "spectator" && (
          <motion.button
            onClick={handleWatchGame}
            className="flex-1 bg-red-800/60 hover:bg-red-700/80 text-red-100 py-3 rounded-lg transition-all"
            variants={buttonVariants}
            whileHover="hover"
            whileTap="tap"
          >
            Rejoindre
          </motion.button>
        )}

        {role === "player" && (
            <motion.button
              onClick={handleJoinGame}
              className="flex-1 bg-red-800/60 hover:bg-red-700/80 text-red-100 py-3 rounded-lg transition-all"
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
            >
              Rejoindre
            </motion.button>
        )}
      </div>
    </motion.div>
  </motion.div>
)}

        </div>
    </>
  );
};

export default Home;