interface EditorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function Editor({ value, onChange }: EditorProps) {
  return (
    <textarea
      className="w-full h-full resize-none p-4 text-sm font-mono leading-relaxed bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Markdown を入力..."
      spellCheck={false}
    />
  );
}
