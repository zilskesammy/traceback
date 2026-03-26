// components/planning/FeatureBoard.tsx — Liste aller FeatureCards eines Epics

import { FeatureCard } from "./FeatureCard";
import type { PlanningFeature } from "@/types/planning";

interface FeatureBoardProps {
  features: PlanningFeature[];
  projectId: string;
}

export function FeatureBoard({ features, projectId }: FeatureBoardProps) {
  if (features.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </div>
        <p className="text-sm text-zinc-400 dark:text-zinc-600">
          Noch keine Features in diesem Epic
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-3">
      {features.map((feature) => (
        <FeatureCard key={feature.id} feature={feature} projectId={projectId} />
      ))}
    </div>
  );
}
