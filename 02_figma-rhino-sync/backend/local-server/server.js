import express from "express";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import chokidar from "chokidar";

const app = express();
const PORT = 4000;
const JSON_PATH = "C:\\2025_TT_Boston_Hackathon\\01_app\\02_figma-rhino-sync\\backend\\database\\rhino-json-output\\shapes.json";

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

// 解析JSON请求体
app.use(express.json());

// 检查文件和目录是否存在
function checkFileAndDirectory() {
  const dir = path.dirname(JSON_PATH);
  
  // 检查目录是否存在
  if (!fs.existsSync(dir)) {
    console.log(`📁 Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // 检查文件是否存在
  if (!fs.existsSync(JSON_PATH)) {
    console.log(`📄 Creating empty JSON file: ${JSON_PATH}`);
    fs.writeFileSync(JSON_PATH, JSON.stringify([], null, 2));
  }
  
  console.log(`✅ File exists and is ready for monitoring: ${JSON_PATH}`);
}

// 初始化文件和目录
checkFileAndDirectory();

console.log(`👀 Starting to watch: ${JSON_PATH}`);

// 监听 JSON 文件改动
const watcher = chokidar.watch(JSON_PATH, {
  persistent: true,
  ignoreInitial: true,  // 忽略初始扫描
  awaitWriteFinish: {   // 等待写入完成
    stabilityThreshold: 2000,
    pollInterval: 100
  }
});

watcher
  .on('ready', () => {
    console.log('🎯 File watcher is ready and monitoring for changes...');
  })
  .on('change', async (filePath) => {
    console.log(`📝 Detected change in: ${filePath}`);
    console.log("🔄 Processing new JSON export from Rhino...");

    try {
      const data = fs.readFileSync(JSON_PATH, "utf8");
      const payload = JSON.parse(data);

      console.log("📊 JSON data structure:", {
        isArray: Array.isArray(payload),
        length: Array.isArray(payload) ? payload.length : 'N/A',
        firstItem: Array.isArray(payload) && payload.length > 0 ? {
          type: payload[0].type,
          pointsCount: payload[0].points ? payload[0].points.length : 0
        } : 'N/A'
      });

      // 🚨 假设这里你已经有 FIGMA_TOKEN 和 PROJECT_ID
      const FIGMA_TOKEN = "figd_8LRNGSCmTDUazeedJjk9DJmzRjMoiUNamXIF66En"
      const PROJECT_ID = "424404326";
      const FIGMA_FILE_KEY = "4uut9pRxLcTl9aWIbSgmTi";

      // 首先获取当前文件信息
      const getFileRes = await fetch(`https://api.figma.com/v1/files/${FIGMA_FILE_KEY}`, {
        headers: {
          "X-Figma-Token": FIGMA_TOKEN
        }
      });

      if (!getFileRes.ok) {
        console.error("❌ Failed to get Figma file:", await getFileRes.text());
        return;
      }

      const fileData = await getFileRes.json();
      console.log("📄 Current Figma file structure:", {
        documentId: fileData.document?.id,
        pagesCount: fileData.document?.children?.length || 0
      });

      // 计算全局包围盒（用于放置时的全局Y翻转）
      const allY = payload.flatMap(c => (c.points || []).map(p => p[1]));
      const globalMaxY = allY.length ? Math.max(...allY) : 0;

      // 转换 Rhino 曲线数据为 Figma 矢量格式（翻转路径Y并按全局包围盒翻转放置Y）
      const convertedShapes = payload.map((curve, index) => {
        if (curve.type === "curve" && curve.points) {
          // 计算边界框
          const xCoords = curve.points.map(p => p[0]);
          const yCoords = curve.points.map(p => p[1]);
          const minX = Math.min(...xCoords);
          const maxX = Math.max(...xCoords);
          const minY = Math.min(...yCoords);
          const maxY = Math.max(...yCoords);
          const height = maxY - minY;
          
          // 创建矢量路径数据（在转换后的局部坐标系中判断闭合并强制闭合）
          const localPoints = curve.points.map((p) => ({
            x: p[0] - minX,
            y: (maxY - p[1])
          }));
          const tol = 1e-2; // 像素级容差
          const isClosedByPoints = localPoints.length > 1 && Math.hypot(
            localPoints[localPoints.length - 1].x - localPoints[0].x,
            localPoints[localPoints.length - 1].y - localPoints[0].y
          ) < tol;
          const isClosedFlag = curve.closed === true;
          const shouldClose = isClosedFlag || isClosedByPoints;

          let pathDataCore = '';
          localPoints.forEach((pt, i) => {
            pathDataCore += (i === 0 ? `M ${pt.x} ${pt.y}` : ` L ${pt.x} ${pt.y}`);
          });
          // 强化闭合：必要时补一条回到起点的线段，并追加 Z
          const pathData = shouldClose
            ? `${pathDataCore} Z`
            : `${pathDataCore}`;

          return {
            id: `curve-${index}`,
            name: `Curve ${index + 1}`,
            type: "VECTOR",
            x: minX,
            // 放置位置也按全局包围盒翻转，使整体布局不被上下颠倒
            y: globalMaxY - maxY,
            width: maxX - minX,
            height: height,
            fills: [],
            strokes: [{
              type: "SOLID",
              color: {
                r: 0,
                g: 0,
                b: 0
              }
            }],
            strokeWeight: curve.style?.strokeWidth || 2,
            vectorPaths: [{
              windingRule: "NONZERO",
              data: pathData
            }]
          };
        }
        return null;
      }).filter(Boolean);

      console.log(`🎨 Converted ${convertedShapes.length} curves to Figma vectors`);

      // 使用 Figma Plugin API 来创建/更新页面内容
      // 注意：这需要 Figma 插件来执行，服务器端无法直接修改文件内容
      console.log("⚠️  Note: Direct file modification via API is not supported.");
      console.log("💡 Suggestion: Use Figma Plugin to read from /latest.json endpoint");
      console.log("📊 Available shapes data:", convertedShapes.length);

    } catch (error) {
      console.error("❌ Error processing file change:", error.message);
    }
  })
  .on('error', (error) => {
    console.error('❌ File watcher error:', error);
  });

