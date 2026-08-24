import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { coachPerimeterSentence } from '@/lib/authz/coach-perimeter';

export default function Forbidden() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
      <div className="bg-[#111111] border border-white/8 rounded-2xl p-10 text-center max-w-md">
        <ShieldAlert className="w-10 h-10 text-white/70 mx-auto mb-4" />
        <h1 className="text-lg font-bold text-white mb-2">Accès refusé</h1>
        <p className="text-sm text-gray-400">
          Cette page est réservée au gérant et au co-gérant de la box. Ton compte
          coach donne accès à : {coachPerimeterSentence()}.
        </p>
        <Link
          href="/wods"
          className="inline-block mt-5 px-5 py-2.5 rounded-xl bg-white text-[#0A0A0A] text-sm font-bold hover:bg-gray-200 transition-colors"
        >
          Aller au Whiteboard
        </Link>
      </div>
    </div>
  );
}
