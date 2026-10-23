import {displayName,replaceNames,tunedVehicle,upgradeCost,UPGRADE_KINDS} from './profile.js?v=9';
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const names = {aurora:'Aurora',lucien:'Lucien',minh:'Minh',nhi:'Nhi',phong:'Phong',rin:'Rin'};
const timeText = seconds => { const value = Math.max(0, Number(seconds) || 0); return `${String(Math.floor(value/60)).padStart(2,'0')}:${(value%60).toFixed(1).padStart(4,'0')}`; };
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bikeSVG = scooter => `<svg viewBox="0 0 160 75" aria-hidden="true"><ellipse cx="80" cy="66" rx="65" ry="4" fill="#294d3b" opacity=".08"/><g fill="#2b3935" stroke="#233c35" stroke-width="2"><circle cx="30" cy="52" r="19"/><circle cx="129" cy="52" r="19"/></g><g fill="#c2cec0" stroke="#42594e" stroke-width="2"><circle cx="30" cy="52" r="12"/><circle cx="129" cy="52" r="12"/></g><g stroke="#718779" stroke-width="1.6"><path d="M30 40v24M18 52h24m78 0h24m-12-12v24m-8-20 16 16m-16 0 16-16M22 44l16 16m-16 0 16-16"/></g>${scooter?'<path d="M30 49Q26 26 46 27h23l-4 17h35l10-30 11 1-3 34q-10-9-17 0H46Z" fill="currentColor" stroke="#284c3d" stroke-width="2"/><path d="M107 16l-1-13 14-1m-7 5 16 44M48 23h30" fill="none" stroke="#32473b" stroke-width="5" stroke-linecap="round"/><path d="M110 22h12" stroke="#fff2c3" stroke-width="5"/><path d="M54 43h32" stroke="#e5e7cc" stroke-width="3"/>':'<path d="m31 50 25-23 40 3 28 22H62L48 40Z" fill="currentColor" stroke="#274c3d" stroke-width="2"/><path d="M52 28 42 13H20l7 12 20 5M83 30l9-17 25 7 11 16-23-2Z" fill="currentColor" stroke="#294e3c" stroke-width="2"/><path d="m107 18 2-13 12 8" fill="#c3d6d4" stroke="#31523e" stroke-width="2"/><path d="m118 24 15 29M58 28h25m-20 4 13 18M44 36l-14 16" stroke="#344a3e" stroke-width="4" fill="none" stroke-linecap="round"/><path d="m92 21 14 6" stroke="#f4edcc" stroke-width="3"/><path d="M47 31h18l-8 10H42Z" fill="#f1e9cc" opacity=".85"/>'}<path d="M67 52h37l9 7H77Z" fill="#83998c" stroke="#324e40" stroke-width="2"/><circle cx="74" cy="45" r="7" fill="#42584c"/><path d="m23 21-7-2" stroke="#dd705a" stroke-width="4"/></svg>`;

export class UI {
  constructor(engine, data) {
    this.engine = engine;
    this.data = data;
    this.actions = {};
    this.input = {throttle:0, brake:0, steer:0, tuck:false};
    this.touchPressed = new Set();
    this.mode = 'custom';
    this.vehicle = 0;
    this.track = 0;
    this.level = 0;
    this.lastPhase = null;
    this.lastResult = null;
    this.lastSaveStamp = '';
    this.storyPending = null;
    this.storyIndex = 0;
    this.mapLast = 0;
    this.toastUntil = 0;
    this.settingsAutoPaused = false;
    this.assets = {hero:'./assets/hero.png',characters:'./assets/characters.png',rivals:'./assets/rivals.png',carry:'./assets/carry.png',kiss:'./assets/kiss.png'};
    this.renderVehicles();
    this.renderRoutes();
    this.syncSettings();
    this._bindControls();
    this.engine.addEventListener('change', event => {
      if (event.detail?.type === 'toast' && event.detail.text) this.toast(event.detail.text);
      if (event.detail?.type === 'pickup') this.toast('Một món quà nhỏ từ thành phố ♡');
      if (['skill','chase'].includes(event.detail?.type)) this.toast(this.text(event.detail.text),1800);
      if(event.detail?.type==='profile'){this.refreshNames();if($('garageDialog').open)this.renderGarage();}
    });
    $('loading').hidden = true;
    this._bindV9();this.refreshNames();this.showMenu();
  }

  bind(actions = {}) { this.actions = actions; return this; }

  setAssets(assets = {}) {
    this.assets = {...this.assets, ...assets};
    $('heroArt').src = this.assets.hero;
    $('auroraAvatar').style.backgroundImage = `url("${this.assets.characters}")`;
    if (!this.storyPending) $('storyPortrait').style.backgroundImage = `url("${this.assets.characters}")`;
    $('auroraAvatar').style.backgroundImage = 'url("./assets/expressions.png")';
    $('auroraAvatar').style.backgroundSize = '800% 400%';
    $('auroraAvatar').style.backgroundPosition = '0% 25.3%';
    return this;
  }

  _act(name, ...args) {
    if (typeof this.actions[name] === 'function') return this.actions[name](...args);
    const method = {menu:'toMenu', preview:'previewCutscene', environment:'setEnvironment', settings:'setSettings'}[name] || name;
    if (typeof this.engine[method] === 'function') return this.engine[method](...args);
  }

