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
    <div className="flex flex-wrap gap-3 p-3 bg-gray-50 rounded-lg">
      {programs.map((program) => (
        <button
          key={program.id}
          onClick={() => onProgramClick?.(program.id)}
          className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        >
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: program.display_color }}
          />
          <span className="text-sm font-medium text-gray-700">{program.name}</span>
        </button>
      ))}
    </div>
  );
}

export default ScheduleLegend;
