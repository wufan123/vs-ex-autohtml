import * as vscode from 'vscode';
import * as unzipper from 'unzipper';
import * as fs from 'fs';
import * as path from 'path';
import * as nls from 'vscode-nls-i18n';
import * as crypto from 'crypto';

export async function refactorPage(context: vscode.ExtensionContext, uri?: vscode.Uri) {
    if (!uri || !uri.fsPath || !/\.zip$/i.test(uri.fsPath)) {
        vscode.window.showErrorMessage(nls.localize('refactorNotZip'));
        return;
    }
    const zipPath = uri.fsPath;
    const folderPath = path.dirname(zipPath);
    const config = vscode.workspace.getConfiguration('autohtml');
    const imagesDirName = config.get<string>('m03.imagesDir', 'images');
    const cssDirName = config.get<string>('m04.cssDir', 'css');
    const baseHtmlName = config.get<string>('m02.baseHtml', 'base.html');
    const imageExts = ['.svg', '.png', '.jpg'];
    const baseName = path.basename(zipPath, '.zip');

    // 1. 解压缩
    await extractZip(zipPath, folderPath);

    // 2. 处理解压后同名文件夹
    await handleExtractedFolder(folderPath, baseName);

    // 3. 删除zip
    deleteZip(zipPath);

    // 4. 处理图片
    const { imagesDir, fileMap } = await moveImages(folderPath, imagesDirName, baseName, imageExts);

    // 5. 处理CSS
    const { newCssName, newCssPath } = await moveCss(folderPath, cssDirName, baseName);

    // 6. 处理HTML
    const htmlPath = path.join(folderPath, `${baseName}.html`);
    const baseHtmlPath = path.join(folderPath, baseHtmlName);
    if (!fs.existsSync(htmlPath) || !fs.existsSync(baseHtmlPath)) {
        let missingFiles: string[] = [];
        if (!fs.existsSync(htmlPath)) missingFiles.push(baseName);
        if (!fs.existsSync(baseHtmlPath)) missingFiles.push(baseHtmlName);
        vscode.window.showErrorMessage(nls.localize('refactorHtmlMissing') + ': ' + missingFiles.join(', '));
        return;
    }
    let html = fs.readFileSync(htmlPath, 'utf-8');
    let baseHtml = fs.readFileSync(baseHtmlPath, 'utf-8');
    html = html.replace(/(<img[^>]*src=["'])([^"']+)(["'][^>]*>)/gi, (match, p1, src, p3) => {
        const ext = path.extname(src).toLowerCase();
        if (imageExts.includes(ext)) {
            const fileName = path.basename(src);
            // 优先用 fileMap 映射
            const mappedName = fileMap[fileName] || (baseName + '_' + fileName);
            const newSrc = `${imagesDirName}/${baseName}/${mappedName}`;
            return p1 + newSrc + p3;
        }
        return match;
    });
    if (newCssName) {
        const cssHref = `${cssDirName}/${newCssName}`;
        // 插入到baseHtml的<head>标签内的尾部
        baseHtml = baseHtml.replace(
            /(<\/head>)/i,
            `    <link rel="stylesheet" href="${cssHref}">\n$1`
        );
    }
    baseHtml = baseHtml.replace(/<!--\s*autohtml\s*-->/i, html);
    fs.writeFileSync(htmlPath, baseHtml, 'utf-8');
    // 在面板中打开该html
    const doc = await vscode.workspace.openTextDocument(htmlPath);
    await vscode.window.showTextDocument(doc, { preview: false });

    vscode.window.showInformationMessage(nls.localize('refactorDone', baseName));
}

