"use client";
// components/planning/FeatureBoard.tsx — Liste aller FeatureCards eines Epics

import { useState } from "react";
import { FeatureCard } from "./FeatureCard";
import { FeatureModal } from "./modals/FeatureModal";
import type { PlanningFeature } from "@/types/planning";

interface FeatureBoardProps {
  features: PlanningFeature[];
  projectId: string;
  epicId: string;
  onMutated: () => void;
}

export function FeatureBoard({ features, projectId, epicId, onMutated }: FeatureBoardProps) {
  const [featureModalOpen, setFeatureModalOpen] = useState(false);

  return (
    <>
      <div className="p-6 space-y-3">
        {features.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
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
        )}

        {features.map((feature) => (
          <FeatureCard
            key={feature.id}
            feature={feature}
            projectId={projectId}
            epicId={epicId}
            onMutated={onMutated}
          />
        ))}

        {/* Add Feature button */}
        <button
          onClick={() => setFeatureModalOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-zinc-700 hover:border-indigo-500 text-zinc-500 hover:text-indigo-400 text-sm transition-colors group"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Feature hinzufügen
        </button>
      </div>

      <FeatureModal
        isOpen={featureModalOpen}
        onClose={() => setFeatureModalOpen(false)}
        projectId={projectId}
        epicId={epicId}
        onSuccess={onMutated}
      />
    </>
  );
}
