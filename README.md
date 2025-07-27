# Cloudflare Worker DDNS

🌐 高性能的 Cloudflare Worker，提供IP检测和DDNS自动更新功能，具备智能缓存和监控能力。

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/little-twain/cf-ip-ddns-worker)

## 功能特性

- 🌐 **IP检测**：自动检测IPv4/IPv6地址
- 🔄 **DDNS更新**：自动更新Cloudflare DNS记录（使用官方SDK）
- 🚀 **极致缓存**：三层LRU缓存架构，开放寻址哈希表
- 📊 **实时监控**：提供缓存统计和域名信息查询
- 🛡️ **类型安全**：使用官方Cloudflare Node.js SDK

## 使用方法

### 基本功能

```bash
# 获取访问者IP地址
curl "https://your-worker.domain.com/"

# DDNS自动更新
curl "https://your-worker.domain.com/?zone=ZONE_ID&email=EMAIL&key=API_KEY&name=RECORD_NAME"
```

### 监控功能

```bash
# 查看缓存统计
curl "https://your-worker.domain.com/?stats"

# 查看域名缓存信息
curl "https://your-worker.domain.com/?info=example.com"
```

## 项目架构

``` plaintext
src/
├── index.ts                   # 主入口文件
├── handlers/                  # 请求处理器
│   └── ddns.ts                # DDNS处理逻辑
└── lib/                       # 核心库代码
    ├── cache/                 # 缓存管理
    │   └── manager.ts         # LRU缓存管理器
    ├── dns/                   # DNS操作
    │   └── operations.ts      # Cloudflare DNS API
    ├── utils/                 # 工具函数
    │   ├── ip.ts              # IP地址处理
    │   └── response.ts        # 响应处理
    ├── validation/            # 验证逻辑
    │   └── params.ts          # 参数验证
    └── index.ts               # 库导出
```

## 部署配置

### 环境变量

无需设置环境变量，运行时通过URL参数传递：

- `zone`：Cloudflare Zone ID
- `email`：Cloudflare账户邮箱
- `key`：Cloudflare API Key
- `name`：DNS记录名称

### Wrangler配置

项目包含 `wrangler.toml` 配置文件，支持一键部署到Cloudflare Workers。

## 开发

```bash
# 安装依赖
npm install

# 本地开发
npm run dev

# 类型检查
npm run type-check

# 部署到Cloudflare
npm run deploy
```

## 环境要求

- Node.js 18+
- Cloudflare Workers 账户
- 支持 Cache API

## 许可证

GPL-3.0 License
