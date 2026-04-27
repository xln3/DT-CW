#!/usr/bin/env python
"""Migrate all data from SQLite to PostgreSQL.

Usage:
    python scripts/migrate_to_postgres.py <postgresql_url>

Example:
    python scripts/migrate_to_postgres.py postgresql://dtcw:password@localhost/dt_cw

This script:
1. Reads all data from the local SQLite database
2. Creates tables on PostgreSQL using the ORM models
3. Copies all data in foreign-key dependency order
4. Resets PostgreSQL sequences to correct values
5. Verifies row counts match

Face recognition data (embeddings, annotations, crops) is fully preserved.
"""
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import date as _date, time as _time, datetime as _datetime

from sqlalchemy import create_engine, text, inspect, MetaData, Table
from sqlalchemy.orm import Session


def _coerce(value, type_name):
    """Cross-engine value coercion. SQLite stores BOOLEAN as INTEGER 0/1 and
    DATE/TIME/DATETIME as ISO strings; PG strict-types reject them.
    Returns the value re-cast to the target column's expected Python type.
    """
    if value is None:
        return None
    if type_name == 'Boolean':
        if isinstance(value, bool):
            return value
        if isinstance(value, (int,)):
            return bool(value)
        if isinstance(value, str):
            return value.strip().lower() in ('1', 'true', 't', 'yes', 'y')
        return bool(value)
    if type_name == 'Date':
        if isinstance(value, _date) and not isinstance(value, _datetime):
            return value
        if isinstance(value, _datetime):
            return value.date()
        if isinstance(value, str):
            return _date.fromisoformat(value[:10])
    if type_name == 'Time':
        if isinstance(value, _time):
            return value
        if isinstance(value, str):
            return _time.fromisoformat(value.split('.')[0])
    if type_name == 'DateTime':
        if isinstance(value, _datetime):
            return value
        if isinstance(value, str):
            return _datetime.fromisoformat(value.replace('T', ' '))
    return value


# Tables in foreign-key dependency order.
# Each round only depends on tables from previous rounds.
MIGRATION_ORDER = [
    # Round 0: root tables (no foreign keys)
    [
        'semesters',
        'members',
        'teachers',
        'system_config',
        'event_types',
        'venues',
        'payment_sources',
        'budget_categories',
        'audit_logs',
    ],
    # Round 1: depends on round 0
    [
        'users',       # FK: members.id (nullable)
        'programs',    # FK: semesters.id (nullable)
    ],
    # Round 2: depends on round 0-1
    [
        'user_programs',      # FK: users, programs
        'program_members',    # FK: programs, members
        'program_teachers',   # FK: programs, teachers
        'rehearsals',         # FK: programs, teachers
        'face_vectors',       # FK: members
        'member_faces',       # FK: members
        'confusion_pairs',    # FK: members x2
        'venue_time_slots',   # FK: venues, semesters
        'teacher_payments',   # FK: teachers, semesters, users
        'budgets',            # FK: semesters, programs, budget_categories, users
    ],
    # Round 3: depends on round 0-2
    [
        'member_photos',               # FK: members, member_faces
        'photo_recognitions',          # FK: rehearsals, programs
        'face_annotations',            # FK: rehearsals, members, users
        'venue_bookings',              # FK: venues, programs, rehearsals, users
        'teacher_entry_applications',  # FK: teachers, rehearsals, users
        'calendar_events',             # FK: event_types, programs, rehearsals, users
        'expenses',                    # FK: budgets, teachers, users
        'payment_source_details',      # FK: teacher_payments, payment_sources
    ],
    # Round 4: depends on round 0-3
    [
        'attendance',        # FK: rehearsals, members, face_annotations
        'detected_faces',    # FK: photo_recognitions, members, users
        'calibration_tasks', # FK: members, confusion_pairs, rehearsals, photo_recognitions
    ],
    # Round 5: depends on round 0-4
    [
        'recognition_errors',       # FK: rehearsals, detected_faces, members, users
        'calibration_challenges',   # FK: members, calibration_tasks, member_photos
    ],
]


