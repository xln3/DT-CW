# 人脸识别模块

艺术团考勤系统的人脸识别模块，基于 InsightFace (ArcFace) 实现。

## 核心特性

### 1. 双轨注册方式
- **方式A**: 上传个人照片
- **方式B**: 从合照中点选自己

### 2. 基于可区分性的注册验证
- 注册成功与否取决于能否与其他成员区分
- 不是靠照片数量或质量分判断
- 阈值设定：
  - `< 0.50`: 可区分，注册成功
  - `0.50 - 0.65`: 边界，建议补充更多照片
  - `>= 0.65`: 冲突，需要解决

### 3. 节目范围内匹配
- 合照识别只在该节目成员中匹配
- 减少误匹配，提高准确率
- 搜索空间从全团（~200人）缩小到节目（~15人）

### 4. 基于错误历史的校准
- 记录识别错误
- 分析问题成员和混淆对
- 生成定向校准任务

## 目录结构

```
face_recognition/
├── __init__.py              # 模块入口
├── config.py                # 配置参数
├── core/                    # 核心算法
│   ├── feature_extractor.py # 特征提取
│   ├── face_matcher.py      # 人脸匹配
│   ├── distinguishability_checker.py  # 可区分性检测
│   └── embedding_aggregator.py        # 特征聚合
├── services/                # 业务服务
│   ├── registration_service.py    # 注册服务
│   ├── group_selection_service.py # 合照点选服务
│   ├── recognition_service.py     # 识别服务
│   └── calibration_service.py     # 校准服务
└── api/                     # API路由
    └── routes.py
```

## API 端点

### 队员端

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/face/upload` | 上传个人照片 |
| GET | `/api/face/my-status` | 获取注册状态 |
| GET | `/api/face/my-photos` | 获取我的照片 |
| DELETE | `/api/face/photos/<id>` | 删除照片 |
| GET | `/api/face/selectable-photos` | 获取可选合照列表 |
| GET | `/api/face/photo-faces/<id>` | 获取合照中的人脸 |
| POST | `/api/face/select-myself` | 在合照中选择自己 |
| GET | `/api/face/calibration-tasks` | 获取校准任务 |
| POST | `/api/face/challenge/generate` | 生成9宫格挑战 |
| POST | `/api/face/challenge/verify` | 验证挑战答案 |

### 管理端

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/face/recognize` | 识别合照 |
| POST | `/api/face/annotate` | 标注/修正人脸 |
| GET | `/api/face/recognition/<id>` | 获取识别结果 |
| GET | `/api/face/members-status` | 批量获取成员状态 |
| GET | `/api/face/stats/overview` | 统计概览 |
| GET | `/api/face/stats/errors` | 错误统计 |
| POST | `/api/face/analyze-errors` | 触发错误分析 |

## 配置参数

```python
class FaceRecognitionConfig:
    # 模型配置
    MODEL_PACK = 'buffalo_l'      # InsightFace 模型包
    EMBEDDING_DIM = 512           # 特征向量维度
    
    # 匹配阈值
    MATCH_THRESHOLD_CONFIRMED = 0.55  # 确认匹配
    MATCH_THRESHOLD_UNCERTAIN = 0.35  # 不确定
    
    # 可区分性阈值
    DISTINGUISHABLE_THRESHOLD = 0.50  # 可区分
    BORDERLINE_THRESHOLD = 0.65       # 边界
    
    # Mock 模式（测试用）
    USE_MOCK_MODE = False
```

## 使用方式

### 1. 注册路由

```python
from face_recognition.api import register_face_routes

def create_app():
    app = Flask(__name__)
    # ... 其他配置
    register_face_routes(app)
    return app
```

### 2. 使用服务

```python
from face_recognition.services import (
    RegistrationService,
    RecognitionService
)

# 上传照片注册
reg_service = RegistrationService()
result = reg_service.upload_photo(
    member_id=1,
    photo_data=photo_bytes,
    photo_url='/uploads/photo.jpg'
)

# 识别合照
rec_service = RecognitionService()
result = rec_service.recognize_group_photo(
    photo_data=photo_bytes,
    rehearsal_id=1,
    photo_type='check_in',
    program_id=1
)
```

## Mock 模式

设置环境变量启用 Mock 模式（不需要真实模型）：

```bash
export FACE_MOCK_MODE=true
```

Mock 模式下：
- 生成确定性的假特征向量（基于图片哈希）
- 用于开发和测试
- 不需要安装 InsightFace

## 数据库模型

新增的表：
- `member_faces`: 成员人脸注册状态
- `member_photos`: 成员照片
- `photo_recognitions`: 合照识别记录
- `detected_faces`: 检测到的人脸
- `recognition_errors`: 识别错误记录
- `confusion_pairs`: 混淆对记录
- `calibration_tasks`: 校准任务
- `calibration_challenges`: 9宫格挑战记录

## 注意事项

1. **模型下载**: 首次运行会自动下载 InsightFace 模型（约100MB）
2. **GPU 支持**: 安装 `onnxruntime-gpu` 可启用 GPU 加速
3. **存储**: 照片和人脸裁剪图需要配置云存储（如腾讯云 COS）
4. **定时任务**: 错误分析应配置为每日/每周执行
