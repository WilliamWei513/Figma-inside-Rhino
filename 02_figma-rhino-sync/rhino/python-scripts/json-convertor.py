import Rhino
import Rhino.Geometry as rg
import rhinoscriptsyntax as rs
import scriptcontext as sc
import System
import os, json

def to_curve(obj):
    if isinstance(obj, rg.Curve):
        return obj
    elif isinstance(obj, System.Guid):
        return rs.coercecurve(obj)
    return None

def curve_to_points(curve, points_per_unit=1.0, min_segments=2, max_segments=10000):
    if not curve: return []
    # Calculate segments dynamically based on length * density, with bounds
    length = curve.GetLength() or 0.0
    segments = int(round(length * points_per_unit))
    if segments < min_segments:
        segments = min_segments
    if segments > max_segments:
        segments = max_segments

    # For closed curves, avoid duplicate end points
    include_end = not curve.IsClosed
    t_vals = curve.DivideByCount(segments, include_end)
    if not t_vals: return []
    pts = [curve.PointAt(t) for t in t_vals]
    return [[round(p.X,3), round(p.Y,3)] for p in pts]

def check_curve_frame_intersection(curve, frame_bbox):
    """Check if a curve intersects with or is contained by a frame's bounding box (2D XY)."""
    if not curve or not frame_bbox: return False

    # Helpers for 2D bbox tests (XY only)
    def aabb_overlap_xy(bb1, bb2):
        return not (
            bb1.Max.X < bb2.Min.X or
            bb1.Min.X > bb2.Max.X or
            bb1.Max.Y < bb2.Min.Y or
            bb1.Min.Y > bb2.Max.Y
        )

    def bbox_contains_bbox_xy(outer, inner):
        return (
            inner.Min.X >= outer.Min.X and inner.Max.X <= outer.Max.X and
            inner.Min.Y >= outer.Min.Y and inner.Max.Y <= outer.Max.Y
        )

    def point_in_bbox_xy(pt, bb):
        return (
            pt.X >= bb.Min.X and pt.X <= bb.Max.X and
            pt.Y >= bb.Min.Y and pt.Y <= bb.Max.Y
        )

    # Get curve's bounding box
    curve_bbox = curve.GetBoundingBox(True)

    # First check if bounding boxes overlap at all
    if not aabb_overlap_xy(curve_bbox, frame_bbox):
        return False

    # If curve's bbox is fully contained, consider it inside
    if bbox_contains_bbox_xy(frame_bbox, curve_bbox):
        return True

    # Otherwise, sample points on the curve to see if any lies within frame
    points = curve_to_points(curve, points_per_unit=2.0)  # denser sampling
    for pt in points:
        if point_in_bbox_xy(rg.Point3d(pt[0], pt[1], 0), frame_bbox):
            return True

    return False

def curve_to_json(curve, frame_id=None, color="#000000", strokeWidth=1):
    crv = to_curve(curve)
    if not crv: return {}
    pts = curve_to_points(crv)
    return {
        "type": "curve",
        "points": pts,
        "closed": bool(getattr(crv, 'IsClosed', False)),
        "style": {
            "stroke": color,
            "strokeWidth": strokeWidth
        },
        "parentFrameId": frame_id  # Add parent frame reference
    }

def rect_to_json(rect_like, name="Frame", index=0):
    """Convert a Rectangle-like input to a frame json with a unique ID."""
    bbox = None
    if isinstance(rect_like, rg.Rectangle3d):
        bbox = rect_like.BoundingBox
    elif isinstance(rect_like, rg.BoundingBox):
        bbox = rect_like
    else:
        crv = to_curve(rect_like)
        if crv:
            bbox = crv.GetBoundingBox(True)
    if not bbox:
        return {}
    min_pt = bbox.Min
    max_pt = bbox.Max
    frame_id = f"frame_{index}"  # Generate unique frame ID
    return {
        "type": "frame",
        "id": frame_id,  # Add unique ID
        "name": name,
        "x": round(min_pt.X, 3),
        "y": round(min_pt.Y, 3),
        "width": round(max_pt.X - min_pt.X, 3),
        "height": round(max_pt.Y - min_pt.Y, 3),
        "bbox": bbox  # Temporary, will be removed before JSON serialization
    }

