'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Beaker, Clipboard, Download, FlaskConical, Play, RefreshCcw, Users } from 'lucide-react';
import { LoadingFallback } from '@/components/LoadingFallback';
import { useLabExperiment } from '../../hooks/useLabExperiment';
import { useLabCollaboration } from '../../hooks/useLabCollaboration';
import type { LabChemical, LabHazard } from '../../types/lab';
import { downloadTextFile } from '../../lib/download';
import { LabDataPanel } from './components/LabDataPanel';
import { LabGuidancePanel } from './components/LabGuidancePanel';
import { LabHazardBanner } from './components/LabHazardBanner';
import { LabToolbar } from './components/LabToolbar';
import { LabCollaborationPanel } from './components/LabCollaborationPanel';

// Issue #141: pull the 3D scene (Three.js / R3F) and the physics
// simulator into separately-fetched chunks. LoadingFallback matches
// the rest of the app for consistent CLS-friendly placeholders.
const LabScene3D = dynamic(() => import('./scenes/LabScene3D').then((m) => ({ default: m.LabScene3D })), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center rounded-3xl border border-slate-200 bg-white/70">
      <LoadingFallback message="Loading 3D lab…" size="md" />
    </div>
  ),
});

const LabReactionSim = dynamic(() => import('./sim/LabReactionSim').then((m) => ({ default: m.LabReactionSim })), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center rounded-3xl border border-slate-200 bg-white/70">
      <LoadingFallback message="Loading physics simulation…" size="md" />
    </div>
  ),
});

function exportCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return '';
  const keys = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const str = value === null || value === undefined ? '' : String(value);
    return `"${str.replace(/"/g, '""')}"`;
  };
  const header = keys.map(escape).join(',');
  const body = rows
    .map((row) => keys.map((k) => escape(row[k])).join(','))
    .join('\n');
  return `${header}\n${body}`;
}

