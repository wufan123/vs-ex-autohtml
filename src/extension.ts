import * as vscode from 'vscode';
import * as nls from 'vscode-nls-i18n';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

const DOWNLOAD_HISTORY_KEY = 'vs-ex-autohtml.downloadHistory';

export function activate(context: vscode.ExtensionContext) {
	nls.init(context.extensionPath);
	const disposable = vscode.commands.registerCommand('vs-ex-autohtml.helloWorld', () => {
		vscode.window.showInformationMessage(nls.localize('helloWorld'));
	});
	context.subscriptions.push(disposable);
	const downloadCmd = vscode.commands.registerCommand('vs-ex-autohtml.downloadFile', async (uri?: vscode.Uri) => {
		const history: string[] = context.globalState.get<string[]>(DOWNLOAD_HISTORY_KEY, []);
		let finalUrl: string | undefined;
		if (history.length > 0) {
			const pick = await vscode.window.showQuickPick([
				...history.map(h => ({ label: h, description: nls.localize('deleteTip') })),
				{ label: nls.localize('inputNewUrl'), description: nls.localize('inputDownloadUrl') },
				{ label: nls.localize('deleteHistory'), description: nls.localize('deleteHistoryDesc') }
			], {
				placeHolder: nls.localize('inputDownloadUrl'),
				ignoreFocusOut: true
			});
			if (!pick) return;
			if (pick.label === nls.localize('inputNewUrl')) {
				finalUrl = await vscode.window.showInputBox({
					prompt: nls.localize('inputDownloadUrl'),
					ignoreFocusOut: true
				});
			} else if (pick.label === nls.localize('deleteHistory')) {
				const delPick = await vscode.window.showQuickPick(history, {
					placeHolder: nls.localize('selectDeleteHistory'),
					ignoreFocusOut: true
				});
				if (delPick) {
					const newHistory = history.filter(u => u !== delPick);
					await context.globalState.update(DOWNLOAD_HISTORY_KEY, newHistory);
					vscode.window.showInformationMessage(nls.localize('deleteSuccess'));
				}
				return;
			} else {
				finalUrl = pick.label;
			}
		} else {
			finalUrl = await vscode.window.showInputBox({
				prompt: nls.localize('inputDownloadUrl'),
				ignoreFocusOut: true
			});
		}
		if (!finalUrl) {
			return;
		}
		// 记录历史，去重并按最近使用排序
		const newHistory = [finalUrl, ...history.filter(u => u !== finalUrl)].slice(0, 10);
		context.globalState.update(DOWNLOAD_HISTORY_KEY, newHistory);
		let folderPath = uri?.fsPath;
		if (!folderPath || !fs.lstatSync(folderPath).isDirectory()) {
			folderPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
		}
		const fileName = path.basename(finalUrl.split('?')[0]);
		const dest = path.join(folderPath, fileName);
		vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: nls.localize('downloading') }, async () => {
			try {
				await downloadFile(finalUrl!, dest);
				vscode.window.showInformationMessage(nls.localize('downloadSuccess', dest));
			} catch (e: any) {
				vscode.window.showErrorMessage(nls.localize('downloadFail', e.message));
			}
		});
	});
	context.subscriptions.push(downloadCmd);
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

export function deactivate() { }
