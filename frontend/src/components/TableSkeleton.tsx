interface TableSkeletonProps {
  columns?: number;
  rows?: number;
}

export default function TableSkeleton({ columns = 5, rows = 5 }: TableSkeletonProps) {
  return (
    <div className="animate-pulse">
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="flex space-x-4">
            {Array.from({ length: columns }).map((_, colIdx) => (
              <div
                key={colIdx}
                className="h-4 bg-gray-200 rounded flex-1"
                style={{ maxWidth: colIdx === 0 ? '30%' : '20%' }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
