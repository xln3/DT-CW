"""Member management routes."""
from datetime import datetime
from flask import Blueprint, request, jsonify, g, send_file
from pypinyin import lazy_pinyin

from database import db
from models import Member, User, AuditLog
from auth.decorators import login_required, committee_required, admin_required
from auth.permissions import Permission, check_permission


def _sort_members_by_pinyin(members):
    """Sort members by pinyin of their names."""
    def sort_key(m):
        return ''.join(lazy_pinyin(m.name or ''))
    return sorted(members, key=sort_key)



def _create_user_for_member(member):
    """Create a user account for a member if conditions are met.

    - Username: member's name
    - Password: last 6 characters of student_id (or full student_id if < 6 chars)
    - Role: member

    Returns the created User or None if not created.
    """
    # Skip if no student_id (can't generate password)
    if not member.student_id:
        return None

    # Skip if user with same username already exists
    existing_user = User.query.filter_by(username=member.name).first()
    if existing_user:
        # If user exists but not linked to this member, link them
        if existing_user.member_id is None:
            existing_user.member_id = member.id
            db.session.commit()
        return existing_user

    # Generate password from student_id (last 6 chars or full if shorter)
    student_id = member.student_id.strip()
    password = student_id[-6:] if len(student_id) >= 6 else student_id

    # Create user
    user = User(
        username=member.name,
        display_name=member.name,
        role=User.ROLE_MEMBER,
        status='active',
        member_id=member.id,
        email=member.email,
        phone=member.phone,
    )
    user.set_password(password)

    db.session.add(user)
    db.session.commit()

    return user



members_bp = Blueprint('members', __name__)


def _update_member_data(member, data, is_create=False):
    """Helper to update member fields from data dict."""
    if 'name' in data:
        name = data['name'].strip() if isinstance(data['name'], str) else data['name']
        if name:
            member.name = name

    if 'student_id' in data:
        member.student_id = (data['student_id'].strip() if data['student_id'] else None)

    if 'phone' in data:
        member.phone = (data['phone'].strip() if data['phone'] else None)

    if 'gender' in data:
        member.gender = (data['gender'].strip() if data['gender'] else None)

    if 'department' in data:
        member.department = (data['department'].strip() if data['department'] else None)

    if 'grade' in data:
        member.grade = (data['grade'].strip() if data['grade'] else None)

    if 'notes' in data:
        member.notes = (data['notes'].strip() if data['notes'] else None)

    if 'status' in data:
        status = data['status'].strip() if isinstance(data['status'], str) else data['status']
        if status in ['active', 'inactive']:
            member.status = status

    # Extended fields
    if 'class_name' in data:
        member.class_name = (data['class_name'].strip() if data['class_name'] else None)

    if 'email' in data:
        member.email = (data['email'].strip() if data['email'] else None)

    if 'dormitory' in data:
        member.dormitory = (data['dormitory'].strip() if data['dormitory'] else None)

    if 'birth_date' in data:
        member.birth_date = _parse_date(data['birth_date'])

    if 'ethnicity' in data:
        member.ethnicity = (data['ethnicity'].strip() if data['ethnicity'] else None)

    if 'hometown' in data:
        member.hometown = (data['hometown'].strip() if data['hometown'] else None)

    if 'political_status' in data:
        member.political_status = (data['political_status'].strip() if data['political_status'] else None)

    if 'party_branch' in data:
        member.party_branch = (data['party_branch'].strip() if data['party_branch'] else None)

    if 'is_talented' in data:
        member.is_talented = bool(data['is_talented'])

    if 'is_concentrated_class' in data:
        member.is_concentrated_class = bool(data['is_concentrated_class'])

    if 'team_role' in data:
        member.team_role = (data['team_role'].strip() if data['team_role'] else None)

    if 'join_year' in data:
        member.join_year = data['join_year']

    if 'team_level' in data:
        member.team_level = (data['team_level'].strip() if data['team_level'] else None)

    if 'graduating_this_semester' in data:
        member.graduating_this_semester = bool(data['graduating_this_semester'])

    db.session.commit()

    return jsonify({
        'message': '队员更新成功' if not is_create else '队员创建成功',
        'member': member.to_dict()
    }), 200 if not is_create else 201


