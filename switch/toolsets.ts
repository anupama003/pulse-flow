/** Which Pulse Flow tools each Switch agent gets: least privilege, on top of the per-person RBAC every tool enforces. */
export const AGENT_TOOLSETS: Record<string, string[]> = {
  "ward-scribe": ["ward_board", "care_plan", "submit_handover", "submit_rounds", "approve_handover_note", "discard_handover_note", "complete_task"],
  "ward-coordinator": ["ward_followups", "ward_board", "complete_task"],
  "opd-desk": ["opd_queue", "list_departments", "register_walk_in"],
  fulfilment: ["pharmacy_queue", "update_pharmacy_order", "lab_queue", "update_lab_order"],
};
