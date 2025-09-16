import Rhino.Geometry as rg
import Rhino
import System
import scriptcontext as sc
import json

# 输入: Curve, 例如 GH Python 组件 input "x"
# 输出: JSON_String, JSON 字符串

def ensure_curve(obj):
    if isinstance(obj, Rhino.Geometry.Curve):
        return obj
    if isinstance(obj, System.Guid):
        rh_obj = sc.doc.Objects.Find(obj)
        if rh_obj:
            geo = rh_obj.Geometry
            if isinstance(geo, Rhino.Geometry.Curve):
                return geo
    return None

def curve_to_points(curve, div_count=50):
    """
    将曲线离散化为点列表
    """
    c = ensure_curve(curve)
    if not c: return []
    t_vals = c.DivideByCount(div_count, True)
    if not t_vals: return []
    pts = [c.PointAt(t) for t in t_vals]
    return [[round(p.X,3), round(p.Y,3)] for p in pts]

def curve_to_json(curve, color="#000000", strokeWidth=2):
    pts = curve_to_points(curve)
    data = {
        "type": "curve",
        "points": pts,
        "style": {
            "stroke": color,
            "strokeWidth": strokeWidth
        }
    }
    return json.dumps(data)

# Grasshopper 执行
if Curve:
    JSON_String = curve_to_json(Curve)
else:
    JSON_String = "{}"