@members_bp.route('', methods=['GET'])
@login_required
def list_members():
    """List all members with optional pagination and sorting."""
    # Filter options
    status = request.args.get('status')
    search = request.args.get('search', '').strip()
    sort = request.args.get('sort', 'pinyin')  # pinyin (default) or birthday
    page = request.args.get('page', type=int)
    per_page = request.args.get('per_page', 20, type=int)

    query = Member.query

    if status:
        query = query.filter_by(status=status)

    if search:
        query = query.filter(
            db.or_(
                Member.name.ilike(f'%{search}%'),
                Member.student_id.ilike(f'%{search}%'),
                Member.department.ilike(f'%{search}%')
            )
        )

    brief = g.current_user.role != 'admin'
    members = query.all()

    if sort == 'birthday':
        from datetime import date as date_type
        sorted_members = sorted(members, key=lambda m: m.birth_date or date_type.max)
    else:
        sorted_members = _sort_members_by_pinyin(members)

    # If page param is provided, return paginated results
    if page is not None:
        total = len(sorted_members)
        start = (page - 1) * per_page
        end = start + per_page
        paged = sorted_members[start:end]
        return jsonify({
            'items': [m.to_dict(brief=brief) for m in paged],
            'total': total,
            'page': page,
            'per_page': per_page,
            'pages': (total + per_page - 1) // per_page,
        })

    # No pagination — return all (backwards compatible)
    return jsonify({
        'members': [m.to_dict(brief=brief) for m in sorted_members]
    })


@members_bp.route('/<int:member_id>', methods=['GET'])
@login_required
def get_member(member_id):
    """Get member by ID."""
    member = Member.query.get_or_404(member_id)
    brief = g.current_user.role != 'admin'
    return jsonify({'member': member.to_dict(include_programs=True, brief=brief)})


@members_bp.route('', methods=['POST'])
@admin_required
def create_member():
    """Create a new member (or update if name exists)."""
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供队员信息'}), 400

    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': '姓名不能为空'}), 400

    existing = Member.query.filter_by(name=name).first()
    if existing:
        return jsonify({'error': f'已存在同名成员: {name}', 'existing_id': existing.id}), 409

    # Parse date field
    birth_date = None
    if data.get('birth_date'):
        birth_date = _parse_date(data.get('birth_date'))

    member = Member(
        name=name,
        student_id=data.get('student_id', '').strip() or None,
        phone=data.get('phone', '').strip() or None,
        gender=data.get('gender', '').strip() or None,
        department=data.get('department', '').strip() or None,
        grade=data.get('grade', '').strip() or None,
        notes=data.get('notes', '').strip() or None,
        status='active',
        # Extended fields
        class_name=data.get('class_name', '').strip() or None,
        email=data.get('email', '').strip() or None,
        dormitory=data.get('dormitory', '').strip() or None,
        birth_date=birth_date,
        ethnicity=data.get('ethnicity', '').strip() or None,
        hometown=data.get('hometown', '').strip() or None,
        political_status=data.get('political_status', '').strip() or None,
        party_branch=data.get('party_branch', '').strip() or None,
        is_talented=data.get('is_talented', False),
        is_concentrated_class=data.get('is_concentrated_class', False),
        team_role=data.get('team_role', '').strip() or None,
        join_year=data.get('join_year'),
        team_level=data.get('team_level', '').strip() or None,
        graduating_this_semester=data.get('graduating_this_semester', False),
    )

    db.session.add(member)
    db.session.commit()

    # Create user account for member
    user_created = _create_user_for_member(member)

    # Log
    AuditLog.log(
        action=AuditLog.ACTION_CREATE,
        user=g.current_user,
        module='attendance',
        resource_type='member',
        resource_id=member.id,
        details={'name': name, 'user_created': user_created is not None},
        ip_address=request.remote_addr
    )

    message = '队员创建成功'
    if user_created:
        message += '，已自动创建登录账号（密码为学号后6位）'

    return jsonify({
        'message': message,
        'member': member.to_dict()
    }), 201


