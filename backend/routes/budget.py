"""Budget management routes."""
from datetime import datetime
from decimal import Decimal
from flask import Blueprint, request, jsonify, g
from sqlalchemy import func

from database import db
from models import Semester, Program, Teacher, AuditLog
from models.budget import BudgetCategory, Budget, Expense
from auth.decorators import login_required, admin_required, committee_required

budget_bp = Blueprint('budget', __name__)


# Budget Categories
@budget_bp.route('/categories', methods=['GET'])
@login_required
def list_categories():
    """List all budget categories."""
    is_active = request.args.get('is_active')

    query = BudgetCategory.query

    if is_active is not None:
        query = query.filter_by(is_active=is_active.lower() == 'true')

    categories = query.order_by(BudgetCategory.sort_order, BudgetCategory.name).all()

    return jsonify({
        'categories': [c.to_dict() for c in categories]
    })


@budget_bp.route('/categories', methods=['POST'])
@admin_required
def create_category():
    """Create a new budget category."""
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供类别信息'}), 400

    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': '类别名称不能为空'}), 400

    category = BudgetCategory(
        name=name,
        description=data.get('description', '').strip() or None,
        sort_order=data.get('sort_order', 0),
        is_active=data.get('is_active', True)
    )

    db.session.add(category)
    db.session.commit()

    return jsonify({
        'message': '预算类别创建成功',
        'category': category.to_dict()
    }), 201


@budget_bp.route('/categories/<int:category_id>', methods=['PUT'])
@admin_required
def update_category(category_id):
    """Update a budget category."""
    category = BudgetCategory.query.get_or_404(category_id)
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供更新信息'}), 400

    if 'name' in data:
        name = data['name'].strip()
        if not name:
            return jsonify({'error': '类别名称不能为空'}), 400
        category.name = name

    if 'description' in data:
        category.description = data['description'].strip() or None

    if 'sort_order' in data:
        category.sort_order = data['sort_order']

    if 'is_active' in data:
        category.is_active = data['is_active']

    db.session.commit()

    return jsonify({
        'message': '类别更新成功',
        'category': category.to_dict()
    })


# Budgets
@budget_bp.route('', methods=['GET'])
@login_required
def list_budgets():
    """List all budgets."""
    semester_id = request.args.get('semester_id', type=int)
    program_id = request.args.get('program_id', type=int)
    category_id = request.args.get('category_id', type=int)

    query = Budget.query

    if semester_id:
        query = query.filter_by(semester_id=semester_id)

    if program_id:
        query = query.filter_by(program_id=program_id)

    if category_id:
        query = query.filter_by(category_id=category_id)

    budgets = query.order_by(Budget.created_at.desc()).all()

    return jsonify({
        'budgets': [b.to_dict() for b in budgets]
    })


@budget_bp.route('/<int:budget_id>', methods=['GET'])
@login_required
def get_budget(budget_id):
    """Get budget by ID."""
    budget = Budget.query.get_or_404(budget_id)
    include_expenses = request.args.get('include_expenses', 'false').lower() == 'true'

    return jsonify({
        'budget': budget.to_dict(include_expenses=include_expenses)
    })


@budget_bp.route('', methods=['POST'])
@admin_required
def create_budget():
    """Create a new budget."""
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供预算信息'}), 400

    category_id = data.get('category_id')
    if not category_id:
        return jsonify({'error': '请选择预算类别'}), 400

    category = BudgetCategory.query.get(category_id)
    if not category:
        return jsonify({'error': '预算类别不存在'}), 404

    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': '预算项名称不能为空'}), 400

    planned_amount = data.get('planned_amount')
    if not planned_amount or float(planned_amount) <= 0:
        return jsonify({'error': '请填写有效的计划金额'}), 400

    budget = Budget(
        semester_id=data.get('semester_id'),
        program_id=data.get('program_id'),
        category_id=category_id,
        name=name,
        planned_amount=Decimal(str(planned_amount)),
        notes=data.get('notes', '').strip() or None,
        created_by=g.current_user.id
    )

    db.session.add(budget)
    db.session.commit()

    AuditLog.log(
        action=AuditLog.ACTION_CREATE,
        user=g.current_user,
        module='budget',
        resource_type='budget',
        resource_id=budget.id,
        details={'name': name, 'amount': float(planned_amount)},
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '预算项创建成功',
        'budget': budget.to_dict()
    }), 201


