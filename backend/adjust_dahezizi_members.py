#!/usr/bin/env python
"""调整大河之子节目成员（2026-03-28 起）：
- 加入: 何烨、向镇
- 退出: 高同阳

幂等：可重复执行。默认 dry-run，加 --execute 才提交。
"""
import sys
from datetime import datetime

from app import create_app
from database import db
from models import Program, Member, ProgramMember, Rehearsal, Attendance

PROGRAM_NAME = '大河之子'
EFFECTIVE_DATE = datetime(2026, 3, 28)
JOIN_NAMES = ['何烨', '向镇']
LEAVE_NAMES = ['高同阳']
LEAVE_REASON = '从 2026-03-28 起退出大河之子'

EXECUTE = '--execute' in sys.argv


def find_unique_member(name):
    members = Member.query.filter_by(name=name).all()
    if not members:
        print(f'  ❌ 找不到成员: {name}')
        return None
    if len(members) > 1:
        ids = [(m.id, m.student_id) for m in members]
        print(f'  ❌ 同名成员多个 {name}: {ids}')
        return None
    return members[0]


def main():
    app = create_app()
    with app.app_context():
        program = Program.query.filter_by(name=PROGRAM_NAME, status='active').first()
        if not program:
            print(f'❌ 节目不存在或非 active: {PROGRAM_NAME}')
            sys.exit(1)

        print(f'节目: {program.name} (id={program.id}, semester_id={program.semester_id})')
        print(f'生效日期: {EFFECTIVE_DATE.date()}')
        print(f'模式: {"EXECUTE (将提交)" if EXECUTE else "DRY-RUN (不提交)"}')

        rehearsals_on_date = Rehearsal.query.filter_by(
            program_id=program.id,
            scheduled_date=EFFECTIVE_DATE.date()
        ).filter(Rehearsal.status != 'cancelled').all()
        print(f'\n{EFFECTIVE_DATE.date()} 当天大河之子排练: {len(rehearsals_on_date)} 次')
        for r in rehearsals_on_date:
            print(f'  - rehearsal id={r.id}, location={r.location}')

        print('\n[查找成员]')
        joiners = []
        for name in JOIN_NAMES:
            m = find_unique_member(name)
            if m:
                joiners.append(m)
                print(f'  ✓ {name} → id={m.id}, student_id={m.student_id}, status={m.status}')
        leavers = []
        for name in LEAVE_NAMES:
            m = find_unique_member(name)
            if m:
                leavers.append(m)
                print(f'  ✓ {name} → id={m.id}, student_id={m.student_id}, status={m.status}')

        missing = (len(JOIN_NAMES) - len(joiners)) + (len(LEAVE_NAMES) - len(leavers))
        if missing > 0:
            print(f'\n⚠️  {missing} 人未找到，仅处理已找到的部分')

        print('\n[加入]')
        for m in joiners:
            existing = ProgramMember.query.filter_by(
                program_id=program.id, member_id=m.id
            ).first()
            if existing:
                if (existing.status == 'active'
                        and existing.joined_at
                        and existing.joined_at.date() <= EFFECTIVE_DATE.date()
                        and not existing.left_at):
                    print(f'  ⏭  {m.name}: 已是 active, joined_at={existing.joined_at.date()} ≤ {EFFECTIVE_DATE.date()}, 跳过')
                    continue
                print(f'  ↻ {m.name}: 更新 status=active, joined_at={EFFECTIVE_DATE.date()}, left_at=None '
                      f'(原 status={existing.status}, joined_at={existing.joined_at}, left_at={existing.left_at})')
                if EXECUTE:
                    existing.status = 'active'
                    existing.joined_at = EFFECTIVE_DATE
                    existing.left_at = None
                    existing.change_reason = None
            else:
                print(f'  + {m.name}: 新建 ProgramMember(status=active, joined_at={EFFECTIVE_DATE.date()})')
                if EXECUTE:
                    db.session.add(ProgramMember(
                        program_id=program.id,
                        member_id=m.id,
                        status='active',
                        joined_at=EFFECTIVE_DATE,
                    ))

        print('\n[退出]')
        for m in leavers:
            existing = ProgramMember.query.filter_by(
                program_id=program.id, member_id=m.id
            ).first()
            if not existing:
                print(f'  ⏭  {m.name}: 不在大河之子，跳过')
                continue
            if existing.status == 'left':
                print(f'  ⏭  {m.name}: 已 left, left_at={existing.left_at}, 跳过')
                continue
            print(f'  - {m.name}: status=left, left_at={EFFECTIVE_DATE.date()}')
            if EXECUTE:
                existing.status = 'left'
                existing.left_at = EFFECTIVE_DATE
                existing.change_reason = LEAVE_REASON

        if EXECUTE:
            db.session.commit()
            print('\n✓ 成员变更已提交')
        else:
            print('\n(dry-run) 成员变更未提交')

        print('\n[回填 absent 记录（>= 生效日期）]')
        rehearsals = Rehearsal.query.filter_by(program_id=program.id).filter(
            Rehearsal.status != 'cancelled'
        ).all()
        for m in joiners:
            backfilled = 0
            already = 0
            for r in rehearsals:
                if r.scheduled_date < EFFECTIVE_DATE.date():
                    continue
                existing_att = Attendance.query.filter_by(
                    rehearsal_id=r.id, member_id=m.id
                ).first()
                if existing_att:
                    already += 1
                    continue
                backfilled += 1
                if EXECUTE:
                    db.session.add(Attendance(
                        rehearsal_id=r.id,
                        member_id=m.id,
                        status=Attendance.STATUS_ABSENT,
                    ))
            print(f'  {m.name}: 新增 {backfilled} 条, 已有 {already} 条')

        if EXECUTE:
            db.session.commit()
            print('\n✓ 考勤回填已提交')
        else:
            print('\n(dry-run) 考勤回填未提交')

        print('\n' + ('✅ 完成' if EXECUTE else '🔍 DRY-RUN 完成（未做修改）'))


if __name__ == '__main__':
    main()
