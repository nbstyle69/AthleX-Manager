"use client";

import { useId, useState } from "react";
import { ChevronDown, Map } from "lucide-react";
import {
  gymTranslations,
  stations,
  roomBounds,
  planRouteDetours,
  stationName,
  tourOrder,
  translations,
  type Locale,
  type Profile,
} from "@/data/landing";

type PlanProps = {
  locale: Locale;
  profile: Profile;
  active: number;
  onSelect: (id: number) => void;
};
const mapPoint = (id: number) => {
  const station = stations.find((s) => s.id === id)!;
  return {
    x: station.position[0] - roomBounds.left,
    y: station.position[2] - roomBounds.back,
  };
};

export function FloorPlan({ locale, profile, active, onSelect }: PlanProps) {
  const g = gymTranslations[locale];
  const path = tourOrder[profile];
  const points = path
    .flatMap((id) => [
      mapPoint(id),
      ...(planRouteDetours[profile]?.[id] ?? []).map(([x, z]) => ({
        x: x - roomBounds.left,
        y: z - roomBounds.back,
      })),
    ])
    .map((p) => `${p.x},${p.y}`)
    .join(" ");
  return (
    <div className="floor-plan" aria-label={g.map}>
      <svg className="floor-plan-path" viewBox="-1 -1 26 41" aria-hidden="true">
        <path d="M9 39H0V0H24V39H15" className="plan-walls" />
        <path d="M9 39V36M15 39V36M9 36Q12 36 12 39" className="plan-door" />
        <rect
          x="18.4"
          y="33.7"
          width="5.2"
          height="4"
          className="plan-office"
        />
        <rect
          x=".2"
          y="32.8"
          width=".65"
          height="3.2"
          className="plan-fixture"
        />
        <rect
          x=".2"
          y="21.6"
          width=".3"
          height="4.8"
          className="plan-fixture"
        />
        <rect
          x="17.2"
          y=".15"
          width="3.6"
          height=".4"
          className="plan-fixture"
        />
        <path d="M9 35V11M15 35V11" className="plan-lane" />
        <polyline points={points} className="plan-route" />
        {path.map((id, index) => {
          const p = mapPoint(id);
          return (
            <g key={id}>
              <circle cx={p.x} cy={p.y} r=".55" className="plan-step" />
              <text
                x={p.x}
                y={p.y + 0.23}
                textAnchor="middle"
                className="plan-number"
              >
                {index}
              </text>
            </g>
          );
        })}
      </svg>
      {stations.map((station) => {
        const p = mapPoint(station.id);
        const current = active === station.id;
        return (
          <button
            key={station.id}
            data-station={station.id}
            className={`floor-plan-station ${path.includes(station.id) ? "on-route" : ""} ${current ? "is-current" : ""}`}
            style={{
              left: `${((p.x + 1) / 26) * 100}%`,
              top: `${((p.y + 1) / 41) * 100}%`,
            }}
            aria-current={current ? "step" : undefined}
            aria-label={`${stationName(locale, station.id)}${current ? ` · ${g.you}` : ""}`}
            onClick={() => onSelect(station.id)}
          >
            <span className="plan-dot" />
            <span
              className={`plan-label ${p.x < 5 ? "label-right" : p.x > 19 ? "label-left" : ""}`}
            >
              {stationName(locale, station.id)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function GymMap(props: PlanProps & { onInteract?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const g = gymTranslations[props.locale];
  return (
    <nav
      className="tour-map"
      aria-label={translations[props.locale].map.navigation}
    >
      <button
        className="tour-map-toggle"
        aria-label={g.map}
        aria-controls={id}
        aria-expanded={expanded}
        onClick={() => {
          props.onInteract?.();
          setExpanded((v) => !v);
        }}
      >
        <Map size={18} />
        <span>{g.map}</span>
        <ChevronDown
          size={16}
          style={{ transform: expanded ? "rotate(180deg)" : undefined }}
        />
      </button>
      {expanded && (
        <div id={id} className="tour-map-content">
          <FloorPlan
            {...props}
            onSelect={(id) => {
              props.onSelect(id);
              setExpanded(false);
            }}
          />
          <p>
            {g.you} · {stationName(props.locale, props.active)}
          </p>
          <p>
            {g.route} · {g[props.profile]}
          </p>
        </div>
      )}
    </nav>
  );
}
