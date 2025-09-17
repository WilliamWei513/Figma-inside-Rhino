# Rhino to Figma Sync - Backend Server

## 项目概述

这是一个本地服务器，用于监控Rhino导出的JSON文件变化，并通过REST API为Figma插件提供几何体数据。服务器实现了从Rhino 3D几何体到Figma 2D矢量图形的转换。

## 功能特性

- 🔍 **文件监控**: 实时监控Rhino导出的JSON文件变化
- 🔄 **数据转换**: 将Rhino曲线数据转换为Figma矢量格式
- 🌐 **REST API**: 提供多个端点供Figma插件访问
- 🔒 **CORS支持**: 配置跨域访问以支持Figma插件
- 📊 **健康检查**: 提供服务器状态监控

## 技术栈

- **Node.js** - 运行时环境
- **Express.js** - Web框架
- **Chokidar** - 文件监控库
- **node-fetch** - HTTP请求库

## 安装和运行

### 1. 安装依赖

```bash
cd local-server
npm install
```

### 2. 启动服务器

```bash
npm start
# 或者
node server.js
```

### 3. 验证服务器运行

服务器启动后会显示以下信息：
```
✅ File exists and is ready for monitoring: [JSON文件路径]
👀 Starting to watch: [JSON文件路径]
🚀 Local server running at http://localhost:4000
🎯 Monitoring file: [JSON文件路径]
🔗 Health check: http://localhost:4000/health
📄 Latest JSON: http://localhost:4000/latest.json
🎨 Figma ready: http://localhost:4000/figma-ready.json
🎯 File watcher is ready and monitoring for changes...
```

## API 端点

### 1. 健康检查
- **URL**: `GET /health`
- **描述**: 检查服务器状态和文件监控情况
- **响应示例**:
```json
{
  "status": "ok",
  "timestamp": "2025-09-17T02:27:04.024Z",
  "watchedFile": "C:\\path\\to\\shapes.json",
  "fileExists": true
}
```

### 2. 原始数据
- **URL**: `GET /latest.json`
- **描述**: 获取Rhino导出的原始JSON数据
- **响应**: 原始曲线数据数组

### 3. Figma就绪数据
- **URL**: `GET /figma-ready.json`
- **描述**: 获取转换为Figma格式的几何体数据
- **响应示例**:
```json
{
  "shapes": [
    {
      "id": "curve-0",
      "name": "Curve 1",
      "type": "VECTOR",
      "x": 0,
      "y": 0,
      "width": 1920,
      "height": 1080,
      "fills": [],
      "strokes": [{"type": "SOLID", "color": {"r": 0, "g": 0, "b": 0}}],
      "strokeWeight": 2,
      "vectorPaths": [{"windingRule": "NONZERO", "data": "M 0 0 L 120 0 ..."}]
    }
  ],
  "metadata": {
    "totalShapes": 1,
    "lastUpdated": "2025-09-17T02:27:04.024Z"
  }
}
```

## 配置说明

### 文件路径配置
服务器监控的JSON文件路径在 `server.js` 中配置：
```javascript
const JSON_PATH = "C:\\2025_TT_Boston_Hackathon\\01_app\\02_figma-rhino-sync\\backend\\database\\rhino-json-output\\shapes.json";
```

### 端口配置
默认端口为4000，可在 `server.js` 中修改：
```javascript
const PORT = 4000;
```

## CORS (跨域资源共享) 详解

### 什么是CORS？

CORS (Cross-Origin Resource Sharing) 是一个Web安全机制，用来控制哪些网站可以访问你的服务器资源。

### CORS的作用

当你的Figma插件（运行在 `figma.com` 域名下）尝试访问你的本地服务器（`localhost:4000`）时，浏览器会进行**同源策略**检查。由于域名不同，浏览器默认会阻止这种跨域请求，这就是为什么没有CORS配置时插件无法检测到服务器。

### 为什么需要CORS？

1. **浏览器安全策略**：防止恶意网站访问你的私人数据
2. **跨域请求限制**：`figma.com` → `localhost:4000` 属于跨域
3. **预检请求**：浏览器会先发送OPTIONS请求检查权限

### CORS工作流程

```
Figma插件 → 浏览器检查同源策略 → 发送预检请求 → 服务器返回CORS头部 → 允许实际请求
```

## 调试经验总结

### 问题1: Figma插件显示"服务器离线"

**症状**: Figma插件界面显示红色圆点，提示服务器离线

**原因**: 缺少CORS（跨域资源共享）配置

**解决方案1 - 手动配置CORS中间件**:
```javascript
// 启用CORS以允许Figma插件访问
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});
```

**解决方案2 - 使用cors包（推荐）**:
```bash
npm install cors
```

