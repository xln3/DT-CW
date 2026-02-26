import { useState, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  X,
  DollarSign,
  Settings,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import {
  budgetsApi,
  budgetCategoriesApi,
  expensesApi,
  semestersApi,
} from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import type { Budget, BudgetCategory, Expense } from '../../../types';
import { EXPENSE_STATUS_DISPLAY } from '../../../types';

interface SemesterOption {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
}

export default function BudgetList() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [semesters, setSemesters] = useState<SemesterOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('');
  const [viewMode, setViewMode] = useState<'budgets' | 'expenses'>('budgets');

  // Budget modal
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [budgetForm, setBudgetForm] = useState({
    category_id: '',
    name: '',
    planned_amount: '',
    semester_id: '',
    program_id: '',
    notes: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // Expense modal
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    budget_id: '',
    amount: '',
    description: '',
    expense_date: new Date().toISOString().split('T')[0],
    receipt_number: '',
    status: 'pending',
  });

  // Categories modal
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const canEdit = hasRole('admin', 'committee');

  const fetchBudgets = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await budgetsApi.list({
        category_id: categoryFilter ? parseInt(categoryFilter) : undefined,
      });
      setBudgets(data);
    } catch (err: any) {
      setError(err.response?.data?.error || '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchExpenses = async () => {
    try {
      const data = await expensesApi.list();
      setExpenses(data);
    } catch (err) {
      console.error('Failed to load expenses', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await budgetCategoriesApi.list();
      setCategories(data);
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  };

  const fetchSemesters = async () => {
    try {
      const data = await semestersApi.list();
      setSemesters(data);
    } catch (err) {
      console.error('Failed to load semesters', err);
    }
  };

  useEffect(() => {
    fetchBudgets();
    fetchExpenses();
    fetchCategories();
    fetchSemesters();
  }, [categoryFilter]);

  const openBudgetModal = (budget?: Budget) => {
    if (budget) {
      setEditingBudget(budget);
      setBudgetForm({
        category_id: budget.category_id.toString(),
        name: budget.name,
        planned_amount: budget.planned_amount.toString(),
        semester_id: budget.semester_id?.toString() || '',
        program_id: budget.program_id?.toString() || '',
        notes: budget.notes || '',
      });
    } else {
      setEditingBudget(null);
      setBudgetForm({
        category_id: '',
        name: '',
        planned_amount: '',
        semester_id: '',
        program_id: '',
        notes: '',
      });
    }
    setShowBudgetModal(true);
  };

  const openExpenseModal = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense);
      setExpenseForm({
        budget_id: expense.budget_id.toString(),
        amount: expense.amount.toString(),
        description: expense.description || '',
        expense_date: expense.expense_date,
        receipt_number: expense.receipt_number || '',
        status: expense.status,
      });
    } else {
      setEditingExpense(null);
      setExpenseForm({
        budget_id: '',
        amount: '',
        description: '',
        expense_date: new Date().toISOString().split('T')[0],
        receipt_number: '',
        status: 'pending',
      });
    }
    setShowExpenseModal(true);
  };

  const handleSaveBudget = async () => {
    if (!budgetForm.category_id || !budgetForm.name || !budgetForm.planned_amount) {
      setError('请填写必填项');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const data = {
        category_id: parseInt(budgetForm.category_id),
        name: budgetForm.name,
        planned_amount: parseFloat(budgetForm.planned_amount),
        semester_id: budgetForm.semester_id ? parseInt(budgetForm.semester_id) : undefined,
        program_id: budgetForm.program_id ? parseInt(budgetForm.program_id) : undefined,
        notes: budgetForm.notes || undefined,
      };

      if (editingBudget) {
        await budgetsApi.update(editingBudget.id, data);
      } else {
        await budgetsApi.create(data);
      }

      setShowBudgetModal(false);
      fetchBudgets();
    } catch (err: any) {
      setError(err.response?.data?.error || '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveExpense = async () => {
    if (!expenseForm.budget_id || !expenseForm.amount || !expenseForm.expense_date) {
      setError('请填写必填项');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const data = {
        budget_id: parseInt(expenseForm.budget_id),
        amount: parseFloat(expenseForm.amount),
        description: expenseForm.description || undefined,
        expense_date: expenseForm.expense_date,
        receipt_number: expenseForm.receipt_number || undefined,
        status: expenseForm.status,
      };

      if (editingExpense) {
        await expensesApi.update(editingExpense.id, data);
      } else {
        await expensesApi.create(data);
      }

      setShowExpenseModal(false);
      fetchExpenses();
      fetchBudgets();
    } catch (err: any) {
      setError(err.response?.data?.error || '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBudget = async (id: number) => {
    if (!confirm('确定要删除此预算项吗？')) return;

    try {
      await budgetsApi.delete(id);
      fetchBudgets();
    } catch (err: any) {
      setError(err.response?.data?.error || '删除失败');
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!confirm('确定要删除此支出记录吗？')) return;

    try {
      await expensesApi.delete(id);
      fetchExpenses();
      fetchBudgets();
    } catch (err: any) {
      setError(err.response?.data?.error || '删除失败');
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      await budgetCategoriesApi.create({ name: newCategoryName.trim() });
      setNewCategoryName('');
      fetchCategories();
    } catch (err: any) {
      setError(err.response?.data?.error || '创建失败');
    }
  };

  const totalPlanned = budgets.reduce((sum, b) => sum + b.planned_amount, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent_amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">预算管理</h1>
          <p className="mt-1 text-sm text-gray-500">管理艺术团预算和支出</p>
        </div>
        <div className="flex items-center space-x-3">
          {isAdmin && (
            <button onClick={() => setShowCategoriesModal(true)} className="btn-secondary">
              <Settings className="w-4 h-4 mr-2" />
              类别管理
            </button>
          )}
          {isAdmin && (
            <button onClick={() => openBudgetModal()} className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              添加预算
            </button>
          )}
          {canEdit && (
            <button onClick={() => openExpenseModal()} className="btn-secondary">
              <Plus className="w-4 h-4 mr-2" />
              添加支出
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <DollarSign className="w-8 h-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-500">预算总额</p>
                <p className="text-2xl font-bold">¥{totalPlanned.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <TrendingDown className="w-8 h-8 text-red-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-500">已支出</p>
                <p className="text-2xl font-bold text-red-600">¥{totalSpent.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-500">剩余</p>
                <p className="text-2xl font-bold text-green-600">
                  ¥{(totalPlanned - totalSpent).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View tabs and filters */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('budgets')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  viewMode === 'budgets'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                预算项
              </button>
              <button
                onClick={() => setViewMode('expenses')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  viewMode === 'expenses'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                支出记录
              </button>
            </div>
            <select
              className="form-input w-full sm:w-48"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">全部类别</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Budgets Table */}
      {viewMode === 'budgets' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>预算项</th>
                  <th>类别</th>
                  <th className="text-right">计划金额</th>
                  <th className="text-right">已支出</th>
                  <th className="text-right">剩余</th>
                  <th>进度</th>
                  {isAdmin && <th className="text-right">操作</th>}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                        <span className="ml-3 text-gray-500">加载中...</span>
                      </div>
                    </td>
                  </tr>
                ) : budgets.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-gray-500">
                      暂无预算数据
                    </td>
                  </tr>
                ) : (
                  budgets.map((budget) => {
                    const progress = (budget.spent_amount / budget.planned_amount) * 100;
                    return (
                      <tr key={budget.id} className="hover:bg-gray-50">
                        <td className="font-medium">{budget.name}</td>
                        <td>{budget.category_name}</td>
                        <td className="text-right">¥{budget.planned_amount.toFixed(2)}</td>
                        <td className="text-right text-red-600">
                          ¥{budget.spent_amount.toFixed(2)}
                        </td>
                        <td className="text-right text-green-600">
                          ¥{budget.remaining_amount.toFixed(2)}
                        </td>
                        <td>
                          <div className="w-24">
                            <div className="flex items-center">
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    progress > 100
                                      ? 'bg-red-500'
                                      : progress > 80
                                      ? 'bg-yellow-500'
                                      : 'bg-green-500'
                                  }`}
                                  style={{ width: `${Math.min(progress, 100)}%` }}
                                />
                              </div>
                              <span className="ml-2 text-xs text-gray-500">
                                {progress.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </td>
                        {isAdmin && (
                          <td className="text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => openBudgetModal(budget)}
                                className="p-2 text-gray-400 hover:text-primary-600"
                                title="编辑"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteBudget(budget.id)}
                                className="p-2 text-gray-400 hover:text-red-600"
                                title="删除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expenses Table */}
      {viewMode === 'expenses' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>预算项</th>
                  <th>说明</th>
                  <th className="text-right">金额</th>
                  <th>状态</th>
                  {canEdit && <th className="text-right">操作</th>}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 6 : 5} className="text-center py-8 text-gray-500">
                      暂无支出记录
                    </td>
                  </tr>
                ) : (
                  expenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-gray-50">
                      <td>
                        {new Date(expense.expense_date).toLocaleDateString('zh-CN')}
                      </td>
                      <td>{expense.budget_name}</td>
                      <td>{expense.description || '-'}</td>
                      <td className="text-right font-medium text-red-600">
                        ¥{expense.amount.toFixed(2)}
                      </td>
                      <td>
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            expense.status === 'reimbursed'
                              ? 'bg-green-100 text-green-800'
                              : expense.status === 'approved'
                              ? 'bg-blue-100 text-blue-800'
                              : expense.status === 'cancelled'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {EXPENSE_STATUS_DISPLAY[expense.status] || expense.status}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => openExpenseModal(expense)}
                              className="p-2 text-gray-400 hover:text-primary-600"
                              title="编辑"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {expense.status === 'pending' && (
                              <button
                                onClick={() => handleDeleteExpense(expense.id)}
                                className="p-2 text-gray-400 hover:text-red-600"
                                title="删除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Budget Modal */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium">
                {editingBudget ? '编辑预算项' : '添加预算项'}
              </h3>
              <button
                onClick={() => setShowBudgetModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="form-label">类别 *</label>
                <select
                  className="form-input"
                  value={budgetForm.category_id}
                  onChange={(e) =>
                    setBudgetForm({ ...budgetForm, category_id: e.target.value })
                  }
                  required
                >
                  <option value="">选择类别</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">预算项名称 *</label>
                <input
                  type="text"
                  className="form-input"
                  value={budgetForm.name}
                  onChange={(e) => setBudgetForm({ ...budgetForm, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label">计划金额 *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    ¥
                  </span>
                  <input
                    type="number"
                    className="form-input pl-8"
                    value={budgetForm.planned_amount}
                    onChange={(e) =>
                      setBudgetForm({ ...budgetForm, planned_amount: e.target.value })
                    }
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="form-label">关联学期</label>
                <select
                  className="form-input"
                  value={budgetForm.semester_id}
                  onChange={(e) =>
                    setBudgetForm({ ...budgetForm, semester_id: e.target.value })
                  }
                >
                  <option value="">不关联</option>
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">备注</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={budgetForm.notes}
                  onChange={(e) => setBudgetForm({ ...budgetForm, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-end space-x-3 p-4 border-t bg-gray-50 rounded-b-lg">
              <button onClick={() => setShowBudgetModal(false)} className="btn-secondary">
                取消
              </button>
              <button onClick={handleSaveBudget} className="btn-primary" disabled={isSaving}>
                {isSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium">
                {editingExpense ? '编辑支出记录' : '添加支出记录'}
              </h3>
              <button
                onClick={() => setShowExpenseModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="form-label">预算项 *</label>
                <select
                  className="form-input"
                  value={expenseForm.budget_id}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, budget_id: e.target.value })
                  }
                  required
                >
                  <option value="">选择预算项</option>
                  {budgets.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.category_name} - {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">金额 *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    ¥
                  </span>
                  <input
                    type="number"
                    className="form-input pl-8"
                    value={expenseForm.amount}
                    onChange={(e) =>
                      setExpenseForm({ ...expenseForm, amount: e.target.value })
                    }
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="form-label">支出日期 *</label>
                <input
                  type="date"
                  className="form-input"
                  value={expenseForm.expense_date}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, expense_date: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="form-label">说明</label>
                <input
                  type="text"
                  className="form-input"
                  value={expenseForm.description}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, description: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="form-label">票据编号</label>
                <input
                  type="text"
                  className="form-input"
                  value={expenseForm.receipt_number}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, receipt_number: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="form-label">状态</label>
                <select
                  className="form-input"
                  value={expenseForm.status}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, status: e.target.value })
                  }
                >
                  <option value="pending">待审核</option>
                  <option value="approved">已审核</option>
                  <option value="reimbursed">已报销</option>
                  <option value="cancelled">已取消</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end space-x-3 p-4 border-t bg-gray-50 rounded-b-lg">
              <button onClick={() => setShowExpenseModal(false)} className="btn-secondary">
                取消
              </button>
              <button onClick={handleSaveExpense} className="btn-primary" disabled={isSaving}>
                {isSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Categories Modal */}
      {showCategoriesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium">预算类别管理</h3>
              <button
                onClick={() => setShowCategoriesModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="form-label">现有类别</label>
                <div className="space-y-2">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <span>{cat.name}</span>
                      <span
                        className={`text-xs ${
                          cat.is_active ? 'text-green-600' : 'text-gray-400'
                        }`}
                      >
                        {cat.is_active ? '启用' : '停用'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t pt-4">
                <label className="form-label">添加新类别</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    className="form-input flex-1"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="类别名称"
                  />
                  <button
                    onClick={handleCreateCategory}
                    className="btn-primary"
                    disabled={!newCategoryName.trim()}
                  >
                    添加
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