// 健康检查端点
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    watchedFile: JSON_PATH,
    fileExists: fs.existsSync(JSON_PATH)
  });
});

// 提供一个 endpoint 给 Figma 插件来访问原始 JSON
app.get("/latest.json", (req, res) => {
  try {
    if (!fs.existsSync(JSON_PATH)) {
      return res.status(404).json({ error: "JSON file not found" });
    }
    const data = fs.readFileSync(JSON_PATH, "utf8");
    res.json(JSON.parse(data));
  } catch (error) {
    res.status(500).json({ error: "Failed to read JSON file", message: error.message });
  }
});

// 提供一个 endpoint 给 Figma 插件来访问转换后的数据
app.get("/figma-ready.json", (req, res) => {
  try {
    if (!fs.existsSync(JSON_PATH)) {
      return res.status(404).json({ error: "JSON file not found" });
    }
    
    const data = fs.readFileSync(JSON_PATH, "utf8");
    const payload = JSON.parse(data);
    
    // 计算全局包围盒（用于放置时的全局Y翻转）
    const allY = payload.flatMap(c => (c.points || []).map(p => p[1]));
    const globalMaxY = allY.length ? Math.max(...allY) : 0;

    // 转换 Rhino 曲线数据为 Figma 矢量格式（翻转路径Y并按全局包围盒翻转放置Y）
    const convertedShapes = payload.map((curve, index) => {
      if (curve.type === "curve" && curve.points) {
        // 计算边界框
        const xCoords = curve.points.map(p => p[0]);
        const yCoords = curve.points.map(p => p[1]);
        const minX = Math.min(...xCoords);
        const maxX = Math.max(...xCoords);
        const minY = Math.min(...yCoords);
        const maxY = Math.max(...yCoords);
        const height = maxY - minY;
        
        // 创建矢量路径数据（在转换后的局部坐标系中判断闭合并强制闭合）
        const localPoints = curve.points.map((p) => ({
          x: p[0] - minX,
          y: (maxY - p[1])
        }));
        const tol = 1e-2; // 像素级容差
        const isClosedByPoints = localPoints.length > 1 && Math.hypot(
          localPoints[localPoints.length - 1].x - localPoints[0].x,
          localPoints[localPoints.length - 1].y - localPoints[0].y
        ) < tol;
        const isClosedFlag = curve.closed === true;
        const shouldClose = isClosedFlag || isClosedByPoints;

        let pathDataCore = '';
        localPoints.forEach((pt, i) => {
          pathDataCore += (i === 0 ? `M ${pt.x} ${pt.y}` : ` L ${pt.x} ${pt.y}`);
        });
        // 强化闭合：必要时补一条回到起点的线段，并追加 Z
        const pathData = shouldClose
          ? `${pathDataCore} Z`
          : `${pathDataCore}`;

        return {
          id: `curve-${index}`,
          name: `Curve ${index + 1}`,
          type: "VECTOR",
          x: minX,
          // 放置位置也按全局包围盒翻转，使整体布局不被上下颠倒
          y: globalMaxY - maxY,
          width: maxX - minX,
          height: height,
          fills: [],
          strokes: [{
            type: "SOLID",
            color: {
              r: 0,
              g: 0,
              b: 0
            }
          }],
          strokeWeight: curve.style?.strokeWidth || 2,
          vectorPaths: [{
            windingRule: "NONZERO",
            data: pathData
          }]
        };
      }
      return null;
    }).filter(Boolean);
    
    res.json({
      shapes: convertedShapes,
      metadata: {
        totalShapes: convertedShapes.length,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to process JSON file", message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Local server running at http://localhost:${PORT}`);
  console.log(`🎯 Monitoring file: ${JSON_PATH}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📄 Latest JSON: http://localhost:${PORT}/latest.json`);
  console.log(`🎨 Figma ready: http://localhost:${PORT}/figma-ready.json`);
});