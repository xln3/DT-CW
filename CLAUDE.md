# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个**艺术团综合管理系统** (Arts Management System),用于管理艺术团的成员、节目、排练和考勤。核心功能包括:

- 成员和教师信息管理
- 节目创建和成员分配
- 排练会议管理
- 基于人脸识别的自动考勤系统
- 公开考勤展示页面
- 学期管理和用户权限管理

## 技术栈

### 后端
- **Flask 3.0.0** - Web 框架
- **SQLAlchemy 2.0.23** - ORM (支持 SQLite/PostgreSQL)
- **Flask-JWT-Extended 4.6.0** - JWT 认证
- **bcrypt** - 密码加密
- **pytest + pytest-flask** - 测试框架

### 前端
- **React 19.2.0** - UI 框架
- **TypeScript 5.9.3** - 类型系统
- **Vite 7.2.4** - 构建工具
- **React Router 7.12.0** - 路由
- **TanStack React Query** - 数据获取和缓存
- **Zustand** - 状态管理
- **Tailwind CSS 4** - 样式框架
- **Axios** - HTTP 客户端

## 开发命令

### 后端开发
```bash
# 安装依赖
cd backend
pip install -r requirements.txt

# 运行开发服务器 (http://localhost:5000)
python app.py

# 运行测试
pytest tests/

# 运行特定测试文件
pytest tests/test_auth.py

# 运行特定测试函数
pytest tests/test_auth.py::test_login
```

### 前端开发
```bash
# 安装依赖 (在项目根目录运行)
npm install

# 运行开发服务器 (http://localhost:3000)
npm run dev

# 构建生产版本
npm run build

# 运行 ESLint 检查
npm run lint

# 预览生产构建
npm run preview
```

### 默认管理员账号
首次启动时自动创建:
- 用户名: `admin`
- 密码: `admin123` (生产环境请立即修改)

## 项目结构

### 后端架构 (`backend/`)
```
backend/
├── app.py              # Flask 应用工厂,启动入口
├── config.py           # 配置类 (Development/Testing/Production)
├── database.py         # SQLAlchemy 初始化
├── auth/               # 认证模块
│   ├── jwt_handler.py  # JWT 令牌生成/验证
│   ├── permissions.py  # 权限检查逻辑
│   └── decorators.py   # 路由装饰器 (@login_required, @role_required)
├── models/             # SQLAlchemy ORM 模型
│   ├── user.py         # 用户和用户-节目关联
│   ├── member.py       # 成员信息
│   ├── teacher.py      # 教师信息
│   ├── program.py      # 节目及节目-成员关联
│   ├── rehearsal.py    # 排练会议
│   ├── attendance.py   # 考勤记录
│   ├── semester.py     # 学期管理
│   ├── system_config.py # 系统配置 KV 存储
│   ├── audit_log.py    # 审计日志
│   ├── face_vector.py  # 人脸向量存储
│   └── face_annotation.py # 人脸标注
├── routes/             # API 路由 (Flask Blueprints)
│   ├── auth.py         # 登录/登出/令牌刷新
│   ├── users.py        # 用户管理
│   ├── members.py      # 成员管理
│   ├── teachers.py     # 教师管理
│   ├── programs.py     # 节目管理
│   ├── rehearsals.py   # 排练管理
│   ├── dashboard.py    # 仪表盘统计
│   ├── semesters.py    # 学期管理
│   └── public_attendance.py # 公开考勤接口
└── tests/              # 测试套件
```

### 前端架构 (`frontend/src/`)
```
src/
├── App.tsx             # 路由配置和应用根组件
├── main.tsx            # 应用入口
├── types/              # TypeScript 类型定义
│   └── index.ts        # 所有核心接口
├── services/           # API 通信层
│   └── api.ts          # Axios 实例和所有 API 端点
├── contexts/           # React Context
│   └── AuthContext.tsx # 认证状态管理
├── components/         # 可复用组件
│   └── Layout/         # 布局组件
├── pages/              # 页面组件
│   ├── Login.tsx       # 登录页面
│   ├── admin/          # 管理后台页面
│   └── public/         # 公开访问页面
```

## 核心架构模式

### 1. 应用工厂模式
后端使用 `create_app(config_name)` 工厂函数:
- 支持多环境配置 (development/testing/production)
- 自动初始化数据库和扩展
- 自动创建默认管理员账号

### 2. 前后端分离
- **后端**: RESTful API (Flask Blueprints)
- **前端**: SPA (React + React Router)
- **通信**: JSON over HTTP with JWT authentication

### 3. 认证与授权

#### 角色体系
- `admin`: 系统管理员 (全权限)
- `committee`: 委员会成员 (管理所有节目)
- `program_manager`: 节目经理 (仅管理分配的节目)

#### JWT 认证流程
1. 用户登录获取 access_token 和 refresh_token
2. access_token (8小时有效期) 用于 API 请求
3. refresh_token (30天有效期) 用于刷新 access_token
4. Axios 拦截器自动处理 401 响应和 token 刷新

#### 路由保护
- 前端: `<ProtectedRoute>` 组件保护管理路由
- 后端: `@login_required` 和 `@role_required` 装饰器

### 4. 数据模型关系

```
Semester (学期)
  └─→ Program (节目)
      ├─→ ProgramMember (节目成员关联)
      │    └─→ Member (成员)
      │         ├─→ Attendance (考勤记录)
      │         └─→ FaceVector (人脸向量)
      └─→ Rehearsal (排练)
          ├─→ Attendance (考勤记录)
          ├─→ FaceAnnotation (人脸标注)
          └─→ Teacher (教师)

User (用户)
  ├─→ UserProgram (节目权限)
  └─→ AuditLog (操作日志)
```

