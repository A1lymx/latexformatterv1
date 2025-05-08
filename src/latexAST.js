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
const TOKEN_NEWLINE = "NEWLINE"; // Optional: Can explicitly tokenize newlines

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

	// Helper to get current position for error reporting
	getCurrentPositionDetails() {
		const lines = this.text.substring(0, this.pos).split('\n');
		const line = lines.length;
		const column = lines[lines.length - 1].length + 1;
		return { line, column };
	}


	getNextToken() {
		if (this.pos >= this.text.length) {
			return new Token(TOKEN_EOF, null);
		}

        // --- Comment Handling ---
        let tempPos = this.pos;
        let lineStartIndex = this.pos;
        while(lineStartIndex > 0 && this.text[lineStartIndex-1] !== '\n' && this.text[lineStartIndex-1] !== '\r') {
            lineStartIndex--;
        }
        let nonWhitespaceFoundBeforePos = false;
        for(let k=lineStartIndex; k < tempPos; k++) {
            if (this.text[k] !== ' ' && this.text[k] !== '\t') {
                nonWhitespaceFoundBeforePos = true;
                break;
            }
        }

        if (this.text[this.pos] === '%' && !nonWhitespaceFoundBeforePos) {
            const start = this.pos;
            while (this.pos < this.text.length && this.text[this.pos] !== '\n' && this.text[this.pos] !== '\r') {
                this.pos++;
            }
            const commentText = this.text.slice(start, this.pos);
            return new Token(TOKEN_TEXT, commentText); // Return full comment line as text
        }
        // --- End Comment Handling ---

		const current = this.text[this.pos];

        // --- Newline Handling ---
        if (current === '\n') {
            this.pos++;
            return new Token(TOKEN_TEXT, '\n'); // Treat newline as text
        }
        if (current === '\r') {
            this.pos++;
            if (this.pos < this.text.length && this.text[this.pos] === '\n') {
                this.pos++; // Consume \n after \r
                return new Token(TOKEN_TEXT, '\r\n');
            }
            return new Token(TOKEN_TEXT, '\r');
        }
        // --- End Newline Handling ---


		if (current === "$") {
			if (this.pos + 1 < this.text.length && this.text[this.pos + 1] === "$") {
				this.pos += 2;
				const start = this.pos;
				while (this.pos < this.text.length && !(this.text[this.pos] === "$" && this.pos + 1 < this.text.length && this.text[this.pos + 1] === "$")) {
					this.pos++;
				}
				const content = this.text.slice(start, this.pos);
				if (this.pos < this.text.length) this.pos += 2;
				return new Token(TOKEN_MATH_DISPLAY, content);
			} else {
				this.pos++;
				const start = this.pos;
				while (this.pos < this.text.length && this.text[this.pos] !== "$") {
					this.pos++;
				}
				const content = this.text.slice(start, this.pos);
				if (this.pos < this.text.length) this.pos++;
				return new Token(TOKEN_MATH_INLINE, content);
			}
		}

		if (current === "\\") {
			if (this.pos + 1 < this.text.length && /[a-zA-Z]/.test(this.text[this.pos + 1])) {
				this.pos++; // Consume the backslash
				const start = this.pos;
				while (this.pos < this.text.length && /[a-zA-Z*]/.test(this.text[this.pos])) {
					this.pos++;
				}
				const cmd = this.text.slice(start, this.pos);
				return new Token(TOKEN_COMMAND, cmd);
			} else {
				this.pos++; // Consume '\'
                if (this.pos < this.text.length) {
				    const escapedChar = this.text[this.pos];
				    this.pos++; // Consume the escaped character
				    const token = new Token(TOKEN_TEXT, "\\" + escapedChar);
				    token.escaped = true;
				    return token;
                } else { // Trailing backslash
                    const token = new Token(TOKEN_TEXT, "\\");
                    token.escaped = true;
                    return token;
                }
			}
		}

		if (current === "{") { this.pos++; return new Token(TOKEN_LBRACE, "{"); }
		if (current === "}") { this.pos++; return new Token(TOKEN_RBRACE, "}"); }
		if (current === "[") { this.pos++; return new Token(TOKEN_LBRACKET, "["); }
		if (current === "]") { this.pos++; return new Token(TOKEN_RBRACKET, "]"); }

		// --- Plain Text Handling (stops at special chars AND newlines) ---
		const start = this.pos;
		while (
            this.pos < this.text.length &&
            // Stop characters include LaTeX specials and newlines
            !["\\", "{", "}", "[", "]", "$", "\n", "\r"].includes(this.text[this.pos])
        ) {
			this.pos++;
		}
		const text_val = this.text.slice(start, this.pos);

		if (text_val.length > 0) {
		    return new Token(TOKEN_TEXT, text_val);
        } else {
            // If text_val is empty, it means we hit a special char or newline immediately.
            // Let the next getNextToken call handle it.
            return this.getNextToken(); // Re-evaluate from the current position
        }
	}

    getAllTokens() {
        const tokens = [];
        let token;
        const originalPos = this.pos;
        this.pos = 0;
        do {
            token = this.getNextToken();
            tokens.push(token);
        } while (token.type !== TOKEN_EOF);
        this.pos = originalPos;
        return tokens;
    }
}

