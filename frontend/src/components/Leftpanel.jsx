// LeftPanel — structural shell, no content
// Slots: label, headline, subheadline, description, image, stat, statsTable, methodology
// All children are optional — pass nothing for a blank panel

export default function LeftPanel({ children }) {
  return (
    <aside
      className='flex flex-col gap-4 p-5'
      style={{
        width: '350px',
        // minWidth: '280px',
        background: 'var(--color-panel)',
        borderRight: '3px solid var(--color-ink)',
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        height: '100vh',
        overflowY: 'auto',
      }}
    >
      {children}
    </aside>
  );
}

