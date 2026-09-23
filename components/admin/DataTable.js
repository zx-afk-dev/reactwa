export default function DataTable({ columns, rows, renderActions }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => <th key={c.key}>{c.label}</th>)}
            {renderActions && <th>Aksi</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={columns.length + (renderActions ? 1 : 0)} className="empty-cell">Tidak ada data.</td></tr>
          )}
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((c) => <td key={c.key}>{c.render ? c.render(row) : (row[c.key] ?? '-')}</td>)}
              {renderActions && <td className="actions-cell">{renderActions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