// --- AST Node Definitions ---
class Document {
	constructor(children) { this.children = children; }
	toString() { return `Document(${this.children.map((child) => child.toString()).join(", ")})`; }
}
class Text {
	constructor(text, escaped = false) { this.text = text; this.escaped = escaped; }
	toString() { return `Text(${JSON.stringify(this.text)})`; }
}
class Command {
	constructor(name, optionalArgument = null, requiredArguments = []) {
		this.name = name;
		this.optionalArgument = optionalArgument;
		this.requiredArguments = requiredArguments;
	}
	toString() {
		let argsStr = "";
		if (this.optionalArgument) argsStr += `[${this.optionalArgument.toString()}]`;
		this.requiredArguments.forEach(arg => argsStr += `{${arg.toString()}}`);
		return `Command(name=${JSON.stringify(this.name)}, arguments=${JSON.stringify(argsStr)})`;
	}
}
// Modified Environment class to include arguments
class Environment {
	constructor(name, children, environmentArguments = []) { // Added environmentArguments
		this.name = name;
		this.children = children;
        this.environmentArguments = environmentArguments; // Store arguments
	}
	toString() {
        // Include arguments in the string representation
        let argsStr = "";
        this.environmentArguments.forEach(arg => argsStr += `{${arg.toString()}}`);
		return `Environment(name=${JSON.stringify(this.name)}, arguments=${JSON.stringify(argsStr)}, children=[${this.children.map((child) => child.toString()).join(", ")}])`;
	}
}
class MathNode {
	constructor(content, inline = true) { this.content = content; this.inline = inline; }
	toString() { return `Math(inline=${this.inline}, content=${JSON.stringify(this.content)})`; }
}

// --- Parser ---
class Parser {
	constructor(lexer) {
		this.lexer = lexer;
		this.currentToken = this.lexer.getNextToken();
	}

	eat(tokenType) {
		if (this.currentToken.type === tokenType) {
			this.currentToken = this.lexer.getNextToken();
		} else {
            const {line, column} = this.lexer.getCurrentPositionDetails();
			throw new Error(`Syntax error (eat): expected ${tokenType}, got ${this.currentToken.type} with value "${this.currentToken.value}" near L${line}:C${column}`);
		}
	}

	parse() {
		const nodes = [];
		while (this.currentToken.type !== TOKEN_EOF) {
			const preParseToken = this.currentToken;
			const node = this.parseElement();

			if (node !== null) {
				nodes.push(node);
			} else {
				// If parseElement returned null and did not consume the token, consume it here.
				if (this.currentToken === preParseToken && this.currentToken.type !== TOKEN_EOF) {
					// console.log(`[DEBUG][Parser] MainLoop: parseElement for ${preParseToken.type} returned null and did not consume token. Consuming ${preParseToken.toString()}`);
					this.eat(preParseToken.type);
				}
			}
		}
		return new Document(nodes);
	}

