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
    // const pick = await vscode.window.showQuickPick([
    //     { label: nls.localize('getTemplateFromLocal'), description: nls.localize('getTemplateFromLocalDesc') },
    //     { label: nls.localize('getTemplateFromUrl'), description: nls.localize('getTemplateFromUrlDesc') }

    // ], {
    //     placeHolder: nls.localize('chooseTemplateSource'),
    //     ignoreFocusOut: true
    // });
    // if (!pick) return;
    // if (pick.label === nls.localize('getTemplateFromLocal')) {
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
    let folderPath = uri?.fsPath;
    if (!folderPath || !fs.lstatSync(folderPath).isDirectory()) {
        folderPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    }
    const config = vscode.workspace.getConfiguration('autohtml');
    const ignorePattern = config.get<string>('m01.ignore', '');
    const regex = ignorePattern ? new RegExp(ignorePattern) : undefined;
    const dest = path.join(folderPath, "");
    if (fs.existsSync(dest) && fs.readdirSync(dest).length > 0) {
        const overwrite = await vscode.window.showQuickPick(
            [
                { label: nls.localize('yes'), description: nls.localize('overwriteYes') },
                { label: nls.localize('no'), description: nls.localize('overwriteNo') }
            ],
            {
                placeHolder: nls.localize('destNotEmptyOverwrite'),
                ignoreFocusOut: true
            }
        );
        if (!overwrite || overwrite.label !== nls.localize('yes')) {
            vscode.window.showInformationMessage(nls.localize('copyCancelled'));
            return;
        }
    }
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: nls.localize('copyingTemplate') }, async () => {
        await copyFolder(finalUrl!, dest, regex);
    });
    vscode.window.showInformationMessage(nls.localize('copyTemplateSuccess', dest));
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