def get_all_table_names():
    """Flatten migration order into a single list."""
    tables = []
    for round_tables in MIGRATION_ORDER:
        tables.extend(round_tables)
    return tables


def copy_table(src_engine, tgt_engine, table_name, tgt_columns):
    """Copy all rows from a SQLite table to PostgreSQL with type-aware coercion.

    Uses Table reflection on both sides so SQLAlchemy can bind values via the
    target column's type, but we still pre-coerce SQLite-isms (int-as-bool,
    iso-string-as-date) defensively because reflected types behave differently
    across versions and we want zero surprises.

    Returns the number of rows copied.
    """
    src_inspector = inspect(src_engine)
    if table_name not in src_inspector.get_table_names():
        return 0

    src_md = MetaData()
    tgt_md = MetaData()
    src_table = Table(table_name, src_md, autoload_with=src_engine)
    tgt_table = Table(table_name, tgt_md, autoload_with=tgt_engine)

    common_cols = [c.name for c in src_table.columns if c.name in tgt_columns]
    if not common_cols:
        return 0

    tgt_col_types = {c.name: type(c.type).__name__ for c in tgt_table.columns}

    with src_engine.connect() as src_conn:
        rows = src_conn.execute(src_table.select()).fetchall()
    if not rows:
        return 0

    src_col_names = [c.name for c in src_table.columns]
    batch_size = 500
    total = len(rows)

    with tgt_engine.begin() as tgt_conn:
        for i in range(0, total, batch_size):
            batch = rows[i:i + batch_size]
            params = []
            for row in batch:
                row_dict = dict(zip(src_col_names, row))
                params.append({
                    c: _coerce(row_dict[c], tgt_col_types.get(c, ''))
                    for c in common_cols
                })
            tgt_conn.execute(tgt_table.insert(), params)

    return total


def reset_sequences(tgt_engine, table_names):
    """Reset PostgreSQL auto-increment sequences to max(id) + 1."""
    with tgt_engine.connect() as conn:
        for table_name in table_names:
            # Check if table has an 'id' column with a sequence
            try:
                result = conn.execute(
                    text(f"SELECT MAX(id) FROM {table_name}")
                ).scalar()
                if result is not None:
                    seq_name = f"{table_name}_id_seq"
                    conn.execute(
                        text(f"SELECT setval('{seq_name}', :val)")
                        , {'val': result}
                    )
            except Exception:
                # Table might not have an 'id' column or sequence
                pass
        conn.commit()