### 5. 人脸识别考勤流程

1. **上传排练照片**: before_photo 和 after_photo
2. **人脸检测**: 自动识别照片中的人脸
3. **向量匹配**: 与已存储的 FaceVector 比对
4. **置信度评估**:
   - 高置信度 (>0.8): 自动确认
   - 低置信度 (0.6-0.8): 需人工标注
5. **考勤状态计算**:
   - `normal`: before ✓ + after ✓
   - `late`: before ✗ + after ✓
   - `early_leave`: before ✓ + after ✗
   - `absent`: before ✗ + after ✗
   - `leave_*`: 覆盖自动状态 (已请假)

### 6. API 路由结构

#### 认证路由 (`/api/auth`)
- `POST /login` - 用户登录
- `POST /refresh` - 刷新 access token
- `POST /logout` - 登出
- `GET /me` - 获取当前用户信息
- `POST /change-password` - 修改密码

#### 管理路由 (`/api/admin/*`, 需认证)
- `/members/*` - 成员 CRUD + 批量导入
- `/teachers/*` - 教师 CRUD
- `/programs/*` - 节目 CRUD + 成员分配
- `/rehearsals/*` - 排练 CRUD + 考勤管理
- `/users/*` - 用户管理
- `/semesters/*` - 学期管理
- `/dashboard/stats` - 仪表盘统计

#### 公开路由 (`/api/public/*`, 无需认证)
- `/attendance/overview` - 考勤总览
- `/attendance/programs/:id` - 节目考勤详情
- `/attendance/members?search=` - 成员考勤搜索

## 环境配置

### 后端配置 (`config.py`)

通过环境变量配置:

```bash
# Flask 环境
FLASK_ENV=development|testing|production

# 密钥
SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret-key

# 数据库 (默认使用 SQLite)
DATABASE_URL=sqlite:///arts_management.db
# 或使用 PostgreSQL
DATABASE_URL=postgresql://user:pass@localhost/dbname
```

### 前端配置 (`vite.config.ts`)
- 开发服务器: http://localhost:3000
- API 代理: `/api` → `http://localhost:5000`

## 测试

### 后端测试
- **框架**: pytest + pytest-flask
- **测试数据库**: 使用内存 SQLite (`:memory:`)
- **测试文件**: `backend/tests/test_*.py`
- **配置**: `backend/tests/conftest.py`

运行测试:
```bash
cd backend
pytest                          # 运行所有测试
pytest tests/test_auth.py       # 运行单个文件
pytest -v                       # 详细输出
pytest --cov=.                  # 测试覆盖率
```

## 数据库迁移

**注意**: 当前项目使用 `db.create_all()` 进行简单的表创建,未使用 Alembic 等迁移工具。

修改模型后:
1. 删除 `backend/arts_management.db` (仅开发环境)
2. 重启应用自动重建表结构

**生产环境警告**: 在生产环境应使用 Alembic 进行安全的数据库迁移,避免数据丢失。

## 关键设计决策

### 1. Blueprint 模块化
每个功能模块 (auth, members, programs 等) 使用独立的 Blueprint,便于维护和扩展。

### 2. 权限分层
- **路由级别**: `@role_required` 装饰器
- **业务逻辑级别**: `permissions.py` 中的 `can_access_program()` 等函数
- **前端级别**: 根据用户角色隐藏/显示 UI 元素

### 3. 前端状态管理
- **全局认证状态**: AuthContext (React Context)
- **服务端状态**: React Query (自动缓存和重新验证)
- **本地状态**: Zustand (轻量级状态管理)

### 4. Axios 拦截器
- **请求拦截**: 自动添加 JWT Authorization header
- **响应拦截**:
  - 401 错误自动尝试刷新 token
  - 刷新失败则跳转登录页

### 5. SystemConfig 表
使用 key-value 存储动态配置:
- 人脸识别阈值
- WebDAV 配置
- 站点名称等

避免硬编码配置,支持运行时修改。

## 常见开发场景

### 添加新的 API 端点
1. 在 `backend/models/` 定义模型 (如需要)
2. 在 `backend/routes/` 创建或修改 Blueprint
3. 在 `frontend/src/services/api.ts` 添加 API 函数
4. 在 `frontend/src/types/index.ts` 定义 TypeScript 类型
5. 创建或更新前端页面组件

### 添加新的权限检查
1. 在 `backend/auth/permissions.py` 添加权限检查函数
2. 在路由中使用 `@role_required` 或调用权限函数
3. 在前端根据用户角色条件渲染 UI

### 修改数据模型
1. 编辑 `backend/models/*.py` 中的模型类
2. 删除开发数据库文件 `backend/arts_management.db`
3. 重启应用触发 `db.create_all()`
4. 更新对应的前端类型定义

### 调试技巧
- **后端日志**: Flask 默认在控制台输出请求日志
- **前端调试**: 使用 React DevTools 和浏览器开发者工具
- **数据库查看**: 使用 SQLite 浏览器工具查看 `arts_management.db`
- **API 测试**: 使用 Postman 或 curl 直接测试 API 端点

## Git 工作流

当前在分支: `claude/explain-codebase-mkc9ut9do2toil9w-aRwZc`

项目历史阶段:
- Phase 1: 基础框架搭建
- Phase 2: 前端 React 应用
- Phase 3: 教师和排练管理
- Phase 4: 公开考勤展示页面
- Phase 5: 管理后台仪表盘完善
- Phase 6: 学期管理和用户管理功能
