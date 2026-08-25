import { Star, Heart, Flag, Crown, Zap, Rocket, type LucideIcon } from "lucide-react";

export type AstronautAccessoryId = "star" | "heart" | "flag" | "crown" | "bolt" | "rocket";

export const ASTRONAUT_ACCESSORIES: { id: AstronautAccessoryId; label: string; Icon: LucideIcon; color: string }[] = [
  { id: "star", label: "Étoile", Icon: Star, color: "#ffd76a" },
  { id: "heart", label: "Cœur", Icon: Heart, color: "#fb7185" },
  { id: "flag", label: "Drapeau", Icon: Flag, color: "#5cc8ff" },
  { id: "crown", label: "Couronne", Icon: Crown, color: "#ffcf4a" },
  { id: "bolt", label: "Éclair", Icon: Zap, color: "#facc15" },
  { id: "rocket", label: "Fusée", Icon: Rocket, color: "#9585ff" },
];

export function findAccessory(id: string | null | undefined) {
  return ASTRONAUT_ACCESSORIES.find(a => a.id === id) ?? null;
}
