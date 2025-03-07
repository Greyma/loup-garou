"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const CreateGamePage: React.FC = () => {
  const [gameName, setGameName] = useState("");
  const router = useRouter();
  const createGame = async () => {
    // Appelle l'API pour créer une nouvelle partie
    const response = await fetch("/api/game/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: gameName }),
    });

    if (response.ok) {
      const data = await response.json();
      router.push(`/narrateur/${data.id}`); // Redirige vers la page de gestion de la partie
    } else {
      alert("Erreur lors de la création de la partie");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-4xl font-bold mb-8">Créer une nouvelle partie</h1>

      <div className="max-w-md mx-auto">
        <label htmlFor="gameName" className="block text-lg font-medium mb-2">
          Nom de la partie
        </label>
        <input
          type="text"
          id="gameName"
          value={gameName}
          onChange={(e) => setGameName(e.target.value)}
          className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          placeholder="Entrez un nom pour la partie"
        />

        <button
          onClick={createGame}
          className="mt-6 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors w-full"
        >
          Créer la partie
        </button>
      </div>
    </div>
  );
};

export default CreateGamePage;