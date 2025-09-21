// Figma Plugin Main Code - Rhino to Figma Sync
const SERVER_URL = "http://localhost:4000";

// Display plugin interface
figma.showUI(__html__, { width: 320, height: 250 });

// Handle messages from UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'load-rhino-data') {
    await loadRhinoData();
  } else if (msg.type === 'clear-canvas') {
    clearCanvas();
  } else if (msg.type === 'close-plugin') {
    figma.closePlugin();
  }
};

// Load Rhino data from server
async function loadRhinoData() {
  try {
    figma.ui.postMessage({ type: 'loading', message: 'Loading data from server...' });
    
    const response = await fetch(`${SERVER_URL}/figma-ready.json`);
    if (!response.ok) {
      throw new Error(`Server response error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Data loaded from server:', data);
    
    if (!data.shapes || data.shapes.length === 0) {
      figma.ui.postMessage({ 
        type: 'error', 
        message: 'No geometries found in server response' 
      });
      return;
    }
    
    // Clear current Rhino shapes from canvas
    clearCanvas();
    
    // Create geometries
    const createdShapes = [];
    const createdFrames = {};
    
    // First create all frames
    data.shapes.forEach((shape, index) => {
      if (shape.type === 'FRAME') {
        const figmaShape = createFigmaShape(shape, index, createdFrames);
        if (figmaShape) {
          createdShapes.push(figmaShape);
        }
      }
    });
    
    // Then create all vectors and texts, they will be placed in their parent frames
    const textCreationPromises = [];
    data.shapes.forEach((shape, index) => {
      if (shape.type === 'VECTOR') {
        const figmaShape = createFigmaShape(shape, index, createdFrames);
        if (figmaShape) {
          createdShapes.push(figmaShape);
        }
      } else if (shape.type === 'TEXT') {
        const promise = createFigmaShape(shape, index, createdFrames);
        if (promise) {
          textCreationPromises.push(promise);
        }
      }
    });

    // Wait for all text nodes to finish creation (font loading)
    const createdTextNodes = await Promise.all(textCreationPromises);
    createdTextNodes.filter(Boolean).forEach(node => createdShapes.push(node));
    
    // Select all created shapes and zoom to view
    if (createdShapes.length > 0) {
      figma.currentPage.selection = createdShapes;
      figma.viewport.scrollAndZoomIntoView(createdShapes);
      
      figma.ui.postMessage({ 
        type: 'success', 
        message: `✅ Successfully created ${createdShapes.length} geometries!` 
      });
    } else {
      figma.ui.postMessage({ 
        type: 'error', 
        message: '❌ Unable to create any geometries' 
      });
    }
    
  } catch (error) {
    console.error('Error loading Rhino data:', error);
    figma.ui.postMessage({ 
      type: 'error', 
      message: `❌ Loading failed: ${error.message}` 
    });
  }
}

// Create Figma shape
function createFigmaShape(shape, index, createdFrames = {}) {
  try {
    if (shape.type === 'FRAME') {
      const frame = figma.createFrame();
      frame.name = shape.name || `Frame ${index + 1}`;
      frame.x = shape.x || 0;
      frame.y = shape.y || 0;
      frame.resize(Math.max(1, shape.width || 1), Math.max(1, shape.height || 1));
      frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
      figma.currentPage.insertChild(0, frame);
      
      // Store the frame reference with its ID
      if (shape.id) {
        createdFrames[shape.id] = frame;
      }
      
      return frame;
    }
    if (shape.type === 'TEXT') {
      // Create text node
      const textNode = figma.createText();
      textNode.name = shape.name || `Text ${index + 1}`;
      textNode.x = shape.x || 0;
      textNode.y = shape.y || 0;
      // Load font then set properties
      const family = (shape.font && shape.font.family) || 'Inter';
      const style = (shape.font && shape.font.style) || 'Regular';
      const fontSize = shape.fontSize || 12;
      const fills = shape.fills || [];

      // Ensure font is loaded before setting characters
      return figma.loadFontAsync({ family, style }).then(() => {
        textNode.fontName = { family, style };
        textNode.characters = shape.text || '';
        textNode.fontSize = fontSize;
        if (fills.length > 0) {
          textNode.fills = fills;
        }

        // Parent handling
        if (shape.parentFrameId && createdFrames[shape.parentFrameId]) {
          createdFrames[shape.parentFrameId].appendChild(textNode);
          const parentFrame = createdFrames[shape.parentFrameId];
          textNode.x = (shape.x || 0) - parentFrame.x;
          textNode.y = (shape.y || 0) - parentFrame.y;
        } else {
          figma.currentPage.appendChild(textNode);
        }
        return textNode;
      }).catch(err => {
        console.warn('Font load failed, fallback to default font:', err);
        // Fallback: still set characters and color
        textNode.characters = shape.text || '';
        if (fills.length > 0) {
          textNode.fills = fills;
        }
        if (shape.parentFrameId && createdFrames[shape.parentFrameId]) {
          createdFrames[shape.parentFrameId].appendChild(textNode);
          const parentFrame = createdFrames[shape.parentFrameId];
          textNode.x = (shape.x || 0) - parentFrame.x;
          textNode.y = (shape.y || 0) - parentFrame.y;
        } else {
          figma.currentPage.appendChild(textNode);
        }
        return textNode;
      });
    }
    if (shape.type === 'VECTOR' && shape.vectorPaths) {
      // Create vector shape
      const vector = figma.createVector();
      vector.name = shape.name || `Rhino Shape ${index + 1}`;
      
      // Set position and size
      vector.x = shape.x || 0;
      vector.y = shape.y || 0;
      vector.resize(shape.width || 100, shape.height || 100);
      
      // Set stroke color
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
      
      // Set stroke weight
      if (shape.strokeWeight) {
        vector.strokeWeight = shape.strokeWeight;
      }
      
      // Set vector paths
      if (shape.vectorPaths && shape.vectorPaths.length > 0) {
        const pathData = shape.vectorPaths[0];
        if (pathData.data) {
          // Convert SVG path to Figma vector path
          const vectorPath = parseSVGPath(pathData.data);
          if (vectorPath) {
            vector.vectorPaths = [vectorPath];
          }
        }
      }
      
      // Add to parent frame if it exists, otherwise add to current page
      if (shape.parentFrameId && createdFrames[shape.parentFrameId]) {
        createdFrames[shape.parentFrameId].appendChild(vector);
        
        // Adjust position relative to parent frame
        const parentFrame = createdFrames[shape.parentFrameId];
        vector.x = vector.x - parentFrame.x;
        vector.y = vector.y - parentFrame.y;
      } else {
        figma.currentPage.appendChild(vector);
      }
      
      return vector;
    }
  } catch (error) {
    console.error('Error creating shape:', error);
    return null;
  }
}

// Parse SVG path to Figma vector path
function parseSVGPath(pathData) {
  try {
    // Simplified SVG path parsing
    // Create a basic path structure
    const vectorPath = {
      windingRule: "NONZERO",
      data: pathData
    };
    
    return vectorPath;
  } catch (error) {
    console.error('Error parsing SVG path:', error);
    return null;
  }
}

// Clear all shapes and frames from canvas
function clearCanvas() {
  const currentPage = figma.currentPage;
  const children = [...currentPage.children];
  
  // Remove all shapes and frames
  children.forEach(child => {
    // Remove all frames and Rhino-related shapes
    if (child.type === 'FRAME' || 
        child.name.startsWith('Rhino Shape') || 
        child.name.startsWith('Curve') ||
        child.name.startsWith('Text') ||
        child.type === 'TEXT' ||
        child.name.includes('Rhino')) {
      child.remove();
    }
  });
}

// Plugin initialization
console.log('🦏 Rhino to Figma Sync Plugin loaded');