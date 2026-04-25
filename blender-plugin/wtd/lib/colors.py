"""
lib/colors.py — Centralized diff color constants.
Single source of truth for ALL diff colors in the plugin.
No operator, panel, or lib module may hardcode a color literal — use get_colors() instead.

Web app parity:
  Default:    red   = v1 only, green = v2 only  (matches web app SPEC.md ghost overlay)
  Colorblind: blue  = v1 only, orange = v2 only (matches web app SPEC.md section 9)
"""

# ---------------------------------------------------------------------------
# Default scheme — red / green (web app default)
# ---------------------------------------------------------------------------

COLOR_V1 = (1.0, 0.31, 0.31)       # red   — only in v1 (original)
COLOR_V2 = (0.31, 0.86, 0.39)      # green — only in v2 (modified)
COLOR_DIFF_PX = (1.0, 0.0, 0.0)    # pixel diff highlight (pure red)

# ---------------------------------------------------------------------------
# Colorblind-safe scheme — blue / orange
# ---------------------------------------------------------------------------

COLOR_V1_CB = (0.31, 0.51, 1.0)    # blue
COLOR_V2_CB = (1.0, 0.65, 0.0)     # orange
COLOR_DIFF_CB = (0.31, 0.51, 1.0)  # blue pixel highlight

# ---------------------------------------------------------------------------
# Stats panel delta colors
# Blender UI does not support arbitrary label text colors.
# Use SEQUENCE_COLOR_* icon constants as color indicators alongside label text.
# ---------------------------------------------------------------------------

# Default scheme
STATS_ICON_ADDED    = "SEQUENCE_COLOR_03"   # green
STATS_ICON_REMOVED  = "SEQUENCE_COLOR_01"   # red
STATS_ICON_MODIFIED = "SEQUENCE_COLOR_05"   # yellow (same in both modes)
STATS_ICON_NONE     = "BLANK1"

# Colorblind scheme
STATS_ICON_ADDED_CB   = "SEQUENCE_COLOR_08"  # orange
STATS_ICON_REMOVED_CB = "SEQUENCE_COLOR_04"  # blue

# ---------------------------------------------------------------------------
# Opacity default (matches web app default exactly)
# ---------------------------------------------------------------------------

DEFAULT_OPACITY = 0.50


# ---------------------------------------------------------------------------
# Public API — always use this, never access constants directly
# ---------------------------------------------------------------------------

def get_colors(colorblind: bool) -> dict:
    """
    Returns the active color scheme as a dict.
    Keys: "v1", "v2", "diff_px"
    Values: (r, g, b) tuples in linear color space.

    Usage in any operator or panel:
        addon_key = __package__.split('.')[0]
        prefs = context.preferences.addons[addon_key].preferences
        colors = get_colors(prefs.colorblind_mode)
        tint_collection(col_a, colors["v1"], opacity)
    """
    if colorblind:
        return {
            "v1": COLOR_V1_CB,
            "v2": COLOR_V2_CB,
            "diff_px": COLOR_DIFF_CB,
        }
    return {
        "v1": COLOR_V1,
        "v2": COLOR_V2,
        "diff_px": COLOR_DIFF_PX,
    }


def get_stats_icons(colorblind: bool) -> dict:
    """
    Returns the correct Blender icon names for stats panel delta rows.
    Keys: "added", "removed", "modified", "none"
    """
    if colorblind:
        return {
            "added":    STATS_ICON_ADDED_CB,
            "removed":  STATS_ICON_REMOVED_CB,
            "modified": STATS_ICON_MODIFIED,
            "none":     STATS_ICON_NONE,
        }
    return {
        "added":    STATS_ICON_ADDED,
        "removed":  STATS_ICON_REMOVED,
        "modified": STATS_ICON_MODIFIED,
        "none":     STATS_ICON_NONE,
    }