```javascript
import cors from "cors";
app.use(cors()); // 添加这一行
```

### 开发 vs 生产环境CORS配置

- **开发环境**：使用 `app.use(cors())` 最简单
- **生产环境**：应该限制允许的域名，提高安全性

### 问题2: 服务器启动路径错误

**症状**: 在错误目录运行 `node server.js` 导致 "Cannot find module" 错误

**原因**: 在项目根目录而不是 `local-server` 目录运行命令

**解决方案**: 确保在正确的目录启动服务器
```bash
cd 02_figma-rhino-sync/backend/local-server
node server.js
```

### 问题3: 端口占用

**症状**: 服务器无法启动，提示端口被占用

**解决方案**: 清理Node.js进程并重新启动
```bash
# Windows
taskkill /F /IM node.exe
netstat -ano | findstr :4000

# 重新启动
node server.js
```

## 完整系统行为分析

### 系统架构图

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────┐
│   Rhino     │───▶│  JSON File   │───▶│   Server    │───▶│  Figma      │
│   (3D CAD)  │    │ (shapes.json)│    │ (Node.js)   │    │  Plugin     │
└─────────────┘    └──────────────┘    └─────────────┘    └─────────────┘
                           │                    │                    │
                           ▼                    ▼                    ▼
                    ┌──────────────┐    ┌─────────────┐    ┌─────────────┐
                    │  File Watch  │    │   REST API  │    │   Canvas    │
                    │  (Chokidar)  │    │ (Express)   │    │  Rendering  │
                    └──────────────┘    └─────────────┘    └─────────────┘
```

### 详细数据流程

#### 步骤1: Rhino数据导出
```
Rhino 3D模型 → 几何体提取 → JSON格式导出 → shapes.json文件
```

**数据格式示例**:
```json
[
  {
    "type": "curve",
    "points": [[0,1080], [0,960], [120,0], [1920,0]],
    "style": {"strokeWidth": 2}
  }
]
```

#### 步骤2: 文件监控系统
```
Chokidar监听 → 文件变化检测 → 触发change事件 → 服务器处理
```

**监控配置**:
```javascript
const watcher = chokidar.watch(JSON_PATH, {
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 2000,  // 等待2秒确保文件写入完成
    pollInterval: 100          // 每100ms检查一次
  }
});
```

#### 步骤3: 数据转换处理
```
原始JSON → 边界框计算 → 坐标转换 → Figma矢量格式
```

**转换过程**:
1. **边界框计算**: 找到所有点的最小/最大X、Y坐标
2. **坐标转换**: 将绝对坐标转换为相对坐标
3. **路径生成**: 创建SVG路径数据
4. **格式转换**: 转换为Figma矢量对象格式

#### 步骤4: CORS跨域处理
```
Figma插件请求 → 浏览器同源检查 → 预检请求(OPTIONS) → CORS头部响应 → 实际请求
```

**CORS请求流程**:
```
1. Figma插件发送: GET http://localhost:4000/health
2. 浏览器检查: figma.com → localhost:4000 (跨域)
3. 浏览器发送预检: OPTIONS http://localhost:4000/health
4. 服务器响应: Access-Control-Allow-Origin: *
5. 浏览器允许: 发送实际GET请求
6. 服务器响应: 返回健康检查数据
```

#### 步骤5: API数据提供
```
客户端请求 → 路由匹配 → 数据读取 → 格式转换 → JSON响应
```

**API端点处理流程**:
- `/health`: 直接返回服务器状态
- `/latest.json`: 返回原始Rhino数据
- `/figma-ready.json`: 返回转换后的Figma格式数据

#### 步骤6: Figma插件渲染
```
数据获取 → 几何体创建 → 矢量路径设置 → 画布渲染 → 用户交互
```

**Figma渲染过程**:
1. **矢量创建**: `figma.createVector()`
2. **属性设置**: 位置、尺寸、描边、填充
3. **路径设置**: `vector.vectorPaths = [vectorPath]`
4. **画布添加**: `figma.currentPage.appendChild(vector)`
5. **视图调整**: `figma.viewport.scrollAndZoomIntoView()`

### 错误处理机制

#### 文件监控错误
```javascript
watcher.on('error', (error) => {
  console.error('❌ File watcher error:', error);
});
```

#### API错误处理
```javascript
try {
  const data = fs.readFileSync(JSON_PATH, "utf8");
  res.json(JSON.parse(data));
} catch (error) {
  res.status(500).json({ 
    error: "Failed to read JSON file", 
    message: error.message 
  });
}
```

#### 插件错误处理
```javascript
try {
  const response = await fetch(`${SERVER_URL}/figma-ready.json`);
  if (!response.ok) {
    throw new Error(`服务器响应错误: ${response.status}`);
  }
} catch (error) {
  figma.ui.postMessage({ 
    type: 'error', 
    message: `❌ 加载失败: ${error.message}` 
  });
}
```

### 性能优化考虑

1. **文件监控优化**: 使用`awaitWriteFinish`避免频繁触发
2. **数据缓存**: 避免重复读取和转换相同数据
3. **错误恢复**: 自动重试机制和降级处理
4. **内存管理**: 及时清理不需要的监听器和事件处理器

### 安全考虑

1. **CORS配置**: 生产环境应限制允许的域名
2. **输入验证**: 验证JSON数据格式和内容
3. **错误信息**: 避免暴露敏感的系统信息
4. **文件权限**: 确保JSON文件访问权限正确

## 监控和日志

服务器提供详细的日志输出：
- 📁 目录和文件创建
- 👀 文件监控状态
- 📝 文件变化检测
- 📊 数据转换统计
- 🎨 几何体转换结果

## 故障排除

### 故障排除流程图

```
Figma插件显示"服务器离线"
           │
           ▼
    检查服务器是否运行
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
服务器未运行    服务器运行中
    │             │
    ▼             ▼