export async function refactorModule(context: vscode.ExtensionContext, uri?: vscode.Uri) {
    if (!uri || !uri.fsPath || !/\.zip$/i.test(uri.fsPath)) {
        vscode.window.showErrorMessage(nls.localize('refactorNotZip'));
        return;
    }
    const zipPath = uri.fsPath;
    const baseName = path.basename(zipPath, '.zip');
    var nameArr = baseName.split("-");

    if (nameArr.length < 2) {
        vscode.window.showErrorMessage(nls.localize('moduleNameError'));
        return;
    }
    const pageName = nameArr[0];
    const moduleName = nameArr[1];
    const folderPath = path.dirname(zipPath);
    const config = vscode.workspace.getConfiguration('autohtml');
    const imagesDirName = config.get<string>('m03.imagesDir', 'images');
    const cssDirName = config.get<string>('m04.cssDir', 'css');
    const imageExts = ['.svg', '.png', '.jpg'];

    // 1. 解压缩
    await extractZip(zipPath, folderPath);
    // 2. 处理解压后同名文件夹
    await handleExtractedFolder(folderPath, baseName);
    // 3. 删除zip
    deleteZip(zipPath);
    // 4. 处理图片
    const { imagesDir, fileMap } = await moveImages(folderPath, imagesDirName, pageName, imageExts, moduleName);
    copyCssContent(folderPath, cssDirName, pageName, moduleName);
    // 6. 处理HTML
    const htmlPath = path.join(folderPath, `${moduleName}.html`);
    const pageHtmlPath = path.join(folderPath, `${pageName}.html`);
    if (!fs.existsSync(htmlPath) || !fs.existsSync(pageHtmlPath)) {
        let missingFiles: string[] = [];
        if (!fs.existsSync(htmlPath)) missingFiles.push(moduleName);
        if (!fs.existsSync(pageHtmlPath)) missingFiles.push(pageName);
        vscode.window.showErrorMessage(nls.localize('refactorHtmlMissing') + ': ' + missingFiles.join(', '));
        return;
    }
    let html = fs.readFileSync(htmlPath, 'utf-8');
    let baseHtml = fs.readFileSync(pageHtmlPath, 'utf-8');
    console.log(htmlPath, pageHtmlPath);
    html = html.replace(/(<img[^>]*src=["'])([^"']+)(["'][^>]*>)/gi, (match, p1, src, p3) => {
        const ext = path.extname(src).toLowerCase();
        if (imageExts.includes(ext)) {
            const fileName = path.basename(src);
            // 优先用 fileMap 映射
            const mappedName = fileMap[fileName] || (pageName + '_' + fileName);
            const newSrc = `${imagesDirName}/${pageName}/${mappedName}`;
            return p1 + newSrc + p3;
        }
        return match;
    });
    html = `
    <!-- ${moduleName} --start -->
    ${html}
    <!-- ${moduleName} --end -->
    `;
    baseHtml = baseHtml.replace(/<!--\s*autohtml\s*-->/i, html);
    fs.writeFileSync(pageHtmlPath, baseHtml, 'utf-8');
    fs.unlinkSync(htmlPath);
    const doc = await vscode.workspace.openTextDocument(pageHtmlPath);
    await vscode.window.showTextDocument(doc, { preview: false });
    vscode.window.showInformationMessage(nls.localize('refactorDone', baseName));

}
function copyCssContent(folderPath: string, cssDirName: string, pageName: string, moduleName: string) {
    const stylePath = path.join(folderPath, 'style.css');
    const pageCssPath = path.join(folderPath, cssDirName, `${pageName}.css`);
    if (fs.existsSync(pageCssPath) && fs.existsSync(stylePath)) {
        let styleContent = fs.readFileSync(stylePath, 'utf-8');
        styleContent = `
        /* ${moduleName} --start */
        ${styleContent}
        /* ${moduleName} --end */
        `;
        // 读取目标css内容，忽略换行和空格后判断是否已包含
        const pageCssContent = fs.readFileSync(pageCssPath, 'utf-8');
        const normalize = (s: string) => s.replace(/\s+/g, '');
        if (!normalize(pageCssContent).includes(normalize(styleContent))) {
            fs.appendFileSync(pageCssPath, '\n' + styleContent);
        }
        fs.unlinkSync(stylePath);
    }
}
async function deleteZip(zipPath: string) {
    // 如果面板中有打开zip文件，则关闭面板
    for (const tabGroup of vscode.window.tabGroups.all) {
        for (const tab of tabGroup.tabs) {
            if (tab.input && typeof tab.input === 'object' && tab.input !== null && 'uri' in tab.input && (tab.input as any).uri.fsPath === zipPath) {
                await vscode.window.tabGroups.close(tab);
            }
        }
    }
    fs.unlinkSync(zipPath);
}

async function extractZip(zipPath: string, folderPath: string) {
    const zipBuffer = fs.readFileSync(zipPath);
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: nls.localize('extracting') }, async () => {
        await new Promise<void>((resolve, reject) => {
            unzipper.Parse()
                .on('entry', (entry: unzipper.Entry) => {
                    const fileName = entry.path;
                    if (/^(index\.html|vars\.css)$/i.test(fileName)) {
                        entry.autodrain();
                    } else {
                        const destPath = path.join(folderPath, fileName);
                        fs.mkdirSync(path.dirname(destPath), { recursive: true });
                        entry.pipe(fs.createWriteStream(destPath));
                    }
                })
                .on('close', resolve)
                .on('error', reject)
                .end(zipBuffer);
        });
    });
}

async function handleExtractedFolder(folderPath: string, baseName: string) {
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
}

async function moveImages(folderPath: string, imagesDirName: string, pageName: string, imageExts: string[] = ['.svg', '.png', '.jpg'], moduleName?: string) {
    const imagesDir = path.join(folderPath, `${imagesDirName}/${pageName}`);
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }

    const hashMap: Record<string, string> = {};
    // 记录已存在图片的内容hash
    // 记录原始文件名与新文件名的映射
    const fileMap: Record<string, string> = {};

    for (const file of fs.readdirSync(imagesDir)) {
        const filePath = path.join(imagesDir, file);
        if (fs.statSync(filePath).isFile()) {
            const buf = fs.readFileSync(filePath);
            const hash = crypto.createHash('sha256').update(buf).digest('hex');
            hashMap[hash] = file;
        }
    }

    for (const file of fs.readdirSync(folderPath)) {
        const ext = path.extname(file).toLowerCase();
        if (imageExts.includes(ext)) {
            const src = path.join(folderPath, file);
            const buf = fs.readFileSync(src);
            const hash = crypto.createHash('sha256').update(buf).digest('hex');
            if (hashMap[hash]) {
                // 内容一样，删除当前文件，不移动 
                fs.unlinkSync(src);
                fileMap[file] = hashMap[hash]; // 记录映射
            } else {
                const newName = moduleName ? `${pageName}_${moduleName}_${file}` : `${pageName}_${file}`;
                const dst = path.join(imagesDir, newName);
                fs.renameSync(src, dst);
                hashMap[hash] = newName;
                fileMap[file] = newName; // 记录映射
            }
        }
    }
    return { imagesDir, fileMap };
}

async function moveCss(folderPath: string, cssDirName: string, baseName: string) {
    await new Promise(resolve => setTimeout(resolve, 100));
    const stylePath = path.join(folderPath, 'style.css');
    const cssDir = path.join(folderPath, cssDirName);
    let newCssName = '';
    let newCssPath = '';
    if (fs.existsSync(stylePath)) {
        if (!fs.existsSync(cssDir)) {
            fs.mkdirSync(cssDir, { recursive: true });
        }
        newCssName = `${baseName}.css`;
        newCssPath = path.join(cssDir, newCssName);
        fs.renameSync(stylePath, newCssPath);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    return { newCssName, newCssPath };
}