import { Code } from "lucide-react";
import { useState, useCallback } from "react";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const CodeEditor = ({ value, onChange, placeholder = "Paste your code here..." }: CodeEditorProps) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const lines = value.split("\n").length || 1;
  const lineNumbers = Array.from({ length: Math.max(lines, 8) }, (_, i) => i + 1);

  return (
    <div
      className={`code-editor rounded-xl border transition-all duration-200 ${
        isFocused ? "border-primary/50 shadow-glow" : "border-border/50"
      }`}
    >
      <div className="flex items-center gap-2 border-b border-border/50 px-3 sm:px-4 py-2 sm:py-3">
        <Code className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
        <span className="text-xs sm:text-sm font-medium text-foreground">Your Code</span>
      </div>
      
      <div className="flex max-h-[250px] sm:max-h-[400px] overflow-auto">
        {/* Line numbers - hidden on very small screens */}
        <div className="hidden xs:flex flex-col items-end border-r border-border/30 bg-muted/30 px-2 sm:px-3 py-3 sm:py-4 select-none">
          {lineNumbers.map((num) => (
            <span key={num} className="text-[10px] sm:text-xs text-muted-foreground leading-5 sm:leading-6">
              {num}
            </span>
          ))}
        </div>
        
        {/* Code area */}
        <textarea
          value={value}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          spellCheck={false}
          data-testid="input-code-editor"
          className="flex-1 resize-none bg-transparent p-3 sm:p-4 text-xs sm:text-sm text-foreground outline-none font-mono leading-5 sm:leading-6 placeholder:text-muted-foreground/50 min-h-[200px] sm:min-h-[300px]"
        />
      </div>
    </div>
  );
};

export default CodeEditor;