export function VirtualScienceLab() {
  const experiment = useLabExperiment();
  const [roomId, setRoomId] = useState('');
  const collaboration = useLabCollaboration({ roomId: roomId.trim() ? roomId : undefined });

  const hazardTop = useMemo<LabHazard | null>(() => {
    if (experiment.hazards.length === 0) return null;
    const byPriority = (h: LabHazard) => (h.level === 'danger' ? 2 : h.level === 'warning' ? 1 : 0);
    return [...experiment.hazards].sort((a, b) => byPriority(b) - byPriority(a))[0] ?? null;
  }, [experiment.hazards]);

  const canAddChemicals = useMemo(() => {
    const required = ['goggles', 'gloves', 'labCoat'] as const;
    return required.every((key) => experiment.ppe[key]);
  }, [experiment.ppe]);

  const setChemical = useCallback((chemical: LabChemical, amount: number) => {
    if (!canAddChemicals && (chemical === 'acid' || chemical === 'base')) {
      return;
    }
    experiment.addChemical(chemical, amount);
  }, [canAddChemicals, experiment]);

  useEffect(() => {
    const dispose = collaboration.onMessage((message) => {
      if (message.type === 'state') {
        const snapshot = (message.payload.snapshot as any) || null;
        if (!snapshot) return;
        experiment.setStepIndex(snapshot.stepIndex ?? 0);
      }
      if (message.type === 'event') {
        experiment.addNote(`Collaboration: ${JSON.stringify(message.payload)}`);
      }
    });

    return () => {
      dispose?.();
    };
  }, [collaboration, experiment]);

  useEffect(() => {
    if (collaboration.mode === 'offline') return;
    collaboration.sendState(experiment.snapshot);
  }, [collaboration, experiment.snapshot]);

  const exportAll = useCallback(() => {
    const seriesRows = experiment.series.map((p) => ({
      t: p.t,
      temperatureC: p.temperatureC,
      ph: p.ph,
      acidMl: experiment.chemicals.acid,
      baseMl: experiment.chemicals.base
    }));

    downloadTextFile('lab-measurements.json', JSON.stringify(seriesRows, null, 2), 'application/json');
    downloadTextFile('lab-measurements.csv', exportCsv(seriesRows), 'text/csv');
    downloadTextFile('lab-events.json', JSON.stringify(experiment.events, null, 2), 'application/json');
  }, [experiment.chemicals.acid, experiment.chemicals.base, experiment.events, experiment.series]);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#fdf7ec_0%,_#f8fbff_45%,_#eef6ff_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/85 p-6 shadow-[0_25px_80px_-45px_rgba(15,23,42,0.55)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/70 px-4 py-1 text-sm font-medium text-sky-700">
                <FlaskConical className="h-4 w-4" />
                Virtual Science Laboratory
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Interactive Chemistry Lab</h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-600">
                Conduct a safe acid-base neutralization experiment with 3D equipment, physics-based mixing, guided steps, safety alerts, and data analysis.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={experiment.start}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <Play className="h-4 w-4" />
                Start
              </button>
              <button
                onClick={experiment.reset}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCcw className="h-4 w-4" />
                Reset
              </button>
              <button
                onClick={exportAll}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
            </div>
          </div>

          {hazardTop && (
            <div className="mt-4">
              <LabHazardBanner hazard={hazardTop} />
            </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="h-[420px] overflow-hidden rounded-[2rem] border border-slate-200 bg-white/70 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)]">
                <LabScene3D
                  measurement={experiment.measurement}
                  chemicals={experiment.chemicals}
                  ppe={experiment.ppe}
                  isStirring={experiment.isStirring}
                  onToggleEquipment={(id) => {
                    if (id === 'stir') experiment.setStirring(!experiment.isStirring);
                    if (id === 'goggles') experiment.togglePPE('goggles');
                    if (id === 'gloves') experiment.togglePPE('gloves');
                    if (id === 'labCoat') experiment.togglePPE('labCoat');
                    if (id === 'fumeHood') experiment.togglePPE('fumeHood');
                  }}
                  onAddChemical={(chemical) => setChemical(chemical, chemical === 'indicator' ? 0 : 10)}
                  canAddChemicals={canAddChemicals}
                />
              </div>

              <div className="h-[420px] overflow-hidden rounded-[2rem] border border-slate-200 bg-white/70 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)]">
                <LabReactionSim
                  chemicals={experiment.chemicals}
                  isStirring={experiment.isStirring}
                  measurement={experiment.measurement}
                  onAddChemical={(chemical) => setChemical(chemical, 10)}
                  blocked={!canAddChemicals}
                />
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white/85 p-5 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] backdrop-blur">
              <LabToolbar
                ppe={experiment.ppe}
                onTogglePPE={experiment.togglePPE}
                onAddChemical={setChemical}
                onToggleStir={() => experiment.setStirring(!experiment.isStirring)}
                isStirring={experiment.isStirring}
                canAddChemicals={canAddChemicals}
                measurement={experiment.measurement}
              />
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white/85 p-5 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] backdrop-blur">
              <LabDataPanel
                series={experiment.series}
                measurement={experiment.measurement}
                events={experiment.events}
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-slate-200 bg-white/85 p-5 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                <Beaker className="h-4 w-4" />
                Guidance
              </div>
              <LabGuidancePanel
                steps={experiment.steps}
                stepIndex={experiment.stepIndex}
                onNext={experiment.nextStep}
                onPrev={experiment.previousStep}
                hazards={experiment.hazards}
                ppe={experiment.ppe}
              />
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white/85 p-5 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                <Users className="h-4 w-4" />
                Collaboration
              </div>
              <LabCollaborationPanel
                collaboration={collaboration}
                roomId={roomId}
                setRoomId={setRoomId}
              />
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white/85 p-5 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                <Clipboard className="h-4 w-4" />
                Safety log
              </div>

              <div className="mt-4 space-y-3">
                {experiment.hazards.length > 0 ? (
                  experiment.hazards.slice(-6).reverse().map((hazard) => (
                    <div
                      key={hazard.id}
                      className={`rounded-2xl border px-4 py-3 text-sm ${
                        hazard.level === 'danger'
                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : hazard.level === 'warning'
                          ? 'border-amber-200 bg-amber-50 text-amber-800'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4" />
                        <div>
                          <p className="font-medium">{hazard.title}</p>
                          <p className="mt-1 text-xs opacity-80">{hazard.message}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-600">No safety events yet.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
