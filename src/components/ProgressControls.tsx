import { Icon } from "@/components/Icon";
import { useMaterialProgress, useSetProgress, type ProgressStatus } from "@/hooks/use-progress";

const OPTIONS: { status: ProgressStatus; label: string; icon: string }[] = [
  { status: "reading", label: "Reading", icon: "auto_stories" },
  { status: "saved", label: "Read later", icon: "bookmark" },
  { status: "completed", label: "Completed", icon: "task_alt" },
];

export function ProgressControls({
  materialId,
  variant = "full",
}: {
  materialId: string;
  variant?: "full" | "compact";
}) {
  const current = useMaterialProgress(materialId);
  const setProgress = useSetProgress();

  const toggle = (s: ProgressStatus) => {
    setProgress.mutate({ materialId, status: current === s ? null : s });
  };

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-1">
        {OPTIONS.map((o) => {
          const active = current === o.status;
          return (
            <button
              key={o.status}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggle(o.status);
              }}
              disabled={setProgress.isPending}
              title={active ? `Remove from ${o.label}` : o.label}
              className={`p-1.5 rounded border backdrop-blur-sm transition-colors ${
                active
                  ? "bg-primary/80 border-primary text-on-primary"
                  : "bg-black/70 border-glass-border text-secondary hover:text-on-background"
              }`}
            >
              <Icon name={o.icon} style={{ fontSize: 16 }} />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="bento-card p-4">
      <p className="font-label-sm text-label-sm text-secondary uppercase tracking-wider mb-3">
        Study progress
      </p>
      <div className="flex flex-col gap-2">
        {OPTIONS.map((o) => {
          const active = current === o.status;
          return (
            <button
              key={o.status}
              onClick={() => toggle(o.status)}
              disabled={setProgress.isPending}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg font-label-sm text-label-sm border transition-colors text-left ${
                active
                  ? "bg-primary text-on-primary border-primary"
                  : "border-outline-variant text-on-surface hover:bg-glass-surface"
              }`}
            >
              <Icon name={active ? "check_circle" : o.icon} style={{ fontSize: 18 }} />
              <span className="flex-1">{o.label}</span>
              {active && (
                <span className="text-[10px] uppercase tracking-wider opacity-80">On</span>
              )}
            </button>
          );
        })}
      </div>
      {current && (
        <button
          onClick={() => setProgress.mutate({ materialId, status: null })}
          disabled={setProgress.isPending}
          className="mt-3 w-full text-center px-3 py-1.5 rounded-lg text-secondary hover:text-on-background font-label-sm text-label-sm"
        >
          Clear status
        </button>
      )}
    </div>
  );
}
