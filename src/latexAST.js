// --- Define Token Types ---
const TOKEN_COMMAND = "COMMAND";
const TOKEN_TEXT = "TEXT";
const TOKEN_LBRACE = "LBRACE";
const TOKEN_RBRACE = "RBRACE";
const TOKEN_LBRACKET = "LBRACKET";
const TOKEN_RBRACKET = "RBRACKET";
const TOKEN_EOF = "EOF";
const TOKEN_MATH_INLINE = "MATH_INLINE";
const TOKEN_MATH_DISPLAY = "MATH_DISPLAY";

// --- Token Class ---
class Token {
	constructor(type, value) {
		this.type = type;
		this.value = value;
	}
	toString() {
		return `Token(${this.type}, ${JSON.stringify(this.value)})`;
	}
}

// --- Lexer ---
class Lexer {
	constructor(text) {
		this.text = text;
		this.pos = 0;
	}

	getNextToken() {
		// If reached the end of the text, return EOF
		if (this.pos >= this.text.length) {
			const token = new Token(TOKEN_EOF, null);
			console.log(`[DEBUG][Lexer] pos=${this.pos}: ${token.toString()}`);
			return token;
		}

		const current = this.text[this.pos];

		// Process math formulas starting with '$'
		if (current === "$") {
			// Check if it's a display math formula: two consecutive '$'
			if (this.pos + 1 < this.text.length && this.text[this.pos + 1] === "$") {
				this.pos += 2; // Consume the starting "$$"
				const start = this.pos;
				// Accumulate until encountering the ending "$$"
				while (
					this.pos < this.text.length &&
					!(this.text[this.pos] === "$" && this.pos + 1 < this.text.length && this.text[this.pos + 1] === "$")
				) {
					this.pos++;
				}
				const content = this.text.slice(start, this.pos);
				if (this.pos < this.text.length) {
					this.pos += 2; // Consume the ending "$$"
				}
				const token = new Token(TOKEN_MATH_DISPLAY, content);
				console.log(`[DEBUG][Lexer] pos=${this.pos}: ${token.toString()}`);
				return token;
			} else {
				// Inline math formula: single '$'
				this.pos++; // Consume the starting '$'
				const start = this.pos;
				while (this.pos < this.text.length && this.text[this.pos] !== "$") {
					this.pos++;
				}
				const content = this.text.slice(start, this.pos);
				if (this.pos < this.text.length) {
					this.pos++; // Consume the ending '$'
				}
				const token = new Token(TOKEN_MATH_INLINE, content);
				console.log(`[DEBUG][Lexer] pos=${this.pos}: ${token.toString()}`);
				return token;
			}
		}

		// Process commands or escape sequences starting with '\'
		if (current === "\\") {
			// Look ahead: if next character is a letter, treat as command.
			if (this.pos + 1 < this.text.length && /[a-zA-Z]/.test(this.text[this.pos + 1])) {
				this.pos++; // Consume the backslash
				const start = this.pos;
				while (this.pos < this.text.length && /[a-zA-Z]/.test(this.text[this.pos])) {
					this.pos++;
				}
				const cmd = this.text.slice(start, this.pos);
				const token = new Token(TOKEN_COMMAND, cmd);
				console.log(`[DEBUG][Lexer] pos=${this.pos}: ${token.toString()}`);
				return token;
			} else {
				// Escape sequence: consume '\' and the next character,
				// return a TEXT token that preserves the backslash.
				this.pos++; // Consume '\'
				const escapedChar = this.text[this.pos];
				this.pos++; // Consume the escaped character
				const token = new Token(TOKEN_TEXT, "\\" + escapedChar);
				token.escaped = true; // 标记该 token 来自转义
				console.log(`[DEBUG][Lexer] pos=${this.pos}: ${token.toString()} (escaped)`);
				return token;
			}
		}

		// Process left brace '{'
		if (current === "{") {
			this.pos++;
			const token = new Token(TOKEN_LBRACE, "{");
			console.log(`[DEBUG][Lexer] pos=${this.pos}: ${token.toString()}`);
			return token;
		}

		// Process right brace '}'
		if (current === "}") {
			this.pos++;
			const token = new Token(TOKEN_RBRACE, "}");
			console.log(`[DEBUG][Lexer] pos=${this.pos}: ${token.toString()}`);
			return token;
		}

		// Process left bracket '['
		if (current === "[") {
			this.pos++;
			const token = new Token(TOKEN_LBRACKET, "[");
			console.log(`[DEBUG][Lexer] pos=${this.pos}: ${token.toString()}`);
			return token;
		}

		// Process right bracket ']'
		if (current === "]") {
			this.pos++;
			const token = new Token(TOKEN_RBRACKET, "]");
			console.log(`[DEBUG][Lexer] pos=${this.pos}: ${token.toString()}`);
			return token;
		}

		// Process plain text until encountering a special character: '\', '{', '}', '[', ']', or '$'
		const start = this.pos;
		while (this.pos < this.text.length && !["\\", "{", "}", "[", "]", "$"].includes(this.text[this.pos])) {
			this.pos++;
		}
		const text_val = this.text.slice(start, this.pos);
		const token = new Token(TOKEN_TEXT, text_val);
		console.log(`[DEBUG][Lexer] pos=${this.pos}: ${token.toString()}`);
		return token;
	}
}