  _bindControls() {
    $('customMode').addEventListener('click', () => this.setMode('custom'));
    $('storyMode').addEventListener('click', () => this.setMode('story'));
    $('vehicleChoices').addEventListener('click', event => {
      const choice = event.target.closest('[data-vehicle]');
      if (!choice) return;
      this.vehicle = +choice.dataset.vehicle;
      this.renderVehicles(); this.updateSelection();
    });
    $('routeChoices').addEventListener('click', event => {
      const choice = event.target.closest('[data-route]');
      if (!choice || choice.disabled) return;
      if (this.mode === 'story') this.level = +choice.dataset.route;
      else this.track = +choice.dataset.route;
      this.renderRoutes(); this.updateSelection();
    });
    $('startButton').addEventListener('click', () => this.startSelected());
    $('settingsButton').addEventListener('click', () => this.openSettings());
    $('raceSettingsButton').addEventListener('click', () => this.openSettings());
    $('pauseSettingsButton').addEventListener('click', () => this.openSettings());
    $('soundButton').addEventListener('click', () => {
      const enabled = !this._settings().sound;
      this.applySettings({sound:enabled});
      this._act('sound', enabled);
      this.toast(enabled ? 'Âm thanh đã bật.' : 'Một vòng đua yên tĩnh.');
    });
    $('audioToggle').addEventListener('change', event => {
      this.applySettings({sound:event.target.checked}); this._act('sound', event.target.checked);
    });
    $('helpButton').addEventListener('click', () => this._openDialog('helpDialog'));
    $('closeHelp').addEventListener('click', () => this._closeDialog('helpDialog'));
    $('readyButton').addEventListener('click', () => this._closeDialog('helpDialog'));
    $('pauseButton').addEventListener('click', () => this._act('pause'));
    $('resumeButton').addEventListener('click', () => {this._closeDialog('pauseDialog'); this._act('resume');});
    $('restartButton').addEventListener('click', () => {this.closeDialogs(); this._act('restart');});
    $('resultRestartButton').addEventListener('click', () => {this.closeDialogs(); this._act('restart');});
    for (const id of ['menuButton','resultMenuButton']) $(id).addEventListener('click', () => {this.closeDialogs(); this.storyPending = null; this._act('menu'); this.showMenu();});
    $('rescueButton').addEventListener('click', () => this._act('rescue'));
    $('cameraButton').addEventListener('click', () => this._act('camera'));
    $('previewButton').addEventListener('click', () => this.preview(false));
    $('previewCarrySettings').addEventListener('click', () => this.preview(false));
    $('previewKissSettings').addEventListener('click', () => this.preview(true));
    $('skipCinema').addEventListener('click', () => this._act('skipCutscene'));
    $('continueCarryButton').addEventListener('click', () => {this.closeDialogs();this._act('continueAfterCarry');});
    $('nextChapterButton').addEventListener('click', () => {
      const current = this.engine.state.config.level || 0;
      this.level = Math.min(4, current + 1);
      this.setMode('story'); this.closeDialogs(); this.startSelected();
    });
    $('nextStory').addEventListener('click', () => this.nextStory());
    $('skipStory').addEventListener('click', () => this.finishStory());
    $('closeSettings').addEventListener('click', () => this.closeSettings());
    $('saveSettings').addEventListener('click', () => this.closeSettings());
    $('qualitySelect').addEventListener('change', event => this.applySettings({quality:event.target.value}));
    $('timeSelect').addEventListener('change', () => this.applyEnvironment());
    $('weatherSelect').addEventListener('change', () => this.applyEnvironment());
    $('carrySelect').addEventListener('change', event => this.applySettings({carryEnabled:event.target.value === '1'}));
    $('touchScale').addEventListener('input', event => this.applySettings({controlScale:Number(event.target.value)/100}));
    $('touchOpacity').addEventListener('input', event => this.applySettings({controlOpacity:Number(event.target.value)/100}));
    for (const button of document.querySelectorAll('[data-control]')) {
      const down = event => {event.preventDefault(); button.setPointerCapture?.(event.pointerId); this.touchPressed.add(button.dataset.control);button.classList.add('pressed');this.updateTouch();};
      const up = event => {event.preventDefault();this.touchPressed.delete(button.dataset.control);button.classList.remove('pressed');this.updateTouch();};
      button.addEventListener('pointerdown', down);
      button.addEventListener('pointerup', up);
      button.addEventListener('pointercancel', up);
      button.addEventListener('lostpointercapture', () => {this.touchPressed.delete(button.dataset.control);button.classList.remove('pressed');this.updateTouch();});
      button.addEventListener('contextmenu', event => event.preventDefault());
    }
    window.addEventListener('blur', () => this.resetInput());
    document.addEventListener('visibilitychange', () => {if (document.hidden) this.resetInput();});
    for (const dialog of document.querySelectorAll('dialog')) {
      dialog.addEventListener('cancel', event => {
        event.preventDefault();
        if (dialog.id === 'settingsDialog') this.closeSettings();
        else if (dialog.id === 'pauseDialog') {this._closeDialog('pauseDialog');this._act('resume');}
        else this._closeDialog(dialog.id);
      });
    }
    document.querySelector('.brand').addEventListener('click', event => event.preventDefault());
  }

  _settings() {return this.engine.save?.settings || {};}

