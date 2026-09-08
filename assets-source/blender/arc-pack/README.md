# 電弧攻防首批素材（v1.5.0）

2026-09-08：使用 Codex 原生 Blender MCP `get_scene_info`、`execute_blender_code` 製作三件原創低多邊形模型；沿用現有 Three.js 遊戲，不涉及 Godot 移植或付費素材服務。

| 模型 | 遊戲功能 | 三角面 |
| --- | --- | ---: |
| arc-rifle | 4 號電弧抑制槍；無視裝甲、半徑 1.8 範圍傷害與 0.8 秒減速 | 372 |
| armored-infected | 第 4 波起出現；一般傷害減免 40%，抵達核心扣 12 血 | 168 |
| arc-tower | 150 能源部署，可升至 Lv.3／出售，無視裝甲並範圍減速 | 360 |

原始建模程序：[blender-build-arc-pack.py](../../../scripts/blender-build-arc-pack.py)。以 MCP 的 `code` 欄位傳入完整內容，勿在 safe mode 內用 `exec(open(...))`。先在外部建立輸出資料夾，修改腳本輸出根目錄後執行。建議在乾淨 Blender 工作階段重製，避免已有同名定位點被 Blender 自動加尾碼。Grip／Muzzle 名稱會由測試檢查。

本次建模在獨立 `DEADZONE_*` 場景進行，匯出使用 `use_active_scene=True`，完成後還原原視窗場景，未覆寫使用者原有校園專案。安全模式全程保留；被禁止的檔案讀寫與 lambda 改用允許的操作。

GLB 由原生 MCP 匯出，含材質／定位點／兩條腿部動畫；靴子隨腿部移動。這裡的 `.blend` 是使用獨立背景 Blender 匯入最終 GLB 後保存的可編輯封存，並非原有校園專案的整份另存。封存腳本：[archive-arc-masters.py](../../../scripts/archive-arc-masters.py)。

檔案摘要、大小及動畫數以 [manifest.json](../../../public/models/arc-pack/manifest.json) 為準。原創幾何採 CC0-1.0；無外部貼圖。示意圖可用 [render-arc-pack.py](../../../scripts/render-arc-pack.py) 重製。

驗收：單元測試涵蓋裝甲克制、核心扣血、塔經濟／存檔、定位點與場景隔離。瀏覽器專項 `node scripts/verify-arc-pack.mjs` 以合法第四波部署存檔測試新武器、塔、敵人與五種尺寸，與從第一波起跑的完整十波測試分開記錄。手機實機操作手感留待使用者驗收。
