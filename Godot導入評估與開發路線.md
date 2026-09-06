# Godot 導入評估與開發路線

更新：2026-09-06。狀態：**評估提案，尚未安裝 Godot、建立 Godot 專案或核准遷移。**

> 本輪決策：使用者已選 G-A（Three.js＋Blender），A＋B＋P1-04／09 已於網頁版實作。下列 Godot 內容保留為未選的研究提案，不是下一步安裝指令。

## 結論

Godot 適合本專案往「可走動的第三人稱射擊＋塔防」發展。建議先做小規模比較原型，通過桌機與實體手機驗收後，再決定是否作為後續主引擎。安裝引擎本身不會讓既有 Three.js 遊戲自動升級；玩法腳本、畫面介面與測試需要移植。

使用者已選 A 核心組＋B 射擊體感；Godot 是達成這些功能的候選技術路線，不代表額外採納多人、Boss 技能或商城。這次 Godot 請求是研究規劃，尚未授權安裝或整體重寫。

## 本機查核

- Blender：已實際執行 `--version`，為 **5.2.1 LTS**，成功匯入 Kenney 武器、保存 `.blend` 並匯出 `.glb`。
- Godot：`Get-Command godot,godot4`、`winget list --name Godot` 未找到；另查 Downloads、Program Files、Local Programs、H 槽根目錄的直接項目，未找到 Godot。未全面掃描磁碟，不能排除其他位置有免安裝版。
- 顯示裝置：系統回報 **Intel UHD Graphics 770**。建議原型先用 Compatibility 渲染，控制陰影、粒子、材質與模型面數；尚未有 Godot 實測 FPS，不能保證效能。
- 可用工具清單沒有 Godot MCP。MCP 可選，先用 Godot CLI 匯入、執行及輸出錯誤紀錄也能自動化，不需要為了開始開發強行加裝第三方外掛。
- 官方 Windows 下載頁查核時顯示 **Godot 4.7.2**；實際安裝時應再核對穩定版本，匯出範本須與編輯器版本一致。[官方下載](https://godotengine.org/download/windows/)

## Blender、Godot、目前網頁版如何分工

| 工具 | 本專案適合交給它的工作 | 需要另外完成的部分 |
|---|---|---|
| Blender | 建模、UV、材質、骨架、動畫、槍口與持握定位、低面數版本 | 傷害、波次、建造、存檔等遊戲規則 |
| Godot | 場景組裝、角色控制、碰撞、動畫切換、音效混音、UI、遊戲邏輯與匯出 | 仍要編寫及驗證玩法，不會自動把 JS 轉為 GDScript |
| Three.js＋Vite | 現有網址即可遊玩、HTML/CSS 介面與現有測試 | 角色控制、物理及關卡工具須自己組合或實作 |

建議素材流程：**Blender `.blend` 編輯母檔 → 明確匯出 `.glb` → Three.js 或 Godot 載入**。Godot 也能透過 Blender 自動轉換直接匯入 `.blend`，但發布與自動建置先採 GLB，讓建置機器不必依賴相同 Blender 環境。Blender 節點材質並非全部都能原樣轉移，複雜材質要烘焙或在引擎重建。[官方 3D 格式說明](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/available_formats.html)

## 對 A＋B 的具體價值

| 現有編號 | Godot 可支援的做法 | 仍需設計或驗收 |
|---|---|---|
| P0-02 桌機／手機操作 | 統一輸入動作，鍵鼠與觸控搖桿接到同一角色控制器 | 多指操作不互搶、手機橫直向、手指遮擋、失焦停止射擊 |
| P0-03 素材載入 | 資源匯入、場景預載、分段載入；網頁啟動頁處理初始下載 | 網路中斷、檔案失敗、明確重試及備援，不是引擎自動全包 |
| P0-04 第三人稱角色 | CharacterBody3D 處理受腳本控制的角色碰撞與滑動；鏡頭獨立節點 | 斜俯視／肩後鏡頭仍待選；玩家受傷規則仍待選 |
| P0-05 完整驗收 | CLI 匯入與匯出、無介面邏輯測試、Web 瀏覽器操作、桌機執行測試 | 實體 Android 與 iPhone 測試不可由桌機模擬替代 |
| P1-01 射擊體感 | 射線命中、槍口粒子、後座、準星回饋、瞄準輔助 | 近距離牆壁遮擋、鏡頭與槍口射線一致、熱量與傷害平衡 |
| P1-06 動畫與聲音 | AnimationTree 混合待機／移動／射擊；音訊匯流排管理音量 | 換槍手部位置、滑步、死亡只結算一次、Web 音效延遲 |
| P1-10 教學與可讀性 | 教學場景、提示層、操作圖示、減少動態設定 | 可跳過與重看、字級、鍵盤焦點、觸控按鈕；Canvas UI 的輔助閱讀需另驗證 |

角色與動畫能力依據：[CharacterBody3D](https://docs.godotengine.org/en/stable/classes/class_characterbody3d.html)、[AnimationTree](https://docs.godotengine.org/en/stable/tutorials/animation/animation_tree.html)。表格中對本遊戲的效益是工程評估，尚非已實現功能。

## 遷移時哪些可以留下

| 可沿用 | 需要改寫／重新驗證 |
|---|---|
| 已取得授權的 GLB／glTF 模型、貼圖與骨架動畫 | JavaScript 遊戲邏輯轉成 GDScript；Three.js 場景建構轉成 Godot 場景 |
| Blender 母檔與素材製作腳本 | HTML/CSS 操作面板轉成 Godot Control，或另外保留網頁外殼 |
| 武器、敵人、塔、波次的數值與名稱 | 既有 JavaScript 單元測試不可直接執行於 GDScript，需移植相同驗收案例 |
| 10 波勝敗流程及已發現 BUG 的驗收條件 | 程式合成 Web Audio 音效改成音檔或重新設計 Godot 音訊實作 |
| 素材來源、SHA256、進度與 RDQ 規格 | 本機儲存、網頁重試與錯誤診斷須重新接入 |

採取遷移時先把數值整理成單一資料來源，避免兩套數值悄悄分歧。比較原型是短期決策工具；選定引擎後只維護一套主要玩法，現版保留為可回退的基準。

## 桌機與手機同等重要時的限制

1. **以網址直接遊玩**：建議 Godot 標準版＋GDScript＋Compatibility，先測單執行緒 Web 匯出。官方目前說明 Godot 4 的 C# 專案不能匯出 Web；Web 也不支援 Forward+／Mobile 渲染。渲染器名稱的 Mobile 不表示它可匯出手機網頁。[Web 匯出](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)
2. **效能不能靠引擎名稱保證**：Web 版多了引擎 WebAssembly 下載與初始化成本。Godot 原生手機版與瀏覽器版要分別量測；不能拿桌機原生 FPS 宣稱手機網頁已改善。多執行緒 Web 另有跨來源隔離需求。[Web 匯出](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)
3. **Android 原生 App**：需要 Android SDK／JDK、匯出設定與簽章配置；先做測試 APK，上架另議。[Android 匯出](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_android.html)
4. **iPhone 原生 App**：需要 macOS 和 Xcode。這台 Windows 可開發邏輯與 Web 版，但不能單靠目前 Windows 完成官方 iOS 原生匯出流程。[iOS 匯出](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_ios.html)
5. **素材不等於物理模型**：牆壁、地形與角色要有簡化碰撞形狀；敵群導引與局部避讓有額外成本。現有固定路線可先保留，不必讓每隻殭屍每幀重新尋路。[NavigationAgent3D](https://docs.godotengine.org/en/stable/classes/class_navigationagent3d.html)

## 建議的導入階段與通過條件

以下均為候選範圍，尚未排成已核准工作。

| 階段 | 實際交付 | 通過條件 |
|---|---|---|
| G0 環境確認 | 安裝穩定版標準 Godot、相同版本匯出範本；讀取現有 GLB | Windows 編輯器與 Web 匯出皆可啟動；版本、GPU、錯誤紀錄留存 |
| G1 素材與控制試場 | 1 張小地圖、1 位守衛、3 把槍、3 種殭屍模型、地面／障礙碰撞 | 角色比例、朝向、貼圖、持槍動畫正確；鏡頭與受傷規則依使用者決定 |
| G2 小型完整戰局 | 3 波敵人、建塔／升級／出售、過熱、勝敗、重開、鍵鼠與觸控 | 每條操作完成；沒有穿牆、黏住輸入、重複獎勵、重開殘留 |
| G3 引擎比較 | 現版與 Godot 對照報告，記錄相同場景及裝置的載入、幀時間、記憶體與操作結果 | 通過下面的量測門檻才建議遷移；未通過則保留 Three.js 主線並找瓶頸 |
| G4 完整移植（另行選定） | 補齊 10 波、Boss 基礎、A＋B 全部內容與回歸測試 | 10 波勝利、失敗、重開、手機實機及長時間遊玩皆有證據 |

建議量測門檻（**待選定的驗收目標，不是目前測得的結果**）：

- 同一台桌機、同一解析度與畫質，目標穩定接近 60 FPS；指定中階手機目標至少 30 FPS，記錄幀時間 p50／p95。
- 以相同的 20／40／80 隻同屏敵人情境分級壓測，找出實際支援上限。壓測允許獨立測試場景，不能拿壓測作弊狀態當完整遊玩證據。
- 冷啟動與快取後啟動分開測量：下載總量、首個可操作畫面耗時、連續 15 分鐘記憶體變化、手機發熱及掉幀。
- 桌機鍵鼠與手機同時移動／瞄準／射擊／切槍可完成；任何指頭取消或切離視窗後都不繼續移動或開火。
- Web 在實體 Android Chrome 與 iPhone Safari 各完成一次開局至重開。尚無設備時明列未確認，不先宣告跨平台通過。

## 可選方案

| 選項 | 範圍 | 我的評估 |
|---|---|---|
| G-A | 繼續 Three.js＋Blender，完成 A＋B | 最快承接已完成網頁版；角色、碰撞與場景工具需要自行維護 |
| **G-B（建議）** | 安裝 Godot，先做 G0～G3 比較原型，再決定主引擎 | 適合想長期擴展第三人稱遊戲，但保留手機網頁目標的情況 |
| G-C | 直接轉 Godot 並完整移植 | 額外工作量最大；目前缺少實機比較證據，暫不建議 |

## 後續可開發但本次尚未選定

- 模組化關卡編輯、路線分支與高低地形：Godot 場景編輯器較方便持續製作，但要新增路線與建造限制設計。
- 新敵人戰術、Boss 招式、尋路與避障：可用導引和狀態機協作；目前 A＋B 不包含這些。
- SKIN 收藏、換裝預覽與武器配件：Blender 統一骨架／插槽規格，再由引擎提供預覽與切換。
- 手把、Android APK、波次存檔、成就：依發布方式與資料格式另外挑選。
- 多人連線：需要狀態同步、網路權威與主機成本的獨立設計，安裝 Godot 不會自動具備。

## 自動化開發方式

可用 CLI 進行無介面匯入、執行、匯出與錯誤收集；Web 產物仍可使用自動瀏覽器回測。無介面測試不能替代顯示、動畫、音效與實機操作驗收。[Godot CLI](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html)

若之後需要 MCP，可評估 [Coding-Solo/godot-mcp](https://github.com/Coding-Solo/godot-mcp) 的專案啟動、場景及除錯工具。它是第三方整合；本次僅閱讀來源，尚未安裝、連接或實測，不承諾所有編輯器操作皆已支援。
