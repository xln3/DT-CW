#!/usr/bin/env python
"""Backup and restore face embeddings data.

Usage:
    python scripts/face_embeddings_backup.py export [--output FILE]
    python scripts/face_embeddings_backup.py import [--input FILE]
    python scripts/face_embeddings_backup.py list
"""
import sys
import os
import json
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from database import db
from models import Member
from models.face_models import MemberFace

DEFAULT_BACKUP_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'data',
    'face_embeddings.json'
)


def export_embeddings(output_file=None):
    """Export face embeddings to JSON file."""
    output_file = output_file or DEFAULT_BACKUP_FILE

    # Ensure directory exists
    os.makedirs(os.path.dirname(output_file), exist_ok=True)

    app = create_app()
    with app.app_context():
        faces = MemberFace.query.filter(
            MemberFace.representative_embedding.isnot(None)
        ).all()

        data = {
            'exported_at': datetime.utcnow().isoformat(),
            'count': len(faces),
            'embeddings': []
        }

        for f in faces:
            member_name = f.member.name if f.member else None
            data['embeddings'].append({
                'member_name': member_name,
                'member_id': f.member_id,
                'embedding': f.get_embedding(),
                'status': f.status,
                'distinguishability_score': f.distinguishability_score,
                'photo_count': f.photo_count,
                'registered_at': f.registered_at.isoformat() if f.registered_at else None,
            })

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"已导出 {len(faces)} 条人脸向量到 {output_file}")


def import_embeddings(input_file=None):
    """Import face embeddings from JSON file."""
    input_file = input_file or DEFAULT_BACKUP_FILE

    if not os.path.exists(input_file):
        print(f"错误: 文件不存在 {input_file}")
        return

    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    app = create_app()
    with app.app_context():
        imported = 0
        updated = 0
        skipped = 0
        not_found = []

        for item in data['embeddings']:
            member_name = item['member_name']
            if not member_name:
                skipped += 1
                continue

            # Find member by name
            member = Member.query.filter_by(name=member_name).first()
            if not member:
                not_found.append(member_name)
                continue

            embedding = item.get('embedding')
            if not embedding:
                skipped += 1
                continue

            # Check if MemberFace exists
            face = MemberFace.query.filter_by(member_id=member.id).first()

            if face:
                # Update existing
                if face.representative_embedding:
                    skipped += 1
                    continue
                face.set_embedding(embedding)
                face.status = item.get('status', 'registered')
                face.distinguishability_score = item.get('distinguishability_score')
                face.photo_count = item.get('photo_count', 0)
                updated += 1
            else:
                # Create new
                face = MemberFace(
                    member_id=member.id,
                    status=item.get('status', 'registered'),
                    distinguishability_score=item.get('distinguishability_score'),
                    photo_count=item.get('photo_count', 0),
                )
                face.set_embedding(embedding)
                db.session.add(face)
                imported += 1

        db.session.commit()

        print(f"导入完成: 新增 {imported}, 更新 {updated}, 跳过 {skipped}")
        if not_found:
            unique_not_found = list(set(not_found))
            print(f"未找到成员 ({len(unique_not_found)}): {', '.join(unique_not_found)}")


def list_embeddings():
    """List current face embeddings in database."""
    app = create_app()
    with app.app_context():
        faces = MemberFace.query.filter(
            MemberFace.representative_embedding.isnot(None)
        ).all()

        print(f"数据库中共 {len(faces)} 条人脸向量:")
        for f in sorted(faces, key=lambda x: x.member.name if x.member else ''):
            name = f.member.name if f.member else f"[ID:{f.member_id}]"
            score = f.distinguishability_score or 0
            print(f"  {name}: 状态={f.status}, 可区分度={score:.2f}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return

    command = sys.argv[1]

    if command == 'export':
        output_file = sys.argv[3] if len(sys.argv) > 3 and sys.argv[2] == '--output' else None
        export_embeddings(output_file)
    elif command == 'import':
        input_file = sys.argv[3] if len(sys.argv) > 3 and sys.argv[2] == '--input' else None
        import_embeddings(input_file)
    elif command == 'list':
        list_embeddings()
    else:
        print(f"未知命令: {command}")
        print(__doc__)


if __name__ == '__main__':
    main()