	parseElement() {
		const token = this.currentToken;

		if (token.type === TOKEN_TEXT) { this.eat(TOKEN_TEXT); return new Text(token.value, token.escaped || false); }
		if (token.type === TOKEN_MATH_INLINE || token.type === TOKEN_MATH_DISPLAY) {
			const inline = token.type === TOKEN_MATH_INLINE;
			this.eat(token.type);
			return new MathNode(token.value, inline);
		}
		if (token.type === TOKEN_COMMAND) {
			if (token.value === "begin") return this.parseEnvironment();
			if (token.value === "end") { this.eat(TOKEN_COMMAND); return null; } // Isolated \end, consumed, no node
			return this.parseCommand();
		}
		if (token.type === TOKEN_LBRACE || token.type === TOKEN_RBRACE || token.type === TOKEN_LBRACKET || token.type === TOKEN_RBRACKET) {
			this.eat(token.type);
			return new Text(token.value);
		}
		// console.log(`[DEBUG][Parser] parseElement: Unhandled token ${token.toString()}, returning null.`);
		return null; // Unhandled token, let parse() loop consume it
	}

	parseCommand() {
		const commandToken = this.currentToken;
		this.eat(TOKEN_COMMAND); // Eat command name
		let optionalArgument = null;
		const requiredArguments = [];

		if (this.currentToken.type === TOKEN_LBRACKET) {
			this.eat(TOKEN_LBRACKET);
			const optNodes = [];
			while (this.currentToken.type !== TOKEN_RBRACKET && this.currentToken.type !== TOKEN_EOF) {
				const preParseToken = this.currentToken;
				const node = this.parseElement();
				if (node) optNodes.push(node);
				else if (this.currentToken === preParseToken && this.currentToken.type !== TOKEN_EOF) this.eat(this.currentToken.type);
			}
			if (this.currentToken.type === TOKEN_RBRACKET) this.eat(TOKEN_RBRACKET);
			else throw new Error(`Syntax error: Unclosed optional argument for command \\${commandToken.value}. Expected RBRACKET, got ${this.currentToken.type}`);
			optionalArgument = new Document(optNodes);
		}

		while (this.currentToken.type === TOKEN_LBRACE) {
			this.eat(TOKEN_LBRACE);
			const argNodes = [];
			while (this.currentToken.type !== TOKEN_RBRACE && this.currentToken.type !== TOKEN_EOF) {
                const preParseToken = this.currentToken;
				const node = this.parseElement();
				if (node) argNodes.push(node);
				else if (this.currentToken === preParseToken && this.currentToken.type !== TOKEN_EOF) this.eat(this.currentToken.type);
			}
			if (this.currentToken.type === TOKEN_RBRACE) this.eat(TOKEN_RBRACE);
            else throw new Error(`Syntax error: Unclosed required argument for command \\${commandToken.value}. Expected RBRACE, got ${this.currentToken.type}`);
			requiredArguments.push(new Document(argNodes));
		}
		return new Command(commandToken.value, optionalArgument, requiredArguments);
	}

