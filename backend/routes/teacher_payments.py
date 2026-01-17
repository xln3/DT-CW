"""Teacher payment routes."""
from datetime import datetime
from decimal import Decimal
from flask import Blueprint, request, jsonify, g
from sqlalchemy import func

from database import db
from models import Teacher, Semester, AuditLog
from models.teacher_application import PaymentSource, TeacherPayment, PaymentSourceDetail
from auth.decorators import login_required, committee_required

teacher_payments_bp = Blueprint('teacher_payments', __name__)


# Payment Sources Management
@teacher_payments_bp.route('/sources', methods=['GET'])
@login_required
def list_sources():
    """List all payment sources."""
    is_active = request.args.get('is_active')

    query = PaymentSource.query

    if is_active is not None:
        query = query.filter_by(is_active=is_active.lower() == 'true')

    sources = query.order_by(PaymentSource.name).all()

    return jsonify({
        'sources': [s.to_dict() for s in sources]
    })


@teacher_payments_bp.route('/sources', methods=['POST'])
@committee_required
def create_source():
    """Create a new payment source."""
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供来源信息'}), 400

    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': '来源名称不能为空'}), 400

    # Check for duplicate name
    existing = PaymentSource.query.filter_by(name=name).first()
    if existing:
        return jsonify({'error': '来源名称已存在'}), 400

    source = PaymentSource(
        name=name,
        description=data.get('description', '').strip() or None,
        is_active=data.get('is_active', True)
    )

    db.session.add(source)
    db.session.commit()

    return jsonify({
        'message': '劳务来源创建成功',
        'source': source.to_dict()
    }), 201


@teacher_payments_bp.route('/sources/<int:source_id>', methods=['PUT'])
@committee_required
def update_source(source_id):
    """Update a payment source."""
    source = PaymentSource.query.get_or_404(source_id)
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供更新信息'}), 400

    if 'name' in data:
        name = data['name'].strip()
        if not name:
            return jsonify({'error': '来源名称不能为空'}), 400
        # Check for duplicate name (excluding current)
        existing = PaymentSource.query.filter(
            PaymentSource.name == name,
            PaymentSource.id != source_id
        ).first()
        if existing:
            return jsonify({'error': '来源名称已存在'}), 400
        source.name = name

    if 'description' in data:
        source.description = data['description'].strip() or None

    if 'is_active' in data:
        source.is_active = data['is_active']

    db.session.commit()

    return jsonify({
        'message': '来源更新成功',
        'source': source.to_dict()
    })


# Teacher Payments Management
@teacher_payments_bp.route('', methods=['GET'])
@login_required
def list_payments():
    """List all teacher payments."""
    teacher_id = request.args.get('teacher_id', type=int)
    semester_id = request.args.get('semester_id', type=int)
    status = request.args.get('status')

    query = TeacherPayment.query

    if teacher_id:
        query = query.filter_by(teacher_id=teacher_id)

    if semester_id:
        query = query.filter_by(semester_id=semester_id)

    if status:
        query = query.filter_by(status=status)

    payments = query.order_by(TeacherPayment.created_at.desc()).all()

    return jsonify({
        'payments': [p.to_dict() for p in payments]
    })


@teacher_payments_bp.route('/<int:payment_id>', methods=['GET'])
@login_required
def get_payment(payment_id):
    """Get payment by ID."""
    payment = TeacherPayment.query.get_or_404(payment_id)

    return jsonify({
        'payment': payment.to_dict()
    })


