import LoginForm from "./LoginForm";

/**
 * La page lit l'environnement pour savoir si la démonstration est ouverte :
 * proposer un bouton qui renvoie sur ce même écran, quand `DEMO_LINK=off`,
 * serait pire que ne rien proposer.
 */
export default function LoginPage() {
  return <LoginForm demoOuvert={process.env.DEMO_LINK !== "off"} />;
}
