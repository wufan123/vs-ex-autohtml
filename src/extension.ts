import * as vscode from 'vscode';
import * as nls from 'vscode-nls-i18n';
import { getTheTemplate } from './templateHelper';
import { refactor } from './refactorHelper';

const DOWNLOAD_HISTORY_KEY = 'vs-ex-autohtml.downloadHistory';

export function activate(context: vscode.ExtensionContext) {
	nls.init(context.extensionPath);
	const getTheTemplateCmd = vscode.commands.registerCommand('vs-ex-autohtml.getTheTemplate', async (uri?: vscode.Uri) => {
		await getTheTemplate(context, uri);
	});
	context.subscriptions.push(getTheTemplateCmd);
	const refactorCmd = vscode.commands.registerCommand('vs-ex-autohtml.refactor', async (uri?: vscode.Uri) => {
		await refactor(context, uri);
	});
	context.subscriptions.push(refactorCmd);
}

export function deactivate() { }