@teacher_payments_bp.route('', methods=['POST'])
@committee_required
def create_payment():
    """Create a new payment record with multiple sources."""
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供劳务信息'}), 400

    teacher_id = data.get('teacher_id')
    if not teacher_id:
        return jsonify({'error': '请选择教师'}), 400

    teacher = Teacher.query.get(teacher_id)
    if not teacher:
        return jsonify({'error': '教师不存在'}), 404

    description = data.get('description', '').strip()
    if not description:
        return jsonify({'error': '请填写劳务说明'}), 400

    total_amount = data.get('total_amount')
    if not total_amount or float(total_amount) <= 0:
        return jsonify({'error': '请填写有效的总金额'}), 400

    # Parse dates
    scheduled_date = None
    if data.get('scheduled_date'):
        try:
            scheduled_date = datetime.strptime(data['scheduled_date'], '%Y-%m-%d').date()
        except ValueError:
            pass

    actual_date = None
    if data.get('actual_date'):
        try:
            actual_date = datetime.strptime(data['actual_date'], '%Y-%m-%d').date()
        except ValueError:
            pass

    payment = TeacherPayment(
        teacher_id=teacher_id,
        semester_id=data.get('semester_id'),
        description=description,
        total_amount=Decimal(str(total_amount)),
        status=data.get('status', TeacherPayment.STATUS_PENDING),
        scheduled_date=scheduled_date,
        actual_date=actual_date,
        reference_number=data.get('reference_number', '').strip() or None,
        notes=data.get('notes', '').strip() or None,
        created_by=g.current_user.id
    )

    db.session.add(payment)
    db.session.flush()  # Get the payment ID

    # Add source details
    sources_data = data.get('sources', [])
    source_total = Decimal('0')

    for source_data in sources_data:
        source_id = source_data.get('source_id')
        amount = source_data.get('amount')

        if not source_id or not amount:
            continue

        source = PaymentSource.query.get(source_id)
        if not source:
            continue

        detail = PaymentSourceDetail(
            payment_id=payment.id,
            source_id=source_id,
            amount=Decimal(str(amount)),
            notes=source_data.get('notes', '').strip() or None
        )
        db.session.add(detail)
        source_total += Decimal(str(amount))

    # Validate that source amounts sum to total
    if sources_data and abs(source_total - Decimal(str(total_amount))) > Decimal('0.01'):
        db.session.rollback()
        return jsonify({'error': f'来源金额总和 ({source_total}) 与总金额 ({total_amount}) 不符'}), 400

    db.session.commit()

    AuditLog.log(
        action=AuditLog.ACTION_CREATE,
        user=g.current_user,
        module='payment',
        resource_type='teacher_payment',
        resource_id=payment.id,
        details={'teacher_id': teacher_id, 'amount': float(total_amount)},
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '劳务记录创建成功',
        'payment': payment.to_dict()
    }), 201


@teacher_payments_bp.route('/<int:payment_id>', methods=['PUT'])
@committee_required
def update_payment(payment_id):
    """Update a payment record."""
    payment = TeacherPayment.query.get_or_404(payment_id)
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供更新信息'}), 400

    if 'description' in data:
        description = data['description'].strip()
        if not description:
            return jsonify({'error': '劳务说明不能为空'}), 400
        payment.description = description

    if 'total_amount' in data:
        total_amount = data['total_amount']
        if not total_amount or float(total_amount) <= 0:
            return jsonify({'error': '请填写有效的总金额'}), 400
        payment.total_amount = Decimal(str(total_amount))

    if 'status' in data:
        status = data['status']
        if status not in [TeacherPayment.STATUS_PENDING, TeacherPayment.STATUS_PROCESSING, TeacherPayment.STATUS_PAID]:
            return jsonify({'error': '无效的状态'}), 400
        payment.status = status

    if 'scheduled_date' in data:
        if data['scheduled_date']:
            try:
                payment.scheduled_date = datetime.strptime(data['scheduled_date'], '%Y-%m-%d').date()
            except ValueError:
                pass
        else:
            payment.scheduled_date = None

    if 'actual_date' in data:
        if data['actual_date']:
            try:
                payment.actual_date = datetime.strptime(data['actual_date'], '%Y-%m-%d').date()
            except ValueError:
                pass
        else:
            payment.actual_date = None

    if 'reference_number' in data:
        payment.reference_number = data['reference_number'].strip() or None

    if 'notes' in data:
        payment.notes = data['notes'].strip() or None

    # Update sources if provided
    if 'sources' in data:
        # Delete existing source details
        PaymentSourceDetail.query.filter_by(payment_id=payment.id).delete()

        # Add new source details
        sources_data = data['sources']
        source_total = Decimal('0')

        for source_data in sources_data:
            source_id = source_data.get('source_id')
            amount = source_data.get('amount')

            if not source_id or not amount:
                continue

            source = PaymentSource.query.get(source_id)
            if not source:
                continue

            detail = PaymentSourceDetail(
                payment_id=payment.id,
                source_id=source_id,
                amount=Decimal(str(amount)),
                notes=source_data.get('notes', '').strip() or None
            )
            db.session.add(detail)
            source_total += Decimal(str(amount))

        # Validate that source amounts sum to total
        if sources_data and abs(source_total - payment.total_amount) > Decimal('0.01'):
            db.session.rollback()
            return jsonify({'error': f'来源金额总和 ({source_total}) 与总金额 ({payment.total_amount}) 不符'}), 400

    db.session.commit()

    AuditLog.log(
        action=AuditLog.ACTION_UPDATE,
        user=g.current_user,
        module='payment',
        resource_type='teacher_payment',
        resource_id=payment_id,
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '劳务记录更新成功',
        'payment': payment.to_dict()
    })


@teacher_payments_bp.route('/<int:payment_id>', methods=['DELETE'])
@committee_required
def delete_payment(payment_id):
    """Delete a payment record."""
    payment = TeacherPayment.query.get_or_404(payment_id)

    # Only allow deletion of pending payments
    if payment.status != TeacherPayment.STATUS_PENDING:
        return jsonify({'error': '只能删除待处理的劳务记录'}), 400

    db.session.delete(payment)
    db.session.commit()

    AuditLog.log(
        action=AuditLog.ACTION_DELETE,
        user=g.current_user,
        module='payment',
        resource_type='teacher_payment',
        resource_id=payment_id,
        ip_address=request.remote_addr
    )

    return jsonify({'message': '劳务记录已删除'})


