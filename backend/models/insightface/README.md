# InsightFace 人脸识别模型

本项目使用 InsightFace 的 buffalo_l 模型进行人脸检测和识别。

## 模型下载

由于模型文件较大（约 275MB），不包含在 Git 仓库中，需要手动下载。

### 方法一：自动下载（推荐）

首次运行时，InsightFace 会自动下载模型到 `~/.insightface/models/` 目录。

### 方法二：手动下载

1. 从以下地址下载 buffalo_l 模型：
   - GitHub Release: https://github.com/deepinsight/insightface/releases
   - 直接链接: https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip

2. 解压到本目录：
   ```bash
   cd backend/models/insightface/models/
   unzip buffalo_l.zip
   ```

3. 目录结构应为：
   ```
   backend/models/insightface/models/
   └── buffalo_l/
       ├── 1k3d68.onnx
       ├── 2d106det.onnx
       ├── det_10g.onnx
       ├── genderage.onnx
       └── w600k_r50.onnx
   ```

## 模型说明

buffalo_l 模型包含：
- **det_10g.onnx**: 人脸检测模型
- **w600k_r50.onnx**: 人脸特征提取模型（512维向量）
- **1k3d68.onnx**: 3D 人脸关键点检测
- **2d106det.onnx**: 2D 人脸关键点检测
- **genderage.onnx**: 性别年龄预测

## 系统要求

- Python 3.8+
- onnxruntime 或 onnxruntime-gpu
- 建议内存 4GB+
