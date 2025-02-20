// latexFormatter.ts

/**
 * 格式化整个 AST，返回格式化后的 LaTeX 文本
 * @param ast 解析后的 AST 对象
 */
export function formatAST(ast: any): string {
    // 对于根节点 Document，不添加额外缩进
    return formatNode(ast, 0);
  }
  
  /**
   * 递归格式化 AST 节点
   * @param node 当前节点
   * @param indentLevel 当前缩进层级（根节点为 0）
   */
  function formatNode(node: any, indentLevel: number): string {
    // 当 indentLevel 为 0 时，不额外添加缩进；否则每级使用两个空格缩进
    const indent = indentLevel > 0 ? '  '.repeat(indentLevel) : '';
    // 通过节点的构造函数名称区分类型
    const nodeType = node.constructor.name;
  
    switch (nodeType) {
      case 'Document':
        // Document 节点包含子节点，直接依次格式化子节点（顶级节点不加缩进）
        return node.children.map((child: any) => formatNode(child, 0)).join('');
        
      case 'Text':
        // 文本节点直接返回文本内容
        return node.text;
        
      case 'Math':
      case 'MathNode':
        // 数学节点根据 inline 标识判断是否为行内或显示数学公式
        if (node.inline) {
          return `$${node.content}$`;
        } else {
          return `$$\n${node.content}\n$$`;
        }
        
      case 'Command':
        // 命令节点输出形如 \name[optional]{argument}
        let cmdStr = `\\${node.name}`;
        if (node.optionalArgument) {
          cmdStr += `[${node.optionalArgument}]`;
        }
        if (node.argument) {
          cmdStr += `{${node.argument}}`;
        }
        return cmdStr;
        
      case 'Environment':
        // 环境节点：\begin{envName} 和 \end{envName} 分行，并对内部内容增加缩进
        let envStr = `${indent}\\begin{${node.name}}\n`;
        // 对环境内部子节点，缩进级别 +1
        envStr += node.children
          .map((child: any) => formatNode(child, indentLevel + 1))
          .join('');
        envStr += `\n${indent}\\end{${node.name}}`;
        return envStr;
        
      default:
        return '';
    }
  }
  