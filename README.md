# cf-ip-ddns-worker

🌐 简单的 Cloudflare Worker，用于返回访问者 IP 地址并可选择性地通过 Cloudflare API 更新 DNS 记录。

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/little-twain/cf-ip-ddns-worker)

## 功能特性

- 🌐 **IP 检测**：访问任意路径返回客户端真实 IP 地址（支持 IPv4 和 IPv6）
- 🔄 **DDNS 更新**：通过 URL 参数自动更新 Cloudflare DNS 记录（A 记录用于 IPv4，AAAA 记录用于 IPv6）
- ⚡ **快速响应**：基于 Cloudflare Workers 的边缘计算
- 🤖 **智能记录类型**：根据请求 IP 类型自动选择 A 记录或 AAAA 记录

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
# 用户访问时，自动更新 DNS 记录
curl "https://your-worker.your-subdomain.workers.dev/?zone=ZONE_ID&email=YOUR_EMAIL&key=YOUR_API_KEY&name=subdomain.example.com"

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

## 安全注意事项

⚠️ **重要提醒**：

- API Key 具有完全的账户权限，请妥善保管
- 建议使用 API Token 替代 Global API Key（需要修改代码中的认证方式）
- 不要在公开的 URL 中暴露 API Key
- 考虑添加访问控制或限流机制

## License

GPL-3.0 License - 详见 [LICENSE](LICENSE) 文件
