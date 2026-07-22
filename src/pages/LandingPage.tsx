import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  Code2,
  Database,
  FlaskConical,
  Globe,
  KeyRound,
  Layers,
  Rocket,
  Search,
  Shield,
  Sparkles,
  Swords,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// ─── Data (mirrors the real agent roster in src/components/agents/AgentSelector.tsx) ──

const AGENT_CATEGORIES = [
  { name: "Core", agents: ["Orchestrator", "Strategist"], color: "text-[#8C1D40]" },
  { name: "Research", agents: ["Researcher", "Architect", "Analyst"], color: "text-cyan-400" },
  { name: "Build", agents: ["Database", "API", "UI/UX", "Builder", "Mobile"], color: "text-violet-400" },
  { name: "Quality", agents: ["Testing", "Security", "Performance"], color: "text-yellow-400" },
  { name: "Polish", agents: ["SEO", "Accessibility", "Docs", "Optimizer"], color: "text-emerald-400" },
  { name: "Review", agents: ["Reviewer", "Fixer", "Refiner"], color: "text-blue-400" },
  { name: "Deploy", agents: ["Deployer"], color: "text-green-500" },
];

const PRESETS = [
  { icon: Sparkles, label: "Auto", desc: "Orchestrator decides the whole pipeline for you" },
  { icon: Zap, label: "Quick", desc: "Core build only — strategist, builder, reviewer, fixer" },
  { icon: Code2, label: "Full Stack", desc: "Complete web app pipeline, 10 agents end to end" },
  { icon: Search, label: "Research", desc: "Deep research first — all 19 build/quality agents" },
  { icon: Shield, label: "Bug Fix", desc: "Diagnose and patch only — analyst, fixer, reviewer" },
  { icon: Layers, label: "Custom", desc: "Hand-pick exactly which of the 21 agents run" },
];

const FEATURES = [
  {
    icon: Bot,
    title: "21 Specialized Agents",
    desc: "Not one generalist model wearing different hats — real dedicated agents for architecture, database, API, mobile, security, SEO, accessibility, and more, each with a focused job.",
  },
  {
    icon: Swords,
    title: "Architectural Debate Engine",
    desc: "Before big decisions ship, agents argue it out — proponent, opponent, and a moderator that scores the evidence and decides: proceed, refine, or escalate.",
  },
  {
    icon: Brain,
    title: "Superagent Task Router",
    desc: "Drop in a task in plain English — the router classifies it and dispatches it to the right pipeline automatically, no manual setup required.",
  },
  {
    icon: Globe,
    title: "Multi-Provider Routing",
    desc: "DeepSeek, Groq, Gemini, Cerebras, GitHub Models, and Cohere — the platform routes each agent to whichever provider fits the job best, with automatic fallback.",
  },
  {
    icon: Rocket,
    title: "Live Sandbox Preview",
    desc: "Watch your app come together in a real, running sandbox as agents write it — not a static code dump you have to run yourself to see if it works.",
  },
  {
    icon: KeyRound,
    title: "Bring Your Own Key",
    desc: "Plug in your own provider API keys and every agent run uses your credits directly — no markup, no shared-compute rate limits, full transparency.",
  },
];

