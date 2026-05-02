# 软曲校队训练手册

软式曲棍球（Floorball）校队训练内容网站，包含个人技术、团队战术与发力原理。

## 本地预览

```bash
pip install -r requirements.txt
python build.py
# 浏览器打开 _site/index.html
```

## 编辑内容

编辑 `manual.md`，然后重新运行 `python build.py`。

### 添加新页面

在 `manual.md` 中添加 `# 新章节`（H1 一级页）或 `## 新子节`（H2 二级页），重新构建即可。

### 添加视频

1. 将 MP4 文件放入 `videos/` 目录
2. 在 `manual.md` 中引用：`<video src="videos/文件名.mp4" controls></video>`

## 从飞书更新

原文档来自飞书，重新导出 JSON 后：
```bash
python regenerate_md.py   # 重新生成 manual.md
python convert_videos.py  # 转换视频格式（如有新 MOV/MKV）
python build.py           # 构建网站
```

## 部署

Push 到 GitHub `main` 分支，GitHub Actions 自动构建并部署到 GitHub Pages。
需在仓库 Settings > Pages 中将 Source 设为 "GitHub Actions"。
