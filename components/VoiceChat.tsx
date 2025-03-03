import { useEffect, useState } from "react";
import Peer, { MediaConnection } from "peerjs";

interface VoiceChatProps {
  gameId: string;
  playerId: string;
}

const VoiceChat: React.FC<VoiceChatProps> = ({ gameId, playerId }) => {
  const [peer, setPeer] = useState<Peer | null>(null);

  useEffect(() => {
    const newPeer = new Peer(playerId);
    setPeer(newPeer);

    return () => {
      newPeer.destroy();
    };
  }, [gameId, playerId]);

  return <div>Voice Chat</div>;
};

export default VoiceChat;