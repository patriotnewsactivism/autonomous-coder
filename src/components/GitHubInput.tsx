import { Github, ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface GitHubInputProps {
  onSubmit: (url: string) => void;
  isLoading?: boolean;
}

const GitHubInput = ({ onSubmit, isLoading = false }: GitHubInputProps) => {
  const [url, setUrl] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim());
    }
  };

  const isValidUrl = url.includes("github.com");

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div
        className={`flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3 transition-all duration-200 ${
          isFocused ? "border-primary/50 shadow-glow" : "border-border/50"
        }`}
      >
        <Github className="h-5 w-5 text-muted-foreground" />
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="https://github.com/username/repository"
          className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
        />
      </div>

      <Button
        type="submit"
        disabled={!isValidUrl || isLoading}
        className="w-full glow-button"
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            Connect Repository
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        We'll analyze your repository and provide actionable insights
      </p>
    </form>
  );
};

export default GitHubInput;
