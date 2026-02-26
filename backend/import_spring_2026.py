"""Import 2026 spring semester training data from Excel."""
import sys
import os
from datetime import date, time

import openpyxl

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from database import db
from models import (
    Semester, Member, User, Program, ProgramMember, UserProgram,
    Venue, VenueTimeSlot,
)

EXCEL_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    '..', 'assets', '春季训练',
    '2026春季学期一队参训及剧目分流统计(3).xlsx',
)

# Program definitions: name -> (display_color, description)
PROGRAM_DEFS = {
    '芭蕾基训': ('#E91E63', '常规排练: 周日 9:00-11:00 | 新清舞蹈排练厅'),
    '冰凌花':   ('#9C27B0', '常规排练: 周日 12:00-14:15 | 新清舞蹈排练厅'),
    '香扇藏春': ('#FF9800', '常规排练: 周日 14:15-16:30 | 新清舞蹈排练厅'),
    '冬':       ('#2196F3', '常规排练: 周六 12:00-14:15 | 新清舞蹈排练厅'),
    '大河之子': ('#4CAF50', '常规排练: 周六 14:30-16:45 | 新清舞蹈排练厅'),
    '我们看见了鸿雁': ('#F44336', '常规排练: 周日 18:45-21:00 | 新清舞蹈排练厅'),
}

# Leaders: program_name -> [(member_name, member_id), ...]
LEADERS = {
    '冬':       [('黄子莟', 17), ('艾丽雅', 1)],
    '大河之子': [('谈皓', 50), ('谌卓凡', 5)],
    '芭蕾基训': [('陈煦霖', 4), ('许珑女', 63)],
    '冰凌花':   [('赵芷欣', 74), ('朱利娅娜', 78)],
    '香扇藏春': [('韩娅非', 11), ('王艺晓', 56)],
    '我们看见了鸿雁': [('李延昊', 25), ('张馨月', 69)],
}

# New members to create
NEW_MEMBERS = ['裴雨桐', '陈海雁', '肖艳', '邓欣晨', '乔炫嘉', '王宇轩']

# Venue time slots: (day_of_week, start_time, end_time)
# day_of_week: 0=Mon, 1=Tue, ..., 6=Sun
VENUE_TIME_SLOTS = [
    # 周一
    (0, time(12, 0), time(19, 0)),
    (0, time(22, 0), time(22, 30)),
    # 周二
    (1, time(12, 0), time(15, 0)),
    (1, time(17, 0), time(19, 0)),
    (1, time(22, 0), time(22, 30)),
    # 周三
    (2, time(12, 0), time(13, 0)),
    (2, time(15, 30), time(22, 30)),
    # 周四: 不可用 — no slots
    # 周五
    (4, time(12, 0), time(22, 30)),
    # 周六
    (5, time(12, 0), time(13, 0)),
    (5, time(17, 30), time(22, 30)),
    # 周日
    (6, time(8, 0), time(22, 30)),
]


def read_excel_programs(path):
    """Read program member assignments from Excel '26春' sheet.

    Returns dict: program_name -> list of unique member names.
    """
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb['26春']

    programs = {}
    for col in range(1, 7):
        name = ws.cell(row=1, column=col).value
        if not name:
            continue
        seen = set()
        members = []
        for row in range(2, ws.max_row + 1):
            val = ws.cell(row=row, column=col).value
            if val is None or isinstance(val, (int, float)):
                continue
            member_name = val.strip()
            if member_name not in seen:
                seen.add(member_name)
                members.append(member_name)
        programs[name] = members

    wb.close()
    return programs