# Grasshopper inputs:
# Drawing = curves (single or multiple)
# Frame = frames (single or multiple)
results = []
frames = []
curves = []
texts = []

# Global stroke weight input from Grasshopper (in pixels); default to 0.5 if missing/invalid
try:
    if 'stroke_weight' in globals() and stroke_weight is not None:
        DEFAULT_STROKE_WEIGHT = float(stroke_weight)
    else:
        DEFAULT_STROKE_WEIGHT = 0.5
except:
    DEFAULT_STROKE_WEIGHT = 0.5

# First process all frames to get their bounding boxes
try:
    has_frame = 'Frame' in globals() and Frame is not None
except NameError:
    has_frame = False

if has_frame:
    if isinstance(Frame, list):
        for i, fr in enumerate(Frame):
            fr_json = rect_to_json(fr, name=f"Frame {i + 1}", index=i)
            if fr_json:
                frames.append(fr_json)
    else:
        fr_json = rect_to_json(Frame, name="Frame", index=0)
        if fr_json:
            frames.append(fr_json)

# Then process all curves and check their containment
if Drawing:
    drawing_list = Drawing if isinstance(Drawing, list) else [Drawing]
    for crv in drawing_list:
        curve = to_curve(crv)
        if not curve:
            continue
            
        # Check intersection with all frames
        parent_frame_id = None
        for frame in frames:
            if check_curve_frame_intersection(curve, frame['bbox']):
                parent_frame_id = frame['id']
                break
                
        # Create curve JSON with parent frame reference and GH-controlled stroke width
        curve_json = curve_to_json(curve, frame_id=parent_frame_id, strokeWidth=DEFAULT_STROKE_WEIGHT)
        if curve_json:
            curves.append(curve_json)

# Utilities for text extraction from the whole Rhino document
def get_effective_color_and_layer(obj, doc):
    try:
        color = None
        if obj and doc:
            attr = obj.Attributes
            # Determine effective color: object color overrides layer color
            color = attr.ObjectColor
            # If color is ByLayer or empty, fallback to layer color
            try:
                layer_index = attr.LayerIndex
                if (not color or (color.R == 0 and color.G == 0 and color.B == 0 and not color.IsKnownColor)) and layer_index >= 0:
                    layer = doc.Layers[layer_index]
                    if layer: color = layer.Color
            except:
                pass
        if color:
            return {"r": int(color.R), "g": int(color.G), "b": int(color.B)}
    except:
        pass
    return {"r": 0, "g": 0, "b": 0}

def bbox_overlap_xy(bb1, bb2):
    if not bb1 or not bb2: return False
    return not (bb1.Max.X < bb2.Min.X or bb1.Min.X > bb2.Max.X or bb1.Max.Y < bb2.Min.Y or bb1.Min.Y > bb2.Max.Y)

