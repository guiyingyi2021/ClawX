/**
 * OpenClaw 专家配置拆分器
 * 逻辑来源：agency-agents-zh/scripts/convert.sh 中的 convert_openclaw()
 *
 * 将单个智能体 .md 文件拆分为三个文件：
 * - SOUL.md：人设（identity, communication, style, critical rules 等）
 * - AGENTS.md：业务逻辑（其余章节 + 标准工作空间规范）
 * - IDENTITY.md：基本信息（name + description）
 */

// SOUL 关键词（不区分大小写）
const SOUL_KEYWORDS = [
  'identity',
  '身份',
  '记忆',
  'communication',
  '沟通',
  'style',
  '风格',
  'critical rule',
  '关键规则',
  'rules you must follow',
];

// 标准工作空间规范（注入到 AGENTS.md 开头）
const STANDARD_WORKSPACE_SPEC = `## Session 启动流程

当你被激活时，按以下顺序读取工作空间文件：

1. **SOUL.md** — 读取你的核心人设、沟通风格和关键规则
2. **IDENTITY.md** — 读取你的身份信息（可选）
3. **memory/memory.md** — 读取长期记忆中的关键事实和偏好
4. **memory/YYYY-MM-DD.md** — 读取最近的会话日志
5. **开始工作时**，主动询问用户是否需要回顾之前的上下文

## 记忆管理规范

### 索引层（长期记忆）
- 路径：\`memory/memory.md\`
- 内容：用户的核心偏好、常用设置、重要的长期事实
- 更新时机：每次完成重要任务后，检查并更新

### 日志层（会话记忆）
- 路径：\`memory/YYYY-MM-DD.md\`（当天日期）
- 内容：当天的会话摘要、进行中的任务、待处理事项
- 更新时机：每次用户明确结束一个话题或任务后

### 写入规则
- **重要**：先读后写，避免覆盖未同步的上下文
- **碎片化信息**：先记在当天日志，需要时再提炼到 memory.md
- **结构化**：使用 Markdown 表格或列表便于后续检索
- **安全第一**：不写入密码、密钥、API Token 等敏感信息

## 工作原则

- **主动**：在每个 Session 开始时检查记忆，不需要用户重复说明已知信息
- **精确**：更新记忆时保持简洁，只记录"差异"而非重复已知内容
- **可追溯**：重大决策记录原因，方便后续回顾
`;

/**
 * 判断章节标题是否属于 SOUL
 */
function isSoulSection(title: string): boolean {
  const lowerTitle = title.toLowerCase();
  return SOUL_KEYWORDS.some(keyword => lowerTitle.includes(keyword.toLowerCase()));
}

/**
 * 解析 YAML frontmatter
 */
function parseFrontmatter(content: string): {
  frontmatter: Record<string, string>;
  body: string;
} {
  const lines = content.split('\n');
  if (lines[0] !== '---') {
    return { frontmatter: {}, body: content };
  }

  const frontmatterLines: string[] = [];
  let inFrontmatter = true;
  let bodyStartIndex = 0;

  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      bodyStartIndex = i + 1;
      break;
    }
    frontmatterLines.push(lines[i]);
  }

  const frontmatter: Record<string, string> = {};
  for (const line of frontmatterLines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      frontmatter[key] = value;
    }
  }

  const body = lines.slice(bodyStartIndex).join('\n');
  return { frontmatter, body };
}

/**
 * 拆分专家配置为三个文件
 */
export function convertOpenClaw(markdownContent: string, expertName?: string): {
  soulContent: string;
  agentsContent: string;
  identityContent: string;
} {
  const { frontmatter, body } = parseFrontmatter(markdownContent);

  // 提取基本信息
  const name = expertName || frontmatter['name'] || frontmatter['role'] || 'Agent';
  const description = frontmatter['description'] || '';

  // 拆分章节
  const lines = body.split('\n');
  const sections: { title: string; level: number; content: string[]; isSoul: boolean }[] = [];
  let currentSection: { title: string; level: number; content: string[]; isSoul: boolean } | null = null;

  for (const line of lines) {
    const h2Match = line.match(/^## (.+)/);
    const h3Match = line.match(/^### (.+)/);

    if (h2Match) {
      if (currentSection) {
        sections.push(currentSection);
      }
      const title = h2Match[1];
      currentSection = {
        title,
        level: 2,
        content: [line],
        isSoul: isSoulSection(title),
      };
    } else if (h3Match) {
      if (currentSection) {
        sections.push(currentSection);
      }
      const title = h3Match[1];
      currentSection = {
        title,
        level: 3,
        content: [line],
        isSoul: isSoulSection(title),
      };
    } else if (currentSection) {
      currentSection.content.push(line);
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  // 分别组装 SOUL 和 AGENTS
  const soulSections: string[] = [];
  const agentsSections: string[] = [];

  for (const section of sections) {
    const sectionContent = section.content.join('\n');
    if (section.isSoul) {
      soulSections.push(sectionContent);
    } else {
      agentsSections.push(sectionContent);
    }
  }

  // 如果没有任何 SOUL 关键词章节，整个正文放入 AGENTS
  if (soulSections.length === 0) {
    soulSections.push(body);
  }

  // 组装三个文件
  const soulContent = soulSections.join('\n\n');
  const agentsContent = STANDARD_WORKSPACE_SPEC + '\n\n' + agentsSections.join('\n\n');
  const identityContent = `# ${name}\n\n${description}`;

  return {
    soulContent,
    agentsContent,
    identityContent,
  };
}

export default convertOpenClaw;