  syncSettings() {
    const settings = this._settings();
    $('qualitySelect').value = settings.quality || 'balanced';
    $('autoQualityToggle').checked=settings.autoQuality!==false;$('shakeToggle').checked=settings.cameraShake>0;$('performanceToggle').checked=!!settings.showPerformance;
    $('timeSelect').value = settings.time || 'day';
    $('weatherSelect').value = settings.weather || 'clear';
    $('carrySelect').value = settings.carryEnabled === false ? '0' : '1';
    const scale = clamp(Number(settings.controlScale) || 1, .8, 1.4);
    const opacity = clamp(Number(settings.controlOpacity) || .8, .35, 1);
    $('touchScale').value = Math.round(scale*100);
    $('touchScaleValue').textContent = `${Math.round(scale*100)}%`;
    $('touchOpacity').value = Math.round(opacity*100);
    $('touchOpacityValue').textContent = `${Math.round(opacity*100)}%`;
    document.documentElement.style.setProperty('--control-scale', scale);
    document.documentElement.style.setProperty('--control-opacity', opacity);
    $('audioToggle').checked = settings.sound !== false;
    $('soundButton').setAttribute('aria-pressed', String(settings.sound !== false));
    $('soundButton').textContent = settings.sound === false ? '♪' : '♫';
    $('soundButton').setAttribute('aria-label', settings.sound === false ? 'Bật âm thanh' : 'Tắt âm thanh');
    const low = navigator.hardwareConcurrency <= 4 || (navigator.deviceMemory && navigator.deviceMemory <= 4);
    $('qualityRecommendation').textContent = low ? 'Gợi ý: Performance để ưu tiên độ mượt trên thiết bị này.' : 'Balanced tự điều chỉnh theo thời gian khung hình thực tế.';
  }

  applySettings(settings) {this._act('settings', settings);this.syncSettings();}
  applyEnvironment() {const time = $('timeSelect').value, weather = $('weatherSelect').value;this._act('environment', time, weather);this.syncSettings();}

  updateTouch() {
    this.input.throttle = this.touchPressed.has('throttle') ? 1 : 0;
    this.input.brake = this.touchPressed.has('brake') ? 1 : 0;
    this.input.steer = (this.touchPressed.has('right') ? 1 : 0) - (this.touchPressed.has('left') ? 1 : 0);
    this.input.tuck = this.touchPressed.has('tuck');
    this.input.drift=this.touchPressed.has('drift');this.input.nitro=this.touchPressed.has('nitro');
  }
  resetInput() {this.touchPressed.clear();for (const button of document.querySelectorAll('[data-control]')) button.classList.remove('pressed');this.updateTouch();}

  renderVehicles() {
    $('vehicleChoices').innerHTML = this.data.vehicles.map((vehicle, index) => `<button class="vehicle-choice ${index === this.vehicle ? 'active' : ''}" style="--bike-color:#${Number(vehicle.color).toString(16).padStart(6,'0')}" data-vehicle="${index}" aria-pressed="${index === this.vehicle}">${bikeSVG(vehicle.id === 'vespa')}<strong>${escapeHTML(vehicle.name)}</strong><small>${escapeHTML(vehicle.tag)}</small></button>`).join('');
    $('vehicleDescription').textContent = this.data.vehicles[this.vehicle]?.desc || '';
  }

  setMode(mode) {
    this.mode = mode === 'story' ? 'story' : 'custom';
    $('customMode').setAttribute('aria-selected', String(this.mode === 'custom'));
    $('storyMode').setAttribute('aria-selected', String(this.mode === 'story'));
    $('customOptions').hidden = this.mode !== 'custom';
    $('storyHint').hidden = this.mode !== 'story';
    $('modeNote').textContent = this.mode === 'story' ? '5 CHƯƠNG · MỘT HÀNH TRÌNH CÙNG NHAU' : 'ĐƯỜNG ĐUA KHÉP KÍN · BẠN TỰ CẦM LÁI';
    this.renderRoutes(); this.updateSelection();
  }

  renderRoutes() {
    const story = this.mode === 'story';
    const tracks = story ? this.data.tracks.slice(0,5) : this.data.tracks;
    const unlocked = this.engine.save?.unlocked || 1;
    $('routeCount').textContent = story ? `${unlocked} / 5 ĐÃ MỞ` : '10 CHẶNG';
    $('routeChoices').innerHTML = tracks.map((track, index) => {
      const selected = index === (story ? this.level : this.track), locked = story && index >= unlocked;
      const name = story ? this.data.levels[index].name : track.name;
      const won = story && this.engine.save?.wins?.[index];
      return `<button class="route-choice ${selected ? 'active' : ''} ${locked ? 'locked' : ''}" data-route="${index}" aria-pressed="${selected}" ${locked ? 'disabled' : ''}><span>${String(index+1).padStart(2,'0')}${won ? ' · ✓' : ''}</span><canvas width="110" height="80" data-map="${index}" aria-hidden="true"></canvas>${locked ? '<i class="lock-icon" aria-label="Chưa mở">⌑</i>' : ''}<strong>${escapeHTML(name)}</strong><small>${(track.length/1000).toFixed(2)} KM · ${story ? escapeHTML(this.data.levels[index].tag || '') : 'ĐƯỜNG PHỐ'}</small></button>`;
    }).join('');
    for (const canvas of $('routeChoices').querySelectorAll('canvas')) this.drawMap(canvas, tracks[+canvas.dataset.map], null, true);
    this.updateSelection();
  }

  updateSelection() {
    const index = this.mode === 'story' ? this.level : this.track;
    const track = this.data.tracks[index];
    if (!track) return;
    $('selectedRouteName').textContent = track.name;
    $('selectedRouteInfo').textContent = `${(track.length/1000).toFixed(2)} km · ${(track.streetNames || []).slice(0,3).join(' → ')} · ${this.data.vehicles[this.vehicle].name}`;
    $('startButton').innerHTML = this.mode === 'story' ? `BẮT ĐẦU CHƯƠNG ${String(this.level+1).padStart(2,'0')} <span class="arrow-ne" aria-hidden="true"></span>` : 'LÊN XE, ĐI THÔI <span class="arrow-ne" aria-hidden="true"></span>';
    const won = Object.values(this.engine.save?.wins || {}).filter(Boolean).length;
    $('saveStatus').textContent = won ? `${won} / 5 chặng đã thắng · Những lời hẹn đang tiếp nối.` : 'Một hành trình mới bắt đầu.';
  }

