# cf-ip-ddns-worker

🌐 简单的 Cloudflare Worker，用于返回访问者 IP 地址并可选择性地通过 Cloudflare API 更新 DNS 记录。

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/little-twain/cf-ip-ddns-worker)

## 功能特性

- 🌐 **IP 检测**：访问任意路径返回客户端真实 IP 地址（支持 IPv4 和 IPv6）
- 🔄 **DDNS 更新**：通过 URL 参数自动更新 DNS 记录（A 记录用于 IPv4，AAAA 记录用于 IPv6）
- ⚡ **快速响应**：基于 Cloudflare Workers 的边缘计算
- 🛡️ **错误处理**：完善的错误处理和状态返回
- 📘 **TypeScript**：完整的类型定义，提供更好的开发体验
- 🤖 **智能记录类型**：根据 IP 地址类型自动选择 A 记录或 AAAA 记录

## 快速部署

### 方式一：一键部署（推荐）

点击上方的 "Deploy to Cloudflare Workers" 按钮，或访问：

```url
https://deploy.workers.cloudflare.com/?url=https://github.com/little-twain/cf-ip-ddns-worker
```

### 方式二：手动部署

```bash
# 克隆项目
git clone https://github.com/little-twain/cf-ip-ddns-worker.git
cd cf-ip-ddns-worker

# 安装依赖
npm install

# 登录 Cloudflare（如果未登录）
npx wrangler auth login

# 部署
npm run deploy
```

## 使用示例

### 获取当前 IP

```bash
curl https://your-worker.your-subdomain.workers.dev/
# 返回: 192.168.1.100 (IPv4)
# 或: 2001:db8::1 (IPv6)
```

### 手动更新 DNS 记录

```bash
# IPv4 用户访问时，自动更新 A 记录
curl "https://your-worker.your-subdomain.workers.dev/?zone=ZONE_ID&email=YOUR_EMAIL&key=YOUR_API_KEY&name=subdomain.example.com"

# IPv6 用户访问时，自动更新 AAAA 记录
# Worker 会根据检测到的 IP 类型自动选择记录类型
```

### 自动化脚本示例

创建一个简单的 DDNS 更新脚本：

```bash
#!/bin/bash
# 保存为 ddns-update.sh

WORKER_URL="https://your-worker.your-subdomain.workers.dev"
ZONE_ID="your_zone_id"
AUTH_EMAIL="your@email.com"
AUTH_KEY="your_api_key"
RECORD_NAME="home.example.com"

# 调用 API 更新 DNS
curl -s "$WORKER_URL/?zone=$ZONE_ID&email=$AUTH_EMAIL&key=$AUTH_KEY&name=$RECORD_NAME"

# 检查更新结果（可选）
RESPONSE=$(curl -s "$WORKER_URL/?zone=$ZONE_ID&email=$AUTH_EMAIL&key=$AUTH_KEY&name=$RECORD_NAME")
if [ $? -eq 0 ]; then
    echo "$(date): DNS update successful"
else
    echo "$(date): DNS update failed"
fi
```

### 定时任务设置

```bash
# 编辑 crontab
crontab -e

# 添加以下行，每5分钟检查一次
*/5 * * * * /path/to/ddns-update.sh >> /var/log/ddns.log 2>&1
```

#### 参数说明

- `zone`: Cloudflare Zone ID
- `email`: Cloudflare 账户邮箱
- `key`: Cloudflare Global API Key
- `name`: 要更新的 DNS 记录名称（如 `home.example.com`）

#### 响应行为

**成功更新或IP未变化：**

- HTTP 状态码：200
- 响应体：空（无内容）
- 适合在自动化脚本中使用，减少日志噪音

**错误情况：**

- HTTP 状态码：400/404/500等
- 响应体：JSON格式的错误信息

```json
{
  "success": false,
  "error": "record_not_found",
  "message": "DNS A record 'home.example.com' not found in zone"
}
```

**IP地址格式无效：**

```json
{
  "success": false,
  "error": "invalid_ip",
  "message": "Invalid IP address format: unknown"
}
```

## 部署说明

### 1. 准备工作

确保您有 Cloudflare 账户，并且已经在 Cloudflare 中添加了要管理的域名。

### 2. 获取 Cloudflare API 信息

1. **Zone ID**: 登录 Cloudflare Dashboard，选择域名，在右侧可找到 Zone ID
2. **Global API Key**: Cloudflare Dashboard → My Profile → API Tokens → Global API Key
3. **Email**: 您的 Cloudflare 账户邮箱

### 3. 本地开发（可选）

```bash
# 启动本地开发服务器
npm run dev

# 类型检查
npm run type-check
```

### 4. 部署到 Cloudflare

```bash
# 部署到默认环境
npm run deploy

# 可选：如果需要测试环境，可以创建不同名称的 Worker
npx wrangler deploy --name ip-test
```

## 🔄 更新 Worker

### 方式一：重新一键部署（推荐）

如果您之前使用一键部署，最简单的方法是重新点击部署按钮，Cloudflare 会自动拉取最新代码。

### 方式二：手动更新

如果您是手动部署的，可以通过以下方式更新：

```bash
# 进入项目目录
cd cf-ip-ddns-worker

# 拉取最新代码
git pull origin main

# 安装最新依赖
npm install

# 重新部署
npm run deploy
```

### 方式三：Fork 仓库后更新

如果您 Fork 了这个仓库：

```bash
# 添加上游仓库
git remote add upstream https://github.com/little-twain/cf-ip-ddns-worker.git

# 获取上游更新
git fetch upstream

# 合并更新
git merge upstream/main

# 重新部署
npm run deploy
```

### 5. 查看日志

```bash
npm run tail
```

### 6. 自定义域名（可选）

您可以为 Worker 配置自定义域名：

#### 方法1：通过 Cloudflare Dashboard

1. 登录 Cloudflare Dashboard
2. 进入 Workers & Pages → 选择您的 Worker
3. 设置 → 触发器 → 添加自定义域名

#### 方法2：通过 wrangler.toml 配置

编辑 `wrangler.toml` 文件，取消注释并修改 routes 部分：

```toml
routes = [
  { pattern = "ddns.yourdomain.com", zone_name = "yourdomain.com" },
  { pattern = "ip.yourdomain.com", zone_name = "yourdomain.com" }
]
```

然后重新部署：

```bash
npm run deploy
```

## 安全注意事项

⚠️ **重要提醒**：

- API Key 具有完全的账户权限，请妥善保管
- 建议使用 API Token 替代 Global API Key（需要修改代码中的认证方式）
- 不要在公开的 URL 中暴露 API Key
- 考虑添加访问控制或限流机制

## 常见用途

- 🏠 家庭宽带动态 IP 的 DDNS 服务（支持 IPv4 和 IPv6）
- 🖥️ 服务器 IP 变更自动更新（A 记录和 AAAA 记录）
- 📊 网络设备状态监控
- 🔍 IP 地址查询服务（同时支持双栈网络）

## 技术特点

- 📦 无服务器架构，零运维成本
- 🌍 全球边缘节点，低延迟响应
- 🔗 支持自定义域名
- ⚙️ 完善的错误处理机制
- 🚀 一键部署到 Cloudflare Workers
- 📘 TypeScript 支持，类型安全
- 🌐 IPv4/IPv6 双栈支持，自动识别记录类型

## License

GPL-3.0 License - 详见 [LICENSE](LICENSE) 文件