def main():
    app = create_app()

    with app.app_context():
        # Safety check: don't run twice
        existing = Semester.query.filter_by(name='2026春季').first()
        if existing:
            print(f'错误: 学期 "2026春季" 已存在 (id={existing.id})，跳过导入。')
            print('如需重新导入，请先手动删除该学期及其关联数据。')
            return

        # --- Step 1: Create semester ---
        semester = Semester(
            name='2026春季',
            semester_type=Semester.TYPE_SPRING,
            start_date=date(2026, 3, 7),
            end_date=date(2026, 5, 31),
        )
        db.session.add(semester)
        db.session.flush()  # get semester.id

        # Set as current
        Semester.query.update({'is_current': False})
        semester.is_current = True
        print(f'✓ 创建学期: {semester.name} (id={semester.id}), 已设为当前学期')

        # --- Step 2: Create new members + user accounts ---
        new_member_map = {}
        for name in NEW_MEMBERS:
            member = Member(name=name, status='active')
            db.session.add(member)
            db.session.flush()
            new_member_map[name] = member

            user = User(
                username=name,
                display_name=name,
                role=User.ROLE_MEMBER,
                status='active',
                member_id=member.id,
            )
            user.set_password('123456')
            db.session.add(user)

        print(f'✓ 创建 {len(NEW_MEMBERS)} 个新成员及账号: {", ".join(NEW_MEMBERS)}')

        # --- Step 3: Read Excel and create programs + member assignments ---
        excel_programs = read_excel_programs(EXCEL_PATH)

        # Build name -> member lookup
        all_members = {m.name: m for m in Member.query.all()}

        program_map = {}  # program_name -> Program
        stats = {}

        for prog_name in PROGRAM_DEFS:
            color, desc = PROGRAM_DEFS[prog_name]
            program = Program(
                name=prog_name,
                category=Program.CATEGORY_DANCE,
                description=desc,
                display_color=color,
                semester_id=semester.id,
                status=Program.STATUS_ACTIVE,
            )
            db.session.add(program)
            db.session.flush()
            program_map[prog_name] = program

            member_names = excel_programs.get(prog_name, [])
            added = 0
            missing = []
            for mname in member_names:
                member = all_members.get(mname)
                if not member:
                    missing.append(mname)
                    continue
                pm = ProgramMember(
                    program_id=program.id,
                    member_id=member.id,
                    status='active',
                )
                db.session.add(pm)
                added += 1

            stats[prog_name] = added
            if missing:
                print(f'  ⚠ {prog_name}: 未找到成员 {missing}')

        print(f'✓ 创建 {len(program_map)} 个节目:')
        for pname, count in stats.items():
            print(f'    {pname}: {count} 人')

        # --- Step 4: Set leaders (is_leader on ProgramMember) ---
        leader_count = 0
        for prog_name, leader_list in LEADERS.items():
            program = program_map[prog_name]
            for leader_name, member_id in leader_list:
                pm = ProgramMember.query.filter_by(
                    program_id=program.id,
                    member_id=member_id,
                ).first()
                if pm:
                    pm.is_leader = True
                    leader_count += 1
                else:
                    print(f'  ⚠ 负责人 {leader_name} 不在节目 {prog_name} 的成员中')

        print(f'✓ 设置 {leader_count} 位节目负责人 (is_leader)')

        # --- Step 5: Upgrade leader users to program_manager + UserProgram ---
        upgraded = 0
        user_programs_created = 0
        for prog_name, leader_list in LEADERS.items():
            program = program_map[prog_name]
            for leader_name, member_id in leader_list:
                user = User.query.filter_by(member_id=member_id).first()
                if not user:
                    print(f'  ⚠ 负责人 {leader_name} 无对应用户账号')
                    continue

                if user.role == User.ROLE_MEMBER:
                    user.role = User.ROLE_PROGRAM_MANAGER
                    upgraded += 1

                # Create UserProgram if not exists
                existing_up = UserProgram.query.filter_by(
                    user_id=user.id,
                    program_id=program.id,
                ).first()
                if not existing_up:
                    up = UserProgram(
                        user_id=user.id,
                        program_id=program.id,
                    )
                    db.session.add(up)
                    user_programs_created += 1

        print(f'✓ 升级 {upgraded} 位用户为 program_manager, 创建 {user_programs_created} 条 UserProgram')

        # --- Step 6: Create venue + time slots ---
        venue = Venue.query.filter_by(name='新清舞蹈排练厅').first()
        if not venue:
            venue = Venue(
                name='新清舞蹈排练厅',
                location='新清华学堂',
                is_active=True,
            )
            db.session.add(venue)
            db.session.flush()
            print(f'✓ 创建场地: {venue.name} (id={venue.id})')
        else:
            print(f'✓ 场地已存在: {venue.name} (id={venue.id})')

        slot_count = 0
        for day, start, end in VENUE_TIME_SLOTS:
            ts = VenueTimeSlot(
                venue_id=venue.id,
                semester_id=semester.id,
                day_of_week=day,
                start_time=start,
                end_time=end,
                is_available=True,
            )
            db.session.add(ts)
            slot_count += 1

        print(f'✓ 创建 {slot_count} 条场地可用时段')

        # --- Commit ---
        db.session.commit()
        print('\n=== 导入完成 ===')
        total_members = sum(stats.values())
        print(f'学期: {semester.name} ({semester.start_date} ~ {semester.end_date})')
        print(f'节目: {len(program_map)} 个, 共 {total_members} 人次')
        print(f'新成员: {len(NEW_MEMBERS)} 人')
        print(f'负责人: {leader_count} 人')
        print(f'场地时段: {slot_count} 条')


if __name__ == '__main__':
    main()
