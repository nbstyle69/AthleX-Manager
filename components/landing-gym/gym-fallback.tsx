import {
  gymTranslations,
  stationName,
  type Locale,
  type Profile,
} from "@/data/landing";
import { FloorPlan } from "./gym-map";

export function GymFallback(props: {
  locale: Locale;
  profile: Profile;
  active: number;
  onSelect: (id: number) => void;
}) {
  const g = gymTranslations[props.locale];
  return (
    <div className="gym-fallback">
      <FloorPlan {...props} />
      <p className="fallback-location">
        <span className="status-dot" />
        {g.you} · {stationName(props.locale, props.active)}
      </p>
    </div>
  );
}