	// Modified parseEnvironment to handle arguments
	parseEnvironment() {
		this.eat(TOKEN_COMMAND); // Consume 'begin'
		if (this.currentToken.type !== TOKEN_LBRACE) throw new Error("Expected { after \\begin");
		this.eat(TOKEN_LBRACE); // {

		let envName = "";
		while (this.currentToken.type === TOKEN_TEXT || this.currentToken.type === TOKEN_COMMAND || (this.currentToken.type === TOKEN_TEXT && this.currentToken.value.endsWith('*'))) {
            if (this.currentToken.type === TOKEN_COMMAND) envName += "\\";
			envName += this.currentToken.value;
			this.eat(this.currentToken.type);
		}
		if (this.currentToken.type !== TOKEN_RBRACE) throw new Error(`Expected RBRACE for environment name, got ${this.currentToken.type} "${this.currentToken.value}"`);
		this.eat(TOKEN_RBRACE); // }

        const trimmedEnvName = envName.trim();

        // --- Parse Environment Arguments ---
        const environmentArguments = [];
        while (this.currentToken.type === TOKEN_LBRACE) {
            this.eat(TOKEN_LBRACE); // {
            const argNodes = [];
            while (this.currentToken.type !== TOKEN_RBRACE && this.currentToken.type !== TOKEN_EOF) {
                const preParseToken = this.currentToken;
                const node = this.parseElement(); // Recursively parse argument content
                if (node) argNodes.push(node);
                else if (this.currentToken === preParseToken && this.currentToken.type !== TOKEN_EOF) this.eat(this.currentToken.type);
            }
            if (this.currentToken.type === TOKEN_RBRACE) this.eat(TOKEN_RBRACE); // }
            else throw new Error(`Syntax error: Unclosed argument for environment \\begin{${trimmedEnvName}}. Expected RBRACE, got ${this.currentToken.type}`);
            environmentArguments.push(new Document(argNodes));
        }
        // --- End Parse Environment Arguments ---

		const mathEnvs = ["equation", "equation*", "align", "align*", "gather", "gather*", "multline", "multline*", "split", "array", "subequations"];
		if (mathEnvs.includes(trimmedEnvName)) {
			let mathContent = "";
			let braceDepth = 0;
			while (true) {
				if (this.currentToken.type === TOKEN_EOF) { console.warn(`[DEBUG][Parser] EOF in math env: ${trimmedEnvName}`); break; }
				if (this.currentToken.type === TOKEN_COMMAND && this.currentToken.value === "end" && braceDepth === 0) {
                    const currentLexerPos = this.lexer.pos;
                    const lookaheadLexer = new Lexer(this.lexer.text.substring(currentLexerPos));
                    const lbraceToken = lookaheadLexer.getNextToken();
					if (lbraceToken.type === TOKEN_LBRACE) {
						let lookaheadEnvName = "";
                        let namePartToken = lookaheadLexer.getNextToken();
                        while(namePartToken.type !== TOKEN_RBRACE && namePartToken.type !== TOKEN_EOF) {
                            if (namePartToken.type === TOKEN_COMMAND) lookaheadEnvName += "\\";
                            lookaheadEnvName += namePartToken.value;
                            namePartToken = lookaheadLexer.getNextToken();
                        }
						if (namePartToken.type === TOKEN_RBRACE && lookaheadEnvName.trim() === trimmedEnvName) break;
					}
				}
				if (this.currentToken.type === TOKEN_LBRACE) braceDepth++;
				else if (this.currentToken.type === TOKEN_RBRACE) braceDepth--;

				mathContent += (this.currentToken.type === TOKEN_COMMAND ? "\\" : "") + this.currentToken.value;
				this.eat(this.currentToken.type);
			}
			const children = [new Text(mathContent, true)];
            if (this.currentToken.type === TOKEN_COMMAND && this.currentToken.value === "end") {
                 this.eat(TOKEN_COMMAND);
                if (this.currentToken.type !== TOKEN_LBRACE) throw new Error(`Expected { after \\end for math environment ${trimmedEnvName}`);
                this.eat(TOKEN_LBRACE);
                let endEnvName = "";
                while (this.currentToken.type !== TOKEN_RBRACE && this.currentToken.type !== TOKEN_EOF) {
                    if (this.currentToken.type === TOKEN_COMMAND) endEnvName += "\\";
                    endEnvName += this.currentToken.value;
                    this.eat(this.currentToken.type);
                }
                if (this.currentToken.type !== TOKEN_RBRACE) throw new Error(`Expected } for \\end name in math environment ${trimmedEnvName}`);
                this.eat(TOKEN_RBRACE);
                if (trimmedEnvName !== endEnvName.trim()) throw new Error(`Math env name mismatch: ${trimmedEnvName} vs ${endEnvName.trim()}`);
            } else {
                throw new Error(`Expected \\end for math environment ${trimmedEnvName}, found ${this.currentToken.type}`);
            }
			return new Environment(trimmedEnvName, children, environmentArguments); // Pass arguments
		} else { // Non-math environments
			const children = [];
			while (true) {
				if (this.currentToken.type === TOKEN_EOF) { console.warn(`[DEBUG][Parser] EOF in non-math env: ${trimmedEnvName}`); break; }
				if (this.currentToken.type === TOKEN_COMMAND && this.currentToken.value === "end") {
                    const currentLexerPos = this.lexer.pos;
					const lookaheadLexer = new Lexer(this.lexer.text.substring(currentLexerPos));
					const lbraceToken = lookaheadLexer.getNextToken();
					if (lbraceToken.type === TOKEN_LBRACE) {
						let lookaheadEnvName = "";
                        let namePartToken = lookaheadLexer.getNextToken();
                        while(namePartToken.type !== TOKEN_RBRACE && namePartToken.type !== TOKEN_EOF) {
                            if (namePartToken.type === TOKEN_COMMAND) lookaheadEnvName += "\\";
                            lookaheadEnvName += namePartToken.value;
                            namePartToken = lookaheadLexer.getNextToken();
                        }
						if (namePartToken.type === TOKEN_RBRACE && lookaheadEnvName.trim() === trimmedEnvName) break;
					}
				}
                const preParseToken_envChildren = this.currentToken;
				const node = this.parseElement();
				if (node !== null) {
					children.push(node);
				} else {
                    if (this.currentToken === preParseToken_envChildren && this.currentToken.type !== TOKEN_EOF) {
                        this.eat(preParseToken_envChildren.type);
                    }
                }
			}
            if (this.currentToken.type === TOKEN_COMMAND && this.currentToken.value === "end") {
                this.eat(TOKEN_COMMAND);
                if (this.currentToken.type !== TOKEN_LBRACE) throw new Error(`Expected { after \\end for non-math environment ${trimmedEnvName}`);
                this.eat(TOKEN_LBRACE);
                let endEnvName = "";
                while (this.currentToken.type !== TOKEN_RBRACE && this.currentToken.type !== TOKEN_EOF) {
                     if (this.currentToken.type === TOKEN_COMMAND) endEnvName += "\\";
                    endEnvName += this.currentToken.value;
                    this.eat(this.currentToken.type);
                }
                if (this.currentToken.type !== TOKEN_RBRACE) throw new Error(`Expected } for \\end name in non-math environment ${trimmedEnvName}`);
                this.eat(TOKEN_RBRACE);
                if (trimmedEnvName !== endEnvName.trim()) throw new Error(`Non-math env name mismatch: ${trimmedEnvName} vs ${endEnvName.trim()}`);
            } else if (this.currentToken.type !== TOKEN_EOF) {
                throw new Error(`Expected \\end for non-math environment ${trimmedEnvName}, found ${this.currentToken.type}`);
            }
			return new Environment(trimmedEnvName, children, environmentArguments); // Pass arguments
		}
	}
}

