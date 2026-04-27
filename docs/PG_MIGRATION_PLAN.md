# SQLite → PostgreSQL 迁移执行计划（零数据丢失）

> 文档日期: 2026-04-27
> 验证方法: 已用生产 SQLite 副本（11 MB / 2157 行）在本地 Docker PG 16 容器完整预演，**全 33 表、全字段、全 byte equal 通过**
> 目标停机时间: ≤ 5 分钟
> 不可逆点: Phase 3 的步骤 9（切 systemd 配置之后用户写入开始落到 PG）

---

## 0. 现状摘要（来自 audit）

| 项 | 值 |
|---|---|
| 生产 SQLite 大小 | 11 MB（活）+ 7.5 MB（一次手工备份） |
| 生产数据行数 | 2157（33 表，详见 §6） |
| `uploads/` 目录大小 | 44 MB（face_crops + rehearsals 子目录） |
| 服务器是否已装 PG | **未装** |
| 应用 SQLite 专属代码 | 无（全 SQLAlchemy ORM） |
| `psycopg2-binary` 在 requirements | 是（2.9.9+） |
| 生产 schema drift | 0 |
| 生产数据完整性问题 | 0 |
| 真二进制（LargeBinary）字段 | 仅 `detected_faces.embedding`，**生产中全 NULL**（业务用 text JSON 存） |

**结论**: 风险面比典型迁移小很多，主要风险只剩 ① 类型 coerce（已在迁移脚本里修好）② uploads/ 同步 ③ 停机窗口操作失误。

---

## 1. 已就绪的工具

| 工具 | 路径 | 作用 |
|---|---|---|
| schema 漂移预检 | `backend/scripts/check_schema_drift.py` | 比对 SQLite 实表 vs ORM，任何"字段会被丢"的情形 → FATAL |
| 数据完整性预检 | `backend/scripts/check_data_integrity.py` | 孤立 FK / 违反 UNIQUE / NOT NULL 含 NULL / Date 不可解析 / Boolean 非 0/1 / 状态枚举越界 |
| 迁移主体（已修） | `backend/scripts/migrate_to_postgres.py` | 类型 coerce（int→bool, str→date/time/datetime），Table reflection + bulk insert + 序列重置 + 行数对账 |
| **全量字段验证** | `backend/scripts/verify_pg_migration.py` | 逐表逐行逐字段比对 SQLite ↔ PG，**0 抽样**，类型差异归一化后报告真实差异 |
| 部署脚本 | `scripts/deploy.sh` / `scripts/install-git-hook.sh` | git pull + build + restart，避免再发生 dist 过期 |

---

## 2. 总体阶段与不可逆点

```
┌─ Phase 0  本地预演与代码就绪   ────────  完全可逆
├─ Phase 1  服务器装 PG（旁路）  ────────  完全可逆（不影响在跑应用）
├─ Phase 2  停服前冷备份         ────────  完全可逆
├─ Phase 3  停服 → 迁移 → 验证   ────────  ★ 步骤 9 起进入"切回 SQLite 会丢中间数据"
└─ Phase 4  监控期               ────────  保留 SQLite 文件 1 个月作为"末尾保险"
```

---

## 3. Phase 0 — 本地预演（已完成 ✓）

### 已经做了
- `scp` 拉生产 SQLite 副本到本机
- `python -m scripts.check_schema_drift /tmp/.../prod.db` → **OK，0 fatal / 0 warn**
- `python -m scripts.check_data_integrity /tmp/.../prod.db` → **OK，0 fatal / 0 warn**
- `docker run postgres:16-alpine` 起一个干净 PG，运行迁移脚本 → **2157 行，4.7 秒**
- `python -m scripts.verify_pg_migration <pg_url>` → **PASS: every common table is byte-equal**
- 显式对 `member_faces.representative_embedding`（11 KB Text，81 行）和 `detected_faces.embedding_json`（654 行）做 SHA256 验证 → **0 mismatches**

### 输出可信
预演用的是**真实的生产快照**，不是合成数据。预演通过 = 生产迁移可期。

---

## 4. Phase 1 — 服务器装 PG（约 5 分钟，可在任意时间做，不停机）

```bash
# 在生产服务器上
sudo apt update
sudo apt install -y postgresql-16 postgresql-contrib

# 创建库与用户
sudo -u postgres psql <<'SQL'
CREATE USER dtcw WITH PASSWORD '<在 1Password 生成强密码>';
CREATE DATABASE dt_cw OWNER dtcw ENCODING 'UTF8' TEMPLATE template0;
GRANT ALL PRIVILEGES ON DATABASE dt_cw TO dtcw;
\c dt_cw
GRANT ALL ON SCHEMA public TO dtcw;
SQL

# 仅允许本机连接，密码方式
sudo sed -i 's/^#listen_addresses.*/listen_addresses = '\''localhost'\''/' /etc/postgresql/16/main/postgresql.conf
sudo systemctl restart postgresql

# 验证
PGPASSWORD='<密码>' psql -h 127.0.0.1 -U dtcw -d dt_cw -c 'SELECT version();'
```

