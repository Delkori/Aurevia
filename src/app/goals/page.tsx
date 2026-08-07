import { redirect } from "next/navigation";

// La page Objectifs a été fusionnée dans la Galaxie (portefeuilles + actifs + objectifs
// dans un seul graphe). On garde cette redirection pour les liens/favoris existants.
export default function GoalsRedirect() {
  redirect("/galaxy");
}
