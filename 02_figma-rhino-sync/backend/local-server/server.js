import express from "express";
import fs from "fs";
import fetch from "node-fetch";
import chokidar from "chokidar";

const app = express();
const PORT = 4000;
const JSON_PATH = "C:\\2025_TT_Boston_Hackathon\\01_app\\02_figma-rhino-sync\\backend\\database\\rhino-json-output\\shapes.json";

// 监听 JSON 文件改动
chokidar.watch(JSON_PATH).on("change", async () => {
  console.log("Detected new JSON export from Rhino");

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

  try {
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

    // 转换 Rhino 曲线数据为 Figma 矢量格式
    const convertedShapes = payload.map((curve, index) => {
      if (curve.type === "curve" && curve.points) {
        // 计算边界框
        const xCoords = curve.points.map(p => p[0]);
        const yCoords = curve.points.map(p => p[1]);
        const minX = Math.min(...xCoords);
        const maxX = Math.max(...xCoords);
        const minY = Math.min(...yCoords);
        const maxY = Math.max(...yCoords);
        
        // 创建矢量路径数据
        const pathData = curve.points.map((point, i) => {
          const x = point[0] - minX; // 相对坐标
          const y = point[1] - minY;
          return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
        }).join(' ');

        return {
          id: `curve-${index}`,
          name: `Curve ${index + 1}`,
          type: "VECTOR",
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
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
    console.error("❌ Error processing Figma file:", error.message);
  }
});

// 提供一个 endpoint 给 Figma 插件来访问原始 JSON
app.get("/latest.json", (req, res) => {
  const data = fs.readFileSync(JSON_PATH, "utf8");
  res.json(JSON.parse(data));
});

// 提供一个 endpoint 给 Figma 插件来访问转换后的数据
app.get("/figma-ready.json", (req, res) => {
  const data = fs.readFileSync(JSON_PATH, "utf8");
  const payload = JSON.parse(data);
  
  // 转换 Rhino 曲线数据为 Figma 矢量格式
  const convertedShapes = payload.map((curve, index) => {
    if (curve.type === "curve" && curve.points) {
      // 计算边界框
      const xCoords = curve.points.map(p => p[0]);
      const yCoords = curve.points.map(p => p[1]);
      const minX = Math.min(...xCoords);
      const maxX = Math.max(...xCoords);
      const minY = Math.min(...yCoords);
      const maxY = Math.max(...yCoords);
      
      // 创建矢量路径数据
      const pathData = curve.points.map((point, i) => {
        const x = point[0] - minX; // 相对坐标
        const y = point[1] - minY;
        return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
      }).join(' ');

      return {
        id: `curve-${index}`,
        name: `Curve ${index + 1}`,
        type: "VECTOR",
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
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
});

app.listen(PORT, () => {
  console.log(`🚀 Local server running at http://localhost:${PORT}`);
});