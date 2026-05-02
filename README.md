# 软曲教学

软式曲棍球（Floorball）校队训练内容网站，包含个人技术、团队战术与发力原理。基于 VitePress 构建。

## 本地预览

```bash
npm install
npm run dev
```

打开浏览器访问 `http://localhost:5173/training-manual/`。

## 构建

```bash
npm run build    # 输出到 .vitepress/dist/
npm run preview  # 预览构建结果
```

## 编辑内容

直接编辑对应目录下的 `.md` 文件，开发服务器自动热重载。

### 添加新页面

在对应目录下新建 `.md` 文件，然后在 `.vitepress/config.ts` 的 sidebar 配置中添加链接。

## 从飞书更新

原文档来自飞书，重新导出 JSON 后：
```bash
python regenerate_md.py   # JSON → 中间 .md
# 手动将内容合并到各 VitePress 页面
python convert_videos.py  # 转换视频格式（如有新 MOV/MKV）
npm run build             # 构建
```

## 部署

Push 到 GitHub `main` 分支，GitHub Actions 自动构建并部署到 GitHub Pages。
需在仓库 Settings > Pages 中将 Source 设为 "GitHub Actions"。
