"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { approveDraft, discardDraft, submitHandover, submitRounds, toggleTask } from "@/app/actions/ward";
import type { CriticalAlertOutcome, DashboardData, DraftEdits, TaskView, UnmatchedCard, UserView } from "@/lib/types";
import AppShell, { type Shell } from "./AppShell";
import ApprovalQueue from "./ApprovalQueue";
import DictationBox from "./DictationBox";
import LiveReview from "./LiveReview";
import OnboardingTour, { TOUR_KEY } from "./OnboardingTour";
import { SPLASH_DONE_EVENT } from "./brand/splash-key";
import PatientCard from "./PatientCard";
import RoundsModal from "./RoundsModal";
import TaskSidebar from "./TaskSidebar";

const DRAFT_KEY = "pulse-flow:draft";
type Filter = "all" | "critical" | "stable";

/** One view at a time: a doctor at 3 AM should see one thing, not the whole ward at once. */
type Tab = "handover" | "approve" | "patients" | "tasks";

export default function Dashboard({ initial, shell }: { initial: DashboardData; shell: Shell }) {
  const [data, setData] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [tab, setTab] = useState<Tab>("handover");
  const [tourOpen, setTourOpen] = useState(false);
  // Server re-render (persona switch, revalidation) → adopt the fresh snapshot.
  useEffect(() => setData(initial), [initial]);

  // Shift brain dump
  const [draft, setDraft] = useState("");
  const [review, setReview] = useState<{ raw: string; handoverId: string | null; unmatched: UnmatchedCard[]; unassigned: string[]; alerts?: CriticalAlertOutcome[] } | null>(null);
  const [handoverError, setHandoverError] = useState<string | null>(null);
  const [handoverPending, startHandover] = useTransition();

  // Human-in-the-loop
  const [busyDraft, setBusyDraft] = useState<string | null>(null);
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});

  // Live rounds
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roundsError, setRoundsError] = useState<string | null>(null);
  const [roundsPending, startRounds] = useTransition();

  // A 3 AM dictation must never be lost to an accidental refresh.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) setDraft(saved);
      if (!localStorage.getItem(TOUR_KEY)) {
        // First visit → guided tour, but only once the splash intro has finished.
        const open = () => setTourOpen(true);
        if (document.getElementById("pf-splash")) window.addEventListener(SPLASH_DONE_EVENT, open, { once: true });
        else open();
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      if (draft) localStorage.setItem(DRAFT_KEY, draft);
      else localStorage.removeItem(DRAFT_KEY);
    } catch {}
  }, [draft]);

  const isCrit = (p: DashboardData["patients"][number]) => p.isCritical || p.draftCritical;
  const criticalCount = data.patients.filter(isCrit).length;
  const criticalIds = useMemo(() => new Set(data.patients.filter((p) => p.isCritical || p.draftCritical).map((p) => p.id)), [data.patients]);
  const patients = useMemo(
    () =>
      data.patients
        .filter((p) => (filter === "critical" ? criticalIds.has(p.id) : filter === "stable" ? !criticalIds.has(p.id) : true))
        .sort((a, b) => Number(criticalIds.has(b.id)) - Number(criticalIds.has(a.id)) || a.bedNumber.localeCompare(b.bedNumber, undefined, { numeric: true })),
    [data.patients, filter, criticalIds],
  );
  const openByPatient = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of data.tasks) if (!t.isCompleted) m.set(t.patientId, (m.get(t.patientId) ?? 0) + 1);
    return m;
  }, [data.tasks]);
  const selected = data.patients.find((p) => p.id === selectedId) ?? null;
  const pendingCount = data.tasks.filter((t) => !t.isCompleted).length;
  const reviewDrafts = review?.handoverId ? data.drafts.filter((d) => d.handoverId === review.handoverId) : [];
  const queueDrafts = data.drafts.filter((d) => d.handoverId !== review?.handoverId);
  const me: UserView = { id: shell.me.id, name: shell.me.name, role: shell.me.role, title: null };

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleHandover = () => {
    const raw = draft;
    setHandoverError(null);
    setReview({ raw, handoverId: null, unmatched: [], unassigned: [] }); // split screen with skeletons immediately
    startHandover(async () => {
      const res = await submitHandover(raw);
      if (!res.ok) {
        setHandoverError(res.error);
        setReview(null);
        return;
      }
      setReview({ raw, handoverId: res.data.handoverId, unmatched: res.data.unmatched, unassigned: res.data.unassigned, alerts: res.data.alerts });
      setData(res.data.dashboard);
      setDraft("");
    });
  };

  const handleRounds = (text: string) =>
    new Promise<boolean>((resolve) => {
      if (!selectedId) return resolve(false);
      setRoundsError(null);
      startRounds(async () => {
        const res = await submitRounds(selectedId, text);
        if (!res.ok) {
          setRoundsError(res.error);
          return resolve(false);
        }
        setData(res.data.dashboard);
        resolve(true);
      });
    });

  const runDraftAction = async (id: string, fn: () => ReturnType<typeof approveDraft>) => {
    setBusyDraft(id);
    setDraftErrors(({ [id]: _, ...rest }) => rest);
    const res = await fn();
    setBusyDraft(null);
    if (res.ok) setData(res.data);
    else setDraftErrors((e) => ({ ...e, [id]: res.error }));
  };
  const handleApprove = (id: string, edits: DraftEdits) => runDraftAction(id, () => approveDraft(id, edits));
  const handleDiscard = (id: string) => runDraftAction(id, () => discardDraft(id));

  // Optimistic: strike through instantly (with my name), roll back if the server disagrees.
  const handleToggle = useCallback(
    async (task: TaskView) => {
      const next = !task.isCompleted;
      const flip = (v: boolean) =>
        setData((d) => ({
          ...d,
          tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, isCompleted: v, completedByName: v ? me.name : null } : t)),
        }));
      flip(next);
      const res = await toggleTask(task.id, next);
      if (!res.ok) flip(!next);
    },
    [me.name],
  );

  const closeRounds = useCallback(() => {
    setSelectedId(null);
    setRoundsError(null);
  }, []);

  const show = (t: Tab, f: Filter = "all") => {
    setFilter(f);
    setTab(t);
  };

  return (
    <AppShell shell={shell} onHelp={() => setTourOpen(true)} badges={{ "/": data.drafts.length }}>
      <div className="mx-auto max-w-6xl">
        <div id="overview" className="mb-6">
          <h1 className="text-3xl font-light tracking-tight md:text-5xl">Ward</h1>
          <p className="mt-1 text-slate-400">
            Good {greeting()}, {me.name.split(" ").slice(0, 2).join(" ")}.
          </p>
          {!shell.switchOn && <SwitchOffNotice />}
        </div>

        {/* What needs this doctor now: three numbers, each opens its view */}
        <div data-tour="overview" className="mb-6 grid grid-cols-3 gap-3">
          <NeedsCard value={criticalCount} label={criticalCount === 1 ? "critical patient" : "critical patients"} tone="blush" onClick={() => show("patients", "critical")} />
          <NeedsCard value={data.drafts.length} label={data.drafts.length === 1 ? "note to approve" : "notes to approve"} tone="butter" onClick={() => show("approve")} />
          <NeedsCard value={pendingCount} label={pendingCount === 1 ? "open task" : "open tasks"} tone="lavender" onClick={() => show("tasks")} />
        </div>

        <nav className="mb-6 flex gap-1 overflow-x-auto rounded-full bg-white p-1.5 shadow-widget">
          {(
            [
              ["handover", "Handover", "dictation", null],
              ["approve", "To approve", "approvals", data.drafts.length],
              ["patients", "Patients", "patients", null],
              ["tasks", "Tasks", "checklist", pendingCount],
            ] as const
          ).map(([id, label, tour, count]) => (
            <button
              key={id}
              data-tour={tour === "dictation" ? undefined : tour}
              onClick={() => show(id)}
              className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-medium transition ${
                tab === id ? "bg-ink text-white shadow-md" : "text-slate-500 hover:text-ink"
              }`}
            >
              {label}
              {!!count && <span className={`rounded-full px-2 text-xs ${tab === id ? "bg-white/20" : "bg-canvas"}`}>{count}</span>}
            </button>
          ))}
        </nav>

        {tab === "handover" && (
          <div className="space-y-5">
            <div id="handover" data-tour="dictation" className="min-w-0">
              <DictationBox
                fill
                primary
                value={draft}
                onChange={setDraft}
                onSubmit={handleHandover}
                pending={handoverPending}
                error={handoverError}
                eyebrow="Shift handover"
                title="Speak your handover"
                subtitle="Hold your Wispr key and go bed by bed. Pulse Flow writes one note per patient and pulls out the tasks. Nothing is saved until a doctor approves it."
                placeholder={`"ICU 2, Vikram, BP 84 by 50 on norad, lactate 4.6, repeat ABG at 6. Bed 7 Meera, ready for discharge after sir's round…"`}
                buttonLabel="Make notes"
                pendingLabel="Writing notes…"
              />
            </div>
            <AnimatePresence>
              {review && (
                <motion.div className="min-w-0" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  {!!review.alerts?.length && <AlertOutcomes alerts={review.alerts} />}
                  <LiveReview
                    raw={review.raw}
                    drafts={reviewDrafts}
                    unmatched={review.unmatched}
                    unassigned={review.unassigned}
                    pending={handoverPending}
                    currentUser={me}
                    busyId={busyDraft}
                    errors={draftErrors}
                    onApprove={handleApprove}
                    onDiscard={handleDiscard}
                    onDismiss={() => setReview(null)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {tab === "approve" && (
          <div id="approvals" className="min-w-0">
            <ApprovalQueue
              drafts={queueDrafts}
              currentUser={me}
              busyId={busyDraft}
              errors={draftErrors}
              onApprove={handleApprove}
              onDiscard={handleDiscard}
            />
          </div>
        )}

        {tab === "patients" && (
          <section id="patients" className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
              <p className="text-sm text-slate-400">Critical patients first. Tap a patient to start rounds.</p>
              <div className="flex gap-1 rounded-full bg-white p-1 shadow-widget">
                {(["all", "critical"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded-full px-4 py-1.5 text-sm transition ${filter === f ? "bg-ink text-white" : "text-slate-500 hover:text-ink"}`}
                  >
                    {f === "all" ? "All" : "Critical"}
                  </button>
                ))}
              </div>
            </div>
            <motion.div layout className="grid grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {patients.map((p) => (
                  <PatientCard key={p.id} patient={p} openTasks={openByPatient.get(p.id) ?? 0} onOpen={() => setSelectedId(p.id)} />
                ))}
              </AnimatePresence>
            </motion.div>
            {patients.length === 0 && <p className="rounded-[2rem] bg-white p-10 text-center text-slate-400 shadow-widget">No critical patients right now.</p>}
          </section>
        )}

        {tab === "tasks" && (
          <div id="checklist" className="min-w-0">
            <TaskSidebar tasks={data.tasks} criticalIds={criticalIds} onToggle={handleToggle} />
          </div>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <RoundsModal
            key={selected.id}
            patient={selected}
            tasks={data.tasks.filter((t) => t.patientId === selected.id)}
            drafts={data.drafts.filter((d) => d.patientId === selected.id)}
            pending={roundsPending}
            error={roundsError}
            currentUser={me}
            busyId={busyDraft}
            draftErrors={draftErrors}
            onApprove={handleApprove}
            onDiscard={handleDiscard}
            onToggle={handleToggle}
            onSubmit={handleRounds}
            onClose={closeRounds}
          />
        )}
      </AnimatePresence>

      <OnboardingTour open={tourOpen} onClose={() => setTourOpen(false)} />
    </AppShell>
  );
}