  selectionConfig() {
    return {...this._settings(), mode:this.mode, track:this.mode === 'story' ? this.level : this.track, level:this.level, vehicle:this.vehicle,
      laps:Number($('lapsSelect').value)||1,difficulty:Number($('difficultySelect').value)||.86,opponent:$('opponentSelect').value||'lucien',
      time:$('timeSelect').value,weather:$('weatherSelect').value};
  }

  startSelected() {
    this.resetInput();this.closeDialogs();
    const config = this.selectionConfig();
    if (config.mode === 'story') {this.storyPending = config;this.storyIndex = 0;this.showStoryLine();}
    else {this.storyPending = null;this._act('start', config);}
  }

  showStoryLine() {
    const config = this.storyPending;
    if (!config) return;
    const lines = this.data.story?.[config.level] || [];
    if (!lines.length) {this.finishStory();return;}
    const [id, text] = lines[this.storyIndex];
    $('menu').hidden = true;$('hud').hidden = true;$('storyScreen').hidden = false;
    $('storyChapter').textContent = `CHƯƠNG ${String(config.level+1).padStart(2,'0')} · ${this.data.levels[config.level].name.toUpperCase()}`;
    $('storySpeaker').textContent = displayName(this.engine.save,id);
    $('storyText').textContent = this.text(text);
    const portrait = $('storyPortrait');
    portrait.className = 'character-portrait';
    if (id === 'aurora' || id === 'lucien') {
      portrait.style.backgroundImage = 'url("./assets/expressions.png")';
      portrait.style.backgroundSize = '800% 400%';
      const face = id === 'aurora' ? (this.storyIndex % 3 === 0 ? 0 : 1) : (this.storyIndex % 3 === 0 ? 4 : 1);
      portrait.style.backgroundPosition = `${face*100/7}% ${id === 'aurora' ? 25.3 : 69.9}%`;
    } else {
      const cells = {minh:[0,0],nhi:[1,0],phong:[2,0],rin:[3,0]};
      const cell = cells[id] || [0,0];
      portrait.classList.add('rival-portrait');
      portrait.style.backgroundImage = `url("${this.assets.rivals}")`;
      portrait.style.backgroundSize = '400% 200%';
      portrait.style.backgroundPosition = `${cell[0]*100/3}% ${cell[1]*100}%`;
    }
    portrait.setAttribute('aria-label', displayName(this.engine.save,id));
    $('storyProgress').textContent = `${String(this.storyIndex+1).padStart(2,'0')} / ${String(lines.length).padStart(2,'0')}`;
    $('nextStory').innerHTML = this.storyIndex === lines.length-1 ? 'VÀO ĐƯỜNG ĐUA <span class="arrow-ne" aria-hidden="true"></span>' : 'TIẾP TỤC <span>→</span>';
  }
  nextStory() {if (!this.storyPending) return;const lines = this.data.story[this.storyPending.level];if (this.storyIndex < lines.length-1) {this.storyIndex++;this.showStoryLine();} else this.finishStory();}
  finishStory() {if (!this.storyPending) return;const config = this.storyPending;this.storyPending = null;$('storyScreen').hidden = true;this._act('start', config);}

  preview(kiss = false) {this.closeDialogs();this.storyPending = null;$('storyScreen').hidden = true;this.resetInput();this._act('preview', kiss);}

  showMenu() {
    $('menu').hidden = false;$('hud').hidden = true;$('storyScreen').hidden = true;$('cinemaScreen').hidden = true;
    this.resetInput();this.renderRoutes();this.updateSelection();this.syncSettings();this.refreshNames();
  }

  openSettings() {
    this.settingsAutoPaused = ['race','countdown'].includes(this.engine.state.phase);
    if (this.settingsAutoPaused) this._act('pause');
    this._closeDialog('pauseDialog');this.syncSettings();this._openDialog('settingsDialog');
  }
  closeSettings() {
    this._closeDialog('settingsDialog');
    if (this.settingsAutoPaused) {this.settingsAutoPaused = false;this._act('resume');}
    else if (this.engine.state.phase === 'paused') this._openDialog('pauseDialog');
  }
  _openDialog(id) {const dialog = $(id);if (!dialog.open) dialog.showModal();}
  _closeDialog(id) {const dialog = $(id);if (dialog.open) dialog.close();}
  closeDialogs() {for (const dialog of document.querySelectorAll('dialog')) if (dialog.open) dialog.close();}

