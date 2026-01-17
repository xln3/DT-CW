# Face embeddings backup

`face_embeddings.json` 包含人脸向量数据，用于数据库重建后恢复。

## 用法

```bash
cd backend
source venv/bin/activate

# 导出当前数据库中的人脸向量
python scripts/face_embeddings_backup.py export

# 导入备份的人脸向量
python scripts/face_embeddings_backup.py import

# 列出当前数据库中的人脸向量
python scripts/face_embeddings_backup.py list
```

## 注意事项

- 导入时按成员姓名匹配，请确保成员已存在于数据库中
- 重复的向量会自动跳过
- 建议在修改人脸数据后及时导出备份