@members_bp.route('/<int:member_id>', methods=['PUT'])
@admin_required
def update_member(member_id):
    """Update a member."""
    member = Member.query.get_or_404(member_id)
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供更新信息'}), 400

    if 'name' in data:
        name = data['name'].strip()
        if not name:
            return jsonify({'error': '姓名不能为空'}), 400
        member.name = name

    if 'student_id' in data:
        member.student_id = data['student_id'].strip() or None

    if 'phone' in data:
        member.phone = data['phone'].strip() or None

    if 'gender' in data:
        member.gender = data['gender'].strip() or None

    if 'department' in data:
        member.department = data['department'].strip() or None

    if 'grade' in data:
        member.grade = data['grade'].strip() or None

    if 'notes' in data:
        member.notes = data['notes'].strip() or None

    if 'status' in data:
        status = data['status'].strip()
        if status not in ['active', 'inactive']:
            return jsonify({'error': '无效的状态'}), 400
        member.status = status

    # Extended fields
    if 'class_name' in data:
        member.class_name = data['class_name'].strip() or None

    if 'email' in data:
        member.email = data['email'].strip() or None

    if 'dormitory' in data:
        member.dormitory = data['dormitory'].strip() or None

    if 'birth_date' in data:
        member.birth_date = _parse_date(data['birth_date'])

    if 'ethnicity' in data:
        member.ethnicity = data['ethnicity'].strip() or None

    if 'hometown' in data:
        member.hometown = data['hometown'].strip() or None

    if 'political_status' in data:
        member.political_status = data['political_status'].strip() or None

    if 'party_branch' in data:
        member.party_branch = data['party_branch'].strip() or None

    if 'is_talented' in data:
        member.is_talented = bool(data['is_talented'])

    if 'is_concentrated_class' in data:
        member.is_concentrated_class = bool(data['is_concentrated_class'])

    if 'team_role' in data:
        member.team_role = data['team_role'].strip() or None

    if 'join_year' in data:
        member.join_year = data['join_year']

    if 'team_level' in data:
        member.team_level = data['team_level'].strip() or None

    if 'graduating_this_semester' in data:
        member.graduating_this_semester = bool(data['graduating_this_semester'])

    db.session.commit()

    # Log
    AuditLog.log(
        action=AuditLog.ACTION_UPDATE,
        user=g.current_user,
        module='attendance',
        resource_type='member',
        resource_id=member.id,
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '队员更新成功',
        'member': member.to_dict()
    })


@members_bp.route('/<int:member_id>', methods=['DELETE'])
@admin_required
def delete_member(member_id):
    """Delete a member."""
    member = Member.query.get_or_404(member_id)

    name = member.name
    User.query.filter_by(member_id=member.id).update({'member_id': None})
    db.session.delete(member)
    db.session.commit()

    # Log
    AuditLog.log(
        action=AuditLog.ACTION_DELETE,
        user=g.current_user,
        module='attendance',
        resource_type='member',
        resource_id=member_id,
        details={'name': name},
        ip_address=request.remote_addr
    )

    return jsonify({'message': '队员已删除'})


