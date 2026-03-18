// NepoTable — generic styled table
//
// Props:
//   data    — array of row objects (any shape)
//   columns — array of column definitions:
//     {
//       key:        string         — unique key for this column
//       header:     string         — column header label
//       renderCell: (row) => node  — optional custom renderer (supports JSX, buttons, etc.)
//       color:      string         — optional CSS color for cell text (dynamic → style)
//     }

export default function NepoTable({ data = [], columns = [], className = "", ...props }) {
  return (
    <div className={`w-full overflow-x-auto bg-panel ${className}`} {...props}>
      <table className='w-full border-collapse'>

        {/* Header — ink bg, muted text */}
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th
                key={col.key ?? idx}
                className='label-medium text-left px-4 py-2.5 whitespace-nowrap bg-ink text-muted'
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>

        {/* Body — alternating rows, dynamic bg per row index */}
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={idx}
              className='border-b border-subtle'
              style={{ background: idx % 2 === 0 ? 'var(--color-panel)' : 'var(--color-paper)' }}
            >
              {columns.map((col, colIdx) => (
                <td key={col.key ?? colIdx} className='px-4 py-2.5 align-middle'>
                  <span
                    className='body-medium'
                    style={{ color: col.color ?? 'var(--color-ink)' }}
                  >
                    {col.renderCell ? col.renderCell(row) : row[col.key]}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>

      </table>
    </div>
  );
}