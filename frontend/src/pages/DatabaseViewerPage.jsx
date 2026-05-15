import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Database } from 'lucide-react';
import api from '../api/client';
import usePageTitle from '../hooks/usePageTitle';

export default function DatabaseViewerPage() {
  usePageTitle('Database Viewer');
  const [tables, setTables] = useState([]);
  const [selected, setSelected] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 100;

  useEffect(() => {
    api.get('/db-viewer/tables')
      .then((res) => setTables(res.data))
      .catch((err) => toast.error(err.response?.data?.error || 'Failed to load tables'));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    api.get(`/db-viewer/tables/${selected}`, { params: { limit, offset } })
      .then((res) => setData(res.data))
      .catch((err) => toast.error(err.response?.data?.error || 'Failed to load table'))
      .finally(() => setLoading(false));
  }, [selected, offset]);

  const pickTable = (name) => {
    setSelected(name);
    setOffset(0);
    setData(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Database Viewer</h2>
        <p className="text-sm text-gray-500 mt-1">Read-only view of every SQLite table.</p>
      </div>

      <section className="bg-white rounded-2xl shadow border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
            <Database size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Tables</h3>
            <p className="text-sm text-gray-500 mt-1">Select a table from the list to view rows.</p>
          </div>
        </div>

        <div className="grid md:grid-cols-[260px_1fr] divide-x divide-gray-200">
          <div className="max-h-[75vh] overflow-y-auto">
            {tables.length === 0 ? (
              <div className="p-6 text-sm text-gray-500">Loading tables...</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {tables.map((t) => (
                  <li key={t.name}>
                    <button
                      type="button"
                      onClick={() => pickTable(t.name)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between ${selected === t.name ? 'bg-blue-50' : ''}`}
                    >
                      <span className="font-mono text-sm text-gray-800">{t.name}</span>
                      <span className="text-xs text-gray-500">{t.row_count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="min-h-[200px]">
            {!selected ? (
              <div className="p-6 text-sm text-gray-500">Select a table to view its rows.</div>
            ) : loading ? (
              <div className="p-6 text-sm text-gray-500">Loading {selected}...</div>
            ) : data ? (
              <div className="flex flex-col h-[75vh]">
                <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between flex-wrap gap-2 shrink-0">
                  <div className="text-sm text-gray-700">
                    <span className="font-medium">{data.table}</span>
                    <span className="text-gray-500 ml-2">
                      Rows {data.total === 0 ? 0 : offset + 1}-{Math.min(offset + data.rows.length, data.total)} of {data.total}
                    </span>
                  </div>
                  <Pagination
                    total={data.total}
                    limit={limit}
                    offset={offset}
                    onChange={setOffset}
                  />
                </div>
                <div className="overflow-auto flex-1">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        {data.columns.map((c) => (
                          <th key={c.name} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">
                            {c.name}
                            {c.pk && <span className="ml-1 text-amber-600">PK</span>}
                            <div className="text-[10px] font-normal text-gray-400">{c.type}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.rows.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          {data.columns.map((c) => (
                            <td key={c.name} className="px-3 py-2 font-mono text-gray-800 whitespace-nowrap max-w-xs truncate" title={formatCell(row[c.name])}>
                              {formatCell(row[c.name])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.rows.length === 0 && (
                    <div className="p-6 text-sm text-gray-500">No rows.</div>
                  )}
                </div>
                <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-end shrink-0">
                  <Pagination
                    total={data.total}
                    limit={limit}
                    offset={offset}
                    onChange={setOffset}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function Pagination({ total, limit, offset, onChange }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;
  const [pageInput, setPageInput] = useState(String(currentPage));

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const goToPage = (page) => {
    const clamped = Math.max(1, Math.min(totalPages, page));
    onChange((clamped - 1) * limit);
  };

  const submitPage = (e) => {
    e.preventDefault();
    const n = parseInt(pageInput, 10);
    if (Number.isFinite(n)) goToPage(n);
    else setPageInput(String(currentPage));
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={currentPage === 1}
        onClick={() => goToPage(1)}
        className="px-2 py-1 text-sm border border-gray-300 rounded disabled:opacity-50"
      >
        « First
      </button>
      <button
        type="button"
        disabled={currentPage === 1}
        onClick={() => goToPage(currentPage - 1)}
        className="px-2 py-1 text-sm border border-gray-300 rounded disabled:opacity-50"
      >
        ‹ Prev
      </button>
      <form onSubmit={submitPage} className="flex items-center gap-1 mx-1">
        <input
          type="number"
          min={1}
          max={totalPages}
          value={pageInput}
          onChange={(e) => setPageInput(e.target.value)}
          onBlur={submitPage}
          className="w-14 px-2 py-1 text-sm border border-gray-300 rounded text-center"
        />
        <span className="text-sm text-gray-500">of {totalPages}</span>
      </form>
      <button
        type="button"
        disabled={currentPage >= totalPages}
        onClick={() => goToPage(currentPage + 1)}
        className="px-2 py-1 text-sm border border-gray-300 rounded disabled:opacity-50"
      >
        Next ›
      </button>
      <button
        type="button"
        disabled={currentPage >= totalPages}
        onClick={() => goToPage(totalPages)}
        className="px-2 py-1 text-sm border border-gray-300 rounded disabled:opacity-50"
      >
        Last »
      </button>
    </div>
  );
}

function formatCell(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