// --- AST Node Definitions ---
class Document {
	constructor(children) {
		this.children = children;
	}
	toString() {
		return `Document(${this.children.map((child) => child.toString()).join(", ")})`;
	}
}

class Text {
	constructor(text, escaped = false) {
		this.text = text;
		this.escaped = escaped;
	}
	toString() {
		return `Text(${JSON.stringify(this.text)})`;
	}
}

// Updated Command AST node to support an optional argument.
class Command {
	constructor(name, optionalArgument = null, requiredArguments = []) {
		this.name = name;
		this.optionalArgument = optionalArgument; // Now a Document node
		this.requiredArguments = requiredArguments; // Array of Document nodes
	}
	toString() {
		let argsStr = "";
		if (this.optionalArgument) {
			argsStr += `[${this.optionalArgument.toString()}]`;
		}
		for (const arg of this.requiredArguments) {
			argsStr += `{${arg.toString()}}`;
		}
		return `Command(name=${JSON.stringify(this.name)}, arguments=${JSON.stringify(argsStr)})`;
	}
}

class Environment {
	constructor(name, children) {
		this.name = name;
		this.children = children;
	}
	toString() {
		return `Environment(name=${JSON.stringify(this.name)}, children=[${this.children.map((child) => child.toString()).join(", ")}])`;
	}
}

// Since 'Math' is reserved in JavaScript, we use 'MathNode' instead.
class MathNode {
	constructor(content, inline = true) {
		this.content = content;
		this.inline = inline; // true indicates inline math, false indicates display math
	}
	toString() {
		return `Math(inline=${this.inline}, content=${JSON.stringify(this.content)})`;
	}
}

// --- Parser ---
class Parser {
	constructor(lexer) {
		this.lexer = lexer;
		this.currentToken = this.lexer.getNextToken();
		console.log(`[DEBUG][Parser] Initial token: ${this.currentToken.toString()}`);
	}

	eat(tokenType) {
		if (this.currentToken.type === tokenType) {
			console.log(`[DEBUG][Parser] Consuming token: ${this.currentToken.toString()}`);
			this.currentToken = this.lexer.getNextToken();
			console.log(`[DEBUG][Parser] Next token: ${this.currentToken.toString()}`);
		} else {
			throw new Error(`Syntax error: expected ${tokenType}, got ${this.currentToken.type}`);
		}
	}

	parse() {
		const nodes = [];
		let iteration = 0;
		while (this.currentToken.type !== TOKEN_EOF) {
			iteration++;
			console.log(
				`[DEBUG][Parser] parse() loop iteration ${iteration}, current token: ${this.currentToken.toString()}`
			);
			const node = this.parseElement();
			// When parseElement returns null, force consumption of the token to avoid an infinite loop
			if (node !== null) {
				nodes.push(node);
			} else {
				if (this.currentToken.type !== TOKEN_EOF) {
					console.log(
						`[DEBUG][Parser] parseElement returned null, force consuming token: ${this.currentToken.toString()}`
					);
					this.eat(this.currentToken.type);
				}
			}
		}
		return new Document(nodes);
	}

	parseElement() {
		console.log(`[DEBUG][Parser] parseElement, current token: ${this.currentToken.toString()}`);
		const token = this.currentToken;

		if (token.type === TOKEN_TEXT) {
			this.eat(TOKEN_TEXT);
			return new Text(token.value, token.escaped || false);
		}

		// Process math formulas (inline or display)
		if (token.type === TOKEN_MATH_INLINE || token.type === TOKEN_MATH_DISPLAY) {
			const inline = token.type === TOKEN_MATH_INLINE;
			this.eat(token.type);
			return new MathNode(token.value, inline);
		}

		if (token.type === TOKEN_COMMAND) {
			// Determine whether this is the start or end of an environment
			if (token.value === "begin") {
				return this.parseEnvironment();
			} else if (token.value === "end") {
				console.log(`[DEBUG][Parser] Encountered isolated \\end in parseElement, consuming and returning null`);
				this.eat(TOKEN_COMMAND);
				return null;
			} else {
				return this.parseCommand();
			}
		}

		// For other token types, simply skip (and print a message)
		console.log(`[DEBUG][Parser] Unrecognized token type ${token.type}, skipping`);
		this.eat(token.type);
		return null;
	}