# Payment Summary
@teacher_payments_bp.route('/summary', methods=['GET'])
@login_required
def get_summary():
    """Get payment summary by source and status."""
    semester_id = request.args.get('semester_id', type=int)

    query = db.session.query(
        PaymentSource.name.label('source_name'),
        TeacherPayment.status,
        func.sum(PaymentSourceDetail.amount).label('total_amount'),
        func.count(TeacherPayment.id.distinct()).label('payment_count')
    ).join(
        PaymentSourceDetail, PaymentSourceDetail.source_id == PaymentSource.id
    ).join(
        TeacherPayment, TeacherPayment.id == PaymentSourceDetail.payment_id
    )

    if semester_id:
        query = query.filter(TeacherPayment.semester_id == semester_id)

    results = query.group_by(PaymentSource.name, TeacherPayment.status).all()

    summary = {}
    for row in results:
        source_name = row.source_name
        if source_name not in summary:
            summary[source_name] = {'pending': 0, 'processing': 0, 'paid': 0}
        summary[source_name][row.status] = float(row.total_amount)

    # Also get totals by status
    status_totals = db.session.query(
        TeacherPayment.status,
        func.sum(TeacherPayment.total_amount).label('total'),
        func.count(TeacherPayment.id).label('count')
    )

    if semester_id:
        status_totals = status_totals.filter(TeacherPayment.semester_id == semester_id)

    status_totals = status_totals.group_by(TeacherPayment.status).all()

    totals = {row.status: {'amount': float(row.total), 'count': row.count} for row in status_totals}

    return jsonify({
        'by_source': summary,
        'by_status': totals
    })


# Teacher-specific payment endpoints
@teacher_payments_bp.route('/teachers/<int:teacher_id>', methods=['GET'])
@login_required
def get_teacher_payments(teacher_id):
    """Get all payments for a specific teacher."""
    Teacher.query.get_or_404(teacher_id)

    status = request.args.get('status')
    semester_id = request.args.get('semester_id', type=int)

    query = TeacherPayment.query.filter_by(teacher_id=teacher_id)

    if status:
        query = query.filter_by(status=status)

    if semester_id:
        query = query.filter_by(semester_id=semester_id)

    payments = query.order_by(TeacherPayment.created_at.desc()).all()

    return jsonify({
        'payments': [p.to_dict() for p in payments]
    })


@teacher_payments_bp.route('/teachers/<int:teacher_id>', methods=['POST'])
@committee_required
def create_teacher_payment(teacher_id):
    """Create payment for a specific teacher."""
    teacher = Teacher.query.get_or_404(teacher_id)
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供劳务信息'}), 400

    description = data.get('description', '').strip()
    if not description:
        return jsonify({'error': '请填写劳务说明'}), 400

    total_amount = data.get('total_amount')
    if not total_amount or float(total_amount) <= 0:
        return jsonify({'error': '请填写有效的总金额'}), 400

    # Parse dates
    scheduled_date = None
    if data.get('scheduled_date'):
        try:
            scheduled_date = datetime.strptime(data['scheduled_date'], '%Y-%m-%d').date()
        except ValueError:
            pass

    actual_date = None
    if data.get('actual_date'):
        try:
            actual_date = datetime.strptime(data['actual_date'], '%Y-%m-%d').date()
        except ValueError:
            pass

    payment = TeacherPayment(
        teacher_id=teacher_id,
        semester_id=data.get('semester_id'),
        description=description,
        total_amount=Decimal(str(total_amount)),
        status=data.get('status', TeacherPayment.STATUS_PENDING),
        scheduled_date=scheduled_date,
        actual_date=actual_date,
        reference_number=data.get('reference_number', '').strip() or None,
        notes=data.get('notes', '').strip() or None,
        created_by=g.current_user.id
    )

    db.session.add(payment)
    db.session.flush()

    # Add source details
    sources_data = data.get('sources', [])
    for source_data in sources_data:
        source_id = source_data.get('source_id')
        amount = source_data.get('amount')

        if not source_id or not amount:
            continue

        source = PaymentSource.query.get(source_id)
        if not source:
            continue

        detail = PaymentSourceDetail(
            payment_id=payment.id,
            source_id=source_id,
            amount=Decimal(str(amount)),
            notes=source_data.get('notes', '').strip() or None
        )
        db.session.add(detail)

    db.session.commit()

    AuditLog.log(
        action=AuditLog.ACTION_CREATE,
        user=g.current_user,
        module='payment',
        resource_type='teacher_payment',
        resource_id=payment.id,
        details={'teacher_id': teacher_id, 'amount': float(total_amount)},
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '劳务记录创建成功',
        'payment': payment.to_dict()
    }), 201
