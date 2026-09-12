import { redirect } from 'next/navigation';

/** Les programmes athlètes vivent désormais dans Marketplace. */
export default function Page() {
  redirect('/programming/athletes');
}
