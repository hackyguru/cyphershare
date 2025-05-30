// components/room/RoomHeader.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Edit, Check } from "lucide-react";

export default function RoomHeader() {
  const [roomId, setRoomId] = useState("XYZ123");
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-2 mb-4">
      {editing ? (
        <Input value={roomId} onChange={(e) => setRoomId(e.target.value)} className="w-32 font-mono" />
      ) : (
        <span className="font-mono text-lg">Room: {roomId}</span>
      )}
      <Button variant="ghost" size="icon" onClick={() => setEditing(!editing)}>
        <Edit size={16} />
      </Button>
      <Button variant="ghost" size="icon" onClick={copy}>
        {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
      </Button>
    </div>
  );
}
