# autohtml VS Code 插件

## 简介

autohtml 是一个 VS Code 扩展，旨在提升 HTML 项目模板的获取与自动化处理效率。支持一键下载远程模板、拷贝本地模板、自动解压、资源整理、历史记录管理等功能，适合前端开发者快速搭建项目结构。

## 主要功能

- **一键获取模板**  
  - 支持输入远程链接下载 zip 包并自动解压
  - 支持选择本地文件夹作为模板拷贝
  - 下载/拷贝历史记录，快速复用

- **智能解压与整理**  
  - zip 解压后自动去除多余嵌套目录
  - 根目录下图片（.svg/.png/.jpg）自动剪切到 images 目录，并重命名防止冲突
  - 支持自定义图片目录（默认 images）

- **HTML 自动处理**  
  - 自动替换 html 文件中 img 标签的 src 路径为新资源路径
  - 支持将模板 html 内容插入 base.html 的 body 中，生成新 html

- **CSS 自动合并**  
  - 自动将 style.css 内容合并到 css/style.css 尾部，避免重复

- **历史记录管理**  
  - 下载/本地模板历史分开管理，支持删除单条历史

## 配置项

可在 VS Code 设置中搜索 `autohtml` 进行自定义：

- `autohtml.m01.ignore`  
  拷贝本地模板时忽略的文件/文件夹正则（默认排除 node_modules、.git 等）
- `autohtml.m02.baseHtml`  
  基础 html 文件名（默认 base.html）
- `autohtml.m03.imagesDir`  
  图片输出目录（默认 images）
- `autohtml.m04.cssDir`  
  CSS 输出目录（默认 css）
- `autohtml.indexHtml`  
  处理的主 html 文件名（默认与 zip 文件同名）

## 使用方法

1. **右键资源管理器文件夹，选择“获取模板”**
2. 选择“远程下载”或“本地拷贝”，按提示操作
3. 若为 zip 包，自动解压并整理资源
4. 若有 base.html，自动合成主 html
5. 可通过设置自定义各类目录和文件名

## 贡献与反馈

如有建议、Bug 或需求，欢迎在 [GitHub 仓库](https://github.com/wufan123/vs-ex-autohtml) 提 Issue。

---