/** Only shown when Switch is off: the one thing a doctor must know is that nobody else will be told. */
function SwitchOffNotice() {
  return (
    <p className="mt-3 max-w-3xl rounded-2xl bg-butter-100 px-4 py-2.5 text-sm text-butter-700">
      Switch is off: critical patients and late tasks only show up on this screen. Nobody is messaged on Telegram, and no agent follows up.
    </p>
  );
}

/** After a handover: did each critical alert reach the escalations group, or only this screen? */
function AlertOutcomes({ alerts }: { alerts: CriticalAlertOutcome[] }) {
  return (
    <ul className="mb-3 space-y-1.5">
      {alerts.map((a) => (
        <li key={a.bed} className={`rounded-2xl px-4 py-2.5 text-sm ${a.status === "SENT" ? "bg-mint-50 text-mint-700" : "bg-blush-100 text-blush-700"}`}>
          <span className="font-medium">Bed {a.bed}, {a.patientName}: critical.</span>{" "}
          {a.status === "SENT"
            ? "Sent to the escalations group on Telegram."
            : a.status === "FAILED"
              ? "Couldn't reach Switch, so the escalations group wasn't told. Call the consultant."
              : "Not sent: Switch is off. Only people looking at this screen will know."}
        </li>
      ))}
    </ul>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

const TONE = {
  blush: "bg-blush-100 text-blush-700",
  butter: "bg-butter-100 text-butter-700",
  lavender: "bg-lavender-100 text-lavender-700",
} as const;

function NeedsCard({ value, label, tone, onClick }: { value: number; label: string; tone: keyof typeof TONE; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-3xl px-4 py-4 text-left transition hover:-translate-y-0.5 ${value ? TONE[tone] : "bg-white text-slate-400 shadow-widget"}`}
    >
      <span className="block text-3xl font-light tabular-nums text-ink">{value}</span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
