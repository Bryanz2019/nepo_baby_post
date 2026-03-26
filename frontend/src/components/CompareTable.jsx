// CompareTable — generic styled table
//
// Props:
//   data    — array of row objects (any shape)
//   columns — array of column definitions:
//     {
//       key:         string         — unique key for this column
//       header:      string         — column header label
//       headerColor: string         — optional CSS color for header text
//       renderCell:  (row) => node  — optional custom renderer (supports JSX, buttons, etc.)
//       color:       string         — optional CSS color for cell text (dynamic → style)
//     }
//   bgPaper — bool — if true, uses --color-paper instead of --color-panel for row backgrounds

export default function CompareTable({ data = [], columns = [], className = "", ...props }) {
  return (
    <div className={`w-full overflow-x-auto ${className}`} style={{ border: "1px solid #2C1A00" }} {...props}>
      <table className='w-full border-collapse' style={{ background: "#D4C9B5 "}}>

        {/* Header */}
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th
                key={col.key ?? idx}
                className='label-medium text-left px-4 py-2.5 whitespace-nowrap'
                style={{
                  background: "var(--color-paper)",
                  color: col.headerColor ?? "var(--color-red)",
                  // borderBottom: "1px solid var(--color-subtle)",
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>

        {/* Body — uniform background, dividers between rows */}
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={idx}
              style={{
                background: "var(--color-paper)",
                borderBottom: "1px solid var(--color-subtle)",
              }}
            >
              {columns.map((col, colIdx) => (
                <td key={col.key ?? colIdx} className='px-4 py-1.5 align-middle'>
                  <span
                    className='body-medium'
                    style={{ color: col.color ?? "#1C0A00" }}
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
