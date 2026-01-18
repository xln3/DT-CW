import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Music, AlertCircle } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('请输入用户名和密码');
      return;
    }

    setIsLoading(true);
    try {
      const response = await login({ username: username.trim(), password });
      // Determine default path based on role
      const defaultPath = response.user.role === 'member' ? '/member' : '/admin';
      // Use 'from' path if it's appropriate for the role, otherwise use default
      let targetPath = defaultPath;
      if (from) {
        // If member trying to access /admin, redirect to /member
        // If admin/committee/pm trying to access /member, redirect to /admin
        if (response.user.role === 'member' && from.startsWith('/admin')) {
          targetPath = '/member';
        } else if (response.user.role !== 'member' && from.startsWith('/member')) {
          targetPath = '/admin';
        } else {
          targetPath = from;
        }
      }
      navigate(targetPath, { replace: true });
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || '登录失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary-100 rounded-full flex items-center justify-center">
            <Music className="h-10 w-10 text-primary-600" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">登录</h2>
          <p className="mt-2 text-sm text-gray-600">用户名为姓名，密码为学号后六位</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
              <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="form-label">
                用户名
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="form-input"
                placeholder="请输入姓名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="password" className="form-label">
                密码
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="form-input"
                placeholder="请输入学号后六位"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full btn-primary py-3 text-base"
          >
            {isLoading ? '登录中...' : '登录'}
          </button>
        </form>

        <div className="text-center text-sm text-gray-500">
          <a href="/" className="text-primary-600 hover:text-primary-700">
            返回首页
          </a>
        </div>
      </div>
    </div>
  );
}
