export default function WorkflowDraft({ value, onChange, disabled }) {
  return <textarea aria-label="Borrador JSON" className="min-h-80 w-full rounded-lg border border-slate-300 bg-slate-950 p-4 font-mono text-sm text-green-200 outline-none focus:border-blue-500" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} spellCheck="false" />;
}