**完成判定**: `psql` 能连上，`SELECT version()` 返回 PostgreSQL 16.x。

---

## 5. Phase 2 — 冷备份（停服之前，约 1 分钟）

```bash
# 在服务器上
TS=$(date +%Y%m%d_%H%M%S)
mkdir -p ~/dt-cw-pre-pg-$TS
cp ~/DT-CW/backend/arts_management.db ~/dt-cw-pre-pg-$TS/
tar czf ~/dt-cw-pre-pg-$TS/uploads.tar.gz -C ~/DT-CW/backend uploads
sha256sum ~/dt-cw-pre-pg-$TS/* > ~/dt-cw-pre-pg-$TS/SHA256

# 拉一份到本地（不要只在服务器上）
sshpass -p '...' scp -r ubuntu@43.143.228.61:~/dt-cw-pre-pg-$TS ./backups/
```

**完成判定**: 本地 `backups/dt-cw-pre-pg-*/` 目录里有 `arts_management.db`、`uploads.tar.gz`、`SHA256`，且 sha 校验通过。

---

## 6. Phase 3 — 停服切换窗口（5 分钟，建议深夜执行）

### 步骤（必须按顺序）

#### 6.1 停服
```bash
sudo systemctl stop dt-cw
# 等 5s 确认无 in-flight 请求
sleep 5
ss -tnp | grep 5001 || echo "no more gunicorn listeners"
```

#### 6.2 停服后再做一次 SQLite 文件副本（这是最终态）
```bash
cp ~/DT-CW/backend/arts_management.db ~/dt-cw-pre-pg-$TS/arts_management.final.db
sha256sum ~/DT-CW/backend/arts_management.db
```
（这一份才是迁移真正的源——和 Phase 2 的备份比对，行数应一致或多 0–几行）

#### 6.3 拉最新代码（含本轮迁移脚本）
```bash
cd ~/DT-CW
git pull --ff-only origin deploy/production
```

#### 6.4 跑 schema 与数据完整性预检（再保险）
```bash
cd ~/DT-CW/backend
source venv/bin/activate
python -m scripts.check_schema_drift
python -m scripts.check_data_integrity
```
**任意一个 FAIL → 立即 abort，原 SQLite 数据没动，`systemctl start dt-cw` 即可恢复。**

#### 6.5 跑迁移
```bash
PG_URL='postgresql://dtcw:PASSWORD@127.0.0.1:5432/dt_cw'
python -m scripts.migrate_to_postgres "$PG_URL"
```
**预期输出（生产数据量）**：约 5–10 秒完成，最后打印"所有表行数一致，迁移成功!"

#### 6.6 全量字段比对（关键，**0 抽样**）
```bash
python -m scripts.verify_pg_migration "$PG_URL"
```
**判定**:
- 输出尾行 `PASS: every common table is byte-equal` → 通过，继续
- 输出 `FAIL: ...` → **abort，分析 diff，必要时 DROP SCHEMA 重做**。**不要切配置。**

#### 6.7 切应用配置
```bash
# 创建受保护的环境文件
sudo tee /etc/dt-cw.env >/dev/null <<EOF
SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(64))')
JWT_SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(64))')
FACE_MODEL_PACK=buffalo_s
DATABASE_URL=$PG_URL
FLASK_ENV=production
EOF
sudo chmod 600 /etc/dt-cw.env
sudo chown root:root /etc/dt-cw.env
```

修改 `/etc/systemd/system/dt-cw.service`，把内联 `Environment=...` 替换为：
```
EnvironmentFile=/etc/dt-cw.env
```
然后：
```bash
sudo systemctl daemon-reload
```

#### 6.8 启动并烟测
```bash
sudo systemctl start dt-cw
sleep 3
sudo systemctl status dt-cw | head -15

# API 烟测
curl -sf http://127.0.0.1:5001/api/auth/me -H "Authorization: Bearer FAKE" -o /dev/null -w '%{http_code}\n'  # 期望 401
# 走 nginx
curl -sf http://127.0.0.1/ -o /dev/null -w '%{http_code}\n'  # 期望 200
```

#### 6.9 业务烟测（人工，约 2 分钟）
1. 登录 admin
2. 列排练（应看到 68 条）
3. 打开任一排练，看考勤记录正常显示
4. 列成员（144 条）、节目（6 条）、教师（6 条）
5. 公开考勤页 (`/attendance`) 加载正常
6. 改一条考勤备注 → 保存 → 刷新 → 改动落到 PG（`psql` 验证）
7. 上传一张排练照片 → uploads/ 目录新文件存在 → 数据库引用新文件

任何一项失败 → 见 §8 回退预案。

