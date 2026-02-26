"""Fix 2026 spring semester start_date and program display_colors."""
import sys
import os
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from database import db
from models import Semester, Program

COLOR_MAP = {
    '芭蕾基训': '#EC4899',
    '冰凌花': '#EAB308',
    '冬': '#3B82F6',
    '大河之子': '#92400E',
    '我们看见了鸿雁': '#22C55E',
    # '香扇藏春' stays '#FF9800'
}


def main():
    app = create_app()

    with app.app_context():
        semester = Semester.query.filter_by(name='2026春季').first()
        if not semester:
            print('错误: 学期 "2026春季" 不存在')
            return

        # Fix start_date
        old_start = semester.start_date
        semester.start_date = date(2026, 2, 23)
        print(f'✓ 学期起始日期: {old_start} → {semester.start_date}')

        # Fix program colors
        programs = Program.query.filter_by(semester_id=semester.id).all()
        updated = 0
        for prog in programs:
            new_color = COLOR_MAP.get(prog.name)
            if new_color and prog.display_color != new_color:
                old_color = prog.display_color
                prog.display_color = new_color
                print(f'✓ {prog.name}: {old_color} → {new_color}')
                updated += 1

        db.session.commit()
        print(f'\n=== 完成: 更新 {updated} 个节目颜色 ===')


if __name__ == '__main__':
    main()
