# PaperMind — AI 论文精读助手

一个面向研究生的 AI 论文精读工具。拖入 PDF 原文，AI 帮你逐段解释，自动构建知识图谱，辅助学术写作。

## 功能

- **PDF 原文精读**：直接在 PDF 上选中文字，AI 实时给出逐句解释和关键术语
- **高亮标注**：在 PDF 上高亮、批注、添加笔记
- **知识图谱**：自动提取论文概念，构建跨文献的知识网络
- **AI 写作辅助**：基于已读文献，生成带引用的学术段落，可点击跳转原文
- **文件夹分类**：按研究主题归类文献，AI 自动生成文献综合解读
- **笔记中心**：汇总所有笔记和高亮

## 快速开始

### 环境要求

- Node.js 18+
- 一个 AI 模型的 API Key（支持 DeepSeek、OpenAI 等 OpenAI 兼容接口）
- macOS / Linux / Windows

### 安装

```bash
# 克隆项目
git clone https://github.com/你的用户名/papermind.git
cd papermind

# 安装依赖
npm install

# 复制环境变量模板
cp .env.example .env.local

# 编辑 .env.local，填入你的 API Key
# 或者跳过这一步，启动后在应用内的设置页面配置
```

### 启动

```bash
npm run dev
```

打开浏览器访问 `http://localhost:3000`

### 配置 API Key

两种方式任选其一：

1. **在 `.env.local` 中配置**（启动前）
2. **在应用内配置**（启动后）：点击左侧栏设置 → 输入 API Key → 保存

支持所有 OpenAI 兼容接口：

| 服务商 | Base URL | 模型名 |
|--------|----------|--------|
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` |
| 其他兼容服务 | 视服务商而定 | 视服务商而定 |

## 使用说明

### 精读论文

1. 在文献库拖入 PDF 文件
2. 点击论文进入精读模式
3. 在 PDF 上选中文字 → 右侧 AI 自动生成逐句解释
4. 选中文字后选择颜色即可高亮标注，点击已有高亮可改色或删除

### 知识图谱

上传论文后系统自动提取概念，进入知识图谱页面查看。悬停节点查看关联论文，双击跳转精读。

### AI 写作

进入写作页面，输入主题，AI 基于你已读的论文生成带引用的学术段落。引用可点击跳转到对应论文的原文位置。

### 文件夹管理

在左侧边栏创建文件夹，拖拽论文卡片到文件夹进行分类。进入文件夹后可使用 AI 文献综合解读功能。

## 数据说明

所有数据保存在本地：

- `data/papermind.db` — SQLite 数据库（论文元数据、笔记、高亮、概念等）
- `uploads/` — 上传的 PDF 文件

建议定期备份这两个目录。

## 技术栈

- **前端**：Next.js 16 · React 19 · TypeScript · Tailwind CSS · shadcn/ui
- **PDF 渲染**：PDF.js · react-pdf-highlighter-extended
- **数据**：SQLite (better-sqlite3)
- **AI**：OpenAI 兼容接口
- **可视化**：D3.js（知识图谱）

## License

MIT