  update(state) {
    if (!state) return;
    const phase = state.phase;
    const now = performance.now();
    if (this.toastUntil && now >= this.toastUntil) {$('raceToast').hidden = true;$('globalToast').hidden = true;this.toastUntil = 0;}
    const saveStamp = `${this.engine.save?.unlocked}|${this.engine.save?.totalCarries}|${this.engine.save?.coins}|${JSON.stringify(this.engine.save?.wins)}`;
    if (saveStamp !== this.lastSaveStamp) {this.lastSaveStamp = saveStamp;this.updateSelection();if (phase === 'menu') this.renderRoutes();}
    $('menu').hidden = phase !== 'menu' || Boolean(this.storyPending);
    $('storyScreen').hidden = !this.storyPending;
    $('hud').hidden = !['countdown','race','paused'].includes(phase) || Boolean(this.storyPending);
    $('cinemaScreen').hidden = phase !== 'cutscene';
    if (phase !== 'paused') this._closeDialog('pauseDialog');
    if (phase !== 'result') {this._closeDialog('resultDialog');this.lastResult = null;}
    if (phase === 'paused' && !$('settingsDialog').open && !$('helpDialog').open) this._openDialog('pauseDialog');
    if (phase === 'result' && state.result && state.result !== this.lastResult) {this.lastResult = state.result;this.showResult(state);}
    if (phase === 'cutscene') {
      if (this.lastPhase !== 'cutscene') {
        $('cinemaImage').style.animationName = '';
        const art=document.querySelector('.cinema-art');
        try {art.style.backgroundImage=`url("${$('game').toDataURL('image/jpeg',.8)}")`;art.style.backgroundSize='cover';} catch {}
      }
      this.updateCinema(state.cutscene);
    } else if (this.lastPhase === 'cutscene') {
      $('cinemaImage').style.animationName='none';
      $('cinemaRunner').hidden=true;$('cinemaStage').hidden=true;
      for(const animation of $('cinemaScreen').getAnimations({subtree:true}))animation.cancel();
    }
    if (['race','countdown','paused'].includes(phase)) {
      const player = state.player || {};
      $('hudTrack').textContent = state.track?.name || 'GRAND PRIX';
      $('hudRank').innerHTML = `${state.rank || 1}<small>/ ${(state.rivals?.length || 1)+1}</small>`;
      $('hudLap').innerHTML = `${Math.min(state.laps || 1, player.lap || state.lap || 1)}<small>/ ${state.laps || 1}</small>`;
      $('hudTime').textContent = timeText(state.elapsed);
      const speed = Math.max(0, Number(player.speed) || 0)*3.6;
      $('hudSpeed').textContent = Math.round(speed);
      const mood = state.warning ? 3 : player.hitTimer > 0 ? 2 : player.brake > .2 ? 1 : speed > 90 ? 0 : 6;
      $('moodPortrait').style.backgroundPosition = `${mood*100/7}% 25.3%`;
      $('moodPortrait').setAttribute('aria-label', ['Aurora vui vẻ','Aurora tập trung','Aurora ngạc nhiên','Aurora lo lắng','','','Aurora mỉm cười'][mood]);
      const bike = this.data.vehicles[state.config?.vehicle || 0];
      $('hudGear').textContent = bike.id === 'vespa' ? 'CVT' : `SỐ ${clamp(Math.floor(speed/35)+1,1,6)}`;
      $('speedBar').style.width = `${Math.min(100,speed/(bike.max*3.6)*100)}%`;
      $('hudGrip').textContent = state.environment?.weather === 'rain' ? 'ĐƯỜNG ƯỚT · PHANH SỚM' : state.environment?.weather === 'fog' ? 'SƯƠNG NHẸ · GIỮ TẦM NHÌN' : 'BÌNH TĨNH QUA TỪNG GÓC CUA';
      $('carryCount').textContent = `♡ ${this.engine.save?.totalCarries || 0} lần được ${displayName(this.engine.save,'lucien')} cứu hộ`;
      const nitro=clamp((player.nitro||0)/(state.bike?.nitroCapacity||100)*100,0,100);$('nitroValue').textContent=Math.round(nitro)+'%';$('nitroBar').style.width=nitro+'%';
      $('skillStatus').hidden=!player.drifting&&!player.nitroActive;$('skillStatus').textContent=player.nitroActive?'NITRO ↑':`DRIFT x${Math.max(1,player.combo||1)} · ${Math.round(player.driftCharge||0)} năng lượng`;
      $('hudCheckpoint').textContent = `CP ${(state.checkpointIndex || 0)+1} / ${state.checkpoints?.length || 1}`;
      const turn = state.nextTurn;
      const turning = turn && turn.distance < 140 && Math.abs(turn.angle) > .4;
      $('navArrow').textContent = turning ? (turn.angle > 0 ? '↱' : '↰') : '↑';
      $('navStreet').textContent = turn?.street?.toUpperCase() || 'THEO TUYẾN ĐƯỜNG ĐUA';
      $('navText').textContent = turning ? (turn.angle > 0 ? 'Chuẩn bị rẽ phải' : 'Chuẩn bị rẽ trái') : 'Theo rào chắn & biển chỉ đường';
      $('navDistance').textContent = turning ? `${Math.max(0,Math.round(turn.distance))} m · Phanh trước cua` : 'Tự lái · Qua checkpoint theo thứ tự';
      let warning = typeof state.warning === 'string' ? state.warning : state.warning?.text || '';
      if (!warning && phase === 'race') {
        const hazard = state.obstacles?.filter(o => !o.hit).map(o => ({...o,near:Math.hypot(o.x-player.x,o.y-player.y),ahead:(o.x-player.x)*Math.cos(player.heading)+(o.y-player.y)*Math.sin(player.heading)})).find(o => o.near < 45 && o.ahead > 4);
        if (hazard) warning = `VẬT CẢN ${Math.round(hazard.near)} m · Chọn khoảng trống để tránh`;
      }
      $('raceWarning').hidden = !warning;$('raceWarning').textContent = warning;
      $('countdown').textContent = phase === 'countdown' ? String(Math.max(1,Math.ceil(state.countdown))) : '';
      if (now-this.mapLast > 90) {this.drawMap($('minimap'),state.track,player,false,state);this.mapLast = now;}
    }
    if (phase !== this.lastPhase) {const previous = this.lastPhase;this.lastPhase = phase;if (!(previous === 'countdown' && phase === 'race')) this.resetInput();if (phase === 'menu') {this.renderRoutes();this.syncSettings();}}
  }

