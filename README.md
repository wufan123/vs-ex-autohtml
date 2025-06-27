# autohtml VS Code 插件

## 简介

autohtml 是一款专为前端开发者设计的 VS Code 扩展，配合figma的[AutoHTML | Components to Code](https://www.figma.com/community/plugin/1077172952654000760/autohtml-components-to-code)插件，帮助你快速获取和整理代码资源。
- [AutoHTML | Components to Code](https://www.figma.com/community/plugin/1077172952654000760/autohtml-components-to-code)是figma上一个设计稿转代码的插件，提供了较还原的HTML代码，并可下载完整的代码，样式和图片资源。虽然提供的HTML资源很大程度上减少了前端开发者的工作量，但在实际的开发中还有一部分问题：
  - 缺少基础模板，既日常开发中经常使用的通用样式，js或html片段。
  - 没有项目结构（插件中付费转换的项目含有完整项目结构）
  - 重复图片造成的冗余问题，获取的一个资源压缩包内会有名称不同但内容相同的图片。
  - 渐进开发支持，这个问题是这样的，一个多页面或单页面中复杂结构的设计稿，我们是无法在一次生成中获取全部资源的，通常来说需要分页面（页面中分模块）多次获取资源压缩包，然后再来整合，这部分也需要较多工作量。
  - 渐进开发过程中造成的冗余问题，上一个问题的衍生问题，多次获取资源压缩包的过程中可能会积累重复的样式和图片，样式会有相互影响的问题，积累的重复图片会使项目大小快速膨胀问题。
- 该vscode插件主要解决以上问题。
- [AutoHTML | Components to Code](https://www.figma.com/community/plugin/1077172952654000760/autohtml-components-to-code)还原效果和可用性很大程度取决于设计稿的结构和组织，以上结合插件官方建议以及自身经验总结一些设计建议
  - wap设计稿宽度750px。
  - 考虑页面的自适应性，避免使用`groups`,尽量使用`Auto layout`和`constraints`。
  - 保持图层尽可能简单，避免过多嵌套嵌套。
  - 良好的图层命名，并尽量使用英文命名。
  - 如果容器是自适应长度或宽度的话，容易背景应避免特殊且不可重复的图案或设计。
  - 尽量使用矢量图。
  - 其他待补充。

## 使用方法
### 重构页面
1. 重命名figma设计稿中的页面名称，例如`page1`
2. 使用[AutoHTML | Components to Code](https://www.figma.com/community/plugin/1077172952654000760/autohtml-components-to-code)生成html代码，并下载zip，zip名称和页面名称相同，例如页面名称为`page1`，zip名称应为`page1.zip`
3. 将zip包拷贝到vscode资源目录下
4. 准备一个`base.html`文件，例如下面的代码，该`base.html`一般为基础模板，设置了常用头部，引用了常用的js和基础css。在页面中需要的位置插入一个`<!-- AUTOHTML -->`注释,也可直接在光标出右键菜单中选择`AUTOHTML_插入注释`，重构时将HTML代码替换到注释的位置。
      ```HTML
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <title></title>
          <meta name="viewport" content="width=device-width,minimum-scale=1.0, maximum-scale=1.0,user-scalable=no" />
          <meta name="keywords" content="">
          <meta name="description" content="">
          <meta name="apple-mobile-web-app-capable" content="yes">
          <meta name="apple-mobile-web-app-status-bar-style" content="black">
          <meta name="format-detection" content="telephone=no">
          <meta name="full-screen" content="yes" />
          <meta name="x5-fullscreen" content="true" />
          <link href="css/style.css" type="text/css" rel="stylesheet">
          <base target="_blank">
      </head>
      <body>
          <script src="js/jquery.min.js"></script>
          <!-- AUTOHTML -->
      </body>
      </html>
      ```
5. 右键zip包弹出菜单，选择`AUTOHTML_重构`，将自动整理资源，执行解压缩，复制html和css代码，移动图片，去除冗余图片等操作。

### 重构模块
1. 重命名figma设计稿中某个页面内的某个模块名称，例如`dia`。
2. 使用[AutoHTML | Components to Code](https://www.figma.com/community/plugin/1077172952654000760/autohtml-components-to-code)生成html代码，并下载zip，zip名称需用-连接页面名称和模块名称，例如该模块是想放在`page1`页面内的某个位置，那么zip名称应为`page1-dia.zip`
3. 将zip包拷贝到vscode资源目录下
4. 在页面中需要的位置插入一个`<!-- AUTOHTML -->`注释，也可直接在光标出右键菜单中选择`AUTOHTML_插入注释`，重构时将HTML代码替换到注释的位置。
      ```HTML
      <body>
          <script src="js/jquery.min.js"></script>
          <!-- AUTOHTML -->
      </body>
      ```
5. 右键zip包弹出菜单，选择`AUTOHTML_重构模块`，将自动整理资源，执行解压缩，复制html和css代码，移动图片，去除冗余图片等操作。

### 重构资源
- 解决图片冗余问题。
- 资源面板右键菜单选择`AUTOHTML_重构资源`，所有页面中用到的相同图片会移动到`public`目录，并替换所有页面中的路径为新路径。
- 一般在所有页面都完成重构后再`重构资源`。

### 获取模板
- 资源面板右键菜单选择`AUTOHTML_重构`，可从本地复制已有的模板项目。


## 配置项

在 VS Code 设置中搜索 `autohtml` 可自定义：

- `autohtml.m01.ignore`  
  本地模板拷贝时忽略的文件/文件夹正则（默认排除 node_modules、.git 等）
- `autohtml.m02.baseHtml`  
  基础 html 文件名（默认 base.html）
- `autohtml.m03.imagesDir`  
  图片输出目录（默认 images）
- `autohtml.m04.cssDir`  
  CSS 输出目录（默认 css）

## 常见问题

- **图片去重如何处理？**  
  插件会自动对比图片内容，去除重复图片，并保证 HTML 路径正确映射到唯一资源。

- **如何自定义输出目录和文件名？**  
  在 VS Code 设置中搜索 `autohtml`，即可自定义各类目录和文件名。

- **操作可否中断？**  
  所有耗时操作均支持进度条和取消，避免卡死。

## 反馈与贡献

如有建议、Bug 或需求，欢迎在 [GitHub 仓库](https://github.com/wufan123/vs-ex-autohtml) 提 Issue 或 PR。

---

MIT
