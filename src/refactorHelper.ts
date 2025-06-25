import * as vscode from 'vscode';
import * as unzipper from 'unzipper';
import * as fs from 'fs';
import * as path from 'path';
import * as nls from 'vscode-nls-i18n';
import * as crypto from 'crypto';
import { pipeline } from 'stream';
import { promisify } from 'util';
const pipelineAsync = promisify(pipeline);

const imageExts = ['.svg', '.png', '.jpg'];

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
    const baseName = path.basename(zipPath, '.zip');

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: nls.localize('refactorProgress', baseName),
            cancellable: true
        },
        async (progress, token) => {
            try {
                progress.report({ message: nls.localize('extracting'), increment: 100 / 7 * 1 });
                if (token.isCancellationRequested) return;
                await extractZip(zipPath, folderPath);
                progress.report({ message: nls.localize('handlingExtractedFolder'), increment: 100 / 7 * 2 });
                if (token.isCancellationRequested) return;
                await handleExtractedFolder(folderPath, baseName);

                progress.report({ message: nls.localize('deletingZip'), increment: 100 / 7 * 3 });
                if (token.isCancellationRequested) return;
                deleteZip(zipPath);
                progress.report({ message: nls.localize('processingImages'), increment: 100 / 7 * 4 });
                if (token.isCancellationRequested) return;
                const { imagesDir, fileMap } = await moveImages(folderPath, imagesDirName, baseName, imageExts);

                progress.report({ message: nls.localize('processingCss'), increment: 100 / 7 * 5 });
                if (token.isCancellationRequested) return;
                const { newCssName, newCssPath } = await moveCss(folderPath, cssDirName, baseName);

                progress.report({ message: nls.localize('processingHtml'), increment: 100 / 7 * 6 });
                if (token.isCancellationRequested) return;
                await processHtml(folderPath, baseName, imagesDirName, imageExts, newCssName, cssDirName, baseHtmlName, fileMap);

                vscode.window.showInformationMessage(nls.localize('refactorDone', baseName));
            } catch (err) {
                vscode.window.showErrorMessage(nls.localize('refactorError', String(err)));
            }
        }
    );
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

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: nls.localize('refactorProgress', baseName),
            cancellable: true
        },
        async (progress, token) => {
            try {
                progress.report({ message: nls.localize('extracting'), increment: 100 / 7 * 1 });
                if (token.isCancellationRequested) return;
                // 1. 解压缩
                await extractZip(zipPath, folderPath);
                progress.report({ message: nls.localize('handlingExtractedFolder'), increment: 100 / 7 * 2 });
                if (token.isCancellationRequested) return;
                // 2. 处理解压后同名文件夹
                await handleExtractedFolder(folderPath, baseName);
                progress.report({ message: nls.localize('deletingZip'), increment: 100 / 7 * 3 });
                if (token.isCancellationRequested) return;
                // 3. 删除zip
                deleteZip(zipPath);

                progress.report({ message: nls.localize('processingImages'), increment: 100 / 7 * 4 });
                if (token.isCancellationRequested) return;
                // 4. 处理图片
                const { imagesDir, fileMap } = await moveImages(folderPath, imagesDirName, pageName, imageExts, moduleName);

                progress.report({ message: nls.localize('processingCss'), increment: 100 / 7 * 5 });
                if (token.isCancellationRequested) return;
                //5.处理样式
                copyCssContent(folderPath, cssDirName, pageName, moduleName);
                progress.report({ message: nls.localize('processingHtml'), increment: 100 / 7 * 6 });
                if (token.isCancellationRequested) return;
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
            } catch (err) {
                vscode.window.showErrorMessage(nls.localize('refactorError', String(err)));
            }
        }
    );

}

