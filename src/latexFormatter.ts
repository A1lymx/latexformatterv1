// src/latexFormatter.ts

/**
 * Format the entire AST and return the formatted LaTeX text.
 * @param ast The parsed AST object.
 */
export function formatAST(ast: any): string {
	// For the root Document node, format its children without extra indentation.
	return formatNode(ast, 0);
}

/**
 * Recursively format AST nodes.
 * @param node The current node.
 * @param indentLevel Current indentation level (root is 0).
 */
function formatNode(node: any, indentLevel: number): string {
	const indent = indentLevel > 0 ? "  ".repeat(indentLevel) : "";
	const nodeType = node.constructor.name;

	switch (nodeType) {
		case "Document":
			return node.children.map((child: any) => formatNode(child, 0)).join("");

		case "Text":
			if (node.escaped) {
				// The text is already escaped, return it directly
				return node.text;
			} else {
				return escapeSpecialChars(node.text);
			}

		case "Math":
		case "MathNode":
			if (node.inline) {
				return `$${node.content}$`;
			} else {
				return `$$\n${node.content}\n$$`;
			}

		// In latexFormatter.ts, update the Command case:
		case "Command":
			let cmdStr = `\\${node.name}`;
			if (node.optionalArgument) {
				cmdStr += `[${formatAST(node.optionalArgument)}]`;
			}
			if (node.requiredArguments && node.requiredArguments.length > 0) {
				for (const arg of node.requiredArguments) {
					// If it is an input or include command, use raw formatting
					if (node.name === "input" || node.name === "include") {
						cmdStr += `{${formatRawNode(arg)}}`;
					} else {
						cmdStr += `{${formatAST(arg)}}`;
					}
				}
			}
			return cmdStr;

		case "Environment":
			const mathEnvs = [
				"equation",
				"equation*",
				"align",
				"align*",
				"gather",
				"gather*",
				"multline",
				"multline*",
				"split",
				"array",
			];

			if (mathEnvs.includes(node.name)) {
				// Special handling for math environments: do not add extra newlines and indentation
				let envStr = `\\begin{${node.name}}`;
				envStr += node.children.map((child: any) => formatNode(child, 0)).join("");
				envStr += `\\end{${node.name}}`;
				return envStr;
			} else {
				let envStr = `${indent}\\begin{${node.name}}\n`;
				envStr += node.children.map((child: any) => formatNode(child, indentLevel + 1)).join("");
				envStr += `\n${indent}\\end{${node.name}}`;
				return envStr;
			}

		default:
			return "";
	}
}

function formatRawNode(node: any): string {
	const nodeType = node.constructor.name;
	switch (nodeType) {
		case "Document":
			return node.children.map((child: any) => formatRawNode(child)).join("");
		case "Text":
			// Directly return the raw text without escaping
			return node.text;
		case "Math":
		case "MathNode":
			if (node.inline) {
				return `$${node.content}$`;
			} else {
				return `$$\n${node.content}\n$$`;
			}
		case "Command":
			let cmdStr = `\\${node.name}`;
			if (node.optionalArgument) {
				// Format optional arguments as usual (usually optional arguments do not contain filenames)
				cmdStr += `[${formatAST(node.optionalArgument)}]`;
			}
			if (node.requiredArguments && node.requiredArguments.length > 0) {
				for (const arg of node.requiredArguments) {
					cmdStr += `{${formatRawNode(arg)}}`;
				}
			}
			return cmdStr;
		case "Environment":
			let envStr =
				`\\begin{${node.name}}\n` +
				node.children.map((child: any) => formatRawNode(child)).join("") +
				`\n\\end{${node.name}}`;
			return envStr;
		default:
			return "";
	}
}

/**
 * Escape special LaTeX characters in a text string while preserving comments.
 * For each line, if a comment marker "%" appears unescaped,
 * only the text before it is processed for special character escaping.
 * Lines that start with "%" (after trimming) are left unchanged.
 * @param text The input text.
 */
function escapeSpecialChars(text: string): string {
	return text
		.split("\n")
		.map((line) => {
			// 判断去除前导空白后是否以 "%" 开头，若是，则认为整行为注释，保持原样返回。
			if (line.trimStart().startsWith("%")) {
				return line;
			}
			// 查找行中第一个未转义的 "%"，视为注释起始位置。
			const idx = findFirstUnescapedPercent(line);
			if (idx !== -1) {
				const before = line.slice(0, idx);
				const comment = line.slice(idx); // 包含 "%" 及后续内容
				return escapeNonComment(before) + comment;
			} else {
				return escapeNonComment(line);
			}
		})
		.join("\n");
}

/**
 * Helper: 查找一行中第一个未被反斜杠转义的 "%" 的位置
 * @param line 输入行
 */
function findFirstUnescapedPercent(line: string): number {
	for (let i = 0; i < line.length; i++) {
		if (line[i] === "%") {
			if (i === 0 || line[i - 1] !== "\\") {
				return i;
			}
		}
	}
	return -1;
}

/**
 * Helper: 对非注释部分的文本转义特殊字符，不处理 "%"（因为已在上层处理）。
 * @param text 输入文本
 */
function escapeNonComment(text: string): string {
	// 转义除 "%" 和 "~" 外的特殊字符： # $ & _ ^ { }
	let escaped = text.replace(/([#$&_^{}])/g, "\\$1");
	// 对 "%" 进行单独转义
	escaped = escaped.replace(/%/g, "\\%");
	return escaped;
}
