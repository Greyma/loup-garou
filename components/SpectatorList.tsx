import React from "react";

interface Spectator {
  id: string;
  name: string;
}

interface SpectatorListProps {
  spectators: Spectator[];
}

const SpectatorList: React.FC<SpectatorListProps> = ({ spectators }) => {
  if (spectators.length === 0) return null;

  return (
    <div className="bg-black/30 rounded-xl p-3 border border-purple-600/40">
      <h3 className="text-sm font-semibold text-purple-300 mb-2 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        Spectateurs ({spectators.length})
      </h3>
      <ul className="space-y-1 max-h-40 overflow-y-auto">
        {spectators.map((spectator) => (
          <li
            key={spectator.id}
            className="text-sm text-purple-200/80 pl-2 flex items-center gap-2"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
            {spectator.name}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SpectatorList;