export async function refactorResources(context: vscode.ExtensionContext, uri?: vscode.Uri) {
    const config = vscode.workspace.getConfiguration('autohtml');
    const imagesDirName = config.get<string>('m03.imagesDir', 'images');
    let folderPath = uri?.fsPath;
    if (!folderPath || !fs.lstatSync(folderPath).isDirectory()) {
        folderPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    }
    const imagesRoot = path.join(folderPath, imagesDirName);
    const publicDir = path.join(imagesRoot, 'public');
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: nls.localize('refactorProgress', imagesDirName),
            cancellable: true
        },
        async (progress, token) => {
            try {
                // 记录hash到public图片名的映射
                const hashToPublicName: Record<string, string> = {};
                // 记录原图片路径到public图片名的映射
                const movedImages: Record<string, string> = {};
                // 遍历imagesDirName下的所有子文件夹
                const subDirs = fs.readdirSync(imagesRoot).filter(f => {
                    const full = path.join(imagesRoot, f);
                    return fs.statSync(full).isDirectory();
                });

                progress.report({ message: nls.localize('collectingImages'), increment: 10 });
                if (token.isCancellationRequested) return;

                // 先收集所有图片的hash和路径
                const hashToPaths: Record<string, string[]> = {};
                let totalImages = 0;
                for (const dir of subDirs) {
                    const dirPath = path.join(imagesRoot, dir);
                    const files = fs.readdirSync(dirPath);
                    for (const file of files) {
                        const ext = path.extname(file).toLowerCase();
                        if (!imageExts.includes(ext)) continue;
                        const filePath = path.join(dirPath, file);
                        const hash = await hashFile(filePath);
                        if (!hashToPaths[hash]) hashToPaths[hash] = [];
                        hashToPaths[hash].push(filePath);
                        totalImages++;
                        if (token.isCancellationRequested) return;
                    }
                }

                progress.report({ message: nls.localize('processingImages'), increment: 30 });
                if (token.isCancellationRequested) return;

                // 对于有重复内容的图片，只移动第一个到public，其余记录映射
                let processed = 0;
                const hashEntries = Object.entries(hashToPaths);
                for (const [hash, paths] of hashEntries) {
                    if (token.isCancellationRequested) return;
                    if (paths.length > 1) {
                        // 取第一个为主
                        const firstPath = paths[0];
                        const ext = path.extname(firstPath);
                        let publicName = path.basename(firstPath);
                        let publicPath = path.join(publicDir, publicName);
                        let i = 1;
                        while (fs.existsSync(publicPath)) {
                            publicName = `${path.basename(firstPath, ext)}_${i}${ext}`;
                            publicPath = path.join(publicDir, publicName);
                            i++;
                        }
                        fs.renameSync(firstPath, publicPath);
                        hashToPublicName[hash] = publicName;
                        movedImages[firstPath] = publicName;
                        // 其余的直接删除并记录映射
                        for (let j = 1; j < paths.length; j++) {
                            fs.unlinkSync(paths[j]);
                            movedImages[paths[j]] = publicName;
                        }
                    }
                    processed++;
                    if (processed % 10 === 0) {
                        progress.report({ message: nls.localize('processingImages'), increment: 30 * (processed / hashEntries.length) });
                    }
                }


                progress.report({ message: nls.localize('processingHtml'), increment: 50 });
                if (token.isCancellationRequested) return;

                // 遍历 folderPath 下所有 .html 文件，替换图片路径
                const htmlFiles = fs.readdirSync(folderPath).filter(f => f.endsWith('.html'));
                for (let i = 0; i < htmlFiles.length; i++) {
                    if (token.isCancellationRequested) return;
                    const htmlFile = htmlFiles[i];
                    const htmlFilePath = path.join(folderPath, htmlFile);
                    let htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
                    // 替换 img 标签 src 路径为 public 目录下的图片名（如果有映射）
                    htmlContent = htmlContent.replace(/(<img[^>]*src=["'])([^"']+)(["'][^>]*>)/gi, (match, p1, src, p3) => {
                        const absPath = path.isAbsolute(src) ? src : path.join(folderPath, src);
                        if (movedImages[absPath]) {
                            const newSrc = `${imagesDirName}/public/${movedImages[absPath]}`;
                            return p1 + newSrc + p3;
                        }
                        return match;
                    });
                    fs.writeFileSync(htmlFilePath, htmlContent, 'utf-8');
                    if (i % 2 === 0) {
                        progress.report({ message: nls.localize('processingHtml'), increment: 50 * ((i + 1) / htmlFiles.length) });
                    }
                }
                vscode.window.showInformationMessage(nls.localize('refactorResourcesDone', String(Object.keys(movedImages).length)));
            } catch (err) {
                vscode.window.showErrorMessage(nls.localize('refactorError', String(err)));
            }
        }
    );
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

// 优化图片去重与移动，采用流式处理和异步API
async function moveImages(
    folderPath: string,
    imagesDirName: string,
    pageName: string,
    imageExts: string[] = ['.svg', '.png', '.jpg'],
    moduleName?: string
) {
    const imagesDir = path.join(folderPath, `${imagesDirName}/${pageName}`);
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }
    const hashMap: Record<string, string> = {};
    const fileMap: Record<string, string> = {};

    // 先扫描 imagesDir 目录下已有图片，避免重复
    for (const file of fs.readdirSync(imagesDir)) {
        const filePath = path.join(imagesDir, file);
        if (fs.statSync(filePath).isFile()) {
            const hash = await hashFile(filePath);
            hashMap[hash] = file;
        }
    }

    // 处理根目录下的图片
    for (const file of fs.readdirSync(folderPath)) {
        const ext = path.extname(file).toLowerCase();
        if (imageExts.includes(ext)) {
            const src = path.join(folderPath, file);
            const hash = await hashFile(src);
            if (hashMap[hash]) {
                // 内容一样，删除当前文件，不移动
                await fs.promises.unlink(src);
                fileMap[file] = hashMap[hash];
            } else {
                const newName = moduleName ? `${pageName}_${moduleName}_${file}` : `${pageName}_${file}`;
                const dst = path.join(imagesDir, newName);
                await moveFileStream(src, dst);
                hashMap[hash] = newName;
                fileMap[file] = newName;
            }
        }
    }
    return { imagesDir, fileMap };
}

