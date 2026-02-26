import { useState } from 'react';
import { Search, Check } from 'lucide-react';
import type { Member } from '../types';

interface MemberPickerProps {
  members: Member[];
  onAdd: (memberIds: number[]) => void;
  isAdding: boolean;
}

export default function MemberPicker({ members, onAdd, isAdding }: MemberPickerProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const filtered = members.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      (m.student_id && m.student_id.toLowerCase().includes(q))
    );
  });

  const toggleMember = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAdd = () => {
    if (selected.size > 0) {
      onAdd(Array.from(selected));
    }
  };

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索姓名或学号..."
          className="form-input pl-9"
          autoFocus
        />
      </div>

      {/* Member list */}
      <div className="max-h-60 overflow-y-auto border rounded-md divide-y divide-gray-100">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            {members.length === 0 ? '所有成员已在节目中' : '未找到匹配的成员'}
          </p>
        ) : (
          filtered.map((member) => {
            const isSelected = selected.has(member.id);
            return (
              <button
                key={member.id}
                onClick={() => toggleMember(member.id)}
                className={`w-full flex items-center px-3 py-2 text-left hover:bg-gray-50 ${
                  isSelected ? 'bg-primary-50' : ''
                }`}
              >
                <div
                  className={`w-5 h-5 rounded border flex items-center justify-center mr-3 flex-shrink-0 ${
                    isSelected
                      ? 'bg-primary-600 border-primary-600'
                      : 'border-gray-300'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-medium text-gray-900">{member.name}</span>
                  {member.student_id && (
                    <span className="ml-2 text-xs text-gray-500">{member.student_id}</span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Selection count + add button */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm text-gray-600">已选择 {selected.size} 人</span>
          <button
            className="btn-primary text-sm"
            onClick={handleAdd}
            disabled={isAdding}
          >
            {isAdding ? '添加中...' : `添加 ${selected.size} 人`}
          </button>
        </div>
      )}
    </div>
  );
}
