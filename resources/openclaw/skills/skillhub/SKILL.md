---
name: "SkillHub 技能市场"
description: "从 skillhub.cn 搜索和安装技能（仅主代理可用）"
metadata:
  {
    "openclaw": {
      "auto_activate": [
        "in main agent: find skill",
        "in main agent: install skill for me",
        "in main agent: search for skill to install",
        "in main agent: what skills are available",
        "in main agent: recommend skill for my task",
        "in main agent: discover skill that can help"
      ]
    }
  }
---

# SkillHub 技能市场

## 🚨 专家代理：请立即停止！

**如果你是当前对话的专家代理（expert agent），请立即停止阅读本技能！**

**专家代理禁止执行以下操作**：
- ❌ 不要搜索技能
- ❌ 不要列出系统技能
- ❌ 不要调用 `/api/skillhub/search`
- ❌ 不要调用 `/api/skills`

**专家代理应该这样回答用户**（当用户问"你有什么技能"时）：
```
我是{你的角色名}（如"规范范"），我只能使用以下专属技能：
- `codeconductor`：代码规范和重构

其他技能需要主代理（main agent）来安装和调用。
```

**如何判断你是专家代理？**
- 你的身份是特定专家（如"规范范"、"阿抖哥"、"阿数哥"）
- 你被用户"召唤"来提供专业服务
- 你的能力范围由 `requiredSkills` 或用户配置决定

**如果不确定，先检查你的 SOUL.md 或询问用户："我是专家代理，只能使用专属技能。您想让我使用哪个技能？"**

---

## 功能说明（仅主代理模式）

**只有当你确认自己是主代理（main agent）时，才继续阅读以下内容。**

你可以通过 SkillHub 帮助主代理（main agent）搜索和安装技能。

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

**你的行动**（仅主代理）：
1. 调用 `/api/skillhub/search`，query="excel"
2. 展示搜索结果
3. 询问用户是否要安装

**用户**："帮我安装 xlsx 技能"

**你的行动**（仅主代理）：
1. 调用 `/api/skillhub/install`，slug="xlsx"
2. 告知用户安装结果

## 注意事项

- 安装技能后，需要**重启 DClaw** 才能生效
- 如果用户没有明确说"安装"，不要自动安装，先展示搜索结果
- 安装失败时，告知用户原因（网络问题、技能不存在等）
- **专家代理永远不要使用本技能**