// 用流式方式移动大文件
async function moveFileStream(src: string, dst: string) {
    await pipelineAsync(
        fs.createReadStream(src),
        fs.createWriteStream(dst)
    );
    await fs.promises.unlink(src);
}

// 用流式方式计算文件hash，避免大文件占用内存
function hashFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.svg') {
            // 用流式方式读取SVG并处理，避免大文件占用内存
            let cleaned = '';
            const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
            stream.on('data', chunk => {
                cleaned += chunk;
            });
            stream.on('end', () => {
                cleaned = cleaned
                    .replace(/id="[^"]*"/g, '')
                    .replace(/xlink:href="[^"]*"/g, '')
                    .replace(/url\(#.*?\)/g, '')
                    .replace(/\s+/g, '');
                const hash = crypto.createHash('sha256').update(cleaned).digest('hex');
                resolve(hash);
            });
            stream.on('error', reject);
        } else {
            const hash = crypto.createHash('sha256');
            const stream = fs.createReadStream(filePath);
            stream.on('data', chunk => hash.update(chunk));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        }
    });
}

// 优化CSS移动与合并，采用异步API和流式追加
async function moveCss(folderPath: string, cssDirName: string, baseName: string) {
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
        // 如果目标已存在，采用流式追加
        if (fs.existsSync(newCssPath)) {
            const styleContent = await fs.promises.readFile(stylePath, 'utf-8');
            const cssContent = await fs.promises.readFile(newCssPath, 'utf-8');
            if (!cssContent.includes(styleContent)) {
                await fs.promises.appendFile(newCssPath, '\n' + styleContent);
            }
            await fs.promises.unlink(stylePath);
        } else {
            await moveFileStream(stylePath, newCssPath);
        }
    }
    return { newCssName, newCssPath };
}

// 优化HTML读写，采用异步API
async function processHtml(
    folderPath: string,
    baseName: string,
    imagesDirName: string,
    imageExts: string[],
    newCssName: string,
    cssDirName: string,
    baseHtmlName: string,
    fileMap: Record<string, string>
) {
    const htmlPath = path.join(folderPath, `${baseName}.html`);
    const baseHtmlPath = path.join(folderPath, baseHtmlName);
    if (!fs.existsSync(htmlPath) || !fs.existsSync(baseHtmlPath)) {
        vscode.window.showErrorMessage(nls.localize('refactorHtmlOrBaseMissing'));
        return;
    }
    let html = await fs.promises.readFile(htmlPath, 'utf-8');
    let baseHtml = await fs.promises.readFile(baseHtmlPath, 'utf-8');
    html = html.replace(/(<img[^>]*src=["'])([^"']+)(["'][^>]*>)/gi, (match, p1, src, p3) => {
        const ext = path.extname(src).toLowerCase();
        if (imageExts.includes(ext)) {
            const fileName = path.basename(src);
            const mappedName = fileMap[fileName] || (baseName + '_' + fileName);
            const newSrc = `${imagesDirName}/${baseName}/${mappedName}`;
            return p1 + newSrc + p3;
        }
        return match;
    });
    if (newCssName) {
        const cssHref = `${cssDirName}/${newCssName}`;
        baseHtml = baseHtml.replace(
            /(<\/head>)/i,
            `    <link rel="stylesheet" href="${cssHref}">\n$1`
        );
    }
    baseHtml = baseHtml.replace(/<!--\s*autohtml\s*-->/i, html);
    await fs.promises.writeFile(htmlPath, baseHtml, 'utf-8');
    const doc = await vscode.workspace.openTextDocument(htmlPath);
    await vscode.window.showTextDocument(doc, { preview: false });
}

// 优化解压，采用流式写入
async function extractZip(zipPath: string, folderPath: string) {
    await new Promise<void>((resolve, reject) => {
        fs.createReadStream(zipPath)
            .pipe(
                unzipper.Parse()
                    .on('entry', async (entry: unzipper.Entry) => {
                        const fileName = path.basename(entry.path);
                        if (/^(index\.html|vars\.css)$/i.test(fileName)) {
                            entry.autodrain();
                        } else {
                            const destPath = path.join(folderPath, entry.path);
                            // 确保目录存在
                            fs.mkdirSync(path.dirname(destPath), { recursive: true });
                            entry.pipe(fs.createWriteStream(destPath));
                        }
                    })
                    .on('close', resolve)
                    .on('error', reject)
            );
    });
}

// 其它辅助函数可保持原样或根据需要优化

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