import type { Sbar } from "@/lib/sbar/schema";

// Pastel clinical palette: sky for facts (S, B), lavender for judgement (A), mint for the plan (R).
const ROWS: { key: keyof Sbar; letter: string; label: string; tile: string; chip: string }[] = [
  { key: "situation", letter: "S", label: "Situation", tile: "bg-powder-50", chip: "bg-powder-100 text-powder-700" },
  { key: "background", letter: "B", label: "Background", tile: "bg-powder-50", chip: "bg-powder-100 text-powder-700" },
  { key: "assessment", letter: "A", label: "Assessment", tile: "bg-lavender-50", chip: "bg-lavender-100 text-lavender-700" },
  { key: "recommendation", letter: "R", label: "Recommendation", tile: "bg-mint-50", chip: "bg-mint-100 text-mint-700" },
];

export default function SbarBlock({ sbar, compact = false }: { sbar: Sbar; compact?: boolean }) {
  return (
    <dl className={compact ? "space-y-1.5" : "space-y-2"}>
      {ROWS.map(({ key, letter, label, tile, chip }) => (
        <div key={key} className={`flex gap-3 rounded-2xl ${tile} ${compact ? "p-2.5" : "p-3.5"}`}>
          <dt title={label} className={`grid shrink-0 place-items-center rounded-full font-semibold ${chip} ${compact ? "size-6 text-[11px]" : "size-8 text-xs"}`}>
            {letter}
          </dt>
          <dd className="min-w-0">
            {!compact && <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</p>}
            <p className={`leading-relaxed text-ink/80 ${compact ? "line-clamp-2 text-xs" : "text-sm"}`}>
              {sbar[key] || <span className="italic text-slate-400">Not stated</span>}
            </p>
          </dd>
        </div>
      ))}
    </dl>
  );
}