function parseLatex(text) {
	const lexer = new Lexer(text);
    console.log("--- LEXER: All Tokens ---");
    const allTokens = new Lexer(text).getAllTokens();
    allTokens.forEach(token => console.log(token.toString()));
    console.log("--- END LEXER ---");

	const parser = new Parser(lexer);
    let ast;
    try {
	    ast = parser.parse();
        console.log("--- PARSER: Final AST ---");
        console.log(ast.toString());
        console.log("--- END PARSER ---");
    } catch (e) {
        console.error("!!! PARSING ERROR !!!");
        console.error(e.message);
        if (parser.currentToken) {
            console.error("Current token at error:", parser.currentToken.toString());
            const {line, column} = parser.lexer.getCurrentPositionDetails();
            console.error(`Error near Line: ${line}, Column: ${column}`);
            const errorPos = parser.lexer.pos;
            const contextChars = 30;
            const startContext = Math.max(0, errorPos - contextChars);
            const endContext = Math.min(lexer.text.length, errorPos + contextChars);
            console.error("Error context:", `...${lexer.text.substring(startContext, errorPos)}[ERROR HERE]${lexer.text.substring(errorPos,endContext)}...`);
        }
        throw e;
    }
	return ast;
}
module.exports = {parseLatex, Lexer, Parser, Document, Text, Command, Environment, MathNode, Token};


