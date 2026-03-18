// LeftPanel — structural shell, no content
// Slots: label, headline, subheadline, description, image, stat, statsTable, methodology
// All children are optional — pass nothing for a blank panel

export default function LeftPanel({ children, className = "", ...props }) {
  return (
    <aside
      className={`flex flex-col gap-4 p-5 sticky top-[20vh] self-start h-[80vh] overflow-y-auto bg-panel border-r-[3px] border-ink w-[380px] min-w-[280px] ${className}`}
      {...props}
    >
      {children}
    </aside>
  );
}
