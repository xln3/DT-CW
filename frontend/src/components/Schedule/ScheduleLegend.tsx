import type { ScheduleProgramInfo } from '../../types';

interface ScheduleLegendProps {
  programs: ScheduleProgramInfo[];
  onProgramClick?: (programId: number) => void;
}

export function ScheduleLegend({ programs, onProgramClick }: ScheduleLegendProps) {
  if (programs.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5 p-1.5 sm:gap-3 sm:p-3 bg-gray-50 rounded-lg">
      {programs.map((program) => (
        <button
          key={program.id}
          onClick={() => onProgramClick?.(program.id)}
          className="flex items-center gap-1 sm:gap-2 px-1.5 py-0.5 sm:px-3 sm:py-1.5 bg-white rounded-full shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        >
          <span
            className="w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: program.display_color }}
          />
          <span className="text-[10px] sm:text-sm font-medium text-gray-700 whitespace-nowrap">{program.name}</span>
          {program.category && (
            <span className="text-[9px] sm:text-xs text-gray-400 hidden sm:inline">({program.category})</span>
          )}
        </button>
      ))}
    </div>
  );
}

export default ScheduleLegend;
