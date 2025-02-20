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
		  // Parse the LaTeX text using the parser to generate an AST
		  const ast = parseLatex(text);
		  // Generate formatted LaTeX text based on the AST
		  const formattedText = formatAST(ast);
		  // Construct an edit operation to replace the entire document content
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
