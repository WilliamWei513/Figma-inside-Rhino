// Figma Plugin Main Code - Rhino to Figma Sync
const SERVER_URL = "http://localhost:4000";

// 显示插件界面
figma.showUI(__html__, { width: 320, height: 250 });

// 处理来自UI的消息
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'load-rhino-data') {
    await loadRhinoData();
  } else if (msg.type === 'clear-canvas') {
    clearCanvas();
  } else if (msg.type === 'close-plugin') {
    figma.closePlugin();
  }
};

// 从服务器加载Rhino数据
async function loadRhinoData() {
  try {
    figma.ui.postMessage({ type: 'loading', message: '正在从服务器加载数据...' });
    
    const response = await fetch(`${SERVER_URL}/figma-ready.json`);
    if (!response.ok) {
      throw new Error(`服务器响应错误: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('从服务器加载的数据:', data);
    
    if (!data.shapes || data.shapes.length === 0) {
      figma.ui.postMessage({ 
        type: 'error', 
        message: '服务器返回的数据中没有几何体' 
      });
      return;
    }
    
    // 清空当前画布上的Rhino图形
    clearCanvas();
    
    // 创建几何体
    const createdShapes = [];
    data.shapes.forEach((shape, index) => {
      const figmaShape = createFigmaShape(shape, index);
      if (figmaShape) {
        createdShapes.push(figmaShape);
      }
    });
    
    // 选中所有创建的图形并缩放到视图
    if (createdShapes.length > 0) {
      figma.currentPage.selection = createdShapes;
      figma.viewport.scrollAndZoomIntoView(createdShapes);
      
      figma.ui.postMessage({ 
        type: 'success', 
        message: `✅ 成功创建 ${createdShapes.length} 个几何体！` 
      });
    } else {
      figma.ui.postMessage({ 
        type: 'error', 
        message: '❌ 无法创建任何几何体' 
      });
    }
    
  } catch (error) {
    console.error('加载Rhino数据时出错:', error);
    figma.ui.postMessage({ 
      type: 'error', 
      message: `❌ 加载失败: ${error.message}` 
    });
  }
}

// 创建Figma图形
function createFigmaShape(shape, index) {
  try {
    if (shape.type === 'VECTOR' && shape.vectorPaths) {
      // 创建矢量图形
      const vector = figma.createVector();
      vector.name = shape.name || `Rhino Shape ${index + 1}`;
      
      // 设置位置和尺寸
      vector.x = shape.x || 0;
      vector.y = shape.y || 0;
      vector.resize(shape.width || 100, shape.height || 100);
      
      // 设置描边颜色
      if (shape.strokes && shape.strokes.length > 0) {
        const stroke = shape.strokes[0];
        if (stroke.type === 'SOLID' && stroke.color) {
          vector.strokes = [{
            type: 'SOLID',
            color: {
              r: stroke.color.r,
              g: stroke.color.g,
              b: stroke.color.b
            }
          }];
        }
      }
      
      // 设置线宽
      if (shape.strokeWeight) {
        vector.strokeWeight = shape.strokeWeight;
      }
      
      // 设置矢量路径
      if (shape.vectorPaths && shape.vectorPaths.length > 0) {
        const pathData = shape.vectorPaths[0];
        if (pathData.data) {
          // 将SVG路径转换为Figma矢量路径
          const vectorPath = parseSVGPath(pathData.data);
          if (vectorPath) {
            vector.vectorPaths = [vectorPath];
          }
        }
      }
      
      // 添加到当前页面
      figma.currentPage.appendChild(vector);
      return vector;
    }
  } catch (error) {
    console.error('创建图形时出错:', error);
    return null;
  }
}

// 解析SVG路径为Figma矢量路径
function parseSVGPath(pathData) {
  try {
    // 简化的SVG路径解析
    // 这里我们创建一个基本的路径结构
    const vectorPath = {
      windingRule: "NONZERO",
      data: pathData
    };
    
    return vectorPath;
  } catch (error) {
    console.error('解析SVG路径时出错:', error);
    return null;
  }
}

// 清空画布上的Rhino图形
function clearCanvas() {
  const currentPage = figma.currentPage;
  const children = [...currentPage.children];
  
  // 删除所有Rhino相关的图形
  children.forEach(child => {
    if (child.name.startsWith('Rhino Shape') || 
        child.name.startsWith('Curve') ||
        child.name.includes('Rhino')) {
      child.remove();
    }
  });
}

// 插件启动时的初始化
console.log('🦏 Rhino to Figma Sync Plugin 已加载');
