import { Input } from '@/components/ui/input';
import { CLASS_TYPES, OTHER_CLASS_TYPE } from '@/lib/classTypes';

interface Props {
  title: string;
  customTitle: string;
  onTitleChange: (title: string) => void;
  onCustomTitleChange: (customTitle: string) => void;
  labelClassName: string;
  selectClassName: string;
}

/**
 * « Type de cours » des éditeurs de créneau type (/templates et panneau).
 * Un titre hors liste s'affiche en « Autre » avec son nom réel, comme dans
 * l'éditeur de créneau de /schedules, au lieu d'un « WOD » trompeur.
 */
export default function ClassTypeField({ title, customTitle, onTitleChange, onCustomTitleChange, labelClassName, selectClassName }: Props) {
  return (
    <>
      <div>
        <label className={labelClassName}>Type de cours</label>
        <select value={title} onChange={e => onTitleChange(e.target.value)} className={selectClassName}>
          {CLASS_TYPES.map(c => <option key={c} className="bg-ax-surface text-ax-text">{c}</option>)}
        </select>
      </div>
      {title === OTHER_CLASS_TYPE && (
        <div>
          <label className={labelClassName}>Nom personnalisé</label>
          <Input value={customTitle} onChange={e => onCustomTitleChange(e.target.value)} placeholder="Ex : Yoga, Pilates…" />
        </div>
      )}
    </>
  );
}
