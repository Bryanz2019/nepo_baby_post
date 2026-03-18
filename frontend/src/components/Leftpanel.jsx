// LeftPanel — structural shell, no content
// Slots: label, headline, subheadline, description, image, stat, statsTable, methodology
// All children are optional — pass nothing for a blank panel

export default function LeftPanel({ children }) {
  return (
    <aside
      className='flex flex-col gap-4 p-5 h-full'
      style={{
        width: '480px',
        background: 'var(--color-paper)',
        borderRight: '1px solid var(--color-subtle)',
      }}
    >
      {children}
    </aside>
  );


};