@budget_bp.route('/<int:budget_id>', methods=['PUT'])
@admin_required
def update_budget(budget_id):
    """Update a budget."""
    budget = Budget.query.get_or_404(budget_id)
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供更新信息'}), 400

    if 'name' in data:
        name = data['name'].strip()
        if not name:
            return jsonify({'error': '预算项名称不能为空'}), 400
        budget.name = name

    if 'planned_amount' in data:
        planned_amount = data['planned_amount']
        if not planned_amount or float(planned_amount) <= 0:
            return jsonify({'error': '请填写有效的计划金额'}), 400
        budget.planned_amount = Decimal(str(planned_amount))

    if 'category_id' in data:
        category = BudgetCategory.query.get(data['category_id'])
        if not category:
            return jsonify({'error': '预算类别不存在'}), 404
        budget.category_id = data['category_id']

    if 'notes' in data:
        budget.notes = data['notes'].strip() or None

    db.session.commit()

    AuditLog.log(
        action=AuditLog.ACTION_UPDATE,
        user=g.current_user,
        module='budget',
        resource_type='budget',
        resource_id=budget_id,
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '预算项更新成功',
        'budget': budget.to_dict()
    })


@budget_bp.route('/<int:budget_id>', methods=['DELETE'])
@admin_required
def delete_budget(budget_id):
    """Delete a budget."""
    budget = Budget.query.get_or_404(budget_id)

    # Check if there are expenses
    if budget.expenses.count() > 0:
        return jsonify({'error': '该预算项下有支出记录，无法删除'}), 400

    name = budget.name
    db.session.delete(budget)
    db.session.commit()

    AuditLog.log(
        action=AuditLog.ACTION_DELETE,
        user=g.current_user,
        module='budget',
        resource_type='budget',
        resource_id=budget_id,
        details={'name': name},
        ip_address=request.remote_addr
    )

    return jsonify({'message': '预算项已删除'})


# Expenses
@budget_bp.route('/expenses', methods=['GET'])
@login_required
def list_expenses():
    """List all expenses."""
    budget_id = request.args.get('budget_id', type=int)
    status = request.args.get('status')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    query = Expense.query

    if budget_id:
        query = query.filter_by(budget_id=budget_id)

    if status:
        query = query.filter_by(status=status)

    if start_date:
        try:
            start = datetime.strptime(start_date, '%Y-%m-%d').date()
            query = query.filter(Expense.expense_date >= start)
        except ValueError:
            pass

    if end_date:
        try:
            end = datetime.strptime(end_date, '%Y-%m-%d').date()
            query = query.filter(Expense.expense_date <= end)
        except ValueError:
            pass

    expenses = query.order_by(Expense.expense_date.desc()).all()

    return jsonify({
        'expenses': [e.to_dict() for e in expenses]
    })


@budget_bp.route('/expenses/<int:expense_id>', methods=['GET'])
@login_required
def get_expense(expense_id):
    """Get expense by ID."""
    expense = Expense.query.get_or_404(expense_id)

    return jsonify({
        'expense': expense.to_dict()
    })


@budget_bp.route('/expenses', methods=['POST'])
@committee_required
def create_expense():
    """Create a new expense."""
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供支出信息'}), 400

    budget_id = data.get('budget_id')
    if not budget_id:
        return jsonify({'error': '请选择预算项'}), 400

    budget = Budget.query.get(budget_id)
    if not budget:
        return jsonify({'error': '预算项不存在'}), 404

    amount = data.get('amount')
    if not amount or float(amount) <= 0:
        return jsonify({'error': '请填写有效的金额'}), 400

    expense_date_str = data.get('expense_date')
    if not expense_date_str:
        return jsonify({'error': '请选择支出日期'}), 400

    try:
        expense_date = datetime.strptime(expense_date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': '日期格式无效'}), 400

    expense = Expense(
        budget_id=budget_id,
        amount=Decimal(str(amount)),
        description=data.get('description', '').strip() or None,
        expense_date=expense_date,
        receipt_number=data.get('receipt_number', '').strip() or None,
        status=data.get('status', Expense.STATUS_PENDING),
        teacher_id=data.get('teacher_id'),
        created_by=g.current_user.id
    )

    db.session.add(expense)
    db.session.commit()

    AuditLog.log(
        action=AuditLog.ACTION_CREATE,
        user=g.current_user,
        module='budget',
        resource_type='expense',
        resource_id=expense.id,
        details={'budget_id': budget_id, 'amount': float(amount)},
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '支出记录创建成功',
        'expense': expense.to_dict()
    }), 201


