# 冷卻工廠原創素材

使用 Codex 原生 Blender MCP 在四個獨立場景製作及輸出；完成後還原原視窗場景。原創程序幾何採 CC0-1.0，無外部貼圖。

| 素材 | 三角面 | GLB bytes | 動畫 |
|---|---:|---:|---:|
| rail-rifle 磁軌槍 | 96 | 13316 | 0；含 Grip／Muzzle |
| dash-infected 衝刺感染者 | 120 | 17640 | 2 |
| shield-infected 護盾感染者 | 108 | 16292 | 2 |
| rift-boss 裂核者 | 120 | 17780 | 2 |

合計 65,028 bytes、444 三角面。製作腳本 `scripts/blender-build-factory.py`，摘要 `public/models/factory-pack/manifest.json`。`scripts/archive-factory-masters.py` 以獨立背景 Blender 匯入各個 GLB，封存此資料夾內的 .blend，不另存使用者原專案。

重製時使用乾淨 Blender 工作階段，避免既有同名 Grip／Muzzle 自動改名；測試會檢查定位點與模型動畫。
