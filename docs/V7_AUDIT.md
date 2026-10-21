# V7 audit before the V8 implementation

Source: the user's uploaded `Hai_Phong_Grand_Prix_V7_Tu_Lai_Vat_Can.html` (7,648,697 bytes). Line references below refer to that original HTML, not a prettified copy. The user-supplied V8 master prompt was treated as the implementation request; embedded V7 comments were treated as source material.

## Architecture and working content to preserve

- A self-contained HTML document embeds Three.js, OpenStreetMap-derived JSON, five PNG portraits/sheets, CSS, application code, and a later independent “V6 expansion pack” IIFE.
- Core rendering uses Three.js WebGL, toon materials, procedural rigged people/motorcycles, a scene per race, a separate garage scene, shadow maps and a postprocessing target. `requestAnimationFrame` drives rendering; physics uses a fixed 1/120 second accumulator (lines 272–275).
- Racer position is stored as distance along a closed curve plus lane offset and heading relative to the curve, not unrestricted world-space navigation. `updateRacer` applies throttle, drag, engine braking, gear ratios, steering/yaw limits, grip, lean and off-route timers (234–251). Rival AI uses curvature look-ahead (252–253). Core has no automatic player steering (`navigationControls` returns input at 446).
- Keyboard WASD/arrows, Space rear brake, Shift tuck, C camera, R recovery, M/Q/E manual gears, Escape pause; pointer buttons support touch and release capture. Blur/visibility pauses the race. No gamepad polling exists.
- Four distinct vehicle records: Yamaha R1 (`r1`), Kawasaki Ninja (`ninja`), Vespa Primavera (`vespa`), Ducati Panigale (`ducati`). CVT vs six-speed behavior is distinct.
- Five story chapters/opponents: “Lời chào bên hồ”/Minh; “Gió qua vườn hoa”/Nhi; “Nhịp phố cổ”/Phong; “Vòng hồ thử thách”/Rin; “Hẹn gặp Lucien”/Lucien. Preserve the actual `STORY` dialogue (321–327), including Aurora wanting to win by her own riding and the final date promise.
- Ten original route names and OSM-derived point sequences: Tam Bạc khởi đầu; Dải vườn hoa trung tâm; Phố cổ bên sông; An Biên · Quần Ngựa; Chung kết thành phố; Quần Ngựa · Vòng hẹn hò; Hồ Sen · Buổi chiều; Tố Hữu · Kim Đồng; Phố Lãn Ông · Tam Bạc; Minh Khai · Hoàng Văn Thụ. First five are story routes; all ten are selectable in the custom race menu. Keep this distinction; V7 has ten maps total, not fifteen unique routes.
- `GEO` contains 62 area polygons, 3,083 roads, 244 building polygons, 10 routes, 52 props, 88 school entries, and 35 bridge entries, plus provenance/license metadata. Retain route geometry and attribution. Architecture is stylized, not a surveyed replica.
- `INLINE_IMAGES` contains `aurora_idle.png`, `aurora_happy.png`, `lucien_idle.png`, `lucien_happy.png`, and `rivals-anime.png`. These are primary identity references for new artwork.
- Audio: synthesized engine and wind, speech-synthesis laughter with oscillator fallback, kiss chime; graphics options low/high/ultra, day/sunset/night, clear/cloudy/rain/mist.

## Confirmed runtime reproductions

Tested the unmodified uploaded HTML in headless Chromium 154 with Playwright, fresh isolated origin storage and Low graphics. Cutscene time was advanced through the existing `window.HPGP.updateCutscene` API so these checks do not depend on waiting through the entire cinematic. There were no JavaScript page errors during this reproduction.

1. **Preview changes the overlay's persistent carry count.** Click `previewCarry`, then advance the core cutscene past 6.3 seconds. Core `HPGP.state.carryCount` remains **0**, but `hp_chibi_gp_v6_save.totalCarries` becomes **1**. Root cause: the core increments only when `!carryPreview` (544), but the expansion separately detects visible `#comicLaugh` and increments a second persistent counter without knowing preview status (1303–1320).
2. **The visible Skip button leaves the core cinematic running.** Click `#v6-skip-cutscene` during that preview. Cinema bars are hidden, but `HPGP.state.mode` remains **`cutscene`**. Its handler calls `endV6Cutscene`, which clears only expansion timers/DOM; it clicks Continue only if Continue is already visible (1110–1129). Core camera/character state and cutscene object remain active.
3. **Carry result grants race achievements without racing.** Advance the same preview to `carryResult`. `elapsed=0` and `progress=0`, yet expansion save receives `first_finish=true`, `no_lost_win=true`, and `affection=40`. Root cause: achievement logic checks only whether `#finishDriver` is visible (1328–1337). `finishDetailedCarry` also displays that element (564). This is not a valid race finish event.

## Further defects established from executable source paths

