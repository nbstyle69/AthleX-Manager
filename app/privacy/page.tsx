import type { Metadata } from 'next';
import { PrivacyContent } from './privacy-content';

export const metadata: Metadata = {
  title: 'Politique de confidentialité – AthleX',
  description:
    "Politique de confidentialité, conditions générales d'utilisation et mentions légales d'AthleX et d'AthleX Manager, édités par NBS INNOVATION.",
};

// Figée au build : la page annonce le jour de sa mise en ligne, pas le jour de la visite.
const DEPLOYED_AT = new Date();

const updatedFr = DEPLOYED_AT.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const updatedEn = DEPLOYED_AT.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export default function PrivacyPage() {
  return <PrivacyContent updatedFr={updatedFr} updatedEn={updatedEn} />;
}