  updateCinema(scene) {
    if (!scene) return;
    const elapsed = Number(scene.elapsed) || 0;
    const kissMoment = scene.kiss && elapsed >= 5.5;
    // Authored transparent poses advance with the engine timeline, never timers.
    // A short walk cycle, physical approach and help-up precede the final illustration.
    const stage = $('cinemaStage'), pose = $('cinemaPose'), runner = $('cinemaRunner');
    const illustrated = elapsed >= (scene.kiss ? 5.5 : 6.2);
    stage.hidden = illustrated;
    $('cinemaImage').style.opacity = illustrated ? '1' : '0';
    $('cinemaScreen').classList.toggle('pose-scene', !illustrated);
    let tile = elapsed < 1.4 ? 0 : elapsed < 2.2 ? 2 : elapsed < 3 ? 3 : elapsed < 4.5 ? 4 + (Math.floor(elapsed * 5) % 2) : elapsed < 5.5 ? 6 : scene.kiss ? 7 : 4 + (Math.floor(elapsed * 5) % 2);
    if(elapsed >= 3 && !illustrated) {
      pose.style.backgroundImage='url("./assets/carry-walk.png")';
      pose.style.backgroundSize='200% 100%';
      pose.style.backgroundPosition=`${Math.floor(elapsed*4)%2?100:0}% 0%`;
    } else {
      pose.style.backgroundImage='url("./assets/cinema-atlas.png")';
      pose.style.backgroundSize='400% 200%';
      pose.style.backgroundPosition = `${(tile % 4) * 100 / 3}% ${tile >= 4 ? 100 : 0}%`;
    }
    pose.style.left = elapsed < 1.4 ? '43%' : elapsed < 3 ? '50%' : `${50 + Math.min(8, Math.max(0,elapsed-3) * 3)}%`;
    pose.style.transform = `translate(-50%,${elapsed > 3 && tile < 6 ? Math.sin(elapsed*30)*2 : 0}px)`;
    runner.hidden = elapsed >= 1.4;
    runner.style.left = `${100 - Math.min(1, elapsed / 1.4)*42}%`;
    runner.style.transform = `translate(-50%,${Math.sin(elapsed * 23)*5}px)`;
    const src = kissMoment ? this.assets.kiss : this.assets.carry;
    const image = $('cinemaImage');
    if (image.getAttribute('src') !== src) image.src = src;
    image.alt = kissMoment ? 'Lucien hôn nhẹ lên má Aurora, cô mỉm cười ngượng ngùng' : 'Lucien đỡ rồi bế Aurora trở lại bên đường an toàn';
    $('cinemaScreen').classList.toggle('kiss', kissMoment);
    $('cinemaPreview').hidden = !scene.preview;
    $('cinemaLabel').textContent = kissMoment ? 'CỨ BA LẦN CỨU HỘ · MỘT CHÚT THƯƠNG' : 'MỘT CHÚT BỐI RỐI, MỘT CHÚT THƯƠNG';
    let speaker, text, note;
    if (elapsed < 1.7) {speaker='LUCIEN';text='“Aurora! Đợi anh, đừng đứng dậy vội.”';note=scene.preview ? 'Một khoảnh khắc trong câu chuyện của hai người.' : 'Lucien dừng xe ở lề an toàn rồi chạy tới.';}
    else if (elapsed < 3.5) {speaker='AURORA';text='“Em chỉ… muốn tự mình về đích thôi mà.”';note='Một cái nắm tay. Một nhịp thở. Mọi chuyện sẽ ổn.';}
    else if (elapsed < 5.5) {speaker='LUCIEN';text='“Hahaha! Đường về dài lắm, để anh đưa em.”';note='Aurora giận dỗi một chút, rồi khẽ nắm lấy vai anh.';}
    else if (kissMoment) {speaker='AURORA';text='“Anh… mọi người đang nhìn kìa!”';note='Một nụ hôn má, hai gương mặt ửng hồng. ♡';}
    else {speaker='LUCIEN';text='“Nghỉ một chút thôi. Rồi em lại tự cầm lái nhé.”';note=scene.preview ? 'Xem thử không thay đổi tiến trình hay thành tích.' : 'Cứu hộ về checkpoint gần nhất · +8 giây · Không cấp huy chương.';}
    $('cinemaSpeaker').textContent=this.text(speaker==='LUCIEN'?'Lucien':'Aurora').toUpperCase();$('cinemaText').textContent=this.text(text);$('cinemaNote').textContent=this.text(note);
  }

  showResult(state) {
    const result = state.result;
    if (!result?.valid) return;
    const story = state.config.mode === 'story';
    $('resultMedal').textContent = result.won ? '★' : '🏁';
    $('resultLabel').textContent = result.best ? 'VỀ ĐÍCH · KỶ LỤC CÁ NHÂN MỚI' : 'KẾT QUẢ CHẶNG ĐUA';
    $('resultTitle').textContent = result.won ? 'Gió cũng chạy theo bạn.' : 'Một vòng phố, thêm một kỷ niệm.';
    $('resultDescription').textContent = result.won ? (story ? 'Một chương mới đã mở. Có người đang đợi bạn ở góc phố tiếp theo.' : 'Bạn đã hoàn thành đúng thứ tự checkpoint và về đích đầu tiên.') : 'Bạn đã đi hết đường đua. Bình tĩnh ở góc cua tiếp theo, mình thử lại nhé.';
    $('resultDescription').textContent += ` +${result.coins||0} xu · Drift ${Math.round(state.stats.driftSeconds||0)} giây.`;
    if(story&&result.won)$('resultDescription').textContent += this.text(state.config.level===4?' Lucien: “Nhà vô địch của anh, hẹn em ở chuyến đi tiếp theo.”':' Aurora: “Một chặng nữa rồi! Hẹn ở góc phố tiếp theo nhé.”');
    $('resultTitle').textContent=this.text(result.won?'Aurora, gió cũng chạy theo em.':'Một vòng phố, thêm một kỷ niệm.');
    $('resultPosition').textContent = `${result.position || state.rank || 1} / ${(state.rivals?.length || 1)+1}`;
    $('resultTime').textContent = timeText(result.time);
    $('resultCollisions').textContent = state.stats?.collisions || result.stats?.collisions || 0;
    $('continueCarryButton').hidden = true;
    $('nextChapterButton').hidden = !(story && result.won && state.config.level < 4);
    $('resultRestartButton').hidden = false;
    this._openDialog('resultDialog');
  }