#### 6.10 二次写后再校验（确认 PG 持久化生效）
```bash
psql -h 127.0.0.1 -U dtcw -d dt_cw -c "SELECT COUNT(*) FROM rehearsals; SELECT COUNT(*) FROM attendance; SELECT MAX(updated_at) FROM rehearsals;"
```

★ **走完 6.7 起就过了不可逆点**：用户写入开始落到 PG。回 SQLite 会丢这之间的写入。

---

## 7. Phase 4 — 监控期

| 项 | 频率 | 内容 |
|---|---|---|
| 错误日志 | 每日 | `journalctl -u dt-cw --since '1 day ago' \| grep -iE 'error\|traceback'` |
| PG 备份 | 每日 03:00 cron | `pg_dump -Fc dt_cw > /home/ubuntu/pg-backups/dt_cw-$(date +%F).dump` + 每周一份上传到腾讯云 COS |
| SQLite 旧文件 | 保留 30 天 | `~/dt-cw-pre-pg-*/` 不要急着删 |
| 行数比对 | 第 1、3、7 天 | 简单 `SELECT COUNT(*)` 看每张表是否在合理增长 |

---

## 8. 回退预案（按"在哪个步骤出问题"分类）

| 出问题的步骤 | 状态 | 回退动作 |
|---|---|---|
| 6.1–6.6 任一失败 | PG 部分写入，**SQLite 完整未动** | `systemctl start dt-cw`（仍 SQLite）；分析问题；下次重试 |
| 6.7 配置写错 | systemd 起不来 | `vim /etc/dt-cw.env` 把 DATABASE_URL 改回 `sqlite:///.../arts_management.db`；`systemctl restart dt-cw` |
| 6.8–6.10 烟测失败 | PG 已持久化但应用错 | 同上：临时切回 SQLite `DATABASE_URL`；重启；分析；这中间几乎无新写入（因为烟测正在做），可接受 |
| 上线后 1 天内发现严重 PG 问题 | PG 已积累若干新数据 | 操作两步：① 立即停服；② 用 `pg_dump --data-only` 把 PG 中新增的 *delta*（按 created_at > 切换时刻 筛选）导出 SQL，必要时手工 merge 回 SQLite；③ 切回 SQLite 启动 |

**最坏情况**: 真的需要回 SQLite 而 PG 中已有大量新数据 → 不切回。**改修 PG 中的问题**而不是回退（因为那时回退会丢真实业务数据）。

---

## 9. 不在迁移范围内但建议同步做的事

> 这些都已经在审计报告里列过，借迁移这次窗口一起改性价比高：

1. **强 SECRET_KEY / JWT_SECRET_KEY** — 已在 6.7 步骤里用 `secrets.token_urlsafe(64)` 生成（**注意：现有 JWT 全部失效，所有用户需重新登录**——上线前公告一下）
2. **systemd EnvironmentFile** — 同上，6.7 一并改
3. **PG 备份 cron** — Phase 4 起就要有
4. **gunicorn 多 worker** — 改 `gunicorn -w 4 --worker-class gthread --threads 4`（PG 支持并发，SQLite 是单写锁，所以这要等 PG 上来才有意义）
5. **关闭 UFW 5000 端口** — 一直没用，删除
6. **删除 Redis（如不用）或启用做限流缓存** — 决定一下

---

## 10. 时间总账

| 阶段 | 估时 | 是否需要停机 |
|---|---|---|
| Phase 0 预演 | 已完成 | 否 |
| Phase 1 装 PG | 5 min | 否 |
| Phase 2 冷备份 | 1 min | 否 |
| Phase 3.1–6.6 迁移+验证 | 1–2 min | **停机** |
| Phase 3.7–6.10 切配置 + 启动 + 烟测 | 3–4 min | **停机** |
| Phase 4 监控 | 持续 | 否 |
| **总停机** | **≤ 5 min** | |

---

## 11. Go/No-go 检查表（执行前必勾）

- [ ] 已读完本文档
- [ ] 已看过 §8 回退预案，理解不可逆点在 6.7
- [ ] 已选好停机时段（建议 23:00 后）
- [ ] 1Password 里有强 PG 密码
- [ ] 本地有 Phase 2 冷备份的副本
- [ ] 服务器装好 PG（Phase 1 完成）
- [ ] 已通知会用系统的人："X 时段约 5 分钟服务中断 + 所有人需重新登录"
- [ ] 准备好可立即响应的 1 小时窗口（万一回退）

---

## 12. 我准备好的下一步

执行前再确认一次以下三件事，由你点头我来动手：

1. **何时停机**？建议今晚 23:00 之后
2. **PG 密码**让我现场生成（写到 `/etc/dt-cw.env`），还是你来定？
3. **JWT 强密钥换不换**？换的话所有用户得重新登录——你要不要提前通知

你点头我走 Phase 1 → 4 全程，并在每个关键节点把"日志 + 验证输出"贴给你看。