const PLANS = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    highlight: false,
    cta: "Start Free",
    features: [
      "Quick preset (4 agents)",
      "Community-tier model access",
      "3 active projects",
      "Shared compute, standard queue",
    ],
  },
  {
    key: "weekly",
    name: "Starter",
    price: "$14.99",
    period: "/week",
    highlight: false,
    cta: "Get Starter",
    features: [
      "All 6 pipeline presets",
      "All 21 agents unlocked",
      "Debate engine on architecture calls",
      "Priority build queue",
    ],
  },
  {
    key: "monthly",
    name: "Pro",
    price: "$39.99",
    period: "/month",
    highlight: true,
    cta: "Go Pro",
    features: [
      "Everything in Starter",
      "Higher concurrent build limit",
      "Private projects & shared links",
      "Superagent task router included",
    ],
  },
  {
    key: "lifetime",
    name: "Lifetime BYOK",
    price: "$499",
    period: "once",
    highlight: false,
    cta: "Buy Lifetime",
    features: [
      "Unlimited usage, forever",
      "Bring your own provider keys",
      "Zero compute markup — ever",
      "All future agents & presets included",
    ],
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={{ background: "#0a0a0a" }} className="min-h-screen text-slate-200">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-violet-400" />
            <span className="font-mono text-sm font-semibold tracking-tight text-white">
              Autonomous Coder
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/vibe")}
              className="rounded-md border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-white/20 hover:text-white"
            >
              Sign in
            </button>
            <button
              onClick={() => navigate("/vibe")}
              className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500"
            >
              Start Building
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-20 pt-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300">
            <Sparkles className="h-3.5 w-3.5" />
            21 agents. 6 pipelines. One prompt.
          </div>
          <h1 className="text-4xl font-bold leading-tight text-white sm:text-6xl">
            Describe it. A team of{" "}
            <span className="text-violet-400">autonomous agents</span> builds it.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            Autonomous Coder spins up a real engineering team for your idea —
            architects, builders, testers, security review, and a deploy agent —
            debating tradeoffs and shipping working code in a live sandbox you
            can watch build in real time.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              onClick={() => navigate("/vibe")}
              className="flex items-center gap-2 rounded-md bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
            >
              Start Building Free <ArrowRight className="h-4 w-4" />
            </button>
            <a
              href="#pricing"
              className="rounded-md border border-white/10 px-6 py-3 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:text-white"
            >
              See pricing
            </a>
          </div>
        </motion.div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="rounded-lg border border-white/10 bg-white/[0.02] p-6"
            >
              <f.icon className="mb-3 h-6 w-6 text-violet-400" />
              <h3 className="mb-2 font-semibold text-white">{f.title}</h3>
              <p className="text-sm leading-relaxed text-slate-400">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Agent roster */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            21 agents, organized like a real eng team
          </h2>
          <p className="mt-3 text-slate-400">
            Every category has a job. Nothing is a generic do-everything prompt.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AGENT_CATEGORIES.map((cat) => (
            <div key={cat.name} className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
              <div className={`mb-3 text-xs font-semibold uppercase tracking-wide ${cat.color}`}>
                {cat.name}
              </div>
              <ul className="space-y-1.5 text-sm text-slate-300">
                {cat.agents.map((a) => (
                  <li key={a} className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Presets */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Pick a pipeline, or let Auto decide
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PRESETS.map((p) => (
            <div
              key={p.label}
              className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-5"
            >
              <p.icon className="mt-0.5 h-5 w-5 shrink-0 text-violet-400" />
              <div>
                <div className="font-semibold text-white">{p.label}</div>
                <div className="mt-1 text-sm text-slate-400">{p.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Simple, honest pricing</h2>
          <p className="mt-3 text-slate-400">
            Go Lifetime and bring your own AI keys — zero markup, ever.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className={`relative flex flex-col rounded-xl border p-6 ${
                plan.highlight
                  ? "border-violet-500/50 bg-violet-500/[0.06]"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 px-3 py-0.5 text-xs font-semibold text-white">
                  Most Popular
                </div>
              )}
              <div className="text-sm font-semibold text-slate-300">{plan.name}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-white">{plan.price}</span>
                <span className="text-sm text-slate-500">{plan.period}</span>
              </div>
              {plan.key === "lifetime" && (
                <p className="mt-1 text-xs text-amber-400/80">BYOK — bring your own AI provider key</p>
              )}
              <ul className="mt-5 flex-1 space-y-2.5 text-sm text-slate-300">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" />
                    {f}
                  </li>
                ))}
              </ul>
              {plan.key === "lifetime" && (
                <div
                  className="mt-4 rounded-md p-3 text-xs text-slate-400"
                  style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}
                >
                  <span className="font-semibold text-amber-400">BYOK:</span> supply your own
                  DeepSeek, Groq, Gemini, or Cohere key. No compute costs billed by us, ever.
                </div>
              )}
              <button
                onClick={() => navigate("/vibe")}
                className={`mt-6 rounded-md px-4 py-2.5 text-sm font-semibold transition ${
                  plan.highlight
                    ? "bg-violet-600 text-white hover:bg-violet-500"
                    : "border border-white/10 text-slate-200 hover:border-white/20"
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="border-t border-white/5 px-6 py-16 text-center">
        <h2 className="text-2xl font-bold text-white">Your next app is one prompt away.</h2>
        <button
          onClick={() => navigate("/vibe")}
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
        >
          Start Building Free <ArrowRight className="h-4 w-4" />
        </button>
        <p className="mt-8 text-xs text-slate-600">© 2026 Autonomous Coder. All agents on deck.</p>
      </section>
    </div>
  );
}
