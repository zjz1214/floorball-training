# training-manual

软曲教学（软式曲棍球校队训练手册）静态网站，基于 VitePress。

## 项目结构

- `manual.md` — 原始内容源（单文件，飞书手动合并后的 Markdown）
- `index.md` — 首页（VitePress home layout）
- `个人技术基础/` 等 — 按 H1/H2 拆分的内容页面
- `.vitepress/config.ts` — VitePress 配置（导航、侧边栏、搜索）
- `.vitepress/theme/` — 自定义主题（custom.css 样式覆盖）
- `public/` — 静态资源（图片直接放根，视频在 `public/videos/`）
- `ISDBdRNj4oIqsxxqXtdcyyuJnoe.json` — 飞书导出原始 JSON
- `ISDBdRNj4oIqsxxqXtdcyyuJnoe.md` — regenerate_md.py 的中间产物
- `regenerate_md.py` — 从飞书 JSON 重新生成 Markdown
- `convert_videos.py` — 视频格式转换（MOV/MKV → MP4）
- `download_videos.py` — 下载视频脚本
- `add_videos_to_md.py` — 向 Markdown 添加视频引用

## 开发

```bash
npm install
npm run dev        # 热重载开发服务器
npm run build      # 构建到 .vitepress/dist/
npm run preview    # 预览构建结果
```

## 从飞书更新内容

飞书重新导出 JSON 后：
```bash
python regenerate_md.py   # JSON → 中间 .md
# 手动将中间 .md 内容合并到各个 VitePress 页面
python convert_videos.py  # 转换新视频格式（如有）
npm run build             # 构建
```

## 内容约定

- 每个目录对应一个 H1 章节，`index.md` 为章节概述页
- 每个 `.md` 文件对应一个 H2 子页面
- `::: tip` = 提示框
- 图片：`![](/文件名.ext)` — 文件放 `public/` 下
- 视频：`<video src="/videos/文件名.mp4" controls></video>` — CSS 控制尺寸
- 首页使用 `layout: home` + hero + features 配置

## 部署

Push 到 main 分支，GitHub Actions 自动构建部署到 GitHub Pages。
