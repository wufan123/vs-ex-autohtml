import * as vscode from 'vscode';
import * as nls from 'vscode-nls-i18n';
import { getTheTemplate } from './templateHelper';
import { refactor, refactorPage, refactorModule, refactorResources } from './refactorHelper';

const DOWNLOAD_HISTORY_KEY = 'vs-ex-autohtml.downloadHistory';

export function activate(context: vscode.ExtensionContext) {
	nls.init(context.extensionPath);
	// 获取模板
	const getTheTemplateCmd = vscode.commands.registerCommand('vs-ex-autohtml.getTheTemplate', async (uri?: vscode.Uri) => {
		await getTheTemplate(context, uri);
	});
	context.subscriptions.push(getTheTemplateCmd);
	// 重构
	const refactorPageCmd = vscode.commands.registerCommand('vs-ex-autohtml.refactor', async (uri?: vscode.Uri) => {
		refactor(context, uri);
	});
	context.subscriptions.push(refactorPageCmd);
	// // 重构页面
	// const refactorPageCmd = vscode.commands.registerCommand('vs-ex-autohtml.refactorPage', async (uri?: vscode.Uri) => {
	// 	await refactorPage(context, uri);
	// });
	// context.subscriptions.push(refactorPageCmd);
	// // 重构模块
	// const refactorModuleCmd = vscode.commands.registerCommand('vs-ex-autohtml.refactorModule', async (uri?: vscode.Uri) => {
	// 	await refactorModule(context, uri);
	// });
	// context.subscriptions.push(refactorModuleCmd);
	// 重构资源
	const refactorResourcesCmd = vscode.commands.registerCommand('vs-ex-autohtml.refactorResources', async (uri?: vscode.Uri) => {
		await refactorResources(context, uri);
	});
	context.subscriptions.push(refactorResourcesCmd);
	// 插入注释
	const insertAutoHtmlCmd = vscode.commands.registerCommand('vs-ex-autohtml.insertAutoHtmlComment', async () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const position = editor.selection.active;
			await editor.edit(editBuilder => {
				editBuilder.insert(position, '<!-- AUTOHTML -->');
			});
		}
	});
	context.subscriptions.push(insertAutoHtmlCmd);

	// img 转成div背景
	const img2div = vscode.commands.registerCommand('vs-ex-autohtml.img2bg', async () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const position = editor.selection.active;
			await editor.edit(editBuilder => {
				editBuilder.insert(position, '<!-- AUTOHTML -->');
			});
		}
	});
	context.subscriptions.push(insertAutoHtmlCmd);
}

export function deactivate() { }
