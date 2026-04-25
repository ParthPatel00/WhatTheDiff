"""
lib/camera_presets.py — 6 predefined camera angles for pixel diff rendering.
Matches web app SPEC.md camera preset definitions exactly.
"""

import math
from mathutils import Vector, Euler

PRESETS = {
    "front": {
        "location": Vector((0.0, -3.0, 0.0)),
        "rotation": Euler((math.radians(90), 0.0, 0.0)),
    },
    "back": {
        "location": Vector((0.0, 3.0, 0.0)),
        "rotation": Euler((math.radians(90), 0.0, math.radians(180))),
    },
    "left": {
        "location": Vector((-3.0, 0.0, 0.0)),
        "rotation": Euler((math.radians(90), 0.0, math.radians(-90))),
    },
    "right": {
        "location": Vector((3.0, 0.0, 0.0)),
        "rotation": Euler((math.radians(90), 0.0, math.radians(90))),
    },
    "top": {
        "location": Vector((0.0, 0.0, 3.0)),
        "rotation": Euler((0.0, 0.0, 0.0)),
    },
    "34": {
        "location": Vector((2.0, -2.0, 1.5)),
        "rotation": Euler((math.radians(65), 0.0, math.radians(45))),
    },
}

ANGLE_NAMES = list(PRESETS.keys())  # ["front", "back", "left", "right", "top", "34"]