@budget_bp.route('/expenses/<int:expense_id>', methods=['PUT'])
@committee_required
def update_expense(expense_id):
    """Update an expense."""
    expense = Expense.query.get_or_404(expense_id)
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供更新信息'}), 400

    if 'amount' in data:
        amount = data['amount']
        if not amount or float(amount) <= 0:
            return jsonify({'error': '请填写有效的金额'}), 400
        expense.amount = Decimal(str(amount))

    if 'description' in data:
        expense.description = data['description'].strip() or None

    if 'expense_date' in data:
        try:
            expense.expense_date = datetime.strptime(data['expense_date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': '日期格式无效'}), 400

    if 'receipt_number' in data:
        expense.receipt_number = data['receipt_number'].strip() or None

    if 'status' in data:
        status = data['status']
        if status not in [Expense.STATUS_PENDING, Expense.STATUS_APPROVED,
                          Expense.STATUS_REIMBURSED, Expense.STATUS_CANCELLED]:
            return jsonify({'error': '无效的状态'}), 400
        expense.status = status

    db.session.commit()

    AuditLog.log(
        action=AuditLog.ACTION_UPDATE,
        user=g.current_user,
        module='budget',
        resource_type='expense',
        resource_id=expense_id,
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '支出记录更新成功',
        'expense': expense.to_dict()
    })


@budget_bp.route('/expenses/<int:expense_id>', methods=['DELETE'])
@committee_required
def delete_expense(expense_id):
    """Delete an expense."""
    expense = Expense.query.get_or_404(expense_id)

    # Only allow deletion of pending expenses
    if expense.status != Expense.STATUS_PENDING:
        return jsonify({'error': '只能删除待审核的支出记录'}), 400

    db.session.delete(expense)
    db.session.commit()

    AuditLog.log(
        action=AuditLog.ACTION_DELETE,
        user=g.current_user,
        module='budget',
        resource_type='expense',
        resource_id=expense_id,
        ip_address=request.remote_addr
    )

    return jsonify({'message': '支出记录已删除'})


# Summary
@budget_bp.route('/summary', methods=['GET'])
@login_required
def get_summary():
    """Get budget vs expense summary."""
    semester_id = request.args.get('semester_id', type=int)

    # Get budgets with spent amounts
    budget_query = Budget.query

    if semester_id:
        budget_query = budget_query.filter_by(semester_id=semester_id)

    budgets = budget_query.all()

    # Group by category
    by_category = {}
    for budget in budgets:
        cat_name = budget.category.name if budget.category else '未分类'
        if cat_name not in by_category:
            by_category[cat_name] = {'planned': 0, 'spent': 0, 'budgets': []}

        budget_data = budget.to_dict()
        by_category[cat_name]['planned'] += budget_data['planned_amount']
        by_category[cat_name]['spent'] += budget_data['spent_amount']
        by_category[cat_name]['budgets'].append(budget_data)

    # Totals
    total_planned = sum(c['planned'] for c in by_category.values())
    total_spent = sum(c['spent'] for c in by_category.values())

    # Status breakdown
    status_query = db.session.query(
        Expense.status,
        func.sum(Expense.amount).label('total'),
        func.count(Expense.id).label('count')
    ).join(Budget)

    if semester_id:
        status_query = status_query.filter(Budget.semester_id == semester_id)

    status_results = status_query.group_by(Expense.status).all()
    by_status = {r.status: {'amount': float(r.total), 'count': r.count} for r in status_results}

    return jsonify({
        'by_category': by_category,
        'by_status': by_status,
        'totals': {
            'planned': total_planned,
            'spent': total_spent,
            'remaining': total_planned - total_spent,
        }
    })
