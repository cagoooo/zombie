# 核心支援設施（v1.8.0）

Blender MCP 已實際建立兩個獨立場景並匯出 GLB，之後還原原視窗場景。原創程序幾何採 CC0-1.0，無外部貼圖。

| 模型 | 三角面 | GLB bytes |
|---|---:|---:|
| shield-station | 324 | 28724 |
| repair-station | 96 | 13152 |

建模程序：`scripts/blender-build-support.py`；原生 MCP 執行完整程序。`scripts/archive-support-masters.py` 在獨立背景 Blender 匯入最終 GLB 保存可編輯 .blend，未保存使用者整個原場景。

摘要與大小見 `public/models/support-pack/manifest.json`。護盾藍色雙環，修復綠色十字；塔 Lv.3 第一分支為青色標記、第二分支為金色標記、舊版標準為白色。
