import { useState, useCallback, useRef, useEffect } from "react";
import {
  Sparkles, Activity, Brain, Github, History, Clock,
  Coins, RotateCcw, ChevronDown, ChevronLeft, DollarSign, Save,
  FolderGit2, AlertTriangle, Rocket, GitBranch, CheckCircle2,
  XCircle, Upload, RefreshCw, Eye, Terminal, Zap, Play,
  Info, ChevronUp, Minimize2, Maximize2
} from "lucide-react";
import Header from "@/components/Header";
import { toast } from "sonner";

const VibeCoding = () => {
  return (
    <div style={{ padding: 40, fontFamily: "monospace", background: "#0a0a0a", minHeight: "100vh", color: "#a0a0a0" }}>
      <h1 style={{ color: "#7c3aed", fontSize: 24, marginBottom: 16 }}>⚡ Autonomous Coder — Loading Test</h1>
      <p>If you see this, React mounted successfully. The crash is in a component below Header.</p>
      <Header />
    </div>
  );
};

export default VibeCoding;
