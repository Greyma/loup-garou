import React, { useState } from "react";
import { addRole, Role } from "@/pages/api/home";
import { motion } from "framer-motion";

const buttonVariants = {
  hover: { scale: 1.05, boxShadow: "0 0 10px rgba(255, 0, 0, 0.5)" },
  tap: { scale: 0.95 },
};

interface RoleManagerProps {
  roles: Role[];
  setRoles: React.Dispatch<React.SetStateAction<Role[]>>;
}

const RoleManager: React.FC<RoleManagerProps> = ({ roles, setRoles }) => {
  const [newRoleName, setNewRoleName] = useState<string>("");
  const [newRoleDescription, setNewRoleDescription] = useState<string>("");

  const handleAddRole = async () => {
    if (!newRoleName.trim()) return;
    try {
      const addedRole = await addRole(newRoleName, newRoleDescription);
      setRoles((prev) => [...prev, { name: addedRole.name, count: 1, description: addedRole.description }]);
      setNewRoleName("");
      setNewRoleDescription("");
    } catch (err) {
      console.error("Erreur ajout rôle :", err);
      alert("Erreur : " + ((err as Error).message || "Impossible d’ajouter le rôle"));
    }
  };

  const handleRoleCountChange = (roleName: string, delta: number) => {
    setRoles((prev) =>
      prev.map((role) =>
        role.name === roleName ? { ...role, count: Math.max(0, (role.count ?? 0) + delta) } : role
      )
    );
  };

  const totalRoles = roles.reduce((sum, role) => sum + (role.count ?? 0), 0);

  return (
    <div className="mb-6">
      <label className="block mb-2 text-red-200">Ajouter un rôle :</label>
      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={newRoleName}
          onChange={(e) => setNewRoleName(e.target.value)}
          className="w-full bg-black/50 text-red-200 px-4 py-3 rounded-lg border border-red-600/50 focus:outline-none focus:ring-2 focus:ring-red-500"
          placeholder="Nom du rôle"
        />
        <input
          type="text"
          value={newRoleDescription}
          onChange={(e) => setNewRoleDescription(e.target.value)}
          className="w-full bg-black/50 text-red-200 px-4 py-3 rounded-lg border border-red-600/50 focus:outline-none focus:ring-2 focus:ring-red-500"
          placeholder="Description (optionnel)"
        />
        <motion.button
          onClick={handleAddRole}
          variants={buttonVariants}
          whileHover="hover"
          whileTap="tap"
          className="w-full bg-red-800/60 hover:bg-red-700/80 text-red-100 py-3 rounded-lg transition-all"
        >
          Ajouter à la base
        </motion.button>
      </div>
      <div className="mt-6">
        <h3 className="text-2xl font-bold text-red-500 mb-4">Rôles disponibles ({totalRoles}) :</h3>
        {roles.length === 0 ? (
          <p className="text-red-400">Aucun rôle disponible. Ajoutez-en un !</p>
        ) : (
          roles.map((role) => (
            <div
              key={role.name}
              className="flex items-center justify-between py-3 px-4 bg-black/50 rounded-lg border border-red-600/50 mb-2"
            >
              <span className="text-red-200">
                {role.name} {role.description && `(${role.description})`}
              </span>
              <div className="flex gap-2">
                <motion.button
                  onClick={() => handleRoleCountChange(role.name, -1)}
                  variants={buttonVariants}
                  whileHover="hover"
                  whileTap="tap"
                  className="bg-red-800/60 hover:bg-red-700/80 text-red-100 p-2 rounded-lg transition-all"
                >
                  -
                </motion.button>
                <span className="text-red-200 px-2">{role.count}</span>
                <motion.button
                  onClick={() => handleRoleCountChange(role.name, 1)}
                  variants={buttonVariants}
                  whileHover="hover"
                  whileTap="tap"
                  className="bg-red-800/60 hover:bg-red-700/80 text-red-100 p-2 rounded-lg transition-all"
                >
                  +
                </motion.button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RoleManager;