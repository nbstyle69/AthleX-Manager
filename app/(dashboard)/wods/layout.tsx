import { HelpDockProvider } from '@/components/help/HelpDock';

// Route du périmètre coach : aucune garde owner ici (cf. `coach-perimeter`).
// Le layout n'existe que pour rendre côté serveur les tutoriels du bouton « ? ».
export default function Layout({ children }: { children: React.ReactNode }) {
  return <HelpDockProvider page="whiteboard">{children}</HelpDockProvider>;
}