| Issue | Evidence and consequence | V8 repair requirement |
| --- | --- | --- |
| Duplicate carry and kiss authority | Core `hpmoto.carries.v5` triggers every third lifetime carry (544–547); expansion uses `sessionCarries===3` and delayed overlay sequences (1305–1320, 1058–1107). | One carry service; preview must be read-only; every-third rule comes from one validated count. |
| Delayed cinematic can escape cleanup | The delayed third-carry `setTimeout` at 1320 is not stored in `cutsceneTimerIds`; expansion `endV6Cutscene` only cancels its registered list. | Use one cancellable timeline and central exit transition, no orphan timeouts. |
| False boss achievement | The first visible `finishDriver` grants `boss_lucien_clear` merely if `rivalName` contains Lucien, with no actual finish, win, or final story chapter check (1328–1337). | Award only on committed finish event with valid ordered checkpoints and intended story win. |
| Race-local achievement state never resets | `hadOfftrackThisRace`, `sessionCarries`, and `lastRankText` belong to expansion closure and are not reset by core `startRace`. `first_finish` guards the whole award block. | Reset race session state on every start; evaluate each achievement independently once. |
| Screen-space pickups lack world collision | `spawnCollectibleOnTrack` positions a DOM emoji by screen percentage, accepts clicks, or awards after 2.6 seconds if displayed speed >35 (992–1034). | Place pickups in world coordinates, draw their actual position, and require spatial overlap. |
| Light hits produce severe penalty | All non-pothole hits multiply speed by `.24`; any obstacle type at only >4 m/s queues a romantic crash (399–413). A cone therefore triggers the same carry as a barrier. | Severity by obstacle class, impact speed and direction; light hits never trigger carry; add invulnerability/cooldown. |
| Finish does not validate checkpoints | `finishTime` is assigned once `dist >= roadLength*raceLaps` (250). No checkpoint state or ordered passage exists. | Require ordered gates, valid direction and finish crossing; recovery returns to a validated checkpoint. |
| “Free” mode is still route-bound | `setGameMode('free')` switches maps/laps/opponent, but uses the same lane/curve update and road clamp. UI says “Đua tự do”. | Call it “Đua tự chọn”; do not claim open-world exploration. |
| Weather has no grip effect | Lighting/fog/road roughness change (473–485), but physics computes `mu` only from vehicle and racer identity (235), not weather. | Shared environment state should modify traction and visible conditions. |
| Ultra selected by default | HTML quality select marks Ultra selected (32); `applyQuality` falls back to Ultra (295), with ratio 2, 2048 shadow map, 80 pedestrians. | Auto recommendation based on device; user override; bounded detail and actual measurements. |
| HUD is assembled by competing systems | Core mobile selectors are followed by expansion fixed-position mood, affection, banter and warning panels. | One responsive HUD with explicit safe regions and mobile overlap checks. Visual inspection is required to claim resolution. |

Do not extrapolate from this audit to assert that every possible V7 visual defect or memory leak has been reproduced. Those need V8 visual/performance checks. This audit confirmed the state/reward/collision paths above.

## Save compatibility contract

Read old values without deleting or rewriting them. New V8 data should have its own versioned, sanitized schema. Import only when V8 data does not already exist; mark migration complete. Preserve legitimate legacy achievements but do not synthesize new ones based on visible UI. Because V7 stored conflicting counters, use the maximum of the two legacy lifetime totals rather than summing them (summing double-counts the same carry); report that preview-contaminated legacy data cannot be perfectly repaired retrospectively.

| Legacy key | Value |
| --- | --- |
| `hpmoto.campaign.v3` | `{unlocked:1..5,wins:{chapter:boolean},best:{chapter:seconds}}` |
| `hpmoto.carries.v5` | Nonnegative integer string |
| `hp_chibi_gp_v6_save` | `{affection,gifts,totalCarries,loveChaosEnabled,guideIntensity,morningMode,unlockedBadges:{first_finish,no_lost_win,stylish_overtake,carried_3_times,secret_kiss_scene,boss_lucien_clear}}` |
| `hpmoto.environment.v5` | `{time:'day'|'sunset'|'night',weather:'clear'|'cloudy'|'rain'|'mist',brightness}` |
| `hpmoto.v3.{chapter}.{vehicleId}` | Best story time in seconds |
| `hpmoto.free.v4.{route}.{laps}.{vehicleId}` | Best custom race time in seconds |

Local storage is scoped to origin. A downloaded V7 `file://` page and a V8 HTTP page do not automatically share storage. Compatibility can reuse keys when hosted at the same origin; cross-origin transfer requires an explicit export/import facility, never a false claim of automatic migration.

## Regression checks to carry into V8

- Preview carry and preview kiss leave the entire save unchanged, including after Skip, natural ending and return to menu.
- Severe gameplay crash increments exactly once; one overlapping trigger cannot create a second cinematic. Third validated carry triggers kiss.
- Skip clears cinematic state, audio/timeline, visual overlay and inputs and returns to the correct prior state.
- Carry result, preview and generic menu/dialog opening award no race medal.
- Finish without all ordered checkpoints is rejected; proper crossing commits awards once.
- Cone hit slows only modestly and does not carry; higher severity is proportional; pickups miss when lateral separation is too large.
- New race resets local warnings, clean-race state and per-race rewards; persistent saves survive reload.
- All 5 story chapters and all 10 map configurations load; locked chapters remain locked until earned or legitimately migrated.
- Rain changes traction; camera switching does not change control; keyboard/touch/gamepad input is explicitly tested where supported.
- Screenshot menu, both hero close-ups, dense street race, day/night and carry scene. Measure browser timing and state memory limits honestly.
