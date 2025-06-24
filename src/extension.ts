import * as vscode from 'vscode';
import * as nls from 'vscode-nls-i18n';
import { getTheTemplate } from './templateHelper';
import { refactorPage, refactorModule } from './refactorHelper';

const DOWNLOAD_HISTORY_KEY = 'vs-ex-autohtml.downloadHistory';

export function activate(context: vscode.ExtensionContext) {
	nls.init(context.extensionPath);
	const getTheTemplateCmd = vscode.commands.registerCommand('vs-ex-autohtml.getTheTemplate', async (uri?: vscode.Uri) => {
		await getTheTemplate(context, uri);
	});
	context.subscriptions.push(getTheTemplateCmd);
	const refactorPageCmd = vscode.commands.registerCommand('vs-ex-autohtml.refactorPage', async (uri?: vscode.Uri) => {
		await refactorPage(context, uri);
	});
	context.subscriptions.push(refactorPageCmd);
	const refactorModuleCmd = vscode.commands.registerCommand('vs-ex-autohtml.refactorModule', async (uri?: vscode.Uri) => {
		await refactorModule(context, uri);
	});
	context.subscriptions.push(refactorModuleCmd);
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
}

export function deactivate() { }