  drawMap(canvas, track, player = null, thumbnail = false, state = null) {
    if (!track?.points?.length) return;
    const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    const points = track.points;
    const bounds = track.bounds || {minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minY:Math.min(...points.map(p=>p[1])),maxY:Math.max(...points.map(p=>p[1]))};
    const pad = thumbnail ? 12 : 22;
    const scale = Math.min((w-pad*2)/(bounds.maxX-bounds.minX || 1),(h-pad*2)/(bounds.maxY-bounds.minY || 1));
    const cx=(bounds.minX+bounds.maxX)/2,cy=(bounds.minY+bounds.maxY)/2;
    const xy = (x,y) => [(x-cx)*scale+w/2,(y-cy)*scale+h/2];
    ctx.clearRect(0,0,w,h);
    if (!thumbnail) {
      ctx.fillStyle='#edf0e3';ctx.fillRect(0,0,w,h);
      for (const area of this.data.geo.areas || []) {
        if (!area.points?.length) continue;
        const a=area.points[0];
        if (a[0] < bounds.minX-1000 || a[0] > bounds.maxX+1000 || a[1] < bounds.minY-1000 || a[1] > bounds.maxY+1000) continue;
        ctx.beginPath();area.points.forEach((p,i)=>{const [x,y]=xy(p[0],p[1]);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();
        ctx.fillStyle=area.type==='water'?'#b4d5cd':'#d6e3c8';ctx.fill();
      }
    }
    ctx.beginPath();points.forEach((p,i)=>{const [x,y]=xy(p[0],p[1]);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();
    ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle=thumbnail?'#a6beaa':'#fcfaf0';ctx.lineWidth=thumbnail?5:8;ctx.stroke();ctx.strokeStyle=thumbnail?'#3e7764':'#427461';ctx.lineWidth=thumbnail?2.2:3.3;ctx.stroke();
    const start=xy(points[0][0],points[0][1]);ctx.fillStyle='#df705c';ctx.beginPath();ctx.arc(start[0],start[1],thumbnail?2.5:3.8,0,Math.PI*2);ctx.fill();
    if (!thumbnail && state) {
      for (const cp of state.checkpoints || []) {const [x,y]=xy(cp.x,cp.y);ctx.beginPath();ctx.arc(x,y,cp.index===state.checkpointIndex?4.5:2.5,0,Math.PI*2);ctx.fillStyle=cp.passed?'#a7c5ac':cp.index===state.checkpointIndex?'#d6aa55':'#fffdf0';ctx.fill();ctx.strokeStyle='#487562';ctx.lineWidth=1;ctx.stroke();}
      for (const rival of state.rivals || []) {const [x,y]=xy(rival.x,rival.y);ctx.fillStyle='#7774a3';ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();}
    }
    if (player) {const [x,y]=xy(player.x,player.y);ctx.save();ctx.translate(x,y);ctx.rotate(player.heading||0);ctx.beginPath();ctx.moveTo(7,0);ctx.lineTo(-5,-4.5);ctx.lineTo(-3,0);ctx.lineTo(-5,4.5);ctx.closePath();ctx.fillStyle='#df705c';ctx.strokeStyle='#fff8ea';ctx.lineWidth=1.4;ctx.fill();ctx.stroke();ctx.restore();}
  }

  text(value){return replaceNames(value,this.engine.save);}
  refreshNames(){
    for(const element of document.querySelectorAll('[data-name-template]'))element.textContent=this.text(element.dataset.nameTemplate);
    $('heroDriverName').textContent=displayName(this.engine.save,'aurora');$('minimapDriver').textContent=displayName(this.engine.save,'aurora').toUpperCase();
    $('opponentSelect').querySelector('[value="lucien"]').textContent=displayName(this.engine.save,'lucien')+' ♡';
    const next=Math.min(4,Math.max(0,this.engine.save.unlocked-1));$('continueChapter').textContent=this.data.levels[next].name;
  }
  _bindV9(){
    $('chooseCustom').onclick=()=>{this.setMode('custom');$('routeChoices').scrollIntoView({block:'nearest',behavior:'smooth'});};
    $('chooseStory').onclick=()=>{this.setMode('story');$('routeChoices').scrollIntoView({block:'nearest',behavior:'smooth'});};
    $('continueJourney').onclick=()=>{this.level=Math.min(4,Math.max(0,this.engine.save.unlocked-1));this.setMode('story');this.startSelected();};
    $('namesButton').onclick=()=>{const n=this.engine.save.characterNames;$('auroraName').value=n.aurora;$('lucienName').value=n.lucien;$('nameFeedback').textContent='';this._openDialog('namesDialog');};
    $('closeNames').onclick=()=>this._closeDialog('namesDialog');
    $('namesForm').onsubmit=event=>{event.preventDefault();const a=$('auroraName').value.trim(),l=$('lucienName').value.trim();if(!a||!l||/[<>]/u.test(a+l)||!/[\p{L}\p{N}\p{Extended_Pictographic}]/u.test(a)||!/[\p{L}\p{N}\p{Extended_Pictographic}]/u.test(l)){$('nameFeedback').textContent='Nhập hai tên hợp lệ, không dùng mã HTML.';return;}this.engine.setNames({aurora:a,lucien:l});this.refreshNames();this._closeDialog('namesDialog');this.toast('Đã lưu tên của hai người.');};
    $('resetNames').onclick=()=>{this.engine.setNames({aurora:'Aurora',lucien:'Lucien'});$('auroraName').value='Aurora';$('lucienName').value='Lucien';this.refreshNames();$('nameFeedback').textContent='Đã khôi phục tên mặc định.';};
    $('garageButton').onclick=()=>{this.garageVehicle=this.vehicle;this.renderGarage();this._openDialog('garageDialog');};
    for(const id of ['closeGarage','garageDone'])$(id).onclick=()=>this._closeDialog('garageDialog');
    $('garageVehicles').onclick=event=>{const b=event.target.closest('[data-garage-vehicle]');if(b){this.garageVehicle=+b.dataset.garageVehicle;this.renderGarage();}};
    $('upgradeChoices').onclick=event=>{const b=event.target.closest('[data-upgrade]');if(!b)return;const result=this.engine.upgradeVehicle(this.data.vehicles[this.garageVehicle].id,b.dataset.upgrade);$('garageFeedback').textContent=result.ok?'Đã nâng cấp. Xe đã sẵn sàng cho cuộc đua tiếp theo.':result.reason==='insufficient-coins'?'Chưa đủ xu. Hoàn thành cuộc đua hoặc Drift để tích thêm.':'Hạng mục đã đạt cấp tối đa.';this.renderGarage();};
    for(const key of ['paint','helmet','jacket','gloves','accessory'])$(key+'Select').onchange=event=>{this.engine.setCosmetics({[key]:event.target.value});this.renderGarage();};
    $('memoriesButton').onclick=()=>{this.renderMemories();this._openDialog('memoriesDialog');};$('closeMemories').onclick=()=>this._closeDialog('memoriesDialog');
    $('previewEndingButton').onclick=()=>{this.closeDialogs();this.storyPending=null;this._act('previewEnding');};
    $('replayEnding').onclick=()=>{this.closeDialogs();this._act('replayEnding');};
    $('autoQualityToggle').onchange=event=>this.applySettings({autoQuality:event.target.checked});$('shakeToggle').onchange=event=>this.applySettings({cameraShake:event.target.checked?.45:0});$('performanceToggle').onchange=event=>this.applySettings({showPerformance:event.target.checked});
    for(const id of ['fullscreenMenu','fullscreenButton'])$(id).onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{this.toast('Trình duyệt này chưa cho phép toàn màn hình.');}};
  }
  renderGarage(){
    const index=this.garageVehicle||0,base=this.data.vehicles[index],bike=tunedVehicle(base,this.engine.save);
    $('garageCoins').textContent=this.engine.save.coins.toLocaleString('vi-VN');
    $('garageVehicles').innerHTML=this.data.vehicles.map((v,i)=>`<button data-garage-vehicle="${i}" class="${i===index?'active':''}" aria-pressed="${i===index}">${escapeHTML(v.name)}</button>`).join('');
    $('garageBikeName').textContent=base.name;$('garageBikeStats').textContent=`${Math.round(bike.max*3.6)} km/h · Gia tốc ${bike.acc.toFixed(1)} · Bám đường ${bike.grip.toFixed(2)} · Nitro ${bike.nitroCapacity}`;
    const titles={engine:'Động cơ',tires:'Lốp xe',brakes:'Phanh',nitro:'Bình Nitro',stability:'Ổn định'},descs={engine:'Tăng gia tốc và tốc độ tối đa',tires:'Bám cua chắc hơn, drift dễ kiểm soát',brakes:'Giảm quãng đường phanh',nitro:'Thêm dung lượng và lực đẩy',stability:'Giữ xe ổn định khi đổi hướng'};
    $('upgradeChoices').innerHTML=UPGRADE_KINDS.map(kind=>{const level=bike.upgrades[kind],cost=upgradeCost(level,kind);return `<button data-upgrade="${kind}" ${level===3?'disabled':''}><span><b>${titles[kind]}</b><small>${descs[kind]}</small></span><i>${'●'.repeat(level)}${'○'.repeat(3-level)}</i><strong>${level===3?'TỐI ĐA':cost+' xu ↗'}</strong></button>`;}).join('');
    this.onGaragePreview?.(index,this.engine.save.garage.cosmetics);
    for(const [key,value] of Object.entries(this.engine.save.garage.cosmetics)){const select=$(key+'Select');if(select)select.value=value;}
  }
  renderMemories(){
    const memory=this.engine.save.memories.heart_bracelet,unlocked=this.engine.save.endingUnlocked&&!!memory;$('memoryGift').hidden=!unlocked;$('memoryLocked').hidden=unlocked;$('replayEnding').disabled=!unlocked;
    if(unlocked){$('memoryGiftName').textContent=memory.title;$('memoryGiftDescription').textContent=this.text(memory.description);const date=new Date(memory.receivedAt);$('memoryGiftDate').textContent=`${displayName(this.engine.save,'aurora')} & ${displayName(this.engine.save,'lucien')} · ${Number.isNaN(+date)?'Đã lưu':date.toLocaleDateString('vi-VN')}`;}
    this.refreshNames();
  }

  toast(text, duration = 2800) {
    const racing = ['race','countdown','paused'].includes(this.engine.state.phase);
    const target = $(racing ? 'raceToast' : 'globalToast');
    $('raceToast').hidden = true;$('globalToast').hidden = true;
    target.textContent = this.text(text);target.hidden = false;this.toastUntil = performance.now()+duration;
  }
}
