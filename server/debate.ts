import { callAI, parseJsonResponse } from "./routes";
import { workerBus } from "./agentWorker";

export type DebateVerdict = "PROCEED" | "REFINE" | "ESCALATE";

export interface DebateResult {
  verdict: DebateVerdict;
  proponentArgument: string;
  opponentArgument: string;
  moderatorReasoning: string;
  refinements?: string[];
  escalationReason?: string;
  confidence: number;
}

export async function runDebate(
  sessionId: string,
  proposal: string,
  context?: string,
  operationType: string = "feature",
  model?: string
): Promise<DebateResult> {
  const contextBlock = context ? `\n\nProject context:\n${context.slice(0, 3000)}` : "";

  workerBus.emit("debate:start", { sessionId, proposal, operationType });

  // ── Round 1: Proponent ─────────────────────────────────────────────────
  const proponentPrompt = `You are the Proponent agent in an architectural debate.
Your job: argue FOR the following proposal. Be specific, cite technical benefits, and anticipate objections.

Proposal: ${proposal}
Operation type: ${operationType}${contextBlock}

Respond with a focused argument (3–5 sentences max). Be concrete — cite real engineering benefits.
Do NOT hedge. You are arguing FOR this change.`;

  workerBus.emit("debate:thinking", { sessionId, role: "proponent" });
  const proponentRes = await callAI(proponentPrompt, "Provide your argument FOR the proposal.", model);
  const proponentArgument = proponentRes.content;
  workerBus.emit("debate:argument", { sessionId, role: "proponent", argument: proponentArgument });

  // ── Round 2: Opponent ──────────────────────────────────────────────────
  const opponentPrompt = `You are the Opponent agent in an architectural debate.
Your job: find real flaws, risks, and edge cases in the following proposal. Be specific and technical.

Proposal: ${proposal}
Operation type: ${operationType}${contextBlock}

Proponent argued: ${proponentArgument}

Respond with your strongest objections (3–5 sentences max). Focus on concrete risks: data loss, 
breaking changes, performance regressions, security issues, or architectural debt.
Do NOT agree with the proponent. You are finding problems.`;

  workerBus.emit("debate:thinking", { sessionId, role: "opponent" });
  const opponentRes = await callAI(opponentPrompt, "Provide your argument AGAINST the proposal.", model);
  const opponentArgument = opponentRes.content;
  workerBus.emit("debate:argument", { sessionId, role: "opponent", argument: opponentArgument });

  // ── Round 3: Moderator ─────────────────────────────────────────────────
  const thresholdNote =
    operationType === "destructive" || operationType === "architectural"
      ? "This is a HIGH-STAKES operation. Default to ESCALATE unless proponent's case is overwhelming."
      : operationType === "bugfix" || operationType === "style"
      ? "This is a LOW-RISK operation. Default to PROCEED unless opponent raises a concrete critical issue."
      : "Apply balanced judgment.";

  const moderatorPrompt = `You are the Moderator agent in an architectural debate.
You have heard both sides. Your job: render a fair, evidence-based verdict.

Proposal: ${proposal}
Operation type: ${operationType}
${thresholdNote}

Proponent argued: ${proponentArgument}

Opponent argued: ${opponentArgument}

You MUST respond with valid JSON only — no other text:
{
  "verdict": "PROCEED" | "REFINE" | "ESCALATE",
  "reasoning": "2–4 sentence explanation of your decision",
  "confidence": 85,
  "refinements": ["specific change 1", "specific change 2"],
  "escalationReason": "why human review is needed"
}

Verdict definitions:
- PROCEED: benefits clearly outweigh risks, safe to execute now
- REFINE: good idea but needs specific adjustments before execution
- ESCALATE: too risky, uncertain, or irreversible — requires human approval`;

  workerBus.emit("debate:thinking", { sessionId, role: "moderator" });
  const moderatorRes = await callAI(moderatorPrompt, "Provide your verdict.", model);
  
  let verdict: DebateVerdict = "ESCALATE";
  let moderatorReasoning = moderatorRes.content;
  let refinements: string[] | undefined;
  let escalationReason: string | undefined;
  let confidence = 50;

  try {
    const parsed = parseJsonResponse(moderatorRes.content);
    verdict = ["PROCEED", "REFINE", "ESCALATE"].includes(parsed.verdict) ? parsed.verdict : "ESCALATE";
    moderatorReasoning = parsed.reasoning || moderatorRes.content;
    confidence = Math.min(100, Math.max(0, parsed.confidence ?? 50));
    if (parsed.refinements?.length) refinements = parsed.refinements;
    if (parsed.escalationReason) escalationReason = parsed.escalationReason;
  } catch {
    verdict = "ESCALATE";
    escalationReason = "Moderator response could not be parsed — defaulting to human review.";
    confidence = 0;
  }

  const result: DebateResult = {
    verdict,
    proponentArgument,
    opponentArgument,
    moderatorReasoning,
    refinements,
    escalationReason,
    confidence
  };

  workerBus.emit("debate:verdict", { sessionId, result });

  return result;
}
