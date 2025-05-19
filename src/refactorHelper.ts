import * as vscode from 'vscode';
import * as unzipper from 'unzipper';
import * as fs from 'fs';
import * as path from 'path';
import * as nls from 'vscode-nls-i18n';

export async function refactor(context: vscode.ExtensionContext, uri?: vscode.Uri) {
    if (!uri || !uri.fsPath || !/\.zip$/i.test(uri.fsPath)) {
        vscode.window.showErrorMessage(nls.localize('refactorNotZip'));
        return;
    }
    const zipPath = uri.fsPath;
    const folderPath = path.dirname(zipPath);
    const config = vscode.workspace.getConfiguration('autohtml');
    const imagesDirName = config.get<string>('m03.imagesDir', 'images');
    // 先读取 zip 文件到 Buffer，避免后续操作时文件被占用
    const zipBuffer = fs.readFileSync(zipPath);
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: nls.localize('extracting') }, async () => {
        // 解压时过滤 index.html，并且只处理文件，跳过目录
        await new Promise<void>((resolve, reject) => {
            unzipper.Parse()
                .on('entry', (entry: unzipper.Entry) => {
                    const fileName = entry.path;
                    if (/^(index\.html|vars\.css)$/i.test(fileName)) {
                        entry.autodrain(); // 跳过目录和 index.html
                    } else {
                        const destPath = path.join(folderPath, fileName);
                        // 确保目录存在
                        fs.mkdirSync(path.dirname(destPath), { recursive: true });
                        entry.pipe(fs.createWriteStream(destPath));
                    }
                })
                .on('close', resolve)
                .on('error', reject)
                .end(zipBuffer); // 用 Buffer 解压，释放对 zip 文件的占用
        });
    });
    // 检查解压后是否只有一个同名文件夹
    const baseName = path.basename(zipPath, '.zip');
    const extractedPath = path.join(folderPath, baseName);
    if (fs.existsSync(extractedPath) && fs.lstatSync(extractedPath).isDirectory()) {
        const files = fs.readdirSync(extractedPath);
        for (const f of files) {
            const src = path.join(extractedPath, f);
            const dst = path.join(folderPath, f);
            fs.renameSync(src, dst);
        }
        fs.rmdirSync(extractedPath);
    }
    fs.unlinkSync(zipPath);
    // 新增：将根目录下所有图片文件剪切到配置目录
    const imagesDir = path.join(folderPath, imagesDirName);
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir);
    }
    const imageExts = ['.svg', '.png', '.jpg'];
    for (const file of fs.readdirSync(folderPath)) {
        const ext = path.extname(file).toLowerCase();
        if (imageExts.includes(ext)) {
            const src = path.join(folderPath, file);
            const newName = baseName + '_' + file;
            const dst = path.join(imagesDir, newName);
            fs.renameSync(src, dst);
        }
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    // 剪切图片后，处理html
    const baseHtmlName = config.get<string>('m02.baseHtml', 'base.html');
    const htmlPath = path.join(folderPath, `${baseName}.html`);
    const baseHtmlPath = path.join(folderPath, baseHtmlName);
    if (!fs.existsSync(htmlPath) || !fs.existsSync(baseHtmlPath)) {
        vscode.window.showErrorMessage(nls.localize('refactorHtmlOrBaseMissing'));
        return;
    }
    if (fs.existsSync(htmlPath) && fs.existsSync(baseHtmlPath)) {
        // 等待上一个文件读写完成
        let html = fs.readFileSync(htmlPath, 'utf-8');
        let baseHtml = fs.readFileSync(baseHtmlPath, 'utf-8');
        html = html.replace(/(<img[^>]*src=["'])([^"']+)(["'][^>]*>)/gi, (match, p1, src, p3) => {
            const ext = path.extname(src).toLowerCase();
            if (imageExts.includes(ext)) {
                const fileName = path.basename(src);
                const newName = baseName + '_' + fileName;
                const newSrc = imagesDirName + '/' + newName;
                return p1 + newSrc + p3;
            }
            return match;
        });
        // 将 html 内容插入 base.html 的 <!-- AUTOHTML --> 占位符
        baseHtml = baseHtml.replace('<!-- AUTOHTML -->', html);
        fs.writeFileSync(htmlPath, baseHtml, 'utf-8');
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    const cssDirName = config.get<string>('m04.cssDir', 'css/style.css');
    const stylePath = path.join(folderPath, 'style.css');
    const cssStylePath = path.join(folderPath, cssDirName);
    if (fs.existsSync(stylePath) && fs.existsSync(cssStylePath)) {
        const styleContent = fs.readFileSync(stylePath, 'utf-8');
        const cssContent = fs.readFileSync(cssStylePath, 'utf-8');
        if (!cssContent.includes(styleContent)) {
            fs.appendFileSync(cssStylePath, '\n' + styleContent);
        }
        fs.unlinkSync(stylePath);
    }
}