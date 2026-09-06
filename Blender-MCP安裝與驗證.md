# Blender MCP 安裝與實測

2026-09-06，使用者明確要求搜尋、安裝並使用。採用社群原作者 [ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp)，不是 Blender Foundation 官方功能，也不是遊戲引擎。

## 安裝結果

- Blender 本體：5.2.1 LTS，已實際啟動。
- Blender MCP 套件：1.9.1，MIT；來源固定在 Git commit `c5f35d9cc54451d785ac4c00c48bf9e98a2e8db9`。沒有將搜尋引擎舊安裝片段當成目前版本。
- 原始碼與獨立 Python 3.11 環境：使用者家目錄 `.local/share/blender-mcp/source/`、`.venv/`；MCP Python SDK 1.29.1。協定 handshake 回報的 server version 1.29.1 是 SDK 值，不當作 Blender MCP 套件版本。
- 外掛：使用者 AppData/Roaming/Blender Foundation/Blender/5.2/scripts/addons/blender_mcp.py；已啟用並保存偏好。
- Codex：已經 `codex mcp add blender`，使用獨立環境內的絕對 exe 路徑，避免 GUI 找不到 uvx。其餘 MCP 設定保留。
- 僅連到 `127.0.0.1:9876`；`DISABLE_TELEMETRY=true`，外掛 telemetry_consent=false；`BLENDER_MCP_SAFE_MODE=true`。Poly Haven／Sketchfab／Hyper3D／Hunyuan3D／Poly Pizza 均未啟用，未輸入 API 金鑰。

## 可核對的 MCP 證據

- `scripts/blender-mcp-client.py` 使用 MCP SDK 的 stdio transport、ClientSession.initialize、list_tools、call_tool，並非跳過 MCP 直接送 socket。
- list_tools 成功回傳 28 個工具；get_scene_info 成功讀到原場景。
- execute_blender_code 建立獨立 DEADZONE_C_MCP_Review 場景、匯入 guard-polar-v1.glb、儲存 mcp-review.blend；之後 get_scene_info 再次確認場景與物件。
- get_viewport_screenshot 成功輸出 artifacts/blender-mcp-viewport.png。
- 隨後以 `scripts/blender-mcp-finish-plasma.py` 透過 MCP 開啟電漿槍母檔，把 Polar_Energy 設為橘色發光、強度 0.9，保存並重新匯出遊戲使用的 `plasma-polar-v1.glb`。視窗截圖 `artifacts/blender-mcp-plasma.png`；模型 scene extras 保留 finishing 工作流。
- 開啟母檔後原 timer context 缺少 active_object，第一次匯出失敗；用 Blender 官方 context override 綁定當前視窗／VIEW_3D 後匯出成功，未停用 MCP safe mode。
- 最新一次機器回報在 artifacts/blender-mcp-report.json 與 blender-mcp-client.log，包含 MCP 回應及工具名稱；目前是電漿修整回報，早先守衛檢查保留在 review 母檔與截圖。只代表測到的核心工具，不宣稱 28 個工具全部測過。
- 本輪執行中的對話工具清單不會熱載入新 MCP；目前以標準 MCP SDK 完成驗證。重開 Codex 後再檢查原生 Blender 工具載入，這件事尚未在目前對話驗證。

## 日後使用

1. 開啟 Blender 並確認側欄 MCP for Blender 已連線；或執行 `scripts/Start-BlenderMCP.ps1`。啟動腳本限本機、會檢查連接埠，不建立 Windows 開機排程。
2. Codex 原生工具載入後，可要求檢查物件／材質、修改局部造型、輸出 GLB 及拍攝視窗。
3. 可重現的整批產物保留 `scripts/blender-build-skins.py`；MCP 適合互動修整與檢查，CLI 腳本適合整批重建，兩者共用 `.blend`／GLB 成品。
4. Blender 關閉後，場景 socket 也會停止。若停用整合，可在 Blender 停止伺服器、取消外掛勾選，並以 `codex mcp remove blender` 移除這一筆設定。

第一輪既有 MK2 成果是 CLI 腳本產生；MCP 是這次追加安裝後才取得成功證據，不回溯宣稱先前已使用 MCP。
