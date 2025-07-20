# cf-ip-ddns-worker

🌐 简单的 Cloudflare Worker，用于返回访问者 IP 地址并可选择性地通过 Cloudflare API 更新 DNS 记录。

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/little-twain/cf-ip-ddns-worker)

## 功能特性

- 🌐 **IP 检测**：访问任意路径返回客户端真实 IP 地址（支持 IPv4 和 IPv6）
- 🔄 **DDNS 更新**：通过 URL 参数自动更新 Cloudflare DNS 记录（A 记录用于 IPv4，AAAA 记录用于 IPv6）
- ⚡ **快速响应**：基于 Cloudflare Workers 的边缘计算
- 🤖 **智能记录类型**：根据请求 IP 类型自动选择 A 记录或 AAAA 记录
- 🗄️ **智能缓存**：内置 LRU 缓存机制，支持高达 70 万条记录，24小时 TTL
- 📊 **监控功能**：提供缓存统计和 DNS 记录状态查询接口

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

### 监控和统计

#### 查看缓存统计

```bash
# 获取缓存性能统计
curl "https://your-worker.your-subdomain.workers.dev/?stats"
```

**响应示例：**

```json
{
    "timestamp": "2025-01-21T10:30:00.000Z",
    "clientIP": "1.2.3.4",
    "statistics": {
        "sets": 25,
        "ratio": "1:2"
    }
}
```

**字段说明：**

- `sets`: 缓存中当前存储的条目数量
- `ratio`: 缓存命中与未命中的比例（格式为"命中:未命中"，自动简化为最小整数比）

#### 查询 DNS 记录状态

```bash
# 查询特定记录的缓存状态
curl "https://your-worker.your-subdomain.workers.dev/?info=ZONE_ID+DNS_RECORD_ID"
```

**响应示例：**

仅有A记录缓存时：

```json
{
    "timestamp": "2025-01-21T10:30:00.000Z",
    "clientIP": "1.2.3.4",
    "A": {
        "content": "192.0.2.1",
        "cached": true
    }
}
```

仅有AAAA记录缓存时：

```json
{
    "timestamp": "2025-01-21T10:30:00.000Z",
    "clientIP": "2001:0db8::1",
    "AAAA": {
        "content": "2001:0db8::1",
        "cached": true
    }
}
```

当域名同时有A和AAAA记录缓存时：

```json
{
    "timestamp": "2025-01-21T10:30:00.000Z",
    "clientIP": "1.2.3.4",
    "A": {
        "content": "192.0.2.1",
        "cached": true
    },
    "AAAA": {
        "content": "2001:0db8::1",
        "cached": true
    }
}
```

如果没有缓存记录：

```json
{
    "timestamp": "2025-01-21T10:30:00.000Z",
    "clientIP": "1.2.3.4",
    "message": "No cached records found for this domain"
}
```

**说明：**

- 只返回在缓存中实际存在的记录类型（A、AAAA或两者）
- 纯IPv4环境的域名只会返回A记录
- 纯IPv6环境的域名只会返回AAAA记录
- 双栈环境的域名同时返回A和AAAA记录
- 如果该域名从未被访问过或缓存已过期，则提示无缓存记录

**获取DNS记录ID：**

DNS记录ID可以通过Cloudflare API获取：

```bash
# 查询A记录
curl -X GET "https://api.cloudflare.com/client/v4/zones/ZONE_ID/dns_records?type=A&name=your.domain.com" \
  -H "X-Auth-Email: your@email.com" \
  -H "X-Auth-Key: your_api_key" \
  -H "Content-Type: application/json"

# 查询AAAA记录  
curl -X GET "https://api.cloudflare.com/client/v4/zones/ZONE_ID/dns_records?type=AAAA&name=your.domain.com" \
  -H "X-Auth-Email: your@email.com" \
  -H "X-Auth-Key: your_api_key" \
  -H "Content-Type: application/json"
```

响应中的 `result[0].id` 字段即为DNS记录ID。

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

**DDNS 更新参数：**

- `zone`: Cloudflare Zone ID
- `email`: Cloudflare 账户邮箱
- `key`: Cloudflare Global API Key
- `name`: 要更新的 DNS 记录名称（如 `home.example.com`）

**监控参数：**

- `stats`: 无值，获取缓存统计信息
- `info`: 格式为 `zoneID+recordName`，查询 DNS 记录缓存状态

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

## 缓存机制说明

🗄️ **智能缓存系统**：

- **缓存容量**：支持 70 万条 DNS 记录缓存
- **缓存策略**：采用 LRU 算法管理内存
- **缓存时间**：24 小时 TTL，自动过期清理
- **性能优化**：显著减少 Cloudflare API 调用次数
- **命中统计**：实时跟踪缓存命中率和性能指标

**缓存工作原理**：

1. 首次 DDNS 更新时，IP 地址被缓存 24 小时
2. 后续相同 IP 的请求直接返回，无需 API 调用
3. IP 变化时自动更新 DNS 记录并刷新缓存
4. 超出容量时自动清理最旧的缓存条目

## License

GPL-3.0 License - 详见 [LICENSE](LICENSE) 文件
