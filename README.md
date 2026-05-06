# 软曲教学

软式曲棍球（Floorball）校队训练内容网站，涵盖个人技术、团队战术。基于 VitePress 构建。

## 特性

- 技术/战术内容：个人技术基础 & 进阶、团队战术、训练计划、装备器材指南
- Live2D 交互装饰：右下角罗小黑模型，支持鼠标追踪、点击触发动作动画
- 访问统计：基于不蒜子（Busuanzi）
- 树形目录导航：左侧自动生成 TOC

## 本地预览

```bash
npm install
npm run dev
```

打开浏览器访问 `http://localhost:5173/floorball-training/`。

## 构建

```bash
npm run build    # 输出到 .vitepress/dist-site/
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

## Live2D

页面右下角展示 Live2D 罗小黑模型，使用 PixiJS + pixi-live2d-display 渲染。

| 功能 | 说明 |
|------|------|
| 鼠标追踪 | 模型视线跟随鼠标 |
| 自动动画 | 呼吸、眨眼、空闲动作 |
| 物理效果 | 发梢、配饰等物理模拟 |
| 点击交互 | 22 个点击区域，触发对应动作（跟宠、换装、恢复等） |

模型原始数据来自 Live2DViewerEX 创意工坊（bilibili@躺下做卷腹），通过 Cubism 4 SDK Core 渲染。
