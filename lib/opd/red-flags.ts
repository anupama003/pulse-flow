// Deterministic emergency screen for patient-dictated symptoms. Runs alongside the LLM:
// if EITHER flags an emergency, the booking page tells the patient to go to emergency / call 108
// instead of quietly giving them an OPD token for tomorrow. Pure module, unit-tested.

const RULES: { label: string; re: RegExp }[] = [
  { label: "Chest pain or pressure", re: /\bchest (pain|pressure|tightness|heaviness)|pain in (my|the) chest|heart attack|\b(seene|chhati|chhaati) (mein|me|main) (dard|bhaaripan|jakdan)/i },
  { label: "Difficulty breathing", re: /\b(can'?t|cannot|unable to|difficulty|trouble|hard to) breath|breathless|short(ness)? of breath|gasping|lips (are |turning )?blue/i },
  { label: "Fainting or unresponsive", re: /\b(fainted|passed out|unconscious|not responding|unresponsive|collapsed)\b/i },
  { label: "Seizure", re: /\b(seizure|fits?|convulsions?|convulsing)\b/i },
  { label: "Stroke signs", re: /\b(face (is )?droop|slurred speech|can'?t (move|feel) (one|his|her|my) (side|arm|leg)|weakness (on )?one side|sudden(ly)? confused)/i },
  { label: "Vomiting blood or black stools", re: /\b(vomit(ing|ed)? blood|blood in (the )?vomit|black (tarry )?stools?|tarry stools?|coffee[- ]ground)/i },
  { label: "Heavy bleeding", re: /\b(heavy|severe|won'?t stop|non[- ]?stop|lot of) bleeding|bleeding (heavily|a lot|won'?t stop)/i },
  { label: "Severe allergic reaction", re: /\b(swelling of (the )?(face|lips|tongue|throat)|(face|lips|tongue|throat) (is |are )?swell|anaphyla)/i },
  { label: "Thoughts of self-harm", re: /\b(suicid|kill (myself|himself|herself)|end (my|his|her) life|self[- ]harm|don'?t want to live)/i },
  { label: "Poisoning or overdose", re: /\b(poison|overdose|swallowed (some|a lot of)|snake ?bite|scorpion sting)/i },
  { label: "Severe head injury", re: /\b(head injury|hit (his|her|my) head).{0,40}(vomit|unconscious|bleeding|confused|drowsy)/i },
  { label: "Fever with stiff neck or non-fading rash", re: /\b(stiff neck|neck stiffness|rash (that )?(doesn'?t|does not|won'?t) fade|purple (spots|rash)|non[- ]?blanching)/i },
  { label: "Pregnancy with bleeding or severe pain", re: /\bpregnan\w*.{0,60}(bleeding|severe pain|water broke|no movement)|(bleeding|severe pain).{0,60}pregnan/i },
  { label: "Young infant with fever", re: /\b([0-9]|1[01])[- ]?(day|week|month)s?[- ]old\b.{0,80}\b(fever|temperature|hot)\b|\b(fever|temperature)\b.{0,80}\b([0-9]|1[01])[- ]?(day|week|month)s?[- ]old\b/i },
  { label: "Severe dehydration in a child", re: /\b(no (urine|wet nappy|wet diaper|pee)|not (passed|passing) urine).{0,40}(hours|since)/i },
];

export function detectRedFlags(text: string): string[] {
  return RULES.filter((r) => r.re.test(text)).map((r) => r.label);
}

/** Final urgency: the stricter of the LLM's view and the rules. */
export function mergeUrgency(llm: "ROUTINE" | "SOON" | "EMERGENCY", ruleFlags: string[]): "ROUTINE" | "SOON" | "EMERGENCY" {
  return ruleFlags.length ? "EMERGENCY" : llm;
}