	// Modified parseCommand to support multiple required arguments
	// Modified parseCommand to support multiple required arguments and preserve inner commands
	// Modified parseCommand to support multiple required arguments and a recursive optional argument
	parseCommand() {
		const token = this.currentToken;
		console.log(`[DEBUG][Parser] Parsing command: ${token}`);
		this.eat(TOKEN_COMMAND);
		let optionalArgument = null;
		let requiredArguments = [];

		// Parse optional argument recursively if present
		if (this.currentToken.type === TOKEN_LBRACKET) {
			this.eat(TOKEN_LBRACKET);
			let optNodes = [];
			// Parse until the closing bracket is encountered
			while (this.currentToken.type !== TOKEN_RBRACKET) {
				let node = this.parseElement();
				if (node) {
					optNodes.push(node);
				} else {
					if (this.currentToken.type !== TOKEN_RBRACKET) {
						this.eat(this.currentToken.type);
					}
				}
			}
			this.eat(TOKEN_RBRACKET);
			optionalArgument = new Document(optNodes); // Wrap in a Document node
		}

		// Parse one or more required arguments in braces recursively
		while (this.currentToken.type === TOKEN_LBRACE) {
			this.eat(TOKEN_LBRACE);
			let argNodes = [];
			while (this.currentToken.type !== TOKEN_RBRACE) {
				let node = this.parseElement();
				if (node) {
					argNodes.push(node);
				} else {
					if (this.currentToken.type !== TOKEN_RBRACE) {
						this.eat(this.currentToken.type);
					}
				}
			}
			this.eat(TOKEN_RBRACE);
			requiredArguments.push(new Document(argNodes));
		}

		return new Command(token.value, optionalArgument, requiredArguments);
	}

	parseEnvironment() {
		console.log(`[DEBUG][Parser] Starting to parse environment`);
		// Process environment: \begin{envName} ... \end{envName}
		this.eat(TOKEN_COMMAND); // Consume 'begin'
		if (this.currentToken.type !== TOKEN_LBRACE) {
			throw new Error("Expected { after \\begin");
		}
		this.eat(TOKEN_LBRACE);
		let envName = "";
		while (this.currentToken.type !== TOKEN_RBRACE) {
			console.log(`[DEBUG][Parser] Parsing environment name, current token: ${this.currentToken.toString()}`);
			envName += this.currentToken.value;
			this.eat(this.currentToken.type);
		}
		this.eat(TOKEN_RBRACE);

		// Parse the environment's internal content
		const children = [];
		let iteration = 0;
		while (true) {
			iteration++;
			console.log(
				`[DEBUG][Parser] Environment content loop iteration ${iteration}, current token: ${this.currentToken.toString()}`
			);
			// Encountering \end indicates the end of the environment
			if (this.currentToken.type === TOKEN_COMMAND && this.currentToken.value === "end") {
				break;
			}
			const node = this.parseElement();
			if (node !== null) {
				children.push(node);
			} else {
				if (this.currentToken.type !== TOKEN_EOF) {
					console.log(
						`[DEBUG][Parser] In environment, parseElement returned null, force consuming token: ${this.currentToken.toString()}`
					);
					this.eat(this.currentToken.type);
				}
			}
		}

		// Process \end{envName}
		console.log(`[DEBUG][Parser] Starting to parse \\end for environment`);
		this.eat(TOKEN_COMMAND); // Consume 'end'
		if (this.currentToken.type !== TOKEN_LBRACE) {
			throw new Error("Expected { after \\end");
		}
		this.eat(TOKEN_LBRACE);
		let endEnvName = "";
		while (this.currentToken.type !== TOKEN_RBRACE) {
			console.log(
				`[DEBUG][Parser] Parsing \\end environment name, current token: ${this.currentToken.toString()}`
			);
			endEnvName += this.currentToken.value;
			this.eat(this.currentToken.type);
		}
		this.eat(TOKEN_RBRACE);
		if (envName.trim() !== endEnvName.trim()) {
			throw new Error("Environment name mismatch between \\begin and \\end");
		}
		return new Environment(envName, children);
	}
}

// --- Test Example ---
const sampleText =
	"This is a text segment, containing an inline math formula $a^2 + b^2 = c^2$, " +
	"and a display math formula $$E = mc^2$$, " +
	"as well as a command with required argument: \\textbf{bold text}, " +
	"a command with optional argument: \\command[opt value]{required value}, " +
	"an escaped dollar sign: \\$, " +
	"and an environment: \\begin{itemize} " +
	"  \\item first item " +
	"  \\item second item " +
	"\\end{itemize} end.";

const lexer = new Lexer(sampleText);
const parser = new Parser(lexer);
const ast = parser.parse();
console.log("\nFinal AST:");
console.log(ast.toString());

// --- Export the Parsing Function ---

function parseLatex(text) {
	const lexer = new Lexer(text);
	const parser = new Parser(lexer);
	return parser.parse();
}
module.exports = {parseLatex};
//export { parseLatex };
