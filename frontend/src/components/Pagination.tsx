import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  perPage: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, pages, total, perPage, onChange }: PaginationProps) {
  if (pages <= 1) return null;

  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
      <span className="text-sm text-gray-500">
        共 {total} 条，显示 {start}-{end}
      </span>
      <div className="flex items-center space-x-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 sm:p-2 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: pages }, (_, i) => i + 1)
          .filter((p) => {
            // Show first, last, current, and neighbors
            if (p === 1 || p === pages) return true;
            if (Math.abs(p - page) <= 1) return true;
            return false;
          })
          .reduce<(number | '...')[]>((acc, p, idx, arr) => {
            if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
              acc.push('...');
            }
            acc.push(p);
            return acc;
          }, [])
          .map((item, idx) =>
            item === '...' ? (
              <span key={`ellipsis-${idx}`} className="px-1 sm:px-2 text-gray-400">
                ...
              </span>
            ) : (
              <button
                key={item}
                onClick={() => onChange(item as number)}
                className={`px-2 py-1 sm:px-3 rounded text-sm ${
                  item === page
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {item}
              </button>
            )
          )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= pages}
          className="p-1.5 sm:p-2 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
