import * as vscode from 'vscode';
import * as nls from 'vscode-nls-i18n';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import * as unzipper from 'unzipper';

const DOWNLOAD_HISTORY_KEY = 'vs-ex-autohtml.downloadHistory';

export async function getTheTemplate(context: vscode.ExtensionContext, uri?: vscode.Uri) {
    const history: string[] = context.globalState.get<string[]>(DOWNLOAD_HISTORY_KEY, []);
    let localHistory: string[] = context.globalState.get<string[]>(DOWNLOAD_HISTORY_KEY + '.local', []);
    let remoteHistory: string[] = context.globalState.get<string[]>(DOWNLOAD_HISTORY_KEY + '.remote', []);
    let finalUrl: string | undefined;
    let isLocal = false;
    const pick = await vscode.window.showQuickPick([
        { label: nls.localize('getTemplateFromLocal'), description: nls.localize('getTemplateFromLocalDesc') },
        { label: nls.localize('getTemplateFromUrl'), description: nls.localize('getTemplateFromUrlDesc') }
        
    ], {
        placeHolder: nls.localize('chooseTemplateSource'),
        ignoreFocusOut: true
    });
    if (!pick) return;
    if (pick.label === nls.localize('getTemplateFromLocal')) {
        if (localHistory.length > 0) {
            const localPick = await vscode.window.showQuickPick([
                ...localHistory.map(h => ({
                    label: path.basename(h),
                    description: nls.localize('localHistoryTip'),
                    detail: h
                })),
                { label: nls.localize('selectLocalFolder'), description: nls.localize('selectLocalFolderDesc') },
                { label: nls.localize('deleteLocalHistory'), description: nls.localize('deleteLocalHistoryDesc') }
            ], {
                placeHolder: nls.localize('chooseLocalHistoryOrSelect'),
                ignoreFocusOut: true
            });
            if (!localPick) return;
            if (localPick.label === nls.localize('selectLocalFolder')) {
                const folders = await vscode.window.showOpenDialog({
                    canSelectFolders: true,
                    canSelectFiles: false,
                    canSelectMany: false,
                    openLabel: nls.localize('selectLocalFolder')
                });
                if (!folders || folders.length === 0) return;
                finalUrl = folders[0].fsPath;
                isLocal = true;
                // 增加本地文件夹历史记录
                const newLocalHistory = [finalUrl, ...localHistory.filter(u => u !== finalUrl)].slice(0, 10);
                context.globalState.update(DOWNLOAD_HISTORY_KEY + '.local', newLocalHistory);
            } else if (localPick.label === nls.localize('deleteLocalHistory')) {
                const delPick = await vscode.window.showQuickPick(localHistory, {
                    placeHolder: nls.localize('selectDeleteLocalHistory'),
                    ignoreFocusOut: true
                });
                if (delPick) {
                    const newLocalHistory = localHistory.filter(u => u !== delPick);
                    await context.globalState.update(DOWNLOAD_HISTORY_KEY + '.local', newLocalHistory);
                    vscode.window.showInformationMessage(nls.localize('deleteSuccess'));
                }
                return;
            } else {
                // 选择历史，需通过 detail 还原真实路径
                const picked = localHistory.find(h => path.basename(h) === localPick.label) || localPick.label;
                finalUrl = picked;
                isLocal = true;
            }
        } else {
            const folders = await vscode.window.showOpenDialog({
                canSelectFolders: true,
                canSelectFiles: false,
                canSelectMany: false,
                openLabel: nls.localize('selectLocalFolder')
            });
            if (!folders || folders.length === 0) return;
            finalUrl = folders[0].fsPath;
            isLocal = true;
            // 增加本地文件夹历史记录
            const newLocalHistory = [finalUrl, ...localHistory.filter(u => u !== finalUrl)].slice(0, 10);
            context.globalState.update(DOWNLOAD_HISTORY_KEY + '.local', newLocalHistory);
        }
    } else if (pick.label === nls.localize('getTemplateFromUrl')) {
        if (remoteHistory.length > 0) {
            const urlPick = await vscode.window.showQuickPick([
                ...remoteHistory.map(h => ({
                    label: path.basename(h),
                    description: nls.localize('deleteTip'),
                    detail: h
                })),
                { label: nls.localize('inputNewUrl'), description: nls.localize('inputDownloadUrl') },
                { label: nls.localize('deleteHistory'), description: nls.localize('deleteHistoryDesc') }
            ], {
                placeHolder: nls.localize('inputDownloadUrl'),
                ignoreFocusOut: true
            });
            if (!urlPick) return;
            if (urlPick.label === nls.localize('inputNewUrl')) {
                finalUrl = await vscode.window.showInputBox({
                    prompt: nls.localize('inputDownloadUrl'),
                    ignoreFocusOut: true
                });
            } else if (urlPick.label === nls.localize('deleteHistory')) {
                const delPick = await vscode.window.showQuickPick(remoteHistory, {
                    placeHolder: nls.localize('selectDeleteHistory'),
                    ignoreFocusOut: true
                });
                if (delPick) {
                    const newRemoteHistory = remoteHistory.filter(u => u !== delPick);
                    await context.globalState.update(DOWNLOAD_HISTORY_KEY + '.remote', newRemoteHistory);
                    vscode.window.showInformationMessage(nls.localize('deleteSuccess'));
                }
                return;
            } else {
                // 选择历史，需通过 detail 还原真实链接
                const picked = remoteHistory.find(h => path.basename(h) === urlPick.label) || urlPick.label;
                finalUrl = picked;
            }
        } else {
            finalUrl = await vscode.window.showInputBox({
                prompt: nls.localize('inputDownloadUrl'),
                ignoreFocusOut: true
            });
        }
        if (!finalUrl) return;
        const newRemoteHistory = [finalUrl, ...remoteHistory.filter(u => u !== finalUrl)].slice(0, 10);
        context.globalState.update(DOWNLOAD_HISTORY_KEY + '.remote', newRemoteHistory);
    }
    let folderPath = uri?.fsPath;
    if (!folderPath || !fs.lstatSync(folderPath).isDirectory()) {
        folderPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    }
    if (isLocal) {
        const config = vscode.workspace.getConfiguration('autohtml');
        const ignorePattern = config.get<string>('m01.ignore', '');
        const regex = ignorePattern ? new RegExp(ignorePattern) : undefined;
        const dest = path.join(folderPath, "");
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: nls.localize('copyingTemplate') }, async () => {
            await copyFolder(finalUrl!, dest, regex);
        });
        vscode.window.showInformationMessage(nls.localize('copyTemplateSuccess', dest));
    } else {
        try {
            const fileName = path.basename(finalUrl!.split('?')[0]);
            const dest = path.join(folderPath, fileName);
            await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: nls.localize('downloading') }, async () => {
            await downloadFile(finalUrl!, dest);
            });
            // 下载后自动解压 zip
            if (/\.(zip)$/i.test(fileName)) {
                await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: nls.localize('extracting') }, async () => {
                    await fs.createReadStream(dest)
                        .pipe(unzipper.Extract({ path: folderPath }))
                        .promise();
                });
                // 检查解压后是否只有一个同名文件夹
                const baseName = fileName.replace(/\.zip$/i, '');
                const extractedPath = path.join(folderPath, baseName);
                if (fs.existsSync(extractedPath) && fs.lstatSync(extractedPath).isDirectory()) {
                    const files = fs.readdirSync(extractedPath);
                    for (const f of files) {
                        const src = path.join(extractedPath, f);
                        const dst = path.join(folderPath, f);
                        fs.renameSync(src, dst);
                    }
                    // 删除空文件夹
                    fs.rmdirSync(extractedPath);
                }
                // 删除压缩包
                fs.unlinkSync(dest);
                vscode.window.showInformationMessage(nls.localize('extractSuccess', folderPath));
            } else {
                vscode.window.showInformationMessage(nls.localize('downloadSuccess', dest));
            }
        } catch (err: any) {
            vscode.window.showErrorMessage(nls.localize('downloadOrExtractError', err?.message || String(err)));
        }
    }
}

export async function downloadFile(url: string, dest: string): Promise<void> {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`下载失败: ${res.status} ${res.statusText}`);
    }
    const fileStream = fs.createWriteStream(dest);
    await new Promise<void>((resolve, reject) => {
        res.body.pipe(fileStream);
        res.body.on('error', reject);
        fileStream.on('finish', () => resolve());
    });
}

export async function copyFolder(src: string, dest: string, ignorePattern?: RegExp) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest);
    }
    for (const file of fs.readdirSync(src)) {
        if (ignorePattern && ignorePattern.test(file)) {
            continue;
        }
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);
        if (fs.lstatSync(srcPath).isDirectory()) {
            await copyFolder(srcPath, destPath, ignorePattern);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}
