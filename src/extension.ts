// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
// Import the parser and formatter
// Assuming latexAST.js exports parseLatex via module.exports
const { parseLatex } = require('./latexAST');
import { formatAST } from './latexFormatter';

/**
 * Checks for unbalanced pairs of characters (e.g., $, {}, []) in the text,
 * ignoring escaped characters.
 * @param text The text to check.
 * @param openChar The opening character (e.g., '{', '[', '$').
 * @param closeChar The closing character (e.g., '}', ']', '$').
 * @returns An object containing `isBalanced` (boolean) and a `message` (string).
 */
function checkBalance(text: string, openChar: string, closeChar: string): { isBalanced: boolean; message: string } {
  let balance = 0;
  let isEscaped = false; // Tracks if the *previous* character was an escape character

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const prevChar = i > 0 ? text[i - 1] : null;

    // Determine if the current character is escaped by the previous one
    // We only consider a single preceding backslash as escaping
    isEscaped = prevChar === '\\' && (i < 2 || text[i - 2] !== '\\');

    if (!isEscaped) {
      if (char === openChar) {
        // Handle the special case for single '$' acting as both open and close
        if (openChar === '$' && closeChar === '$') {
          balance++; // Treat every unescaped $ as incrementing/decrementing toggle
        } else {
          balance++;
        }
      } else if (char === closeChar) {
         // Handle the special case for single '$'
         if (openChar === '$' && closeChar === '$') {
           // Already handled by the openChar check, do nothing here for balance toggle
         } else {
            balance--;
         }
      }
    }

    // Check for closing character without a preceding opening one during iteration
    if (balance < 0 && !(openChar === '$' && closeChar === '$')) { // Ignore negative balance for '$' toggle
      return {
        isBalanced: false,
        // Updated message to English
        message: `Detected extra closing symbol '${closeChar}'.`,
      };
    }
  }

  // Final check: For '$', balance must be even. For others, must be zero.
  if (openChar === '$' && closeChar === '$') {
    if (balance % 2 !== 0) {
        // Updated message to English
        return { isBalanced: false, message: `Detected unbalanced '${openChar}' symbols.` };
    }
  } else if (balance !== 0) {
    return {
      isBalanced: false,
      // Updated message to English
      message: `Detected unbalanced '${openChar}${closeChar}' symbols.`,
    };
  }

  return { isBalanced: true, message: '' };
}


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
	  vscode.languages.registerDocumentFormattingEditProvider('latex', {
		provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
		  const originalText = document.getText();
		  let formattedText = '';
		  try {
			// Parse the LaTeX text using the parser to generate an AST
			const ast = parseLatex(originalText);
			// Generate formatted LaTeX text based on the AST
			formattedText = formatAST(ast);

			// --- Basic Error Checking ---
            const checks = [
                checkBalance(formattedText, '$', '$'),
                checkBalance(formattedText, '{', '}'),
                checkBalance(formattedText, '[', ']'),
            ];

            checks.forEach(result => {
                if (!result.isBalanced) {
                    // Show warning message (already updated in checkBalance)
                    vscode.window.showWarningMessage(result.message);
                }
            });
			// Add more checks here if needed

		  } catch (error: any) {
			// If parsing or formatting fails, show an error message
			// and return an empty array to avoid applying incorrect formatting.
            // Updated message to English
			vscode.window.showErrorMessage(`LaTeX formatting failed: ${error.message}`);
			console.error("LaTeX formatting error:", error);
			return []; // Return empty array to indicate failure
		  }

		  // Construct an edit operation to replace the entire document content
		  // Only apply formatting if parsing and formatting were successful
		  const fullRange = new vscode.Range(
			document.positionAt(0),
			document.positionAt(originalText.length)
		  );
		  return [vscode.TextEdit.replace(fullRange, formattedText)];
		}
	  })
	);
  }

// This method is called when your extension is deactivated
export function deactivate() {}
