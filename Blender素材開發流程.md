# Blender 素材開發流程

查核日期：2026-09-06。Blender 5.2.1 LTS 已在本機實際執行。

## 已完成範例

- 編輯母檔：`assets-source/blender/pulse-mk2.blend`。
- 遊戲產物：`public/models/pulse-mk2.glb`；已由 `src/assets.js` 接入脈衝步槍，武器卡顯示相同造型。
- 來源：Kenney CC0 `public/models/blaster-a.glb`，原檔保留。
- 改良：雙側六格發光能源單元、`Muzzle` 槍口定位點、內嵌原本的色盤貼圖。
- 六格能源單元合併為一個網格；整把槍共 3 個網格、542 個三角面、48,432 bytes。這是資產資料，並非 FPS 提升證明。
- `Muzzle` 已供 Three.js 槍口閃光與光束起點使用。遊戲內的傷害、冷卻、熱量仍由 `src/game.js` 決定。
- 製作紀錄：`artifacts/blender-build-report.json` 含版本、面數、檔案大小與 SHA256。

## 再生成範例

在專案根目錄執行以下 PowerShell；會重建上述範例母檔與 GLB，手動另改的設計應另存新檔名：

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python scripts/blender-build-pulse.py
```

腳本從專案位置推導素材路徑，只有命令中的 Blender 執行檔位置需依其他主機調整。

## 建議的素材規格

1. `.blend` 保存在 `assets-source/blender/`，瀏覽器只載入 `public/models/` 的 GLB／glTF。
2. 維持低多邊形科幻風格，優先用輪廓、少量發光材質與色盤強化辨識度。
3. 輸出前確認朝向、縮放、原點、骨架名稱與動畫；記錄槍口、手握點、角色腳底等定位約定。
4. 動畫保持待機、行走、奔跑、受擊、死亡等語義名稱；使用既有素材時先查已有動作再補作。
5. 少量共享材質、合併同材質靜態細節；角色骨架與可動配件避免誤合併。不要把細緻美術網格直接用作每個角色的碰撞體。
6. 保存原始授權及下載來源，更新 `asset-manifest.json`。模型可跨引擎使用，shader 與遊戲腳本需分別處理。
7. 匯出後在實際瀏覽器看武器卡、槍口、射擊、陰影；再測貼圖失敗／重試、切槍與完整戰局。

## v1.4.0 方案 C 與 MCP

守衛及三槍的「極地偵巡」已接入外觀選擇器；母檔在 `assets-source/blender/skins/`，產物在 `public/models/skins/`。`src/skin-catalog.json` 記錄八款外觀（含原版）的 ID、版本、尺寸、方向、動畫、持握／槍口、材質區域、實際三角面、貼圖尺寸、來源與摘要。原素材骨架 `Middle1.L` 經 GLTFLoader 轉成 `Middle1L`，遊戲持握點支援兩者。槍口視覺跟隨 Muzzle，傷害判定仍保留既有規則。

批次母檔可由 `blender --factory-startup --background --python scripts/blender-build-skins.py` 重建，再執行 `node scripts/build-skin-catalog.mjs` 更新清單。批次重建會覆寫生成母檔，手工修改應先另存。電漿槍最後一次材質修整透過真正 MCP 完成；重建後若要重現相同產物，再執行下面的 MCP finishing 與清單刷新。

```powershell
& "$env:USERPROFILE/.local/share/blender-mcp/source/.venv/Scripts/python.exe" scripts/blender-mcp-client.py --code scripts/blender-mcp-finish-plasma.py --screenshot artifacts/blender-mcp-plasma.png
node scripts/build-skin-catalog.mjs
```

使用前先確認 Blender MCP 已啟動。安裝版本、28 個工具清單及實際場景／材質／GLB 證據見 [MCP 安裝與驗證](Blender-MCP安裝與驗證.md)。此前 MK2 使用 CLI；MCP 是 v1.4.0 開發時才接入。完整收拔換槍動畫、新護甲輪廓、防禦塔 SKIN 與收藏解鎖仍是後續候選。

Godot 的適用範圍與導入成本另見 [Godot 導入評估](Godot導入評估與開發路線.md)。