启动服务器      检查CORS配置
    │             │
    ▼             ▼
检查端口占用    检查网络连接
    │             │
    ▼             ▼
清理进程        检查防火墙
    │             │
    ▼             ▼
重新启动        测试API端点
```

### 详细故障排除步骤

#### 步骤1: 检查服务器状态
```bash
# 检查服务器是否响应
curl http://localhost:4000/health

# 预期响应
{
  "status": "ok",
  "timestamp": "2025-09-17T02:27:04.024Z",
  "watchedFile": "C:\\path\\to\\shapes.json",
  "fileExists": true
}
```

#### 步骤2: 检查端口占用
```bash
# Windows
netstat -ano | findstr :4000

# 如果端口被占用，清理进程
taskkill /F /IM node.exe
```

#### 步骤3: 检查CORS配置
```bash
# 检查响应头是否包含CORS信息
curl -I http://localhost:4000/health

# 预期响应头
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization
```

#### 步骤4: 检查数据端点
```bash
# 检查原始数据
curl http://localhost:4000/latest.json

# 检查转换后数据
curl http://localhost:4000/figma-ready.json
```

#### 步骤5: 检查文件监控
```bash
# 检查JSON文件是否存在
ls "C:\2025_TT_Boston_Hackathon\01_app\02_figma-rhino-sync\backend\database\rhino-json-output\shapes.json"

# 检查文件内容
cat shapes.json
```

### 常见错误及解决方案

#### 错误1: "Cannot find module"
```
Error: Cannot find module 'C:\path\to\server.js'
```
**解决方案**: 确保在正确的目录运行命令
```bash
cd 02_figma-rhino-sync/backend/local-server
node server.js
```

#### 错误2: "Port 4000 is already in use"
```
Error: listen EADDRINUSE: address already in use :::4000
```
**解决方案**: 清理占用端口的进程
```bash
taskkill /F /IM node.exe
netstat -ano | findstr :4000
```

#### 错误3: "CORS policy: No 'Access-Control-Allow-Origin'"
```
Access to fetch at 'http://localhost:4000/health' from origin 'https://www.figma.com' 
has been blocked by CORS policy
```
**解决方案**: 添加CORS配置
```javascript
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});
```

#### 错误4: "JSON file not found"
```
{"error": "JSON file not found"}
```
**解决方案**: 检查文件路径和权限
```bash
# 检查文件是否存在
ls -la "C:\path\to\shapes.json"

# 检查目录权限
ls -la "C:\path\to\directory"
```

### 调试工具和命令

#### 网络调试
```bash
# 检查网络连接
ping localhost

# 检查端口监听
netstat -tulpn | grep :4000

# 使用telnet测试连接
telnet localhost 4000
```

#### 日志调试
```bash
# 查看服务器日志
node server.js 2>&1 | tee server.log

# 实时监控日志
tail -f server.log
```

#### 浏览器调试
```javascript
// 在浏览器控制台测试
fetch('http://localhost:4000/health')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));
```

## 开发注意事项

1. **文件路径**: 确保JSON文件路径正确且可访问
2. **CORS配置**: 必须配置CORS以支持Figma插件
3. **错误处理**: 添加适当的错误处理和日志记录
4. **数据验证**: 验证JSON数据格式和完整性
5. **性能优化**: 考虑大量数据时的性能影响

## 版本信息

- **Node.js**: v22.17.1
- **Express**: ^5.1.0
- **Chokidar**: ^4.0.3
- **node-fetch**: ^3.3.2

## 许可证

ISC License
