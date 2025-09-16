# 🦏 Rhino to Figma Sync Plugin

这个 Figma 插件可以将 Rhino 中的几何体实时同步到 Figma 画布中。

## 🚀 快速开始

### 1. 确保服务器运行
首先确保你的本地服务器正在运行：
```bash
cd 02_figma-rhino-sync/backend/local-server
npm start
```
服务器应该在 `http://localhost:4000` 运行。

### 2. 安装 Figma 插件

1. 打开 **Figma Desktop** 应用（注意：必须是桌面版，网页版不支持开发插件）
2. 进入 **Plugins** → **Development** → **Import plugin from manifest...**
3. 选择 `02_figma-rhino-sync/frontend/manifest.json` 文件
4. 插件会出现在你的开发插件列表中

### 3. 运行插件

1. 在 Figma 中打开任意文件
2. 进入 **Plugins** → **Development** → **Rhino to Figma Sync**
3. 插件界面会弹出，显示服务器状态

## 🎯 使用方法

### 基本操作
1. **检查状态**：插件会自动检查服务器连接状态
2. **加载数据**：点击"加载 Rhino 数据"按钮同步几何体
3. **清空画布**：点击"清空画布"按钮清除之前创建的几何体
4. **关闭插件**：点击"关闭插件"按钮

### 数据同步流程
1. 插件从 `http://localhost:4000/figma-ready.json` 读取数据
2. 将 Rhino 曲线数据转换为 Figma 矢量图形
3. 自动添加到当前页面并选中
4. 自动缩放到视图以显示所有图形

## 🔧 功能特性

- ✅ **实时同步**：从服务器实时获取最新的 Rhino 几何体
- ✅ **自动转换**：将曲线数据转换为 Figma 矢量图形
- ✅ **保持样式**：保留原始的位置、尺寸、颜色和线宽
- ✅ **批量导入**：支持多个几何体同时导入
- ✅ **智能视图**：自动选中和缩放视图到新创建的图形
- ✅ **状态监控**：实时显示服务器连接状态
- ✅ **错误处理**：友好的错误提示和状态反馈
- ✅ **一键清空**：快速清除之前导入的图形

## 📁 文件结构

```
frontend/
├── manifest.json    # 插件配置文件
├── code.js         # 插件主逻辑（Figma API）
├── ui.html         # 插件用户界面
└── README.md       # 说明文档
```

## 🐛 故障排除

### 插件无法加载
- **检查 Figma 版本**：确保使用 Figma Desktop 应用
- **检查文件路径**：确保 manifest.json 文件路径正确
- **重新导入**：尝试重新导入 manifest.json 文件

### 无法连接服务器
- **检查服务器状态**：确保服务器在 `http://localhost:4000` 运行
- **检查防火墙**：确保防火墙允许 Figma 访问 localhost
- **重启服务器**：尝试重启本地服务器

### 数据加载失败
- **检查数据格式**：确保 `shapes.json` 文件存在且格式正确
- **检查网络**：确保 Figma 可以访问 localhost 域名
- **查看控制台**：在 Figma 中按 F12 查看控制台错误信息

### 几何体显示不正确
- **检查数据转换**：确保服务器正确转换了数据格式
- **检查坐标系统**：Figma 和 Rhino 的坐标系统可能不同
- **调整缩放**：可能需要手动调整视图缩放

## 🔄 开发模式

如果你需要修改插件代码：

1. **修改代码**：编辑 `code.js` 或 `ui.html` 文件
2. **重新加载**：在 Figma 中按 `Ctrl+R` (Windows) 或 `Cmd+R` (Mac)
3. **重新导入**：或者重新导入 manifest.json 文件

## 📝 技术细节

### 数据流程
1. **Rhino** → 导出几何体到 `shapes.json`
2. **服务器** → 监听文件变化，转换为 Figma 格式
3. **插件** → 从服务器获取数据，创建 Figma 图形

### 支持的几何体类型
- ✅ 曲线 (Curves)
- ✅ 矢量路径 (Vector Paths)
- ✅ 描边样式 (Stroke Styles)

### 网络权限
插件需要访问 `localhost` 域名的权限，这在 manifest.json 中已配置。

## 🎨 自定义

你可以根据需要修改以下内容：
- **服务器地址**：在 `code.js` 中修改 `SERVER_URL`
- **图形样式**：在 `createFigmaShape` 函数中调整样式
- **用户界面**：在 `ui.html` 中修改界面设计

## 📞 支持

如果遇到问题：
1. 检查服务器日志
2. 查看 Figma 控制台错误
3. 确保所有依赖都正确安装
4. 尝试重启 Figma 应用
