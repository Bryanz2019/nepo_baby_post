
export default function ProfileTable({ title='SUBJECT PROFILE -- CLASSIFIED', data = [], className = "", ...props }) {
  return (
    <div className={`px-5 mb-1 ${className}`} {...props}>
      <table className='w-full border-collapse'>

        <caption className='label-tiny text-red text-left py-2.5'>
          {title}
        </caption>

        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} className={`${idx !== 0 ? 'border-t' : ''} border-muted`}>
              <td className='py-1 pr-5 label-tiny text-print'>{row.key}</td>
              <td className='py-1 body-medium text-ink'>{row.value}</td>
            </tr>
          ))}
        </tbody>

      </table>
    </div>
  );
}