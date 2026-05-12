---
name: "SkillHub 技能市场"
description: "从 skillhub.cn 搜索和安装技能（开箱即用）"
metadata:
  {
    "openclaw": {
      "auto_activate": [
        "find skill in main agent",
        "install skill for me",
        "search for skill to install",
        "what skills are available in the system",
        "recommend skill for my task",
        "discover skill that can help"
      ]
    }
  }
---

# SkillHub 技能市场

你可以通过 SkillHub 帮助用户搜索和安装技能。

## 重要：专家代理模式

**如果你当前是作为一个专家代理（expert agent）在运行**：

1. **只展示和安装你的专属技能** - 查看你的 SOUL.md 或配置中的 `requiredSkills`
2. **不要展示系统中的所有技能** - 这会混淆用户
3. **如果用户要求安装不在你专属列表中的技能** - 礼貌地拒绝，并解释："我是{角色名}，只能帮您使用{你的专属技能列表}。其他技能需要主代理来安装。"

**如何判断是否是专家代理？**
- 检查你的身份：如果你有特定的角色（如"抖音策略师"、"数据分析师"），你就是专家代理
- 查看 workspace 路径：如果路径包含 `agents/` 子目录，你就是专家代理

**示例（阿抖哥）**：
- 阿抖哥的专属技能：`xlsx`（用于视频数据分析）
- 当用户问"有什么技能"时，阿抖哥应该回答："我可以使用 `xlsx` 技能帮您分析视频数据。其他技能需要主代理来安装。"
- 不要调用 `/api/skillhub/search` 搜索所有技能！

## 功能（主代理模式）

### 1. 搜索技能

当用户询问"有什么技能"、"找XX技能"、"搜索技能"时，使用 `hostApiFetch` 调用搜索 API：

```typescript
const result = await hostApiFetch('/api/skillhub/search', {
    method: 'POST',
    body: JSON.stringify({
        query: 'excel',  // 用户搜索关键词
        limit: 20
    })
});
```

返回格式：
```json
{
  "results": [
    {
      "slug": "xlsx",
      "name": "xlsx",
      "description": "Excel 文件处理...",
      "version": "1.0.0"
    }
  ]
}
```

### 2. 安装技能

当用户明确说"安装XX技能"、"帮我安装XX"时，使用 `hostApiFetch` 调用安装 API：

```typescript
const result = await hostApiFetch('/api/skillhub/install', {
    method: 'POST',
    body: JSON.stringify({
        slug: 'xlsx',
        force: false  // 如果已安装，跳过
    })
});
```

### 3. 检查技能是否已安装

```typescript
const result = await hostApiFetch('/api/skillhub/check-installed', {
    method: 'POST',
    body: JSON.stringify({
        slugs: ['xlsx', 'pdf']
    })
});
```

返回格式：
```json
{
  "xlsx": true,
  "pdf": false
}
```

## 对话示例

**用户**："有什么技能可以处理 Excel？"

**你的行动**：
1. 调用 `/api/skillhub/search`，query="excel"
2. 展示搜索结果
3. 询问用户是否要安装

**用户**："帮我安装 xlsx 技能"

**你的行动**：
1. 调用 `/api/skillhub/install`，slug="xlsx"
2. 告知用户安装结果

## 注意事项

- 安装技能后，需要**重启 DClaw** 才能生效
- 如果用户没有明确说"安装"，不要自动安装，先展示搜索结果
- 安装失败时，告知用户原因（网络问题、技能不存在等）
