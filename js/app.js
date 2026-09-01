/* 계시록 노래 - app.js */
(function(){
"use strict";

const CHAPTERS = Object.keys(REV_DATA).map(Number).sort((a,b)=>a-b);
function verseCount(ch){ return REV_DATA[String(ch)].length; }
function verseText(ch,i){ return REV_DATA[String(ch)][i]; }

/* chapter titles - shown instead of the verse count next to the chapter
   number ("1장 계시록 전장의 요약과 결론" instead of "1장 (20절)") */
const CHAPTER_TITLES = {
  1: "계시록 전장의 요약과 결론",
  2: "일곱 교회 사자에게 보낸 편지",
  3: "일곱 교회 사자에게 보낸 편지",
  4: "영계 하나님의 보좌와 계열",
  5: "일곱 인으로 봉한 책",
  6: "배도한 선천 해달별에 대한 심판",
  7: "새창조된 영적 새 이스라엘 열두 지파",
  8: "마지막 인과 일곱 나팔",
  9: "무저갱의 황충과 범죄한 천사",
  10: "하늘에서 온 계시 책과 약속의 목자",
  11: "두 증인과 일곱째 나팔",
  12: "용과 하나님과의 전쟁",
  13: "짐승에게 표 받고 배도한 선민",
  14: "처음 익은 열매 시온 산 14만 4천",
  15: "만국이 와서 경배할 증거장막 성전",
  16: "진노의 일곱 대접",
  17: "마귀의 양식 음행의 포도주",
  18: "만국을 무너뜨린 사단과의 결혼",
  19: "영육 어린양의 혼인잔치",
  20: "순교의 영과 산 자의 첫째 부활",
  21: "약속한 새 하늘 새 땅 신천지",
  22: "생명나무가 있는 거룩한 성",
  23: "각 장 제목 모음"
};
function chapterTitle(ch){ return CHAPTER_TITLES[ch] || ""; }

/* Chapter 23 is a special "title track" - a song of just the 22 chapter
   titles read out (1장 is split into two, giving 23 lines total) rather
   than an actual chapter of Revelation. It shows as "제목" everywhere a
   chapter number would normally appear (grid tile, "N장" label) instead
   of "23"/"23장". */
const TITLE_TRACK_CH = 23;
function chapterDisplayLabel(ch){
  return Number(ch)===TITLE_TRACK_CH ? "제목" : ch+"장";
}
function chapterTileLabel(ch){
  return Number(ch)===TITLE_TRACK_CH ? "제목" : String(ch);
}
/* labels shown in bold before each line of the title track - index-matched
   to REV_DATA["23"] (1장 is split into two lines, so 23 labels total) */
const TITLE_TRACK_LABELS = [
  "1-1장","1-2장","2장","3장","4장","5장","6장","7장","8장","9장","10장",
  "11장","12장","13장","14장","15장","16장","17장","18장","19장","20장","21장","22장"
];

function qs(sel, root){ return (root||document).querySelector(sel); }
function qsa(sel, root){ return Array.from((root||document).querySelectorAll(sel)); }
function el(tag, attrs, children){
  const e = document.createElement(tag);
  if(attrs) for(const k in attrs){
    if(k==="class") e.className = attrs[k];
    else if(k==="html") e.innerHTML = attrs[k];
    else if(k.startsWith("on") && typeof attrs[k]==="function") e.addEventListener(k.slice(2), attrs[k]);
    else if(attrs[k]===false || attrs[k]==null){ /* skip */ }
    else e.setAttribute(k, attrs[k]===true ? "" : attrs[k]);
  }
  if(children) (Array.isArray(children)?children:[children]).forEach(c=>{
    if(c==null) return;
    e.appendChild(typeof c==="string" ? document.createTextNode(c) : c);
  });
  return e;
}
function fmtTime(t){
  if(t==null || isNaN(t)) return "--:--";
  const m = Math.floor(t/60), s = Math.floor(t%60);
  return String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
}

/* ---------------- localStorage: verse start timestamps ---------------- */
const LS_TS = "revsongs_timestamps_v1";
function loadAllTs(){ try{ return JSON.parse(localStorage.getItem(LS_TS)) || {}; }catch(e){ return {}; } }
function saveAllTs(t){ localStorage.setItem(LS_TS, JSON.stringify(t)); }
/* Each entry is {start, end} (end may still be null if only the start was
   marked). Older data only ever stored a plain start-time number per verse -
   migrate those to {start:number, end:null} on the way out so existing marks
   (and old backup files) keep working; the app just asks for an end point
   too from then on.

   DEFAULT_TS (js/verse-times.js) ships pre-marked verse timing baked into
   the app itself, so it works out of the box with no import step - this
   matters a lot for less tech-savvy users. It's only used as a fallback:
   if this chapter has never been touched in localStorage at all (raw is
   undefined), fall back to the shipped default. The moment the user marks
   or clears anything for that chapter (even clearing it down to []),
   saveChapterTs writes a real (possibly empty) array for it, and from then
   on their own data always wins over the shipped default. */
function loadChapterTs(ch){
  const all = loadAllTs();
  let raw = all[String(ch)];
  if(raw===undefined && typeof DEFAULT_TS!=="undefined" && DEFAULT_TS[String(ch)]){
    // clone each entry - otherwise any later mutation (⏱ 다시 표시, 절 구간
    // 표시하기 등) would write directly into the shared DEFAULT_TS objects
    // themselves, silently corrupting the shipped defaults for the rest of
    // the session (and for every other chapter still relying on them).
    raw = DEFAULT_TS[String(ch)].map(e=>{
      if(e==null) return e;
      if(typeof e==="number") return e;
      return {start:e.start, end:e.end};
    });
  }
  raw = raw || [];
  return raw.map(e=>{
    if(e==null) return null;
    if(typeof e === "number") return {start:e, end:null};
    return e;
  });
}
function saveChapterTs(ch, arr){
  const all = loadAllTs();
  all[String(ch)] = arr;
  saveAllTs(all);
}

/* ---------------- IndexedDB: alternate clips per verse ---------------- */
let dbPromise = null;
function openDB(){
  if(dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject)=>{
    const req = indexedDB.open("RevSongsDB", 2);
    req.onupgradeneeded = ()=>{
      const db = req.result;
      if(!db.objectStoreNames.contains("altClips")){
        const store = db.createObjectStore("altClips", {keyPath:"id", autoIncrement:true});
        store.createIndex("chapter", "chapter");
      }
      if(!db.objectStoreNames.contains("chapterAudio")){
        // one row per chapter - a user-uploaded replacement for that
        // chapter's whole original song (not the per-verse alt clips)
        db.createObjectStore("chapterAudio", {keyPath:"chapter"});
      }
    };
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
    req.onblocked = ()=>{
      // most common cause: this app is already open in another tab, and
      // that tab's older connection hasn't closed, so the browser just
      // parks this request forever instead of firing onsuccess/onerror.
      // dbWithTimeout() below is what keeps that from freezing the app.
      console.warn("RevSongsDB open blocked - probably open in another tab");
    };
  });
  return dbPromise;
}
/* every DB call below goes through this instead of awaiting openDB()
   directly. If IndexedDB never responds (blocked by another tab, or any
   other reason) we give up after a few seconds and resolve to null so
   callers can fall back gracefully (no alt clips / no saved chapter
   override) instead of the whole screen hanging blank forever - which is
   exactly what used to happen before this guard existed. openDB()'s own
   promise is left alone (not replaced), so if the block clears later
   (e.g. the other tab closes), the next call can still succeed normally. */
function dbWithTimeout(ms){
  return Promise.race([
    openDB().catch(()=>null),
    new Promise(resolve=> setTimeout(()=>resolve(null), ms||2500))
  ]);
}
async function addAltClip(chapter, verse, label, blob){
  const db = await dbWithTimeout();
  if(!db) throw new Error("저장 공간을 열 수 없어요. 이 앱을 다른 탭에서도 열어두셨다면 그 탭을 닫고 다시 시도해주세요.");
  return new Promise((resolve,reject)=>{
    const tx = db.transaction("altClips","readwrite");
    tx.objectStore("altClips").add({chapter, verse, label, blob, createdAt:Date.now()});
    tx.oncomplete = ()=>resolve();
    tx.onerror = ()=>reject(tx.error);
  });
}
async function getAltClipsForChapter(chapter){
  const db = await dbWithTimeout();
  if(!db) return [];
  return new Promise((resolve,reject)=>{
    const tx = db.transaction("altClips","readonly");
    const idx = tx.objectStore("altClips").index("chapter");
    const req = idx.getAll(IDBKeyRange.only(chapter));
    req.onsuccess = ()=>resolve(req.result || []);
    req.onerror = ()=>reject(req.error);
  });
}
async function deleteAltClip(id){
  const db = await dbWithTimeout();
  if(!db) throw new Error("삭제할 수 없어요. 이 앱을 다른 탭에서도 열어두셨다면 그 탭을 닫고 다시 시도해주세요.");
  return new Promise((resolve,reject)=>{
    const tx = db.transaction("altClips","readwrite");
    tx.objectStore("altClips").delete(id);
    tx.oncomplete = ()=>resolve();
    tx.onerror = ()=>reject(tx.error);
  });
}

/* whole-chapter song replacement (separate from per-verse alt clips) -
   lets a chapter's main song be swapped for a different recording of the
   whole chapter, stored locally in this browser only */
async function setChapterAudioOverride(chapter, blob, name){
  const db = await dbWithTimeout();
  if(!db) throw new Error("저장 공간을 열 수 없어요. 이 앱을 다른 탭에서도 열어두셨다면 그 탭을 닫고 다시 시도해주세요.");
  return new Promise((resolve,reject)=>{
    const tx = db.transaction("chapterAudio","readwrite");
    tx.objectStore("chapterAudio").put({chapter, blob, name, updatedAt:Date.now()});
    tx.oncomplete = ()=>resolve();
    tx.onerror = ()=>reject(tx.error);
  });
}
async function getChapterAudioOverride(chapter){
  const db = await dbWithTimeout();
  if(!db) return null;
  return new Promise((resolve,reject)=>{
    const tx = db.transaction("chapterAudio","readonly");
    const req = tx.objectStore("chapterAudio").get(chapter);
    req.onsuccess = ()=>resolve(req.result || null);
    req.onerror = ()=>reject(req.error);
  });
}
async function deleteChapterAudioOverride(chapter){
  const db = await dbWithTimeout();
  if(!db) throw new Error("되돌릴 수 없어요. 이 앱을 다른 탭에서도 열어두셨다면 그 탭을 닫고 다시 시도해주세요.");
  return new Promise((resolve,reject)=>{
    const tx = db.transaction("chapterAudio","readwrite");
    tx.objectStore("chapterAudio").delete(chapter);
    tx.oncomplete = ()=>resolve();
    tx.onerror = ()=>reject(tx.error);
  });
}

/* ---------------- state ---------------- */
let currentChapter = 1;
let chapterAltClips = []; // cached alt clips for currentChapter
const objectUrls = []; // track for revocation
function clearObjectUrls(){
  objectUrls.forEach(u=>URL.revokeObjectURL(u));
  objectUrls.length = 0;
}

const chapterGrid = qs("#chapterGrid");
const chapterLabel = qs("#chapterLabel");
const chapterTitleRow = qs("#chapterTitleRow");
const mainAudio = qs("#mainAudio");
const missingMsg = qs("#missingMsg");
const markCountEl = qs("#markCount");
const verseListEl = qs("#verseList");
const playAllHint = qs("#playAllHint");

/* ---------------- 글꼴 크기(가/가) ---------------- */
const LS_FONT_SIZE = "revsongs_font_size_v1";
const fontSmallBtn = qs("#fontSmallBtn");
const fontLargeBtn = qs("#fontLargeBtn");
function applyFontSize(size){
  document.body.classList.toggle("font-large", size==="large");
  fontSmallBtn.classList.toggle("on", size!=="large");
  fontLargeBtn.classList.toggle("on", size==="large");
}
fontSmallBtn.addEventListener("click", ()=>{
  localStorage.setItem(LS_FONT_SIZE, "normal");
  applyFontSize("normal");
});
fontLargeBtn.addEventListener("click", ()=>{
  localStorage.setItem(LS_FONT_SIZE, "large");
  applyFontSize("large");
});
applyFontSize(localStorage.getItem(LS_FONT_SIZE) === "large" ? "large" : "normal");
const chapterAudioInput = qs("#chapterAudioInput");
const chapterAudioStatus = qs("#chapterAudioStatus");
const chapterAudioRevertBtn = qs("#chapterAudioRevertBtn");
const seekBackBtn = qs("#seekBackBtn");
const seekFwdBtn = qs("#seekFwdBtn");
const speedSlider = qs("#speedSlider");
const speedLabel = qs("#speedLabel");
const playPauseBtn = qs("#playPauseBtn");
const playIcon = qs("#playIcon");
const pauseIcon = qs("#pauseIcon");
const seekRange = qs("#seekRange");
const curTimeLabel = qs("#curTimeLabel");
const durTimeLabel = qs("#durTimeLabel");

/* ---------------- custom play button + seek bar ----------------
   The native <audio controls> transport bar renders its play button tiny
   (and un-stylable in any reliable cross-browser way, especially on iOS
   Safari) - too small for people to reliably find/tap. mainAudio itself
   stays in the DOM (display:none) purely as the underlying media element;
   all playback is driven through this custom UI instead. */
function fmtClock(t){
  if(t==null || isNaN(t) || !isFinite(t)) return "0:00";
  const m = Math.floor(t/60), s = Math.floor(t%60);
  return m+":"+String(s).padStart(2,"0");
}
function updatePlayPauseIcon(){
  const playing = !mainAudio.paused && !mainAudio.ended;
  playIcon.hidden = playing;
  pauseIcon.hidden = !playing;
  playPauseBtn.setAttribute("aria-label", playing ? "일시정지" : "재생");
}
playPauseBtn.addEventListener("click", ()=>{
  if(mainAudio.paused){ mainAudio.play().catch(()=>{}); }
  else { mainAudio.pause(); }
});
mainAudio.addEventListener("play", updatePlayPauseIcon);
mainAudio.addEventListener("pause", updatePlayPauseIcon);
mainAudio.addEventListener("ended", updatePlayPauseIcon);

let seekRangeDragging = false;
function refreshDuration(){
  const dur = mainAudio.duration;
  if(isFinite(dur) && dur>0){
    seekRange.max = dur;
    durTimeLabel.textContent = fmtClock(dur);
  }
}
mainAudio.addEventListener("loadedmetadata", refreshDuration);
mainAudio.addEventListener("durationchange", refreshDuration);
mainAudio.addEventListener("timeupdate", ()=>{
  curTimeLabel.textContent = fmtClock(mainAudio.currentTime);
  if(!seekRangeDragging) seekRange.value = mainAudio.currentTime || 0;
});
seekRange.addEventListener("input", ()=>{
  seekRangeDragging = true;
  curTimeLabel.textContent = fmtClock(Number(seekRange.value));
});
function commitSeekRange(){
  seekRangeDragging = false;
  safeSeek(Number(seekRange.value));
}
seekRange.addEventListener("change", commitSeekRange);
seekRange.addEventListener("mouseup", commitSeekRange);
seekRange.addEventListener("touchend", commitSeekRange);

/* ±5초 이동 버튼 - 절 표시하다 잘못 짚은 지점을 손으로 이동해가며 고칠 때
   진행바를 드래그하는 것보다 정확하고 편해요.
   Setting currentTime before the browser has metadata (readyState 0) gets
   silently dropped/reset - same issue playQueueFrom() below already guards
   against. These buttons didn't have that guard, so tapping them right
   after switching chapters (before the file's metadata loads) could look
   like "seeking doesn't work". safeSeek() waits for loadedmetadata first
   when needed. */
function safeSeek(target){
  const clamped = Math.max(0, target);
  const apply = ()=>{
    mainAudio.currentTime = clamped;
    // On some mobile browsers, a seek made right as other page content
    // changes (e.g. right after opening 절 구간 표시) can get silently
    // dropped/reverted a moment later. Verify shortly after and force it
    // again if it didn't actually stick, instead of trusting the first
    // assignment blindly.
    setTimeout(()=>{
      if(Math.abs((mainAudio.currentTime||0) - clamped) > 0.5){
        mainAudio.currentTime = clamped;
      }
    }, 150);
  };
  if(mainAudio.readyState >= 1){
    apply();
  } else {
    mainAudio.addEventListener("loadedmetadata", function once(){
      mainAudio.removeEventListener("loadedmetadata", once);
      apply();
    }, {once:true});
  }
}
seekBackBtn.addEventListener("click", ()=>{
  safeSeek((mainAudio.currentTime||0) - 5);
});
seekFwdBtn.addEventListener("click", ()=>{
  const dur = mainAudio.duration;
  const target = (mainAudio.currentTime||0) + 5;
  // only clamp to the song's length once the browser actually knows it -
  // duration can be 0/NaN before the audio has loaded enough metadata
  safeSeek((isFinite(dur) && dur>0) ? Math.min(dur, target) : target);
});

/* ---------------- 관리자 도구(구간 표시/초기화) 숨김 토글 ----------------
   Regular listeners never need "절 구간 표시"/"초기화" - only whoever is
   marking up chapters does. Tucked behind a gear icon so the normal
   listening UI stays simple; remembered in localStorage so the person
   doing the marking doesn't have to re-reveal it every visit. */
const LS_ADMIN = "revsongs_admin_mode_v1";
const adminToggleBtn = qs("#adminToggleBtn");
const adminControlsRow = qs("#adminControlsRow");
let adminMode = localStorage.getItem(LS_ADMIN) === "1";
function applyAdminMode(){
  adminControlsRow.hidden = !adminMode;
  adminToggleBtn.classList.toggle("on", adminMode);
}
adminToggleBtn.addEventListener("click", ()=>{
  adminMode = !adminMode;
  localStorage.setItem(LS_ADMIN, adminMode ? "1" : "0");
  applyAdminMode();
  if(!adminMode && guidedMode){
    guidedMode = false;
    guidedBtn.classList.remove("on");
    guidedPanel.hidden = true;
  }
});
applyAdminMode();

/* 재생 속도 0.8x~2.0x - audio 엘리먼트에 그대로 남아있는 속성이라 장을
   바꿔도 유지되지만, 혹시 몰라 매번 새 곡을 걸 때도 다시 적용해줘요
   (applyPlaybackRate, setChapter/loadChapterAudioSource에서 호출) */
function applyPlaybackRate(){ mainAudio.playbackRate = parseFloat(speedSlider.value); }
speedSlider.addEventListener("input", ()=>{
  applyPlaybackRate();
  speedLabel.textContent = parseFloat(speedSlider.value).toFixed(1)+"x";
});
applyPlaybackRate();

/* picks the audio source for the current chapter: a user-uploaded
   whole-chapter replacement if one was saved for it (this browser only),
   otherwise the original shipped file */
let chapterAudioObjectUrl = null;
async function loadChapterAudioSource(){
  if(chapterAudioObjectUrl){ URL.revokeObjectURL(chapterAudioObjectUrl); chapterAudioObjectUrl = null; }
  const override = await getChapterAudioOverride(currentChapter).catch(()=>null);
  if(override && override.blob){
    chapterAudioObjectUrl = URL.createObjectURL(override.blob);
    mainAudio.src = chapterAudioObjectUrl;
    chapterAudioStatus.hidden = false;
    chapterAudioStatus.textContent = "🎵 내가 올린 곡 사용 중" + (override.name ? " ("+override.name+")" : "") + " (이 브라우저에만 저장됨)";
    chapterAudioRevertBtn.hidden = false;
  } else {
    mainAudio.src = "audio/"+currentChapter+".mp3";
    chapterAudioStatus.hidden = true;
    chapterAudioRevertBtn.hidden = true;
  }
  mainAudio.onerror = ()=>{ missingMsg.hidden = false; playPauseBtn.disabled = true; };
  applyPlaybackRate();
}

chapterAudioInput.addEventListener("change", async (e)=>{
  const f = e.target.files[0];
  e.target.value = "";
  if(!f) return;
  const ok = confirm(
    currentChapter+"장 전체를 이 파일로 바꿀까요?\n\n" +
    "이 브라우저에만 저장돼요(내보내기에는 포함 안 됨). 그리고 이미 표시해둔 절 시작/끝 " +
    "지점은 새 곡의 타이밍과 안 맞을 수 있어서, 절 구간 표시로 다시 표시해야 할 수 있어요."
  );
  if(!ok) return;
  try{
    await setChapterAudioOverride(currentChapter, f, f.name);
    await loadChapterAudioSource();
  }catch(err){ alert(err.message || "저장하지 못했어요."); }
});

chapterAudioRevertBtn.addEventListener("click", async ()=>{
  if(!confirm(currentChapter+"장을 원래 곡으로 되돌릴까요? (지금 올려둔 곡은 삭제돼요)")) return;
  try{
    await deleteChapterAudioOverride(currentChapter);
    await loadChapterAudioSource();
  }catch(err){ alert(err.message || "되돌리지 못했어요."); }
});

function buildChapterGrid(){
  chapterGrid.innerHTML = "";
  CHAPTERS.forEach(ch=>{
    const tile = el("button",{class:"chapter-tile", "data-ch":ch, title:chapterDisplayLabel(ch)+" "+chapterTitle(ch)}, chapterTileLabel(ch));
    tile.addEventListener("click", ()=> setChapter(ch));
    chapterGrid.appendChild(tile);
  });
}
buildChapterGrid();

function updateChapterGridActive(){
  qsa(".chapter-tile", chapterGrid).forEach(t=>{
    t.classList.toggle("active", Number(t.dataset.ch)===currentChapter);
  });
}

async function setChapter(ch, opts){
  const autoplay = !!(opts && opts.autoplay);
  currentChapter = ch;
  updateChapterGridActive();
  chapterLabel.textContent = chapterDisplayLabel(ch);
  chapterTitleRow.textContent = chapterTitle(ch);
  missingMsg.hidden = true;
  guidedMode = false;
  guidedBtn.classList.remove("on");
  guidedPanel.hidden = true;
  stopLoop();
  chapterLoopMode = false;
  chapterLoopBtn.classList.remove("on");
  chapterLoopBtn.textContent = "이 장만 듣기";
  mainAudio.loop = false;
  lastPlayedVerseIndex = null;
  playPauseBtn.disabled = false;
  updatePlayPauseIcon();
  curTimeLabel.textContent = "0:00";
  durTimeLabel.textContent = "0:00";
  seekRange.value = 0;

  // show the original song + verse list right away - the verse list and
  // mark count only need localStorage, so they should never sit blank
  // waiting on IndexedDB (which can occasionally be slow, or even stuck
  // for a while if this app is open in another tab too). A saved "이 장
  // 곡 바꾸기" override and alt-clip 🎵 badges are layered on right after,
  // without blocking any of this.
  if(chapterAudioObjectUrl){ URL.revokeObjectURL(chapterAudioObjectUrl); chapterAudioObjectUrl = null; }
  mainAudio.src = "audio/"+ch+".mp3";
  mainAudio.onerror = ()=>{ missingMsg.hidden = false; playPauseBtn.disabled = true; };
  applyPlaybackRate();
  chapterAudioStatus.hidden = true;
  chapterAudioRevertBtn.hidden = true;
  chapterAltClips = [];
  renderVerseList();
  updateMarkCount();
  if(autoplay){ mainAudio.play().catch(()=>{}); }

  const [override, altClips] = await Promise.all([
    getChapterAudioOverride(ch).catch(()=>null),
    getAltClipsForChapter(ch).catch(()=>[])
  ]);
  if(ch !== currentChapter) return; // user already moved to a different chapter

  if(override && override.blob){
    // getChapterAudioOverride() is async and can resolve late (slow
    // IndexedDB, or this app open in another tab too) - by then the
    // person may already be tens of seconds into listening to the
    // original file. Swapping mainAudio.src here necessarily restarts
    // playback from 0, so without this, the song could suddenly and
    // silently jump back to the beginning mid-listen. Capture where
    // playback actually is right now and resume there once the
    // (different) override file has loaded, instead of just letting it
    // snap back to 0.
    const resumeAt = mainAudio.currentTime || 0;
    const wasPlaying = !mainAudio.paused;
    chapterAudioObjectUrl = URL.createObjectURL(override.blob);
    mainAudio.src = chapterAudioObjectUrl;
    chapterAudioStatus.hidden = false;
    chapterAudioStatus.textContent = "🎵 내가 올린 곡 사용 중" + (override.name ? " ("+override.name+")" : "") + " (이 브라우저에만 저장됨)";
    chapterAudioRevertBtn.hidden = false;
    applyPlaybackRate();
    const resumePlayback = ()=>{
      if(resumeAt > 0.05) mainAudio.currentTime = resumeAt;
      if(wasPlaying || autoplay){ mainAudio.play().catch(()=>{}); }
    };
    if(mainAudio.readyState >= 1){
      resumePlayback();
    } else {
      mainAudio.addEventListener("loadedmetadata", function once(){
        mainAudio.removeEventListener("loadedmetadata", once);
        resumePlayback();
      }, {once:true});
    }
  }
  chapterAltClips = altClips;
  clearObjectUrls();
  renderVerseList();
}

qs("#prevBtn").addEventListener("click", ()=>{
  const idx = CHAPTERS.indexOf(currentChapter);
  if(idx>0) setChapter(CHAPTERS[idx-1]);
});
qs("#nextBtn").addEventListener("click", ()=>{
  const idx = CHAPTERS.indexOf(currentChapter);
  if(idx<CHAPTERS.length-1) setChapter(CHAPTERS[idx+1]);
});

/* ---------------- 전체 듣기: 챕터가 끝나면 자동으로 다음 장으로 넘어가며 계속 재생 ---------------- */
let playAllMode = false;
const playAllBtn = qs("#playAllBtn");
playAllBtn.addEventListener("click", ()=>{
  playAllMode = !playAllMode;
  playAllBtn.classList.toggle("on", playAllMode);
  playAllBtn.textContent = playAllMode ? "■ 중지" : "전체 듣기";
  playAllHint.hidden = true;
  if(playAllMode && chapterLoopMode){
    // 이 장만 듣기와는 같이 켤 수 없음 - 꺼줌
    chapterLoopMode = false;
    chapterLoopBtn.classList.remove("on");
    chapterLoopBtn.textContent = "이 장만 듣기";
    mainAudio.loop = false;
  }
  if(playAllMode){
    mainAudio.play().catch(()=>{});
  }
});
mainAudio.addEventListener("ended", ()=>{
  if(!playAllMode) return;
  const idx = CHAPTERS.indexOf(currentChapter);
  if(idx < CHAPTERS.length-1){
    setChapter(CHAPTERS[idx+1], {autoplay:true});
  } else {
    playAllMode = false;
    playAllBtn.classList.remove("on");
    playAllBtn.textContent = "전체 듣기";
    playAllHint.hidden = false;
    playAllHint.textContent = "22장까지 다 들었어요.";
  }
});

/* ---------------- 장만 반복: 지금 장의 노래만 계속 반복 재생 ---------------- */
let chapterLoopMode = false;
const chapterLoopBtn = qs("#chapterLoopBtn");
chapterLoopBtn.addEventListener("click", ()=>{
  chapterLoopMode = !chapterLoopMode;
  chapterLoopBtn.classList.toggle("on", chapterLoopMode);
  chapterLoopBtn.textContent = chapterLoopMode ? "■ 중지" : "이 장만 듣기";
  mainAudio.loop = chapterLoopMode;
  if(chapterLoopMode && playAllMode){
    // 전체 듣기와는 같이 켤 수 없음 - 전체 듣기를 꺼줌
    playAllMode = false;
    playAllBtn.classList.remove("on");
    playAllBtn.textContent = "전체 듣기";
  }
  if(chapterLoopMode){
    mainAudio.play().catch(()=>{});
  }
});

function updateMarkCount(){
  const ts = loadChapterTs(currentChapter);
  const n = verseCount(currentChapter);
  let full=0, startOnly=0;
  ts.forEach(e=>{
    if(e && e.start!=null){ if(e.end!=null) full++; else startOnly++; }
  });
  let txt = full+" / "+n+"절 표시됨";
  if(startOnly>0) txt += " (시작만 된 절 "+startOnly+"개)";
  markCountEl.textContent = txt;
}

/* ---------------- verse list rendering ---------------- */
let openAltPanelVerse = null; // which verse's alt panel is expanded

function fmtRange(entry){
  if(!entry || entry.start==null) return "";
  return fmtTime(entry.start) + " ~ " + (entry.end!=null ? fmtTime(entry.end) : "--:--");
}
/* what tapping the per-row mark button will do next for this verse:
   no start yet -> set start; start but no end -> set end; both already
   set -> start over (re-mark start, clear end) */
function nextMarkAction(entry){
  if(!entry || entry.start==null) return "start";
  if(entry.end==null) return "end";
  return "restart";
}

function renderVerseList(){
  verseListEl.innerHTML = "";
  const ts = loadChapterTs(currentChapter);
  const n = verseCount(currentChapter);
  for(let i=0;i<n;i++){
    verseListEl.appendChild(buildVerseRow(i, ts[i]));
  }
}

function buildVerseRow(i, entry){
  const verseNum = i+1;
  const hasStart = entry && entry.start!=null;
  const hasEnd = entry && entry.end!=null;
  const row = el("div",{class:"verse-row"+(hasStart?" marked":"")+(hasEnd?" complete":""), "data-verse":verseNum});

  const main = el("div",{class:"vr-main"});
  main.appendChild(el("div",{class:"vnum"}, String(verseNum)));

  const textCol = el("div",{style:"flex:1;"});
  const textWrap = (Number(currentChapter)===TITLE_TRACK_CH && TITLE_TRACK_LABELS[i])
    ? el("div",{class:"vtext"}, [el("b",{class:"title-track-label"}, TITLE_TRACK_LABELS[i]+" "), verseText(currentChapter,i)])
    : el("div",{class:"vtext"}, verseText(currentChapter,i));
  textCol.appendChild(textWrap);
  textCol.appendChild(el("div",{class:"vtime"}, fmtRange(entry)));
  main.appendChild(textCol);

  const ctrl = el("div",{class:"vctrl"});
  const action = nextMarkAction(entry);
  const markBtn = el("button",{
    class: action==="end" ? "armed" : "",
    title: action==="start" ? "이 절 시작 지점 표시 (재생 중인 지점으로)"
         : action==="end" ? "이 절 끝 지점 표시 (재생 중인 지점으로)"
         : "다시 표시 (시작 지점부터 새로 잡아요 - 끝 지점도 이어서 다시 눌러주세요)"
  }, "⏱");
  markBtn.addEventListener("click", ()=>{
    const arr = loadChapterTs(currentChapter);
    while(arr.length<verseCount(currentChapter)) arr.push(null);
    const cur = arr[i] || {start:null, end:null};
    const act = nextMarkAction(cur);
    if(act==="start" || act==="restart"){ cur.start = mainAudio.currentTime||0; cur.end = null; }
    else { cur.end = mainAudio.currentTime||0; }
    arr[i] = cur;
    saveChapterTs(currentChapter, arr);
    renderVerseList();
    updateMarkCount();
    resyncGuidedIfOpen();
  });

  const inLoop = loopActive && loopQueue.includes(i);
  const playBtn = el("button",{
    title: inLoop ? "반복 재생 중 - 다시 누르면 반복에서 빼요" : "이 절부터 재생 (다시 누르면 이 절만 반복 재생돼요)",
    disabled: !hasStart,
    class: inLoop ? "on" : ""
  }, inLoop ? "🔁" : "▶");
  playBtn.addEventListener("click", ()=>handleVersePlayTap(i));

  const altClips = chapterAltClips.filter(c=>c.verse===verseNum);
  const altBtn = el("button",{title:"이 절 대체곡 관리", class: altClips.length? "on":""}, "🎵");
  if(altClips.length) altBtn.appendChild(el("span",{class:"badge"}, String(altClips.length)));
  altBtn.addEventListener("click", ()=>{
    openAltPanelVerse = (openAltPanelVerse===verseNum) ? null : verseNum;
    renderVerseList();
  });

  // 순서: 재생, 시간지정, 다른 노래 교체 - 세로로 배치 (CSS)
  ctrl.appendChild(playBtn);
  ctrl.appendChild(markBtn);
  ctrl.appendChild(altBtn);

  main.appendChild(ctrl);
  row.appendChild(main);

  if(openAltPanelVerse===verseNum){
    row.appendChild(buildAltPanel(verseNum, altClips));
  }

  return row;
}

function buildAltPanel(verseNum, clips){
  const panel = el("div",{class:"alt-panel"});
  if(clips.length===0){
    panel.appendChild(el("div",{class:"empty-alt"}, "아직 대체곡이 없어요. 이 절이 잘 안 외워질 때 다른 버전 노래를 추가해보세요."));
  }
  clips.forEach(c=>{
    const url = URL.createObjectURL(c.blob);
    objectUrls.push(url);
    const r = el("div",{class:"alt-clip-row"});
    r.appendChild(el("span",{class:"label"}, c.label || "대체곡"));
    const a = el("audio",{controls:true});
    a.src = url;
    r.appendChild(a);
    const del = el("button",{class:"del", title:"삭제"}, "✕");
    del.addEventListener("click", async ()=>{
      if(!confirm("이 대체곡을 삭제할까요?")) return;
      try{
        await deleteAltClip(c.id);
        chapterAltClips = await getAltClipsForChapter(currentChapter);
        renderVerseList();
      }catch(err){ alert(err.message || "삭제하지 못했어요."); }
    });
    r.appendChild(del);
    panel.appendChild(r);
  });

  const addRow = el("div",{class:"alt-add-row"});
  const labelInput = el("input",{type:"text", placeholder:"버전 이름(선택, 예: 잔잔 버전)"});
  const fileInput = el("input",{type:"file", accept:"audio/*", hidden:true});
  const addLabel = el("label",{class:"btn ghost small", style:"cursor:pointer;white-space:nowrap;"}, ["파일 추가", fileInput]);
  fileInput.addEventListener("change", async (e)=>{
    const f = e.target.files[0];
    if(!f) return;
    try{
      await addAltClip(currentChapter, verseNum, labelInput.value.trim() || f.name, f);
      chapterAltClips = await getAltClipsForChapter(currentChapter);
      renderVerseList();
    }catch(err){ alert(err.message || "추가하지 못했어요."); }
  });
  addRow.appendChild(labelInput);
  addRow.appendChild(addLabel);
  panel.appendChild(addRow);

  return panel;
}

/* ---------------- playback: jump to verse, karaoke highlight ---------------- */
function nextStartAfter(ts, i){
  for(let j=i+1;j<ts.length;j++){ if(ts[j] && ts[j].start!=null) return ts[j].start; }
  return null;
}

let jumpHandler = null;

/* ---- repeat playback: one verse on loop, or several verses in sequence
   on loop ("tap ▶ on a verse again to loop it; tap ▶ on another verse
   while looping to add it to the loop, in verse order") ---- */
let loopActive = false;      // false = the ▶ button just plays through once and stops
let loopQueue = [];          // verse indices (0-based) in the repeat sequence, in order
let loopPos = 0;             // index within loopQueue currently playing
let lastPlayedVerseIndex = null; // last verse a ▶ button was pressed for - lets a second press on the same verse mean "loop this"

/* playGen: bumped every time playQueueFrom starts a NEW authoritative jump
   (a fresh tap, or the loop itself advancing to the next verse). Every
   jumpHandler closure captures the generation it was created for and
   checks it on every timeupdate - if a newer jump has since started, the
   old handler quietly removes itself instead of acting. This makes stale
   handlers harmless no matter how/when they'd otherwise fire, instead of
   depending on catching one particular DOM event at one particular time. */
let playGen = 0;

const loopStatusEl = qs("#loopStatus");
const loopStatusText = qs("#loopStatusText");
const loopStopBtn = qs("#loopStopBtn");

function renderLoopStatus(){
  if(loopActive && loopQueue.length>0){
    loopStatusEl.hidden = false;
    const label = loopQueue.map(i=>(i+1)+"절").join(", ");
    loopStatusText.textContent = "🔁 "+label+" 반복 재생 중 (다른 절의 ▶를 누르면 반복에 추가/제외돼요)";
  } else {
    loopStatusEl.hidden = true;
  }
}
function stopLoop(){
  loopActive = false;
  loopQueue = [];
  loopPos = 0;
  playGen++; // invalidate any in-flight jumpHandler/pending seek immediately
  if(jumpHandler){ mainAudio.removeEventListener("timeupdate", jumpHandler); jumpHandler=null; }
  renderLoopStatus();
}
loopStopBtn.addEventListener("click", ()=>{
  stopLoop();
  mainAudio.pause();
  renderVerseList();
});

/* plays loopQueue[pos] once; when it reaches its own marked end (or the
   next verse's start, if no end was marked), either advances to the next
   verse in the queue and loops back to the start of the queue (loopActive)
   or just pauses there (one-shot ▶ play, loopActive false) */
function playQueueFrom(pos){
  loopPos = pos;
  const i = loopQueue[pos];
  const ts = loadChapterTs(currentChapter);
  const entry = ts[i];
  if(!entry || entry.start==null) return;

  const myGen = ++playGen; // this call supersedes any previous jump/handler
  if(jumpHandler){ mainAudio.removeEventListener("timeupdate", jumpHandler); jumpHandler=null; }

  // prefer this verse's own marked end; fall back to the next verse's start
  const stopAt = entry.end!=null ? entry.end : nextStartAfter(ts, i);
  if(stopAt!=null){
    let lastSeen = null; // currentTime as of the last timeupdate THIS handler processed
    jumpHandler = function(){
      if(myGen !== playGen){ // a newer jump has started since - this handler is stale, drop it
        mainAudio.removeEventListener("timeupdate", jumpHandler);
        return;
      }
      const now = mainAudio.currentTime;
      // Natural playback only advances currentTime a small amount between
      // consecutive timeupdate ticks. A bigger jump than that - forward OR
      // backward - means someone just moved the playhead on purpose
      // (dragging the scrubber, tapping ◀5초/5초▶, anything else): back
      // off and let it happen instead of yanking it back to stopAt.
      // (An earlier version tried to catch this via the "seeking" event
      // instead, flagging our own programmatic seeks so they'd be ignored
      // - but "seeking" fires as a queued task, and a timeupdate that was
      // already queued from ongoing playback can slip in and fire with
      // the ALREADY-moved currentTime before our own "seeking" cancel
      // logic gets a turn, silently eating the person's own 5초/scrubber
      // seek. Comparing consecutive currentTime readings directly doesn't
      // depend on which event fires first, so that race can't happen.)
      if(lastSeen!=null && (now < lastSeen - 0.05 || now - lastSeen > 2)){
        mainAudio.removeEventListener("timeupdate", jumpHandler);
        jumpHandler = null;
        return;
      }
      lastSeen = now;
      if(now >= stopAt - 0.05){
        if(loopActive && loopQueue.length>0){
          playQueueFrom((loopPos+1) % loopQueue.length);
        } else {
          mainAudio.pause();
          mainAudio.removeEventListener("timeupdate", jumpHandler);
          jumpHandler = null;
        }
      }
    };
    mainAudio.addEventListener("timeupdate", jumpHandler);
  }

  // Setting currentTime the instant a new src is assigned (readyState still
  // HAVE_NOTHING) gets silently dropped by the browser as part of loading
  // the resource - it snaps back to 0 a moment later even though the seek
  // "succeeded" at the time. Waiting for loadedmetadata avoids that; most
  // of the time it's already loaded and this resolves immediately.
  const doSeekAndPlay = () => {
    if(myGen !== playGen) return; // superseded while we were waiting
    mainAudio.currentTime = entry.start;
    mainAudio.play().catch(()=>{});
  };
  if(mainAudio.readyState >= 1){
    doSeekAndPlay();
  } else {
    mainAudio.addEventListener("loadedmetadata", function once(){
      mainAudio.removeEventListener("loadedmetadata", once);
      doSeekAndPlay();
    }, {once:true});
  }
}

/* one-shot play (existing ▶ behaviour: play this verse once, stop at its end) */
function playFromVerse(i){
  loopActive = false;
  loopQueue = [i];
  loopPos = 0;
  lastPlayedVerseIndex = i;
  playQueueFrom(0);
  renderLoopStatus();
}

/* what a tap on verse i's ▶ button actually does depends on what's already
   happening:
   - a loop is already running -> add/remove this verse from that loop
   - this is the SECOND tap in a row on the same verse -> start looping
     just this one verse
   - otherwise -> normal one-shot play */
function handleVersePlayTap(i){
  if(loopActive){
    const qIdx = loopQueue.indexOf(i);
    if(qIdx !== -1){
      loopQueue.splice(qIdx, 1);
      if(loopQueue.length === 0){
        stopLoop();
        mainAudio.pause();
      } else {
        if(loopPos >= loopQueue.length) loopPos = 0;
        playQueueFrom(loopPos);
      }
    } else {
      loopQueue.push(i);
      loopQueue.sort((a,b)=>a-b);
    }
    renderVerseList();
    renderLoopStatus();
    return;
  }
  if(lastPlayedVerseIndex === i){
    loopActive = true;
    loopQueue = [i];
    playQueueFrom(0);
    renderVerseList();
    renderLoopStatus();
    return;
  }
  playFromVerse(i);
  renderVerseList();
}

/* current verse = the one whose [start, end-or-next-start) range contains
   the playhead. During an interlude/repeat that isn't part of any marked
   verse, nothing is highlighted - that's the point of having end points. */
function computeCurrentVerse(ts, t){
  let cur = null;
  for(let i=0;i<ts.length;i++){
    const e = ts[i];
    if(!e || e.start==null) continue;
    if(e.start <= t + 0.02){
      const endBound = e.end!=null ? e.end : nextStartAfter(ts, i);
      const withinRange = endBound==null ? true : (t < endBound - 0.02);
      cur = withinRange ? i : null;
    }
  }
  return cur;
}

let lastCurrentVerse = null;
mainAudio.addEventListener("timeupdate", ()=>{
  const ts = loadChapterTs(currentChapter);
  const cur = computeCurrentVerse(ts, mainAudio.currentTime);
  if(cur===lastCurrentVerse) return;
  lastCurrentVerse = cur;
  qsa(".verse-row").forEach(r=>r.classList.remove("current"));
  if(cur!=null){
    const row = qs('.verse-row[data-verse="'+(cur+1)+'"]');
    if(row){
      row.classList.add("current");
      row.scrollIntoView({behavior:"smooth", block:"center"});
    }
  }
});

/* ---------------- clear / export / import ---------------- */
qs("#clearMarksBtn").addEventListener("click", ()=>{
  if(!confirm(currentChapter+"장의 절 구간 표시를 모두 지울까요?")) return;
  saveChapterTs(currentChapter, []);
  renderVerseList();
  updateMarkCount();
  resyncGuidedIfOpen();
});
qs("#exportBtn").addEventListener("click", ()=>{
  const blob = new Blob([JSON.stringify(loadAllTs(), null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = el("a",{href:url, download:"revsongs_timestamps_backup.json"});
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});
qs("#importInput").addEventListener("change", (e)=>{
  const f = e.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const data = JSON.parse(reader.result);
      saveAllTs(data);
      alert("불러왔어요.");
      renderVerseList();
      updateMarkCount();
      resyncGuidedIfOpen();
    }catch(err){ alert("파일을 읽지 못했어요: "+err.message); }
  };
  reader.readAsText(f);
  e.target.value = "";
});

/* ---------------- 절 구간 표시하기 (안내형 순서대로 표시) ----------------
   자동 추정은 정확도가 너무 낮아서 없앴어요. 대신 이 버튼을 누르면 노래를
   들으면서 절 순서대로 시작 지점 -> 끝 지점을 하나씩 탭해서 표시할 수 있게
   안내해줘요 (간주가 길거나 반복되는 절이 있어도 끝 지점을 따로 표시해두면
   재생/카라오케 강조가 그 구간에서 정확히 멈춰요).
   (개별 절의 ⏱ 버튼으로 아무 절이나 따로 다시 표시하는 것도 여전히 가능해요.) */
let guidedMode = false;
let guidedPos = 0;
let guidedStage = "start"; // "start" | "end"
const guidedBtn = qs("#guidedBtn");
const guidedPanel = qs("#guidedPanel");
const guidedStatus = qs("#guidedStatus");
const guidedMarkBtn = qs("#guidedMarkBtn");
const guidedUndoBtn = qs("#guidedUndoBtn");

/* where to resume: first verse missing a start, or (if start is set but
   end isn't) that same verse's end */
function findGuidedResume(ts, n){
  for(let i=0;i<n;i++){
    const e = ts[i];
    if(!e || e.start==null) return {pos:i, stage:"start"};
    if(e.end==null) return {pos:i, stage:"end"};
  }
  return {pos:n, stage:"start"};
}

function renderGuidedPanel(){
  const n = verseCount(currentChapter);
  if(guidedPos>=n){
    guidedStatus.textContent = "이 장 "+n+"절이 모두 표시됐어요 (시작+끝) ✓";
    guidedMarkBtn.textContent = "표시할 절 없음";
    guidedMarkBtn.disabled = true;
  } else if(guidedStage==="start"){
    guidedStatus.textContent = "표시할 절: "+(guidedPos+1)+"절 시작 ("+(guidedPos+1)+"/"+n+")";
    guidedMarkBtn.textContent = (guidedPos+1)+"절 시작 지점 표시";
    guidedMarkBtn.disabled = false;
  } else {
    guidedStatus.textContent = "표시할 절: "+(guidedPos+1)+"절 끝 ("+(guidedPos+1)+"/"+n+") — 방금 잡은 시작 지점이 잘못됐으면 ↩ 되돌리기를 눌러 다시 잡을 수 있어요";
    guidedMarkBtn.textContent = (guidedPos+1)+"절 끝 지점 표시";
    guidedMarkBtn.disabled = false;
  }
  guidedUndoBtn.style.display = (guidedPos>0 || guidedStage==="end") ? "inline-block" : "none";
}

/* the guided position only tracks reality at the moment it's computed - if
   verses get marked/cleared through some OTHER path (the per-row ⏱ button,
   표시 초기화, 가져오기) while the guided panel is still open, guidedPos/
   guidedStage would otherwise go stale and point at a verse that's already
   done (or already gone). Call this after any such change so the panel
   (and, critically, 되돌리기) always matches the real saved data. */
function resyncGuidedIfOpen(){
  if(!guidedMode) return;
  const ts = loadChapterTs(currentChapter);
  const r = findGuidedResume(ts, verseCount(currentChapter));
  guidedPos = r.pos; guidedStage = r.stage;
  renderGuidedPanel();
}

guidedBtn.addEventListener("click", ()=>{
  guidedMode = !guidedMode;
  guidedBtn.classList.toggle("on", guidedMode);
  guidedPanel.hidden = !guidedMode;
  if(guidedMode){
    const ts = loadChapterTs(currentChapter);
    const r = findGuidedResume(ts, verseCount(currentChapter));
    guidedPos = r.pos; guidedStage = r.stage;
    renderGuidedPanel();
  }
});

/* guided-panel floats sticky right under the player card (see CSS) - its
   "top" has to match the player card's actual rendered height, which
   isn't constant (loop status/hints can appear, chapter titles can wrap
   to two lines, etc). ResizeObserver keeps it in sync automatically
   instead of hardcoding a height that would drift out of date. */
const playerCardEl = qs("#playerCard");
function syncGuidedPanelStickyTop(){
  guidedPanel.style.top = (playerCardEl.offsetHeight + 70) + "px";
}
if(window.ResizeObserver){
  new ResizeObserver(syncGuidedPanelStickyTop).observe(playerCardEl);
} else {
  window.addEventListener("resize", syncGuidedPanelStickyTop);
}
syncGuidedPanelStickyTop();

guidedMarkBtn.addEventListener("click", ()=>{
  const n = verseCount(currentChapter);
  if(guidedPos>=n) return;
  const arr = loadChapterTs(currentChapter);
  while(arr.length<n) arr.push(null);
  const cur = arr[guidedPos] || {start:null, end:null};
  if(guidedStage==="start"){
    cur.start = mainAudio.currentTime||0;
    cur.end = null;
    arr[guidedPos] = cur;
    guidedStage = "end";
  } else {
    cur.end = mainAudio.currentTime||0;
    arr[guidedPos] = cur;
    guidedPos++;
    guidedStage = "start";
  }
  saveChapterTs(currentChapter, arr);
  renderVerseList();
  updateMarkCount();
  renderGuidedPanel();
});

guidedUndoBtn.addEventListener("click", ()=>{
  const arr = loadChapterTs(currentChapter);
  if(guidedStage==="end"){
    // currently waiting for this verse's end -> undo clears its start, back to "start" stage
    const cur = arr[guidedPos] || {start:null, end:null};
    cur.start = null; cur.end = null;
    arr[guidedPos] = cur;
    guidedStage = "start";
  } else {
    if(guidedPos<=0) return;
    guidedPos--;
    const cur = arr[guidedPos] || {start:null, end:null};
    cur.end = null;
    arr[guidedPos] = cur;
    guidedStage = "end";
  }
  saveChapterTs(currentChapter, arr);
  renderVerseList();
  updateMarkCount();
  renderGuidedPanel();
});

/* ---------------- init ---------------- */
setChapter(1);

})();
