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
	// Handle cases where node might be null or undefined, although ideally the parser shouldn't produce them in the main tree.
	if (!node || !node.constructor) {
		// console.warn("[Formatter] Encountered null or invalid node.");
		return "";
	}
	const nodeType = node.constructor.name;

    // List of commands whose arguments (both optional and required) should generally be treated as raw text
    // and not have special characters like '_' escaped.
    const rawArgumentCommands = [
        "input", "include", "includegraphics",
        "label", "ref", "eqref", "cite", "bibitem",
        "url", "href" // For href, only the first argument (URL) is typically raw. This is a simplification.
    ];

	switch (nodeType) {
		case "Document":
            // Ensure children is an array before mapping
            if (!Array.isArray(node.children)) return "";
			return node.children.map((child: any) => formatNode(child, indentLevel)).join(""); // Pass indentLevel for children of document if needed for top-level items

		case "Text":
			if (node.escaped) {
				// The text is already escaped (e.g., \\$, \\%) or is from a math environment, return it directly
				return node.text || ""; // Ensure text exists
			} else {
				return escapeSpecialChars(node.text || ""); // Ensure text exists
			}

		case "Math":
		case "MathNode": // Ensure both constructor names are handled if they differ
            const content = node.content || ""; // Ensure content exists
			if (node.inline) {
				return `$${content}$`;
			} else {
				// For display math, ensure content is trimmed and newlines are consistent
                const trimmedContent = content.trim();
				return `$$\n${indent}${trimmedContent}\n${indent}$$`; // Indent content of display math if desired, or keep as is
			}

		case "Command":
			let cmdStr = `\\${node.name || 'unknownCommand'}`; // Ensure name exists
			if (node.optionalArgument) {
                if (rawArgumentCommands.includes(node.name)) {
                    cmdStr += `[${formatRawNode(node.optionalArgument)}]`;
                } else {
				    cmdStr += `[${formatAST(node.optionalArgument)}]`;
                }
			}
			if (node.requiredArguments && Array.isArray(node.requiredArguments) && node.requiredArguments.length > 0) {
				for (const arg of node.requiredArguments) {
                    if (!arg) continue; // Skip null/undefined arguments
					if (rawArgumentCommands.includes(node.name)) {
                        // Special case for \href{URL}{TEXT} - URL is raw, TEXT is formatted
                        if (node.name === "href" && node.requiredArguments.indexOf(arg) === 1) {
                            cmdStr += `{${formatAST(arg)}}`; // Second argument of \href is formatted
                        } else {
                            cmdStr += `{${formatRawNode(arg)}}`;
                        }
					} else {
						cmdStr += `{${formatAST(arg)}}`;
					}
				}
			}
			return cmdStr;

		case "Environment":
			const mathEnvs = [
				"equation", "equation*", "align", "align*", "gather", "gather*",
				"multline", "multline*", "split", "array", "subequations"
			];

			const currentEnvName = (node.name || 'unknownEnv').trim(); // Ensure name exists and trim
            let envBeginStr = `${indent}\\begin{${currentEnvName}}`;

            // --- Format Environment Arguments ---
            if (node.environmentArguments && Array.isArray(node.environmentArguments) && node.environmentArguments.length > 0) {
                // Assume environment arguments (like {13} in thebibliography) should be treated as raw.
                for (const arg of node.environmentArguments) {
                    if (!arg) continue; // Skip null/undefined arguments
                    envBeginStr += `{${formatRawNode(arg)}}`; // Use formatRawNode
                }
            }
            // --- End Format Environment Arguments ---

            // Ensure children is an array
            const childrenToFormat = Array.isArray(node.children) ? node.children : [];

			if (mathEnvs.includes(currentEnvName)) {
				let envStr = envBeginStr; // Start with the \begin{...}{...} string
                // Math content is often a single Text node marked as 'escaped' or pre-formatted
				envStr += childrenToFormat.map((child: any) => formatRawNode(child)).join(""); // Use formatRawNode for math content
				envStr += `\\end{${currentEnvName}}`;
				return envStr;
			} else {
				let envStr = envBeginStr + "\n"; // Add newline after \begin{...}{...}
				envStr += childrenToFormat.map((child: any) => formatNode(child, indentLevel + 1)).join(""); // Indent children
				envStr += `\n${indent}\\end{${currentEnvName}}`;
				return envStr;
			}

		default:
			// console.warn(`[Formatter] Unknown node type: ${nodeType}`);
			return ""; // Or handle unknown nodes more gracefully
	}
}

/**
 * Formats a node as "raw" text, meaning its Text children are output directly
 * without further escaping. This is useful for file paths, labels, URLs etc.
 * @param node The AST node (typically a Document node representing an argument).
 */
function formatRawNode(node: any): string {
    if (!node || !node.constructor) return "";
	const nodeType = node.constructor.name;
	switch (nodeType) {
		case "Document":
            if (!Array.isArray(node.children)) return "";
			return node.children.map((child: any) => formatRawNode(child)).join("");
		case "Text":
			// Directly return the raw text without escaping
			return node.text || "";
		case "Math":
        case "MathNode":
            const mathContent = node.content || "";
			if (node.inline) {
				return `$${mathContent}$`;
			} else {
                const trimmedContent = mathContent.trim();
				return `$$\n${trimmedContent}\n$$`;
			}
		case "Command": // Commands within raw arguments should still be formatted as commands
			let cmdStr = `\\${node.name || 'unknownCmd'}`;
			if (node.optionalArgument) {
				cmdStr += `[${formatRawNode(node.optionalArgument)}]`;
			}
			if (node.requiredArguments && Array.isArray(node.requiredArguments) && node.requiredArguments.length > 0) {
				for (const arg of node.requiredArguments) {
                    if (!arg) continue;
					cmdStr += `{${formatRawNode(arg)}}`;
				}
			}
			return cmdStr;
		case "Environment": // Environments within raw arguments
            const childrenToFormatRaw = Array.isArray(node.children) ? node.children : [];
			let envStr = `\\begin{${node.name || 'unknownEnv'}}\n` + // Basic formatting for environments
				childrenToFormatRaw.map((child: any) => formatRawNode(child)).join("") +
				`\n\\end{${node.name || 'unknownEnv'}}`;
			return envStr;
		default:
            // console.warn(`[Formatter - Raw] Unknown node type: ${nodeType}`);
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
	if (text === null || typeof text === 'undefined') {
		return "";
	}
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
    // 注意：这里仍然会转义下划线 `_`。
    // 对于 \label 等命令，我们通过 formatRawNode 绕过了这个函数。
	let escaped = text.replace(/([#$&_^{}])/g, "\\$1");
	// 对 "%" 进行单独转义 (如果它不是行注释的一部分)
    // escaped = escaped.replace(/%/g, "\\%"); // 这个逻辑在 escapeSpecialChars 中通过 findFirstUnescapedPercent 处理了
	return escaped;
}
