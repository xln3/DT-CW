"""Budget and expense models."""
from datetime import datetime
from decimal import Decimal
from database import db


class BudgetCategory(db.Model):
    """Budget category."""
    __tablename__ = 'budget_categories'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    sort_order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    budgets = db.relationship('Budget', back_populates='category', lazy='dynamic')

    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'sort_order': self.sort_order,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Budget(db.Model):
    """Budget item."""
    __tablename__ = 'budgets'

    id = db.Column(db.Integer, primary_key=True)
    semester_id = db.Column(db.Integer, db.ForeignKey('semesters.id'), nullable=True)
    program_id = db.Column(db.Integer, db.ForeignKey('programs.id'), nullable=True)
    category_id = db.Column(db.Integer, db.ForeignKey('budget_categories.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    planned_amount = db.Column(db.Numeric(12, 2), nullable=False)
    notes = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    semester = db.relationship('Semester')
    program = db.relationship('Program')
    category = db.relationship('BudgetCategory', back_populates='budgets')
    creator = db.relationship('User')
    expenses = db.relationship('Expense', back_populates='budget', lazy='dynamic',
                               cascade='all, delete-orphan')

    def to_dict(self, include_expenses=False):
        """Convert to dictionary."""
        spent_amount = sum(e.amount for e in self.expenses if e.status != 'cancelled')

        data = {
            'id': self.id,
            'semester_id': self.semester_id,
            'semester_name': self.semester.name if self.semester else None,
            'program_id': self.program_id,
            'program_name': self.program.name if self.program else None,
            'category_id': self.category_id,
            'category_name': self.category.name if self.category else None,
            'name': self.name,
            'planned_amount': float(self.planned_amount) if self.planned_amount else 0,
            'spent_amount': float(spent_amount),
            'remaining_amount': float(self.planned_amount - spent_amount) if self.planned_amount else 0,
            'notes': self.notes,
            'created_by': self.created_by,
            'created_by_name': self.creator.username if self.creator else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_expenses:
            data['expenses'] = [e.to_dict() for e in self.expenses.order_by(Expense.expense_date.desc())]
        return data


class Expense(db.Model):
    """Expense record."""
    __tablename__ = 'expenses'

    id = db.Column(db.Integer, primary_key=True)
    budget_id = db.Column(db.Integer, db.ForeignKey('budgets.id'), nullable=False)
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    description = db.Column(db.String(500))
    expense_date = db.Column(db.Date, nullable=False)
    receipt_number = db.Column(db.String(100))  # Receipt/invoice number
    status = db.Column(db.String(20), default='pending')  # pending/approved/reimbursed/cancelled
    teacher_id = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    budget = db.relationship('Budget', back_populates='expenses')
    teacher = db.relationship('Teacher')
    creator = db.relationship('User')

    STATUS_PENDING = 'pending'
    STATUS_APPROVED = 'approved'
    STATUS_REIMBURSED = 'reimbursed'
    STATUS_CANCELLED = 'cancelled'

    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'budget_id': self.budget_id,
            'budget_name': self.budget.name if self.budget else None,
            'category_name': self.budget.category.name if self.budget and self.budget.category else None,
            'amount': float(self.amount) if self.amount else 0,
            'description': self.description,
            'expense_date': self.expense_date.isoformat() if self.expense_date else None,
            'receipt_number': self.receipt_number,
            'status': self.status,
            'teacher_id': self.teacher_id,
            'teacher_name': self.teacher.name if self.teacher else None,
            'created_by': self.created_by,
            'created_by_name': self.creator.username if self.creator else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
