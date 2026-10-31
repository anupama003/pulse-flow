"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ClipboardCheck, HeartPulse, ListTodo, ShieldCheck } from "lucide-react";
import { approveDraft, discardDraft, submitHandover, submitRounds, toggleTask } from "@/app/actions/ward";
import type { DashboardData, DraftEdits, TaskView, UnmatchedCard, UserView } from "@/lib/types";
import ActionBoard from "./ActionBoard";
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

type NavId = "handover" | "approvals" | "patients" | "checklist" | "board";

export default function Dashboard({ initial, shell }: { initial: DashboardData; shell: Shell }) {
  const [data, setData] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [tourOpen, setTourOpen] = useState(false);
  // Server re-render (persona switch, revalidation) → adopt the fresh snapshot.
  useEffect(() => setData(initial), [initial]);

  // Shift brain dump
  const [draft, setDraft] = useState("");
  const [review, setReview] = useState<{ raw: string; handoverId: string | null; unmatched: UnmatchedCard[]; unassigned: string[] } | null>(null);
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
      setReview({ raw, handoverId: res.data.handoverId, unmatched: res.data.unmatched, unassigned: res.data.unassigned });
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

  const goTo = (id: NavId) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <AppShell
      shell={shell}
      onHelp={() => setTourOpen(true)}
      badges={{ "/": data.drafts.length }}
      toolbar={
        <div className="flex items-center gap-1 rounded-full bg-white p-1.5 shadow-widget">
          {(["all", "critical", "stable"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-5 py-2 text-sm capitalize transition ${filter === f ? "bg-ink text-white shadow-md" : "text-slate-500 hover:text-ink"}`}
            >
              {f === "all" ? "All patients" : f}
            </button>
          ))}
        </div>
      }
    >
          <div id="overview" className="mb-8">
            <h1 className="text-4xl font-light tracking-tight md:text-6xl">Ward Dashboard</h1>
            <p className="mt-2 text-slate-400">
              Good {greeting()}, {me.name.split(" ").slice(0, 2).join(" ")}. Speak the handover. Leave on time.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            {/* Dictation hero */}
            <div id="handover" data-tour="dictation" className="min-w-0 scroll-mt-6 xl:col-span-8">
              <DictationBox
                fill
                primary
                value={draft}
                onChange={setDraft}
                onSubmit={handleHandover}
                pending={handoverPending}
                error={handoverError}
                eyebrow="Shift brain dump"
                title="Speak your handover"
                subtitle="Hold your Wispr key and talk through every patient. We'll structure it into SBAR, pull out the tasks, and hand it back to you for approval."
                placeholder={`"Okay so ICU 2, Vikram, BP 84 over 50 on norad, lactate 4.6, repeat ABG at 6. Bed 7 Meera ready for discharge. Bed 12 Arjun, post-op day 1…"`}
                buttonLabel="Structure handover"
                pendingLabel="Structuring…"
              />
            </div>

            {/* Ward overview: pastel tiles (Find Doctor style) */}
            <section data-tour="overview" className="min-w-0 rounded-[2rem] bg-white p-6 shadow-widget xl:col-span-4">
              <h2 className="text-xl font-medium">Ward overview</h2>
              <p className="mb-5 text-sm text-slate-400">Tap a tile to filter patients</p>
              <div className="grid grid-cols-2 gap-3">
                <OverviewTile
                  onClick={() => setFilter("critical")}
                  active={filter === "critical"}
                  className="bg-blush-100 text-blush-700"
                  icon={<HeartPulse className="size-6" />}
                  value={criticalCount}
                  label="Critical"
                />
                <OverviewTile
                  onClick={() => setFilter("stable")}
                  active={filter === "stable"}
                  className="bg-mint-100 text-mint-700"
                  icon={<ShieldCheck className="size-6" />}
                  value={data.patients.length - criticalCount}
                  label="Stable"
                />
                <OverviewTile
                  onClick={() => goTo("checklist")}
                  className="bg-lavender-100 text-lavender-700"
                  icon={<ListTodo className="size-6" />}
                  value={pendingCount}
                  label="Pending tasks"
                />
                <OverviewTile
                  onClick={() => goTo("approvals")}
                  className="bg-butter-100 text-butter-700"
                  icon={<ClipboardCheck className="size-6" />}
                  value={data.drafts.length}
                  label="To approve"
                />
              </div>
            </section>

            {/* Review of the dictation just made */}
            <AnimatePresence>
              {review && (
                <motion.div className="min-w-0 xl:col-span-12" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
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

            {/* Everything else awaiting sign-off */}
            <div id="approvals" data-tour="approvals" className="min-w-0 scroll-mt-6 xl:col-span-12">
              <ApprovalQueue
                drafts={queueDrafts}
                currentUser={me}
                busyId={busyDraft}
                errors={draftErrors}
                onApprove={handleApprove}
                onDiscard={handleDiscard}
              />
            </div>

            {/* Patients (Your Appointments style) */}
            <section id="patients" data-tour="patients" className="min-w-0 scroll-mt-6 xl:col-span-8">
              <div className="mb-4 flex items-end justify-between px-1">
                <div>
                  <h2 className="text-2xl font-medium tracking-tight md:text-3xl">Your patients</h2>
                  <p className="text-sm text-slate-400">Tap a card to start live rounds at the bedside.</p>
                </div>
                <span className="rounded-full bg-white px-4 py-1.5 text-sm text-slate-500 shadow-widget">{patients.length} shown</span>
              </div>
              <motion.div layout className="grid grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-2 2xl:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {patients.map((p) => (
                    <PatientCard key={p.id} patient={p} openTasks={openByPatient.get(p.id) ?? 0} onOpen={() => setSelectedId(p.id)} />
                  ))}
                </AnimatePresence>
              </motion.div>
              {patients.length === 0 && (
                <p className="rounded-[2rem] bg-white p-10 text-center text-slate-400 shadow-widget">No patients match this filter.</p>
              )}
            </section>

            {/* Ward checklist (Homework style) */}
            <div id="checklist" data-tour="checklist" className="min-w-0 scroll-mt-6 xl:col-span-4">
              <TaskSidebar tasks={data.tasks} criticalIds={criticalIds} onToggle={handleToggle} />
            </div>

            <div id="board" className="min-w-0 scroll-mt-6 xl:col-span-12">
              <ActionBoard tasks={data.tasks} onToggle={handleToggle} />
            </div>
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

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

function OverviewTile({
  icon,
  value,
  label,
  className,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  className: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`flex flex-col items-start gap-3 rounded-3xl p-4 text-left transition ${className} ${
        active ? "ring-2 ring-ink/80 ring-offset-2" : ""
      }`}
    >
      <span className="grid size-11 place-items-center rounded-2xl bg-white/70">{icon}</span>
      <span>
        <span className="block text-3xl font-light tabular-nums text-ink">{value}</span>
        <span className="text-sm font-medium">{label}</span>
      </span>
    </motion.button>
  );
}