@members_bp.route('/batch', methods=['POST'])
@admin_required
def batch_create_members():
    """Batch create members."""
    data = request.get_json()

    if not data or 'members' not in data:
        return jsonify({'error': '请提供队员列表'}), 400

    members_data = data['members']
    if not isinstance(members_data, list):
        return jsonify({'error': '队员列表格式错误'}), 400

    created = []
    errors = []

    for i, m_data in enumerate(members_data):
        name = m_data.get('name', '').strip() if isinstance(m_data, dict) else ''
        if not name:
            errors.append(f'第{i+1}行: 姓名不能为空')
            continue

        # Parse date field
        birth_date = None
        if m_data.get('birth_date'):
            birth_date = _parse_date(m_data.get('birth_date'))

        member = Member(
            name=name,
            student_id=m_data.get('student_id', '').strip() or None,
            phone=m_data.get('phone', '').strip() or None,
            gender=m_data.get('gender', '').strip() or None,
            department=m_data.get('department', '').strip() or None,
            grade=m_data.get('grade', '').strip() or None,
            status='active',
            # Extended fields
            class_name=m_data.get('class_name', '').strip() or None,
            email=m_data.get('email', '').strip() or None,
            dormitory=m_data.get('dormitory', '').strip() or None,
            birth_date=birth_date,
            ethnicity=m_data.get('ethnicity', '').strip() or None,
            hometown=m_data.get('hometown', '').strip() or None,
            political_status=m_data.get('political_status', '').strip() or None,
            party_branch=m_data.get('party_branch', '').strip() or None,
            is_talented=m_data.get('is_talented', False),
            is_concentrated_class=m_data.get('is_concentrated_class', False),
            team_role=m_data.get('team_role', '').strip() or None,
            join_year=m_data.get('join_year'),
            team_level=m_data.get('team_level', '').strip() or None,
            graduating_this_semester=m_data.get('graduating_this_semester', False),
        )
        db.session.add(member)
        created.append(member)

    if created:
        db.session.commit()

    return jsonify({
        'message': f'成功创建{len(created)}名队员',
        'created_count': len(created),
        'errors': errors
    })


# CSV field mapping: Chinese header -> English field name
CSV_FIELD_MAP = {
    '姓名': 'name',
    '性别': 'gender',
    '学号': 'student_id',
    '院系': 'department',
    '班级': 'class_name',
    '手机号': 'phone',
    '邮箱': 'email',
    '宿舍': 'dormitory',
    '出生日期': 'birth_date',
    '民族': 'ethnicity',
    '籍贯': 'hometown',
    '政治面貌': 'political_status',
    '党团关系所在': 'party_branch',
    '是否为特长生': 'is_talented',
    '是否为集中班': 'is_concentrated_class',
    '队内职务': 'team_role',
    '入队年份': 'join_year',
    '所在梯队': 'team_level',
    '本学期毕业': 'graduating_this_semester',
    '年级': 'grade',
    '状态': 'status',
    '备注': 'notes',
}

# Boolean field values
BOOL_TRUE_VALUES = {'是', '1', 'true', 'yes', 'y'}
BOOL_FALSE_VALUES = {'否', '0', 'false', 'no', 'n', ''}


def _parse_bool(value):
    """Parse boolean value from string."""
    if value is None:
        return False
    val = str(value).strip().lower()
    if val in BOOL_TRUE_VALUES:
        return True
    return False


def _parse_date(value):
    """Parse date value from string (YYYY-MM-DD format)."""
    if not value or not value.strip():
        return None
    try:
        return datetime.strptime(value.strip(), '%Y-%m-%d').date()
    except ValueError:
        return None


def _parse_int(value):
    """Parse integer value from string."""
    if not value or not value.strip():
        return None
    try:
        return int(value.strip())
    except ValueError:
        return None


