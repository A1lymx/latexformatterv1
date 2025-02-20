// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
//import { parseLatex } from './latexAST';
const { parseLatex } = require('./latexAST');
import { formatAST } from './latexFormatter';
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
	  vscode.languages.registerDocumentFormattingEditProvider('latex', {
		provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
		  const text = document.getText();
		  // 使用解析器解析 LaTeX 文本，生成 AST
		  const ast = parseLatex(text);
		  // 基于 AST 生成格式化后的 LaTeX 文本
		  const formattedText = formatAST(ast);
		  // 构造替换整个文档内容的编辑操作
		  const fullRange = new vscode.Range(
			document.positionAt(0),
			document.positionAt(text.length)
		  );
		  return [vscode.TextEdit.replace(fullRange, formattedText)];
		}
	  })
	);
  }

// This method is called when your extension is deactivated
export function deactivate() {}