def collect_texts_from_entire_document(frames_list):
    ghdoc = getattr(sc, 'doc', None)
    try:
        rhdoc = Rhino.RhinoDoc.ActiveDoc
        if rhdoc is None:
            return
        # Switch context to Rhino document so geometry access works reliably in GH Python
        try:
            sc.doc = rhdoc
        except:
            pass

        # Enumerate all annotation-like objects
        try:
            oset = Rhino.DocObjects.ObjectEnumeratorSettings()
            oset.IncludeDeletedObjects = False
            oset.IncludeLights = False
            oset.HiddenObjects = True
            oset.LockedObjects = True
            # Filter annotations and text dots
            try:
                oset.ObjectTypeFilter = Rhino.DocObjects.ObjectType.Annotation | Rhino.DocObjects.ObjectType.TextDot
            except:
                # Fallback: no filter, iterate all
                oset = None

            objs = rhdoc.Objects.GetObjectList(oset) if oset else list(rhdoc.Objects)
        except:
            # Fallback to iterating all
            try:
                objs = list(rhdoc.Objects)
            except:
                objs = []

        for obj in objs:
            geo = getattr(obj, 'Geometry', None)
            if geo is None:
                continue
            is_text_entity = isinstance(geo, rg.TextEntity)
            is_text_dot = isinstance(geo, rg.TextDot)
            if not (is_text_entity or is_text_dot):
                continue

            # Extract text content
            text_value = ""
            try:
                if is_text_entity:
                    text_value = geo.PlainText if hasattr(geo, 'PlainText') else (geo.Text if hasattr(geo, 'Text') else "")
                elif is_text_dot:
                    text_value = getattr(geo, 'Text', "")
            except:
                pass

            # Position
            try:
                if is_text_entity and hasattr(geo, 'Plane'):
                    pt = geo.Plane.Origin
                elif is_text_dot and hasattr(geo, 'Point'):
                    pt = geo.Point
                else:
                    pt = rg.Point3d(0,0,0)
            except:
                pt = rg.Point3d(0,0,0)
            x = round(pt.X, 3)
            y = round(pt.Y, 3)

            # Font
            family = None
            style = None
            font_size = 12.0
            if is_text_entity:
                try:
                    font_index = getattr(geo, 'FontIndex', -1)
                    if font_index is not None and font_index >= 0 and rhdoc:
                        rfont = rhdoc.Fonts[font_index]
                        if rfont:
                            family = getattr(rfont, 'FamilyName', None) or getattr(rfont, 'FaceName', None)
                            is_bold = bool(getattr(rfont, 'Bold', False))
                            is_italic = bool(getattr(rfont, 'Italic', False))
                            if is_bold and is_italic:
                                style = "Bold Italic"
                            elif is_bold:
                                style = "Bold"
                            elif is_italic:
                                style = "Italic"
                            else:
                                style = "Regular"
                except:
                    pass
                try:
                    font_size = float(getattr(geo, 'TextHeight', 12.0))
                except:
                    font_size = 12.0
            else:
                # TextDot doesn't have font metadata; keep defaults
                family = "Inter"
                style = "Regular"
                font_size = 12.0

            if not family:
                family = "Inter"
            if not style:
                style = "Regular"

            # Color
            color_rgb = get_effective_color_and_layer(obj, rhdoc)

            # Parent frame detection via bbox overlap
            parent_frame_id = None
            try:
                text_bbox = geo.GetBoundingBox(True)
                for fr in frames_list:
                    if bbox_overlap_xy(text_bbox, fr.get('bbox')):
                        parent_frame_id = fr.get('id')
                        break
            except:
                pass

            texts.append({
                "type": "text",
                "text": text_value,
                "x": x,
                "y": y,
                "font": {"family": family, "style": style},
                "fontSize": round(font_size, 3),
                "color": color_rgb,
                "parentFrameId": parent_frame_id
            })
    finally:
        # Restore GH doc context
        try:
            sc.doc = ghdoc
        except:
            pass

# Collect texts from entire file (not limited to a specific layer)
try:
    collect_texts_from_entire_document(frames)
except:
    pass

# Add frames to results first
for frame in frames:
    # Remove temporary bbox before adding to results
    frame_copy = frame.copy()
    frame_copy.pop('bbox', None)
    results.append(frame_copy)

# Then add curves
results.extend(curves)

# Then add texts
results.extend(texts)

# Convert to JSON string
json_string = json.dumps(results, indent=2)

# Write file
filepath = r"C:\2025_TT_Boston_Hackathon\01_app\02_figma-rhino-sync\backend\database\rhino-json-output\shapes.json"
os.makedirs(os.path.dirname(filepath), exist_ok=True)
with open(filepath, "w", encoding="utf-8") as f:
    f.write(json_string)

# Grasshopper output
JSON_String = json_string