def verify_counts(src_engine, tgt_engine, table_names):
    """Verify row counts match between source and target."""
    src_inspector = inspect(src_engine)
    src_tables = src_inspector.get_table_names()
    mismatches = []

    with src_engine.connect() as src_conn, tgt_engine.connect() as tgt_conn:
        for table_name in table_names:
            if table_name not in src_tables:
                continue
            src_count = src_conn.execute(
                text(f'SELECT COUNT(*) FROM {table_name}')
            ).scalar()
            try:
                tgt_count = tgt_conn.execute(
                    text(f'SELECT COUNT(*) FROM {table_name}')
                ).scalar()
            except Exception:
                tgt_count = -1

            status = 'OK' if src_count == tgt_count else 'MISMATCH'
            if src_count != tgt_count:
                mismatches.append((table_name, src_count, tgt_count))

            if src_count > 0 or tgt_count > 0:
                print(f"  {table_name:40s} SQLite: {src_count:6d}  PG: {tgt_count:6d}  {status}")

    return mismatches


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    pg_url = sys.argv[1]

    # Validate PostgreSQL URL
    if not pg_url.startswith('postgresql'):
        print(f"错误: 需要 PostgreSQL 连接字符串，收到: {pg_url}")
        sys.exit(1)

    # SQLite source path
    sqlite_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'arts_management.db'
    )
    if not os.path.exists(sqlite_path):
        print(f"错误: 找不到 SQLite 数据库: {sqlite_path}")
        sys.exit(1)

    sqlite_url = f'sqlite:///{sqlite_path}'

    print(f"源数据库:   {sqlite_path}")
    print(f"目标数据库: {pg_url}")
    print()

    # Step 1: Create tables on PostgreSQL using Flask app + ORM models
    print("=== 第1步: 在 PostgreSQL 上创建表结构 ===")
    os.environ['DATABASE_URL'] = pg_url
    os.environ['FLASK_ENV'] = 'production'

    from app import create_app
    app = create_app('production')

    # create_app already calls db.create_all() and init_defaults()
    print("表结构创建完成")
    print()

    # Step 2: Get target table column info
    tgt_engine = create_engine(pg_url)
    tgt_inspector = inspect(tgt_engine)
    tgt_table_columns = {}
    for table_name in get_all_table_names():
        try:
            cols = tgt_inspector.get_columns(table_name)
            tgt_table_columns[table_name] = {c['name'] for c in cols}
        except Exception:
            tgt_table_columns[table_name] = set()

    # Step 3: Clear any default data that create_app inserted
    # (system_config defaults, admin user, event_types)
    print("=== 第2步: 清理初始化默认数据 ===")
    with tgt_engine.connect() as conn:
        # Delete in reverse dependency order to avoid FK violations
        for table_name in reversed(get_all_table_names()):
            try:
                conn.execute(text(f'DELETE FROM {table_name}'))
            except Exception:
                pass
        conn.commit()
    print("默认数据已清理")
    print()

    # Step 4: Copy data from SQLite to PostgreSQL
    print("=== 第3步: 迁移数据 ===")
    src_engine = create_engine(sqlite_url)

    total_rows = 0
    start_time = time.time()

    for round_idx, round_tables in enumerate(MIGRATION_ORDER):
        print(f"\n--- 第 {round_idx} 轮 ---")
        for table_name in round_tables:
            if table_name not in tgt_table_columns:
                print(f"  跳过 {table_name} (目标表不存在)")
                continue

            count = copy_table(src_engine, tgt_engine, table_name, tgt_table_columns[table_name])
            total_rows += count
            if count > 0:
                print(f"  {table_name}: {count} 行")
            else:
                print(f"  {table_name}: (空表)")

    elapsed = time.time() - start_time
    print(f"\n数据迁移完成: {total_rows} 行, 耗时 {elapsed:.1f}s")
    print()

    # Step 5: Reset sequences
    print("=== 第4步: 重置自增序列 ===")
    reset_sequences(tgt_engine, get_all_table_names())
    print("序列已重置")
    print()

    # Step 6: Verify
    print("=== 第5步: 验证数据 ===")
    mismatches = verify_counts(src_engine, tgt_engine, get_all_table_names())

    if mismatches:
        print(f"\n有 {len(mismatches)} 个表的行数不匹配:")
        for table_name, src_count, tgt_count in mismatches:
            print(f"  {table_name}: SQLite={src_count}, PG={tgt_count}")
        sys.exit(1)
    else:
        print("\n所有表行数一致，迁移成功!")

    # Step 7: Show face recognition data summary
    print()
    print("=== 人脸识别数据摘要 ===")
    with tgt_engine.connect() as conn:
        face_count = conn.execute(
            text("SELECT COUNT(*) FROM member_faces WHERE representative_embedding IS NOT NULL")
        ).scalar()
        photo_count = conn.execute(
            text("SELECT COUNT(*) FROM member_photos")
        ).scalar()
        recognition_count = conn.execute(
            text("SELECT COUNT(*) FROM photo_recognitions")
        ).scalar()
        detected_count = conn.execute(
            text("SELECT COUNT(*) FROM detected_faces")
        ).scalar()

        print(f"  已注册人脸向量:   {face_count}")
        print(f"  成员照片:         {photo_count}")
        print(f"  识别任务记录:     {recognition_count}")
        print(f"  检测到的人脸:     {detected_count}")

    print()
    print("迁移完成。请更新 .env 文件中的 DATABASE_URL 为 PostgreSQL 连接字符串。")


if __name__ == '__main__':
    main()