@members_bp.route('/import-csv', methods=['POST'])
@admin_required
def import_members_csv():
    """Import members from CSV file.

    CSV format with headers (order can vary):
    姓名,性别,学号,院系,班级,手机号,邮箱,宿舍,出生日期,民族,...

    Import logic:
    - Name is the unique identifier
    - If name exists: update existing member
    - Otherwise: create new member
    """
    import csv
    import io

    if 'file' not in request.files:
        return jsonify({'error': '请上传CSV文件'}), 400

    file = request.files['file']
    if not file.filename.endswith('.csv'):
        return jsonify({'error': '请上传CSV格式文件'}), 400

    user = g.current_user

    try:
        # Read and decode CSV
        content = file.read().decode('utf-8-sig')  # Handle BOM
        reader = csv.DictReader(io.StringIO(content))

        created_count = 0
        updated_count = 0
        skipped_count = 0
        errors = []
        row_num = 1  # Header is row 0
        imported_members = []

        for row in reader:
            row_num += 1
            try:
                # Get name (required, used as unique identifier)
                name = row.get('姓名', '').strip()
                if not name:
                    errors.append(f'第{row_num}行: 姓名不能为空')
                    continue

                # Check if member exists by name (name is unique identifier)
                existing_member = Member.query.filter_by(name=name).first()

                if existing_member:
                    # Update existing member
                    member = existing_member
                    is_new = False
                else:
                    # Create new member
                    member = Member(status='active')
                    is_new = True

                # Set all fields from CSV
                member.name = name
                member.student_id = row.get('学号', '').strip() or None
                member.gender = row.get('性别', '').strip() or None
                member.department = row.get('院系', '').strip() or None
                member.class_name = row.get('班级', '').strip() or None
                member.phone = row.get('手机号', '').strip() or None
                member.email = row.get('邮箱', '').strip() or None
                member.dormitory = row.get('宿舍', '').strip() or None
                member.birth_date = _parse_date(row.get('出生日期', ''))
                member.ethnicity = row.get('民族', '').strip() or None
                member.hometown = row.get('籍贯', '').strip() or None
                member.political_status = row.get('政治面貌', '').strip() or None
                member.party_branch = row.get('党团关系所在', '').strip() or None
                member.is_talented = _parse_bool(row.get('是否为特长生', ''))
                member.is_concentrated_class = _parse_bool(row.get('是否为集中班', ''))
                member.team_role = row.get('队内职务', '').strip() or None
                member.join_year = _parse_int(row.get('入队年份', ''))
                member.team_level = row.get('所在梯队', '').strip() or None
                member.graduating_this_semester = _parse_bool(row.get('本学期毕业', ''))
                member.grade = row.get('年级', '').strip() or None
                member.notes = row.get('备注', '').strip() or None

                # Handle status field
                status = row.get('状态', '').strip()
                if status in ['active', 'inactive']:
                    member.status = status

                if is_new:
                    db.session.add(member)
                    created_count += 1
                else:
                    updated_count += 1

                imported_members.append(member)

            except Exception as e:
                errors.append(f'第{row_num}行: 处理错误 - {str(e)}')
                continue

        db.session.commit()

        # Create user accounts only for members imported in this batch
        users_created = 0
        for member in imported_members:
            if member.student_id and not User.query.filter_by(username=member.name).first():
                user_account = _create_user_for_member(member)
                if user_account:
                    users_created += 1

        # Log
        AuditLog.log(
            action=AuditLog.ACTION_CREATE,
            user=user,
            module='attendance',
            resource_type='member_import',
            details={
                'created': created_count,
                'updated': updated_count,
                'skipped': skipped_count,
                'users_created': users_created,
                'errors': len(errors)
            },
            ip_address=request.remote_addr
        )

        message = f'导入完成: 创建 {created_count} 名队员, 更新 {updated_count} 名队员'
        if users_created > 0:
            message += f', 创建 {users_created} 个登录账号（密码为学号后6位）'

        return jsonify({
            'message': message,
            'created_count': created_count,
            'updated_count': updated_count,
            'skipped_count': skipped_count,
            'users_created': users_created,
            'errors': errors[:20]  # Limit error output
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'CSV解析错误: {str(e)}'}), 400


@members_bp.route('/import-template', methods=['GET'])
def get_import_template():
    """Download CSV import template for members (public access)."""
    import io

    template = """姓名,性别,学号,院系,班级,手机号,邮箱,宿舍,出生日期,民族,籍贯,政治面貌,党团关系所在,是否为特长生,是否为集中班,队内职务,入队年份,所在梯队,本学期毕业,年级,状态,备注
张三,男,2021001234,艺术学院,表演2101,13800138001,zhangsan@example.com,北区3号楼101,2003-05-15,汉族,北京市,共青团员,艺术学院团委,是,否,队长,2021,一梯队,否,大三,active,示例数据
李四,女,2022005678,传媒学院,播音2201,13900139002,lisi@example.com,南区2号楼202,2004-08-20,汉族,上海市,群众,传媒学院团委,否,是,,2022,二梯队,否,大二,active,"""

    output = io.BytesIO()
    output.write('\ufeff'.encode('utf-8'))  # BOM for Excel
    output.write(template.encode('utf-8'))
    output.seek(0)

    return send_file(
        output,
        mimetype='text/csv',
        as_attachment=True,
        download_name='member_import_template.csv'
    )
