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
    # 动态计算分段数：按长度 * 密度，并限制上下界
    length = curve.GetLength() or 0.0
    segments = int(round(length * points_per_unit))
    if segments < min_segments:
        segments = min_segments
    if segments > max_segments:
        segments = max_segments

    # 闭合曲线避免重复首尾点；开放曲线包含末端
    include_end = not curve.IsClosed
    t_vals = curve.DivideByCount(segments, include_end)
    if not t_vals: return []
    pts = [curve.PointAt(t) for t in t_vals]
    return [[round(p.X,3), round(p.Y,3)] for p in pts]

def curve_to_json(curve, color="#000000", strokeWidth=2):
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
        }
    }

# Grasshopper 输入:
# Curves = 曲线 (单条或多条)
# filepath = 输出路径 (string，必须带 .json)
results = []

if Curves:
    if isinstance(Curves, list):
        for crv in Curves:
            results.append(curve_to_json(crv))
    else:
        results.append(curve_to_json(Curves))

# 转换为单一 JSON 字符串
json_string = json.dumps(results, indent=2)

# 写文件
filepath = r"C:\2025_TT_Boston_Hackathon\01_app\02_figma-rhino-sync\backend\database\rhino-json-output\shapes.json"
os.makedirs(os.path.dirname(filepath), exist_ok=True)
with open(filepath, "w", encoding="utf-8") as f:
    f.write(json_string)

# Grasshopper 输出
JSON_String = json_string

