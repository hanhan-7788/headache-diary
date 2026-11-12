import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBclPKAEdvIhfREWzwXHxV5HhkfELwc5k0",
  authDomain: "test1006-1009.firebaseapp.com",
  projectId: "test1006-1009",
  storageBucket: "test1006-1009.firebasestorage.app",
  messagingSenderId: "1013562746709",
  appId: "1:1013562746709:web:d136bd927e3b8aef1ff1dc"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let currentUser = null;
let globalRecords = [];
let globalPeriods = []; 
let globalPeriodDetails = {}; 
window.isPeriodGridEditMode = false;

const LATEST_DEFAULT_PREFS = {
    contexts: ['剛睡醒', '工作/專注中', '家中', '辦公室/學校', '戶外'],
    triggers: ['頭吹到風', '氣溫降低', '睡眠不足', '螢幕看太久', '壓力', '生理期'],
    painTypes: ['間歇性疼痛', '搏動性疼痛', '持續性疼痛'],
    symptoms: ['噁心', '發熱', '畏光', '怕吵'],
    meds: ['普拿疼', '布洛芬', 'EVE'] 
};
let globalPrefs = JSON.parse(JSON.stringify(LATEST_DEFAULT_PREFS));

const DEFAULT_PERIOD_PREFS = {
    flows: ['點狀', '少', '中', '多', '大量'],
    colors: ['鮮紅', '暗紅', '咖啡色', '有血塊', '黏稠'],
    cramps: ['無', '輕微隱痛', '中度(需熱敷)', '重度(需吃藥)'],
    symps: ['腰痠背痛', '乳房脹痛', '腹瀉/軟便', '便秘/脹氣', '水腫', '極度疲倦', '長痘痘', '易怒煩躁', '情緒低落', '想吃甜食']
};
let globalPeriodPrefs = JSON.parse(JSON.stringify(DEFAULT_PERIOD_PREFS));

const DEFAULT_SLEEP_PREFS = {
    tags: ['睡前吃甘胺酸鎂', '入睡困難', '半夜醒來多次', '多夢/惡夢', '早醒睡不著', '睡醒肩頸僵硬']
};
let globalSleepPrefs = JSON.parse(JSON.stringify(DEFAULT_SLEEP_PREFS));

const DEFAULT_ABNORMAL_PREFS = {
    cats: ['腸胃消化', '皮膚與過敏', '呼吸道/發燒', '肌肉骨骼/外傷', '其他不適'],
    symps: ['胃脹氣/打嗝', '胃酸逆流', '腹瀉/軟便', '便秘', '手部乾燥脫皮', '皮膚紅癢/濕疹', '鼻過敏/鼻塞', '肩頸腰背痠痛'],
    treats: ['吃消脹氣/酵素', '擦護手霜/Yuskin', '擦外用藥膏', '吃抗組織胺/常備藥', '熱敷/休息']
};
let globalAbnormalPrefs = JSON.parse(JSON.stringify(DEFAULT_ABNORMAL_PREFS));

let globalModules = {
    sleep: [],
    abnormal: [],
    hydration: [],
    coffee: []
};

var currentModule = 'headache';
var currentCalDate = new Date();
var chartCalDate = new Date();
var chartTrendYear = new Date().getFullYear();
window.periodCalDate = new Date();
window.sleepCalDate = new Date();
window.abnormalCalDate = new Date();

window.selectedCalDateStr = '';
window.selectedPeriodDateStr = '';
window.selectedSleepDateStr = '';
window.selectedAbnormalDateStr = '';

window.currentHistoryPainFilter = 'all';
window.currentSleepFilter = 'all';
window.currentAbnormalFilter = 'all';
window.lastEditedId = null;
var chartInstances = {};

function getLocalIsoStr(dateObj) {
    var tzOffset = (new Date()).getTimezoneOffset() * 60000;
    return (new Date(dateObj - tzOffset)).toISOString().slice(0, 16);
}
function fmtDateStr(y, m, d) {
    return y + '-' + String(m+1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}
function getTodayStr() {
    var t = new Date();
    return fmtDateStr(t.getFullYear(), t.getMonth(), t.getDate());
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        loadDataFromCloud();
    } else {
        currentUser = null;
        document.getElementById('login-overlay').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
    }
});

document.getElementById('btn-login').addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(error => {
        if(error.code !== 'auth/popup-closed-by-user') window.showToast("登入失敗: " + error.message);
    });
});
document.getElementById('btn-logout').addEventListener('click', () => { signOut(auth); });

function loadDataFromCloud() {
    get(child(ref(db), `users/${currentUser.uid}`)).then((snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            globalRecords = data.records || [];
            if(data.prefs) {
                globalPrefs = data.prefs;
                if(!globalPrefs.contexts) globalPrefs.contexts = [...LATEST_DEFAULT_PREFS.contexts];
                if(!globalPrefs.painTypes) globalPrefs.painTypes = [...LATEST_DEFAULT_PREFS.painTypes];
                if(!globalPrefs.symptoms) globalPrefs.symptoms = [...LATEST_DEFAULT_PREFS.symptoms];
                if(!globalPrefs.triggers) globalPrefs.triggers = [...LATEST_DEFAULT_PREFS.triggers];
                if(!globalPrefs.meds) globalPrefs.meds = [...LATEST_DEFAULT_PREFS.meds];
            }
            if(data.periodPrefs) {
                globalPeriodPrefs = data.periodPrefs;
                if(!globalPeriodPrefs.flows) globalPeriodPrefs.flows = [...DEFAULT_PERIOD_PREFS.flows];
                if(!globalPeriodPrefs.colors) globalPeriodPrefs.colors = [...DEFAULT_PERIOD_PREFS.colors];
                if(!globalPeriodPrefs.cramps) globalPeriodPrefs.cramps = [...DEFAULT_PERIOD_PREFS.cramps];
                if(!globalPeriodPrefs.symps) globalPeriodPrefs.symps = [...DEFAULT_PERIOD_PREFS.symps];
            }
            if(data.sleepPrefs && data.sleepPrefs.tags) {
                globalSleepPrefs = data.sleepPrefs;
            }
            if(data.abnormalPrefs) {
                globalAbnormalPrefs = data.abnormalPrefs;
                if(!globalAbnormalPrefs.cats) globalAbnormalPrefs.cats = [...DEFAULT_ABNORMAL_PREFS.cats];
                if(!globalAbnormalPrefs.symps) globalAbnormalPrefs.symps = [...DEFAULT_ABNORMAL_PREFS.symps];
                if(!globalAbnormalPrefs.treats) globalAbnormalPrefs.treats = [...DEFAULT_ABNORMAL_PREFS.treats];
            }
            globalPeriods = data.periods || [];
            globalPeriodDetails = data.periodDetails || {};
            if(data.modules) {
                globalModules = { ...globalModules, ...data.modules };
                if(!globalModules.sleep) globalModules.sleep = [];
                if(!globalModules.abnormal) globalModules.abnormal = [];
            }
        }
        
        var locHtml = document.querySelector('#loc-container').innerHTML;
        document.getElementById('change-matrix-container').innerHTML = locHtml;
        document.getElementById('change-matrix-container').querySelectorAll('.loc-check').forEach(el => el.className = 'modal-loc-check');
        
        window.initDefaultDates();
        window.renderDynamicButtons();
        window.renderHeadachePrefsManager();
        window.renderPeriodDynamicButtons();
        window.renderPeriodPrefsManager();
        window.renderSleepDynamicButtons();
        window.renderSleepPrefsManager();
        window.renderAbnormalDynamicButtons();
        window.renderAbnormalPrefsManager();
        window.renderCalendar();
        window.renderPeriodCalendar();
        window.updateDashboard();
    });
}

function syncToCloud() {
    if(!currentUser) return;
    set(ref(db, `users/${currentUser.uid}`), {
        records: globalRecords,
        prefs: globalPrefs,
        periodPrefs: globalPeriodPrefs,
        sleepPrefs: globalSleepPrefs,
        abnormalPrefs: globalAbnormalPrefs,
        periods: globalPeriods,
        periodDetails: globalPeriodDetails,
        modules: globalModules
    });
}

const PREF_RECORD_FIELD_MAP = {
    triggers: 'triggers',
    painTypes: 'painTypes',
    symptoms: 'symptoms',
    contexts: 'contexts',
    meds: 'meds'
};

window.appLogic = {
    getRecords: () => globalRecords,
    getPrefs: () => globalPrefs,
    getPeriodPrefs: () => globalPeriodPrefs,
    getSleepPrefs: () => globalSleepPrefs,
    getAbnormalPrefs: () => globalAbnormalPrefs,
    getPeriods: () => globalPeriods,
    getPeriodDetails: () => globalPeriodDetails,
    getModules: () => globalModules,

    // 頭痛標籤管理
    addPrefItem: (categoryKey) => {
        var inputEl = document.getElementById('new-pref-' + categoryKey);
        if(!inputEl) return;
        var val = inputEl.value.trim();
        if(!val) return window.showToast("請輸入選項名稱！");
        if(!globalPrefs[categoryKey]) globalPrefs[categoryKey] = [];
        if(globalPrefs[categoryKey].includes(val)) return window.showToast("此選項已存在！");
        globalPrefs[categoryKey].push(val);
        inputEl.value = '';
        syncToCloud();
        window.renderDynamicButtons();
        window.renderHeadachePrefsManager();
        window.showToast("已新增選項：" + val);
    },
    editPrefItem: (categoryKey, index) => {
        var oldVal = globalPrefs[categoryKey][index];
        var newVal = prompt(`修改「${oldVal}」的名稱：\n(歷史紀錄中的同名標籤也會一併更新)`, oldVal);
        if(newVal === null) return;
        newVal = newVal.trim();
        if(!newVal || newVal === oldVal) return;
        if(globalPrefs[categoryKey].includes(newVal)) return window.showToast("此名稱已存在！");

        globalPrefs[categoryKey][index] = newVal;

        var recField = PREF_RECORD_FIELD_MAP[categoryKey];
        if(recField) {
            globalRecords.forEach(r => {
                if(r[recField]) {
                    r[recField] = r[recField].split('、').map(item => item === oldVal ? newVal : item).join('、');
                }
                if(r.changes) {
                    r.changes.forEach(c => {
                        if(c[recField]) {
                            c[recField] = c[recField].split('、').map(item => item === oldVal ? newVal : item).join('、');
                        }
                    });
                }
            });
        }

        syncToCloud();
        window.renderDynamicButtons();
        window.renderHeadachePrefsManager();
        window.showToast(`已將「${oldVal}」修改為「${newVal}」`);
    },
    deletePrefItem: (categoryKey, index) => {
        var targetVal = globalPrefs[categoryKey][index];
        if(!confirm(`確定要刪除「${targetVal}」選項嗎？\n(僅移除按鈕選項，不會影響已存檔的歷史紀錄)`)) return;
        globalPrefs[categoryKey].splice(index, 1);
        syncToCloud();
        window.renderDynamicButtons();
        window.renderHeadachePrefsManager();
        window.showToast("已刪除選項：" + targetVal);
    },

    // 生理期設定管理
    addPeriodPrefItem: (catKey) => {
        var inputEl = document.getElementById('new-ppref-' + catKey);
        if(!inputEl) return;
        var val = inputEl.value.trim();
        if(!val) return window.showToast("請輸入選項名稱！");
        if(!globalPeriodPrefs[catKey]) globalPeriodPrefs[catKey] = [];
        if(globalPeriodPrefs[catKey].includes(val)) return window.showToast("此選項已存在！");
        globalPeriodPrefs[catKey].push(val);
        inputEl.value = '';
        syncToCloud();
        window.renderPeriodDynamicButtons();
        window.renderPeriodPrefsManager();
        window.loadPeriodDayForm(window.selectedPeriodDateStr);
        window.showToast("已新增生理期選項：" + val);
    },
    editPeriodPrefItem: (catKey, index) => {
        var oldVal = globalPeriodPrefs[catKey][index];
        var newVal = prompt(`修改「${oldVal}」的名稱：\n(已存檔的生理期紀錄也會一併更新)`, oldVal);
        if(newVal === null) return;
        newVal = newVal.trim();
        if(!newVal || newVal === oldVal) return;
        if(globalPeriodPrefs[catKey].includes(newVal)) return window.showToast("此名稱已存在！");

        globalPeriodPrefs[catKey][index] = newVal;

        Object.keys(globalPeriodDetails).forEach(dStr => {
            var d = globalPeriodDetails[dStr];
            if(catKey === 'flows' && d.flow === oldVal) d.flow = newVal;
            if(catKey === 'cramps' && d.cramp === oldVal) d.cramp = newVal;
            if(catKey === 'colors' && Array.isArray(d.colors)) {
                d.colors = d.colors.map(x => x === oldVal ? newVal : x);
            }
            if(catKey === 'symps' && Array.isArray(d.symps)) {
                d.symps = d.symps.map(x => x === oldVal ? newVal : x);
            }
        });

        syncToCloud();
        window.renderPeriodDynamicButtons();
        window.renderPeriodPrefsManager();
        window.loadPeriodDayForm(window.selectedPeriodDateStr);
        window.showToast(`已將「${oldVal}」修改為「${newVal}」`);
    },
    deletePeriodPrefItem: (catKey, index) => {
        var targetVal = globalPeriodPrefs[catKey][index];
        if(!confirm(`確定要刪除「${targetVal}」選項嗎？\n(僅移除按鈕選項，不會影響已存檔的歷史紀錄)`)) return;
        globalPeriodPrefs[catKey].splice(index, 1);
        syncToCloud();
        window.renderPeriodDynamicButtons();
        window.renderPeriodPrefsManager();
        window.loadPeriodDayForm(window.selectedPeriodDateStr);
        window.showToast("已刪除選項：" + targetVal);
    },

    // 睡眠標籤設定管理
    addSleepPrefItem: () => {
        var inputEl = document.getElementById('new-spref-tags');
        if(!inputEl) return;
        var val = inputEl.value.trim();
        if(!val) return window.showToast("請輸入選項名稱！");
        if(globalSleepPrefs.tags.includes(val)) return window.showToast("此選項已存在！");
        globalSleepPrefs.tags.push(val);
        inputEl.value = '';
        syncToCloud();
        window.renderSleepDynamicButtons();
        window.renderSleepPrefsManager();
        window.showToast("已新增睡眠標籤：" + val);
    },
    editSleepPrefItem: (index) => {
        var oldVal = globalSleepPrefs.tags[index];
        var newVal = prompt(`修改「${oldVal}」的名稱：\n(已存檔的睡眠紀錄也會一併更新)`, oldVal);
        if(newVal === null) return;
        newVal = newVal.trim();
        if(!newVal || newVal === oldVal) return;
        if(globalSleepPrefs.tags.includes(newVal)) return window.showToast("此名稱已存在！");

        globalSleepPrefs.tags[index] = newVal;
        (globalModules.sleep || []).forEach(s => {
            if(Array.isArray(s.tags)) s.tags = s.tags.map(t => t === oldVal ? newVal : t);
        });
        syncToCloud();
        window.renderSleepDynamicButtons();
        window.renderSleepPrefsManager();
        window.showToast(`已將「${oldVal}」修改為「${newVal}」`);
    },
    deleteSleepPrefItem: (index) => {
        var targetVal = globalSleepPrefs.tags[index];
        if(!confirm(`確定要刪除「${targetVal}」選項嗎？`)) return;
        globalSleepPrefs.tags.splice(index, 1);
        syncToCloud();
        window.renderSleepDynamicButtons();
        window.renderSleepPrefsManager();
        window.showToast("已刪除選項：" + targetVal);
    },

    // 身體異常標籤設定管理
    addAbnormalPrefItem: (catKey) => {
        var inputEl = document.getElementById('new-apref-' + catKey);
        if(!inputEl) return;
        var val = inputEl.value.trim();
        if(!val) return window.showToast("請輸入選項名稱！");
        if(!globalAbnormalPrefs[catKey]) globalAbnormalPrefs[catKey] = [];
        if(globalAbnormalPrefs[catKey].includes(val)) return window.showToast("此選項已存在！");
        globalAbnormalPrefs[catKey].push(val);
        inputEl.value = '';
        syncToCloud();
        window.renderAbnormalDynamicButtons();
        window.renderAbnormalPrefsManager();
        window.showToast("已新增選項：" + val);
    },
    editAbnormalPrefItem: (catKey, index) => {
        var oldVal = globalAbnormalPrefs[catKey][index];
        var newVal = prompt(`修改「${oldVal}」的名稱：\n(已存檔的身體異常紀錄也會一併更新)`, oldVal);
        if(newVal === null) return;
        newVal = newVal.trim();
        if(!newVal || newVal === oldVal) return;
        if(globalAbnormalPrefs[catKey].includes(newVal)) return window.showToast("此名稱已存在！");

        globalAbnormalPrefs[catKey][index] = newVal;
        (globalModules.abnormal || []).forEach(item => {
            if(Array.isArray(item[catKey])) {
                item[catKey] = item[catKey].map(x => x === oldVal ? newVal : x);
            }
        });
        syncToCloud();
        window.renderAbnormalDynamicButtons();
        window.renderAbnormalPrefsManager();
        window.showToast(`已將「${oldVal}」修改為「${newVal}」`);
    },
    deleteAbnormalPrefItem: (catKey, index) => {
        var targetVal = globalAbnormalPrefs[catKey][index];
        if(!confirm(`確定要刪除「${targetVal}」選項嗎？`)) return;
        globalAbnormalPrefs[catKey].splice(index, 1);
        syncToCloud();
        window.renderAbnormalDynamicButtons();
        window.renderAbnormalPrefsManager();
        window.showToast("已刪除選項：" + targetVal);
    },

    togglePeriodGridEditMode: () => {
        window.isPeriodGridEditMode = !window.isPeriodGridEditMode;
        var btn = document.getElementById('period-grid-edit-btn');
        var hint = document.getElementById('period-edit-mode-hint');
        if(window.isPeriodGridEditMode) {
            btn.innerHTML = '✅ 完成圈選並儲存';
            btn.style.background = 'var(--success-color)';
            hint.innerHTML = '<strong style="color:#f48fb1;">⚡ 快速圈選模式中：直接點擊下方月曆格子即可塗紅/取消生理期！</strong>';
        } else {
            btn.innerHTML = '✏️ 點擊月曆快速圈選';
            btn.style.background = 'var(--period-bg-color)';
            hint.innerHTML = '💡 點擊下方已標記的經期日可填寫當日症狀；或按右上角「✏️ 點擊月曆快速圈選」直接塗選/取消經期';
            globalPeriods.sort();
            syncToCloud();
            window.renderCalendar();
            window.showToast("生理期日期已儲存！");
        }
        window.renderPeriodCalendar();
    },
    savePeriodDayDetail: () => {
        var dateStr = window.selectedPeriodDateStr;
        if(!dateStr) return;
        if(!globalPeriods.includes(dateStr)) {
            globalPeriods.push(dateStr);
            globalPeriods.sort();
        }
        var defaultFlow = (globalPeriodPrefs.flows && globalPeriodPrefs.flows[0]) ? globalPeriodPrefs.flows[0] : '中';
        var defaultCramp = (globalPeriodPrefs.cramps && globalPeriodPrefs.cramps[0]) ? globalPeriodPrefs.cramps[0] : '無';
        var flow = window.getRadioVal('#period-detail-form', 'p-flow') || defaultFlow;
        var cramp = window.getRadioVal('#period-detail-form', 'p-cramp') || defaultCramp;
        var colors = []; document.querySelectorAll('#period-detail-form .p-color:checked').forEach(el => colors.push(el.value));
        var symps = []; document.querySelectorAll('#period-detail-form .p-symp:checked').forEach(el => symps.push(el.value));
        var memo = document.getElementById('p-memo').value.trim();
        globalPeriodDetails[dateStr] = { flow, cramp, colors, symps, memo };

        syncToCloud();
        window.renderPeriodCalendar();
        window.renderCalendar();
        window.showToast("已儲存 " + dateStr + " 生理期症狀詳情！");
    },
    changePeriodMonth: (offset) => {
        window.periodCalDate.setMonth(window.periodCalDate.getMonth() + offset);
        window.renderPeriodCalendar();
    },

    savePrefs: (newCtx, newT, newP, newS, newM) => {
        if(newCtx && !globalPrefs.contexts.includes(newCtx)) globalPrefs.contexts.push(newCtx);
        if(newT && !globalPrefs.triggers.includes(newT)) globalPrefs.triggers.push(newT);
        if(newP && !globalPrefs.painTypes.includes(newP)) globalPrefs.painTypes.push(newP);
        if(newS && !globalPrefs.symptoms.includes(newS)) globalPrefs.symptoms.push(newS);
        if(newM && !globalPrefs.meds.includes(newM)) globalPrefs.meds.push(newM);
        syncToCloud();
        window.renderDynamicButtons();
        window.renderHeadachePrefsManager();
    },
    saveCurrentEdit: () => {
        if(currentModule === 'headache') {
            var activeTab = document.querySelector('#mod-headache .tab-content.active').id;
            if(activeTab === 'tab-record') window.appLogic.saveRecord();
            else if(activeTab === 'tab-change') window.appLogic.saveChange();
        } else if(currentModule === 'sleep') {
            window.appLogic.saveSleepRecord();
        } else if(currentModule === 'abnormal') {
            window.appLogic.saveAbnormalRecord();
        }
    },
    cancelCurrentEdit: () => {
        if(currentModule === 'headache') {
            var activeTab = document.querySelector('#mod-headache .tab-content.active').id;
            if(activeTab === 'tab-record') window.appLogic.cancelEdit();
            else if(activeTab === 'tab-change') window.appLogic.cancelChangeEdit();
        } else if(currentModule === 'sleep') {
            window.handleBottomNav('dashboard');
        } else if(currentModule === 'abnormal') {
            window.handleBottomNav('dashboard');
        }
    },
    saveRecord: () => {
        var id = document.getElementById('edit-id').value;
        var time = document.getElementById('record-time').value;
        if(!time) return window.showToast("請填寫時間！");

        var pain = window.getRadioVal('#tab-record', 'pain') || '未填寫';
        var duration = window.getRadioVal('#tab-record', 'duration') || '未確認';
        var effect = window.getRadioVal('#tab-record', 'effect');
        
        var locs = []; document.querySelectorAll('#tab-record .loc-check:checked').forEach(el => locs.push(el.value));
        var contexts = []; document.querySelectorAll('#tab-record .context-check:checked').forEach(el => contexts.push(el.value));
        var triggers = []; document.querySelectorAll('#tab-record .trigger-check:checked').forEach(el => triggers.push(el.value));
        var painTypes = []; document.querySelectorAll('#tab-record .painType-check:checked').forEach(el => painTypes.push(el.value));
        var symptoms = []; document.querySelectorAll('#tab-record .symptom-check:checked').forEach(el => symptoms.push(el.value));
        var meds = []; document.querySelectorAll('#tab-record .med-check:checked').forEach(el => meds.push(el.value));
        
        var customCtx = document.getElementById('custom-context').value.trim();
        var customT = document.getElementById('custom-trigger').value.trim();
        var customP = document.getElementById('custom-painType').value.trim();
        var customS = document.getElementById('custom-symptom').value.trim();
        var customM = document.getElementById('custom-med').value.trim();
        
        if(customCtx) contexts.push(customCtx);
        if(customT) triggers.push(customT);
        if(customP) painTypes.push(customP);
        if(customS) symptoms.push(customS);
        if(customM) meds.push(customM);
        var memo = document.getElementById('memo').value.trim();
        
        if(customCtx || customT || customP || customS || customM) window.appLogic.savePrefs(customCtx, customT, customP, customS, customM);

        if(id) {
            var idx = globalRecords.findIndex(r => r.id == id);
            if(idx > -1) { 
                globalRecords[idx] = { ...globalRecords[idx], time, pain, duration, locs: locs.join('、'), contexts: contexts.join('、'), triggers: triggers.join('、'), painTypes: painTypes.join('、'), symptoms: symptoms.join('、'), meds: meds.join('、'), effect, memo }; 
            }
            window.lastEditedId = id; 
            window.showToast("編輯已儲存！");
        } else {
            var newId = Date.now();
            globalRecords.push({ id: newId, time, pain, duration, locs: locs.join('、'), contexts: contexts.join('、'), triggers: triggers.join('、'), painTypes: painTypes.join('、'), symptoms: symptoms.join('、'), meds: meds.join('、'), effect, memo, changes: [] });
            window.lastEditedId = newId; 
            window.showToast("紀錄已儲存！");
        }
        globalRecords.sort((a, b) => new Date(b.time) - new Date(a.time));
        syncToCloud();
        window.appLogic.cancelEdit();
    },
    saveChange: () => {
        var id = document.getElementById('change-parent-id').value;
        var editIndex = document.getElementById('change-edit-index').value;
        var time = document.getElementById('change-time').value;
        if(!time) return window.showToast("請輸入時間！");

        var pain = window.getRadioVal('#tab-change', 'change-pain') || '未填寫';
        var effect = window.getRadioVal('#tab-change', 'change-effect');
        
        var locs = []; document.querySelectorAll('#tab-change .modal-loc-check:checked').forEach(el => locs.push(el.value));
        var contexts = []; document.querySelectorAll('#tab-change .modal-context-check:checked').forEach(el => contexts.push(el.value));
        var triggers = []; document.querySelectorAll('#tab-change .modal-trigger-check:checked').forEach(el => triggers.push(el.value));
        var painTypes = []; document.querySelectorAll('#tab-change .modal-painType-check:checked').forEach(el => painTypes.push(el.value));
        var symptoms = []; document.querySelectorAll('#tab-change .modal-symptom-check:checked').forEach(el => symptoms.push(el.value));
        var meds = []; document.querySelectorAll('#tab-change .modal-med-check:checked').forEach(el => meds.push(el.value));
        
        var customCtx = document.getElementById('change-custom-context').value.trim();
        var customT = document.getElementById('change-custom-trigger').value.trim();
        var customP = document.getElementById('change-custom-painType').value.trim();
        var customS = document.getElementById('change-custom-symptom').value.trim();
        var customM = document.getElementById('change-custom-med').value.trim();
        
        if(customCtx) contexts.push(customCtx);
        if(customT) triggers.push(customT);
        if(customP) painTypes.push(customP);
        if(customS) symptoms.push(customS);
        if(customM) meds.push(customM);
        var memo = document.getElementById('change-memo').value.trim();
        
        if(customCtx || customT || customP || customS || customM) window.appLogic.savePrefs(customCtx, customT, customP, customS, customM);

        var idx = globalRecords.findIndex(r => r.id == id);
        if(idx > -1) {
            if(!globalRecords[idx].changes) globalRecords[idx].changes = [];
            var changeData = { time, pain, locs: locs.join('、'), contexts: contexts.join('、'), triggers: triggers.join('、'), painTypes: painTypes.join('、'), symptoms: symptoms.join('、'), meds: meds.join('、'), effect, memo };
            if(editIndex !== '') globalRecords[idx].changes[parseInt(editIndex)] = changeData;
            else globalRecords[idx].changes.push(changeData);
            globalRecords[idx].changes.sort((a,b) => new Date(a.time) - new Date(b.time));
            
            window.lastEditedId = id; 
            syncToCloud();
            window.showToast("變化紀錄已儲存！");
        }
        window.appLogic.cancelChangeEdit();
    },
    deleteRecord: (id) => {
        if(confirm("確定刪除此整筆紀錄？")) {
            globalRecords = globalRecords.filter(r => r.id != id);
            syncToCloud();
            window.renderCalendar();
            window.renderHistory();
        }
    },
    deleteChange: (id, cIndex) => {
        if(confirm("確定刪除此次變化？")) {
            var idx = globalRecords.findIndex(r => r.id == id);
            if(idx > -1) {
                globalRecords[idx].changes.splice(cIndex, 1);
                window.lastEditedId = id; 
                syncToCloud();
                window.renderCalendar();
                window.renderHistory();
            }
        }
    },
    cancelEdit: () => {
        document.getElementById('edit-id').value = '';
        document.getElementById('form-title').innerText = "➕ 新增紀錄";
        document.querySelectorAll('#tab-record input[type="checkbox"], #tab-record input[type="radio"]').forEach(el => el.checked = false);
        document.querySelectorAll('#tab-record input[type="text"], #tab-record textarea').forEach(el => el.value = '');
        window.switchTab('history');
    },
    cancelChangeEdit: () => {
        document.getElementById('change-parent-id').value = '';
        document.getElementById('change-edit-index').value = '';
        document.getElementById('change-form-title').innerText = "⏱️ 新增轉移變化";
        document.querySelectorAll('#tab-change input[type="checkbox"], #tab-change input[type="radio"]').forEach(el => el.checked = false);
        document.querySelectorAll('#tab-change input[type="text"], #tab-change textarea').forEach(el => el.value = '');
        window.switchTab('history');
    },

    // ==================== 睡眠紀錄儲存與刪除 ====================
    saveSleepRecord: () => {
        var editId = document.getElementById('sleep-edit-id').value;
        var date = document.getElementById('slp-date').value;
        if(!date) return window.showToast("請選擇日期！");
        var hours = parseFloat(document.getElementById('slp-hours').value) || 8;
        var bed = document.getElementById('slp-bed').value || '23:00';
        var wake = document.getElementById('slp-wake').value || '07:00';
        var score = parseInt(window.getRadioVal('#sleep-sub-record', 'slp-score') || '3');
        var tags = []; document.querySelectorAll('#sleep-sub-record .slp-tag:checked').forEach(e => tags.push(e.value));
        var customTag = document.getElementById('custom-sleep-tag').value.trim();
        if(customTag) {
            tags.push(customTag);
            if(!globalSleepPrefs.tags.includes(customTag)) {
                globalSleepPrefs.tags.push(customTag);
                window.renderSleepDynamicButtons();
                window.renderSleepPrefsManager();
            }
        }
        var memo = document.getElementById('slp-memo').value.trim();

        if(!globalModules.sleep) globalModules.sleep = [];
        if(editId) {
            var idx = globalModules.sleep.findIndex(x => x.id == editId);
            if(idx > -1) globalModules.sleep[idx] = { id: Number(editId), date, hours, bed, wake, score, tags, memo };
        } else {
            // 若同日已有紀錄則覆蓋更新
            globalModules.sleep = globalModules.sleep.filter(x => x.date !== date);
            globalModules.sleep.push({ id: Date.now(), date, hours, bed, wake, score, tags, memo });
        }
        globalModules.sleep.sort((a,b) => b.date.localeCompare(a.date));
        document.getElementById('custom-sleep-tag').value = '';
        window.selectedSleepDateStr = date;
        syncToCloud();
        window.showToast("睡眠紀錄已儲存！");
        window.handleBottomNav('dashboard');
    },
    deleteSleepRecord: (id) => {
        if(!confirm("確定刪除此筆睡眠紀錄？")) return;
        globalModules.sleep = (globalModules.sleep || []).filter(x => x.id != id);
        syncToCloud();
        window.renderSleepCalendar();
        window.renderSleepHistory();
    },

    // ==================== 身體異常紀錄儲存與刪除 ====================
    saveAbnormalRecord: () => {
        var editId = document.getElementById('abnormal-edit-id').value;
        var time = document.getElementById('abn-time').value;
        if(!time) return window.showToast("請填寫時間！");
        var level = window.getRadioVal('#abnormal-sub-record', 'abn-level') || '2分: 中度不適';

        var cats = []; document.querySelectorAll('#abnormal-sub-record .abn-cat:checked').forEach(e=>cats.push(e.value));
        var symps = []; document.querySelectorAll('#abnormal-sub-record .abn-symp:checked').forEach(e=>symps.push(e.value));
        var treats = []; document.querySelectorAll('#abnormal-sub-record .abn-treat:checked').forEach(e=>treats.push(e.value));

        var cCat = document.getElementById('custom-abn-cat').value.trim();
        var cSymp = document.getElementById('custom-abn-symp').value.trim();
        var cTreat = document.getElementById('custom-abn-treat').value.trim();
        var prefChanged = false;
        if(cCat) { cats.push(cCat); if(!globalAbnormalPrefs.cats.includes(cCat)) { globalAbnormalPrefs.cats.push(cCat); prefChanged = true; } }
        if(cSymp) { symps.push(cSymp); if(!globalAbnormalPrefs.symps.includes(cSymp)) { globalAbnormalPrefs.symps.push(cSymp); prefChanged = true; } }
        if(cTreat) { treats.push(cTreat); if(!globalAbnormalPrefs.treats.includes(cTreat)) { globalAbnormalPrefs.treats.push(cTreat); prefChanged = true; } }
        if(prefChanged) {
            window.renderAbnormalDynamicButtons();
            window.renderAbnormalPrefsManager();
        }

        var hasClinic = document.getElementById('abn-clinic-toggle').checked;
        var clinicDate = hasClinic ? document.getElementById('abn-clinic-date').value : '';
        var clinicDept = hasClinic ? document.getElementById('abn-clinic-dept').value.trim() : '';
        var memo = document.getElementById('abn-memo').value.trim();

        if(!globalModules.abnormal) globalModules.abnormal = [];
        var itemData = { id: editId ? Number(editId) : Date.now(), time, level, cats, symps, treats, hasClinic, clinicDate, clinicDept, memo };

        if(editId) {
            var idx = globalModules.abnormal.findIndex(x => x.id == editId);
            if(idx > -1) globalModules.abnormal[idx] = itemData;
        } else {
            globalModules.abnormal.push(itemData);
        }
        globalModules.abnormal.sort((a,b) => new Date(b.time) - new Date(a.time));
        window.selectedAbnormalDateStr = time.slice(0, 10);
        syncToCloud();
        window.showToast("身體異常紀錄已儲存！");
        window.handleBottomNav('dashboard');
    },
    deleteAbnormalRecord: (id) => {
        if(!confirm("確定刪除此筆身體異常紀錄？")) return;
        globalModules.abnormal = (globalModules.abnormal || []).filter(x => x.id != id);
        syncToCloud();
        window.renderAbnormalCalendar();
        window.renderAbnormalHistory();
    },

    // B 類模組儲存邏輯
    saveModuleItem: (modName) => {
        var id = Date.now();
        if(modName === 'coffee') {
            var name = document.getElementById('cof-name').value.trim();
            if(!name) return window.showToast("請輸入豆款或濾掛名稱");
            var roast = document.getElementById('cof-roast').value;
            var method = document.getElementById('cof-method').value;
            var rating = document.getElementById('cof-rating').value;
            var memo = document.getElementById('cof-memo').value.trim();
            var date = new Date().toISOString().slice(0,10);
            if(!globalModules.coffee) globalModules.coffee = [];
            globalModules.coffee.unshift({ id, date, name, roast, method, rating: parseInt(rating), memo });
            document.getElementById('cof-name').value = '';
            document.getElementById('cof-memo').value = '';
            window.renderCoffeeModule();
        }
        syncToCloud();
        window.showToast("紀錄已儲存！");
    },
    deleteModuleItem: (modName, id) => {
        if(!confirm("確定刪除此筆紀錄？")) return;
        globalModules[modName] = (globalModules[modName] || []).filter(x => x.id != id);
        syncToCloud();
        window.refreshCurrentModuleView();
    },
    quickAddDrink: (name, ml, caf) => {
        var dateStr = document.getElementById('hyd-date').value;
        var timeStr = new Date().toTimeString().slice(0,5);
        if(!globalModules.hydration) globalModules.hydration = [];
        globalModules.hydration.unshift({ id: Date.now(), date: dateStr, time: timeStr, name, ml: parseInt(ml), caf: parseInt(caf) });
        syncToCloud();
        window.renderHydrationModule();
        window.showToast(`已紀錄：${name}`);
    },
    addCustomDrink: () => {
        var name = document.getElementById('hyd-custom-name').value.trim() || '自訂飲品';
        var ml = parseInt(document.getElementById('hyd-custom-ml').value) || 250;
        var caf = parseInt(document.getElementById('hyd-custom-caf').value) || 0;
        window.appLogic.quickAddDrink(name, ml, caf);
        document.getElementById('hyd-custom-name').value = '';
    }
};

// ==================== UI 與導覽切換邏輯 ====================
window.initDefaultDates = function() {
    var todayStr = getTodayStr();
    window.selectedCalDateStr = todayStr;
    window.selectedPeriodDateStr = todayStr;
    window.selectedSleepDateStr = todayStr;
    window.selectedAbnormalDateStr = todayStr;
    var nowIso = getLocalIsoStr(new Date());
    var abnTime = document.getElementById('abn-time');
    if(abnTime) abnTime.value = nowIso;
    ['slp-date', 'hyd-date', 'abn-clinic-date'].forEach(id => { var el = document.getElementById(id); if(el) el.value = todayStr; });
};

window.toggleSidebar = function() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('open');
};

const MODULE_TITLES = {
    headache: '🤕 頭痛日記',
    period: '🩸 生理期專業紀錄',
    sleep: '😴 睡眠紀錄',
    abnormal: '🩺 身體異常情況紀錄',
    hydration: '💧 飲水與咖啡因追蹤',
    coffee: '☕ 咖啡豆與沖煮品鑑'
};

window.switchModule = function(modName) {
    currentModule = modName;
    document.getElementById('top-module-title').innerText = MODULE_TITLES[modName] || '健康日誌';
    document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
    var menuEl = document.getElementById('menu-' + modName);
    if(menuEl) menuEl.classList.add('active');

    document.querySelectorAll('.module-view').forEach(el => el.classList.remove('active'));
    var modEl = document.getElementById('mod-' + modName);
    if(modEl) modEl.classList.add('active');

    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open');
    document.getElementById('fab-container').style.display = 'none';

    var bottomNav = document.getElementById('bottom-nav');
    var navSettingsBtn = document.getElementById('nav-settings');
    if(['headache', 'period', 'sleep', 'abnormal'].includes(modName)) {
        bottomNav.style.display = 'flex';
        if(navSettingsBtn) navSettingsBtn.style.display = 'block';
        window.handleBottomNav('dashboard');
    } else {
        bottomNav.style.display = 'none';
        window.refreshCurrentModuleView();
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
};

window.handleBottomNav = function(tabName) {
    document.querySelectorAll('#bottom-nav button').forEach(b => b.classList.remove('active'));
    var btn = document.getElementById('nav-' + tabName);
    if(btn) btn.classList.add('active');
    document.getElementById('fab-container').style.display = 'none';

    if(currentModule === 'headache') {
        window.switchTab(tabName);
    } else if(currentModule === 'period') {
        document.getElementById('period-sub-dash').style.display = (tabName === 'dashboard') ? 'block' : 'none';
        document.getElementById('period-sub-history').style.display = (tabName === 'history') ? 'block' : 'none';
        document.getElementById('period-sub-charts').style.display = (tabName === 'charts') ? 'block' : 'none';
        document.getElementById('period-sub-settings').style.display = (tabName === 'settings') ? 'block' : 'none';
        if(tabName === 'dashboard') window.renderPeriodCalendar();
        if(tabName === 'history') window.renderPeriodHistoryList();
        if(tabName === 'charts') window.renderPeriodCharts();
        if(tabName === 'settings') window.renderPeriodPrefsManager();
        window.scrollTo({ top: 0, behavior: 'auto' });
    } else if(currentModule === 'sleep') {
        document.getElementById('sleep-sub-dash').style.display = (tabName === 'dashboard') ? 'block' : 'none';
        document.getElementById('sleep-sub-record').style.display = 'none';
        document.getElementById('sleep-sub-history').style.display = (tabName === 'history') ? 'block' : 'none';
        document.getElementById('sleep-sub-charts').style.display = (tabName === 'charts') ? 'block' : 'none';
        document.getElementById('sleep-sub-settings').style.display = (tabName === 'settings') ? 'block' : 'none';
        if(tabName === 'dashboard') window.renderSleepCalendar();
        if(tabName === 'history') window.renderSleepHistory();
        if(tabName === 'charts') window.renderSleepCharts();
        if(tabName === 'settings') window.renderSleepPrefsManager();
        window.scrollTo({ top: 0, behavior: 'auto' });
    } else if(currentModule === 'abnormal') {
        document.getElementById('abnormal-sub-dash').style.display = (tabName === 'dashboard') ? 'block' : 'none';
        document.getElementById('abnormal-sub-record').style.display = 'none';
        document.getElementById('abnormal-sub-history').style.display = (tabName === 'history') ? 'block' : 'none';
        document.getElementById('abnormal-sub-charts').style.display = (tabName === 'charts') ? 'block' : 'none';
        document.getElementById('abnormal-sub-settings').style.display = (tabName === 'settings') ? 'block' : 'none';
        if(tabName === 'dashboard') window.renderAbnormalCalendar();
        if(tabName === 'history') window.renderAbnormalHistory();
        if(tabName === 'charts') window.renderAbnormalCharts();
        if(tabName === 'settings') window.renderAbnormalPrefsManager();
        window.scrollTo({ top: 0, behavior: 'auto' });
    }
};

window.refreshCurrentModuleView = function() {
    if(currentModule === 'hydration') window.renderHydrationModule();
    if(currentModule === 'coffee') window.renderCoffeeModule();
};

function isEditingFormActive() {
    if(currentModule === 'headache') {
        var activeTab = document.querySelector('#mod-headache .tab-content.active');
        return activeTab && (activeTab.id === 'tab-record' || activeTab.id === 'tab-change');
    }
    if(currentModule === 'sleep') {
        return document.getElementById('sleep-sub-record').style.display === 'block';
    }
    if(currentModule === 'abnormal') {
        return document.getElementById('abnormal-sub-record').style.display === 'block';
    }
    return false;
}

window.addEventListener('DOMContentLoaded', () => {
    window.initDefaultDates();
    var fab = document.getElementById('fab-container');
    var obs = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if(entry.isIntersecting) {
                fab.classList.add('hidden');
            } else if(isEditingFormActive()) {
                fab.classList.remove('hidden');
            }
        });
    }, { threshold: 0.1 });
    ['save-anchor-record', 'save-anchor-change', 'save-anchor-sleep', 'save-anchor-abnormal'].forEach(id => {
        var el = document.getElementById(id);
        if(window.IntersectionObserver && el) obs.observe(el);
    });
});

window.showToast = function(msg) {
    var toast = document.createElement('div');
    toast.innerText = msg;
    toast.style.cssText = "position:fixed; bottom:90px; left:50%; transform:translateX(-50%); background:var(--primary-color); color:#fff; padding:12px 24px; border-radius:30px; z-index:9999; box-shadow:0 4px 10px rgba(0,0,0,0.5); opacity:0; transition:opacity 0.3s; font-weight:bold; white-space:nowrap;";
    document.body.appendChild(toast);
    setTimeout(function(){ toast.style.opacity = 1; }, 10);
    setTimeout(function(){ toast.style.opacity = 0; setTimeout(function(){ toast.remove(); }, 300); }, 2300);
};

function formatHistoryDate(isoStr) {
    if(!isoStr) return '';
    var d = new Date(isoStr);
    var days = ['日','一','二','三','四','五','六'];
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    var day = days[d.getDay()];
    var hh = String(d.getHours()).padStart(2, '0');
    var min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} (${day}) ${hh}:${min}`;
}

function getPainBarHtml(painStr) {
    var val = parseInt((painStr||'').charAt(0)) || 1;
    var emojis = ['😐', '🙁', '😣', '😫', '🤯'];
    var colors = ['#fbc02d', '#ff9800', '#f57c00', '#e53935', '#8e24aa'];
    var emoji = emojis[val - 1] || '😐';
    var color = colors[val - 1] || '#fbc02d';
    var pct = val * 20;
    return `<div style="display:flex; align-items:center; gap:6px; margin-top:6px; font-weight:normal;">
                <span style="font-size:18px; line-height:1; flex-shrink:0;">${emoji}</span>
                <div style="width:75px; height:8px; background:#333; border-radius:4px; overflow:hidden; display:flex; flex-shrink:0;">
                    <div style="width:${pct}%; height:100%; background:${color}; border-radius:4px;"></div>
                </div>
                <span style="font-size:13px; font-weight:bold; color:${color}; flex-shrink:0;">Lv.${val}</span>
            </div>`;
}

function getRecordPainEvolutionHtml(r) {
    var emojis = ['😐', '🙁', '😣', '😫', '🤯'];
    var colors = ['#fbc02d', '#ff9800', '#f57c00', '#e53935', '#8e24aa'];
    var initVal = parseInt((r.pain||'').charAt(0)) || 1;
    var seq = [initVal];
    if(r.changes && r.changes.length > 0) {
        r.changes.forEach(c => {
            seq.push(parseInt((c.pain||'').charAt(0)) || 1);
        });
    }
    var maxVal = Math.max(...seq);
    var maxEmoji = emojis[maxVal - 1] || '😐';
    var maxColor = colors[maxVal - 1] || '#fbc02d';
    var pct = maxVal * 20;

    if(seq.length === 1) {
        return getPainBarHtml(r.pain);
    }

    var flowBadges = seq.map(v => `<span style="color:${colors[v-1]}; font-weight:bold;">Lv.${v}</span>`).join('<span style="color:#777; margin:0 2px; font-size:11px;">➔</span>');

    return `<div style="display:flex; align-items:center; gap:6px; margin-top:6px; flex-wrap:nowrap; overflow-x:auto; max-width:100%; font-weight:normal;">
                <span style="font-size:18px; line-height:1; flex-shrink:0;" title="最高痛覺 Lv.${maxVal}">${maxEmoji}</span>
                <div style="width:65px; height:8px; background:#333; border-radius:4px; overflow:hidden; display:flex; flex-shrink:0;">
                    <div style="width:${pct}%; height:100%; background:${maxColor}; border-radius:4px;"></div>
                </div>
                <div style="font-size:12px; background:#161616; padding:2px 8px; border-radius:12px; border:1px solid #383838; display:inline-flex; align-items:center; white-space:nowrap; flex-shrink:0;">
                    <span style="color:#999; margin-right:4px;">走向:</span>${flowBadges}
                </div>
            </div>`;
}

function makeChipsHtml(str, chipClass) {
    if(!str) return '';
    return str.split('、').filter(Boolean).map(s => `<span class="chip ${chipClass}">${s}</span>`).join('');
}

function buildRecordExpandedBodyHtml(r) {
    var changeCount = (r.changes && r.changes.length) ? r.changes.length : 0;
    var changesHtml = '';
    if(changeCount > 0) {
        changesHtml = '<div class="timeline">';
        r.changes.forEach((c, cIdx) => {
            var cTime = formatHistoryDate(c.time);
            changesHtml += `<div class="timeline-item">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:5px;">
                    <div style="font-size:13px; font-weight:bold; color:var(--primary-color);">⏱️ 第 ${cIdx+1} 次變化 <span style="font-size:12px; color:#aaa; font-weight:normal;">${cTime}</span>${getPainBarHtml(c.pain)}</div>
                    <div style="white-space:nowrap;" onclick="event.stopPropagation();">
                        <span style="cursor:pointer; margin-right:10px; font-size:15px;" onclick="openChangeTab(${r.id}, ${cIdx})">✏️</span>
                        <span style="cursor:pointer; font-size:15px;" onclick="window.appLogic.deleteChange(${r.id}, ${cIdx})">🗑️</span>
                    </div>
                </div>
                <div class="chips-container" style="margin-top:4px; margin-bottom:4px;">${makeChipsHtml(c.locs, 'loc')}${makeChipsHtml(c.triggers, 'trig')}${makeChipsHtml(c.meds, 'med')}</div>
                ${c.contexts ? `<div><strong>情境狀態：</strong>${c.contexts}</div>` : ''}
                ${c.painTypes ? `<div><strong>疼痛方式：</strong>${c.painTypes}</div>` : ''}
                ${c.symptoms ? `<div><strong>伴隨症狀：</strong>${c.symptoms}</div>` : ''}
                ${c.effect ? `<div><strong>藥效：</strong>${c.effect}</div>` : ''}
                ${c.memo ? `<div><strong>備註：</strong>${c.memo}</div>` : ''}
            </div>`;
        });
        changesHtml += '</div>';
    }

    return `${r.sleep && r.sleep !== '未填寫' ? `<div class="record-detail"><strong>前天睡眠：</strong>${r.sleep}</div>` : ''}
            ${r.contexts ? `<div class="record-detail"><strong>發作情境：</strong>${r.contexts}</div>` : ''}
            ${r.painTypes ? `<div class="record-detail"><strong>疼痛方式：</strong>${r.painTypes}</div>` : ''}
            ${r.symptoms ? `<div class="record-detail"><strong>伴隨症狀：</strong>${r.symptoms}</div>` : ''}
            ${r.memo ? `<div class="record-detail"><strong>備註：</strong>${r.memo}</div>` : ''}
            ${changesHtml}
            <button class="ghost-add-btn" onclick="openChangeTab(${r.id})">⏱️ 新增轉移變化</button>`;
}

window.getRadioVal = function(scope, name) { var el = document.querySelector(scope + ' input[name="' + name + '"]:checked'); return el ? el.value : ''; };

window.renderDynamicButtons = function() {
    var p = window.appLogic ? window.appLogic.getPrefs() : {contexts:[], triggers:[], painTypes:[], symptoms:[], meds:[]};
    document.getElementById('dynamic-contexts').innerHTML = (p.contexts||[]).map(t => '<label><input type="checkbox" value="'+t+'" class="context-check"><div class="btn-check">'+t+'</div></label>').join('');
    document.getElementById('dynamic-triggers').innerHTML = (p.triggers||[]).map(t => '<label><input type="checkbox" value="'+t+'" class="trigger-check"><div class="btn-check">'+t+'</div></label>').join('');
    document.getElementById('dynamic-painTypes').innerHTML = (p.painTypes||[]).map(t => '<label><input type="checkbox" value="'+t+'" class="painType-check"><div class="btn-check">'+t+'</div></label>').join('');
    document.getElementById('dynamic-symptoms').innerHTML = (p.symptoms||[]).map(t => '<label><input type="checkbox" value="'+t+'" class="symptom-check"><div class="btn-check">'+t+'</div></label>').join('');
    document.getElementById('dynamic-meds').innerHTML = (p.meds||[]).map(m => '<label><input type="checkbox" value="'+m+'" class="med-check"><div class="btn-check">'+m+'</div></label>').join('');
    
    document.getElementById('modal-dynamic-contexts').innerHTML = (p.contexts||[]).map(t => '<label><input type="checkbox" value="'+t+'" class="modal-context-check"><div class="btn-check">'+t+'</div></label>').join('');
    document.getElementById('modal-dynamic-triggers').innerHTML = (p.triggers||[]).map(t => '<label><input type="checkbox" value="'+t+'" class="modal-trigger-check"><div class="btn-check">'+t+'</div></label>').join('');
    document.getElementById('modal-dynamic-painTypes').innerHTML = (p.painTypes||[]).map(t => '<label><input type="checkbox" value="'+t+'" class="modal-painType-check"><div class="btn-check">'+t+'</div></label>').join('');
    document.getElementById('modal-dynamic-symptoms').innerHTML = (p.symptoms||[]).map(t => '<label><input type="checkbox" value="'+t+'" class="modal-symptom-check"><div class="btn-check">'+t+'</div></label>').join('');
    document.getElementById('modal-dynamic-meds').innerHTML = (p.meds||[]).map(m => '<label><input type="checkbox" value="'+m+'" class="modal-med-check"><div class="btn-check">'+m+'</div></label>').join('');
};

window.renderHeadachePrefsManager = function() {
    var container = document.getElementById('headache-prefs-manager');
    if(!container || !window.appLogic) return;
    var p = window.appLogic.getPrefs();
    var categories = [
        { key: 'triggers', title: '⚡ 潛在誘因選項' },
        { key: 'painTypes', title: '🤕 疼痛方式選項' },
        { key: 'symptoms', title: '🤢 伴隨症狀選項' },
        { key: 'contexts', title: '🏠 發作情境與狀態選項' },
        { key: 'meds', title: '💊 常用藥物選項' }
    ];

    container.innerHTML = categories.map(cat => {
        var items = p[cat.key] || [];
        var tagsHtml = items.map((val, idx) => `
            <div class="pref-tag-item">
                <span>${val}</span>
                <span class="icon-btn" title="修改名稱" onclick="appLogic.editPrefItem('${cat.key}', ${idx})">✏️</span>
                <span class="icon-btn" title="刪除選項" onclick="appLogic.deletePrefItem('${cat.key}', ${idx})">🗑️</span>
            </div>
        `).join('');

        return `<div class="section">
            <div class="section-title">${cat.title}</div>
            <div class="pref-tag-box">${tagsHtml || '<span style="color:#777; font-size:13px;">尚無選項</span>'}</div>
            <div style="display:flex; gap:8px;">
                <input type="text" id="new-pref-${cat.key}" placeholder="輸入要新增的選項名稱..." style="flex:1; padding:9px 12px;">
                <button class="action-btn" style="background:var(--primary-color); border:none; padding:0 16px; font-weight:bold; white-space:nowrap;" onclick="appLogic.addPrefItem('${cat.key}')">➕ 新增</button>
            </div>
        </div>`;
    }).join('');
};

window.renderPeriodDynamicButtons = function() {
    var pp = window.appLogic ? window.appLogic.getPeriodPrefs() : {flows:[], colors:[], cramps:[], symps:[]};
    var fEl = document.getElementById('dynamic-period-flows');
    var colEl = document.getElementById('dynamic-period-colors');
    var crEl = document.getElementById('dynamic-period-cramps');
    var sEl = document.getElementById('dynamic-period-symps');

    if(fEl) fEl.innerHTML = (pp.flows||[]).map(v => `<label><input type="radio" name="p-flow" value="${v}"><div class="btn-check">${v}</div></label>`).join('');
    if(colEl) colEl.innerHTML = (pp.colors||[]).map(v => `<label><input type="checkbox" class="p-color" value="${v}"><div class="btn-check">${v}</div></label>`).join('');
    if(crEl) crEl.innerHTML = (pp.cramps||[]).map(v => `<label><input type="radio" name="p-cramp" value="${v}"><div class="btn-check">${v}</div></label>`).join('');
    if(sEl) sEl.innerHTML = (pp.symps||[]).map(v => `<label><input type="checkbox" class="p-symp" value="${v}"><div class="btn-check">${v}</div></label>`).join('');
};

window.renderPeriodPrefsManager = function() {
    var container = document.getElementById('period-prefs-manager');
    if(!container || !window.appLogic) return;
    var pp = window.appLogic.getPeriodPrefs();
    var categories = [
        { key: 'flows', title: '🩸 當日經血量選項 (單選)' },
        { key: 'colors', title: '🎨 經血顏色與質地選項 (可多選)' },
        { key: 'cramps', title: '⚡ 生理痛程度選項 (單選)' },
        { key: 'symps', title: '😣 伴隨身體與情緒症狀選項 (可多選)' }
    ];

    container.innerHTML = categories.map(cat => {
        var items = pp[cat.key] || [];
        var tagsHtml = items.map((val, idx) => `
            <div class="pref-tag-item">
                <span>${val}</span>
                <span class="icon-btn" title="修改名稱" onclick="appLogic.editPeriodPrefItem('${cat.key}', ${idx})">✏️</span>
                <span class="icon-btn" title="刪除選項" onclick="appLogic.deletePeriodPrefItem('${cat.key}', ${idx})">🗑️</span>
            </div>
        `).join('');

        return `<div class="section">
            <div class="section-title">${cat.title}</div>
            <div class="pref-tag-box">${tagsHtml || '<span style="color:#777; font-size:13px;">尚無選項</span>'}</div>
            <div style="display:flex; gap:8px;">
                <input type="text" id="new-ppref-${cat.key}" placeholder="輸入要新增的選項名稱..." style="flex:1; padding:9px 12px;">
                <button class="action-btn" style="background:var(--period-bg-color); border:none; padding:0 16px; font-weight:bold; white-space:nowrap;" onclick="appLogic.addPeriodPrefItem('${cat.key}')">➕ 新增</button>
            </div>
        </div>`;
    }).join('');
};

window.startNewRecord = function() {
    if(document.getElementById('edit-id').value !== '') { window.appLogic.cancelEdit(); }
    document.getElementById('record-time').value = getLocalIsoStr(new Date());
    window.switchTab('record');
};

window.startNewRecordForSelectedDate = function() {
    if(document.getElementById('edit-id').value !== '') { window.appLogic.cancelEdit(); }
    var baseDate = window.selectedCalDateStr || getTodayStr();
    var nowTime = new Date().toTimeString().slice(0,5);
    document.getElementById('record-time').value = `${baseDate}T${nowTime}`;
    window.switchTab('record');
};

window.editRecord = function(id) {
    var record = window.appLogic.getRecords().find(r => r.id == id);
    if(!record) return;
    document.getElementById('edit-id').value = record.id;
    document.getElementById('record-time').value = record.time;
    document.getElementById('memo').value = record.memo || '';
    ['custom-context','custom-trigger','custom-painType','custom-symptom','custom-med'].forEach(k => document.getElementById(k).value = '');

    document.querySelectorAll('#tab-record input[type="radio"], #tab-record input[type="checkbox"]').forEach(el => el.checked = false);
    if(record.pain) { var p = document.querySelector('#tab-record input[name="pain"][value="' + record.pain + '"]'); if(p) p.checked = true; }
    if(record.duration) { var d = document.querySelector('#tab-record input[name="duration"][value="' + record.duration + '"]'); if(d) d.checked = true; }
    if(record.effect) { var e = document.querySelector('#tab-record input[name="effect"][value="' + record.effect + '"]'); if(e) e.checked = true; }
    
    if(record.locs) record.locs.split('、').forEach(v => { var cb = document.querySelector('#tab-record .loc-check[value="' + v + '"]'); if(cb) cb.checked = true; });
    if(record.contexts) record.contexts.split('、').forEach(v => { var cb = document.querySelector('#tab-record .context-check[value="' + v + '"]'); if(cb) cb.checked = true; });
    if(record.triggers) record.triggers.split('、').forEach(v => { var cb = document.querySelector('#tab-record .trigger-check[value="' + v + '"]'); if(cb) cb.checked = true; });
    if(record.painTypes) record.painTypes.split('、').forEach(v => { var cb = document.querySelector('#tab-record .painType-check[value="' + v + '"]'); if(cb) cb.checked = true; });
    if(record.symptoms) record.symptoms.split('、').forEach(v => { var cb = document.querySelector('#tab-record .symptom-check[value="' + v + '"]'); if(cb) cb.checked = true; });
    if(record.meds) record.meds.split('、').forEach(v => { var cb = document.querySelector('#tab-record .med-check[value="' + v + '"]'); if(cb) cb.checked = true; });
    
    document.getElementById('form-title').innerText = "✏️ 編輯主紀錄";
    window.switchTab('record');
};

window.openChangeTab = function(id, cIndex) {
    document.getElementById('change-parent-id').value = id;
    document.querySelectorAll('#tab-change input[type="radio"], #tab-change input[type="checkbox"]').forEach(el => el.checked = false);
    ['change-custom-context','change-custom-trigger','change-custom-painType','change-custom-symptom','change-custom-med'].forEach(k => document.getElementById(k).value = '');

    var record = window.appLogic.getRecords().find(r => r.id == id);
    if(cIndex !== undefined) {
        document.getElementById('change-edit-index').value = cIndex;
        document.getElementById('change-form-title').innerText = "✏️ 編輯轉移變化";
        var change = record.changes[cIndex];
        document.getElementById('change-time').value = change.time;
        if(change.pain) { var p = document.querySelector('#tab-change input[name="change-pain"][value="' + change.pain + '"]'); if(p) p.checked = true; }
        if(change.effect) { var e = document.querySelector('#tab-change input[name="change-effect"][value="' + change.effect + '"]'); if(e) e.checked = true; }
        if(change.locs) change.locs.split('、').forEach(v => { var cb = document.querySelector('#tab-change .modal-loc-check[value="' + v + '"]'); if(cb) cb.checked = true; });
        if(change.contexts) change.contexts.split('、').forEach(v => { var cb = document.querySelector('#tab-change .modal-context-check[value="' + v + '"]'); if(cb) cb.checked = true; });
        if(change.triggers) change.triggers.split('、').forEach(v => { var cb = document.querySelector('#tab-change .modal-trigger-check[value="' + v + '"]'); if(cb) cb.checked = true; });
        if(change.painTypes) change.painTypes.split('、').forEach(v => { var cb = document.querySelector('#tab-change .modal-painType-check[value="' + v + '"]'); if(cb) cb.checked = true; });
        if(change.symptoms) change.symptoms.split('、').forEach(v => { var cb = document.querySelector('#tab-change .modal-symptom-check[value="' + v + '"]'); if(cb) cb.checked = true; });
        if(change.meds) change.meds.split('、').forEach(v => { var cb = document.querySelector('#tab-change .modal-med-check[value="' + v + '"]'); if(cb) cb.checked = true; });
        document.getElementById('change-memo').value = change.memo || '';
    } else {
        document.getElementById('change-edit-index').value = '';
        document.getElementById('change-form-title').innerText = "⏱️ 新增轉移變化";
        var rDate = new Date(record.time);
        var today = new Date();
        if (rDate.toDateString() === today.toDateString()) {
            document.getElementById('change-time').value = getLocalIsoStr(today);
        } else if (record.changes && record.changes.length > 0) {
            document.getElementById('change-time').value = record.changes[record.changes.length - 1].time;
        } else {
            document.getElementById('change-time').value = record.time;
        }
    }
    window.switchTab('change');
};

window.switchTab = function(tab) {
    document.querySelectorAll('#mod-headache .tab-content, #bottom-nav button').forEach(el => el.classList.remove('active'));
    var tabEl = document.getElementById('tab-' + tab);
    if(tabEl) tabEl.classList.add('active');
    
    var navElId = 'nav-' + tab;
    if(tab === 'record' || tab === 'change') navElId = 'nav-dashboard'; 
    var navEl = document.getElementById(navElId);
    if(navEl) navEl.classList.add('active'); 
    
    var fab = document.getElementById('fab-container');
    if(tab === 'record' || tab === 'change') { fab.style.display = 'flex'; fab.classList.remove('hidden'); } 
    else { fab.style.display = 'none'; }
    
    if (tab !== 'history' || !window.lastEditedId) {
        window.scrollTo({ top: 0, behavior: 'auto' });
    }
    
    if(tab === 'dashboard') { window.updateDashboard(); window.renderCalendar(); }
    if(tab === 'history') window.renderHistory();
    if(tab === 'charts') { window.updateDashboard(); window.renderCharts(); }
    if(tab === 'settings') window.renderHeadachePrefsManager();
};

window.updateDashboard = function() {
    var records = window.appLogic ? window.appLogic.getRecords() : [];
    var now = new Date();
    var thisMonthCount = records.filter(r => { var d = new Date(r.time); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); }).length;
    var sumEl = document.getElementById('dash-summary');
    if(sumEl) sumEl.innerHTML = `本月頭痛發作：<strong>${thisMonthCount}</strong> 次 ｜ 歷史總計：<strong>${records.length}</strong> 筆`;
};

window.changeMonth = function(offset) {
    currentCalDate.setMonth(currentCalDate.getMonth() + offset);
    window.renderCalendar();
};

function analyzePeriodCycles() {
    var periods = window.appLogic ? [...window.appLogic.getPeriods()].sort() : [];
    if(periods.length === 0) return { cycles: [], avgCycle: 28, avgDuration: 5, predictedDates: [], ovulationDates: [], nextStart: null, daysUntilNext: null, currentDayOfPeriod: null };
    
    var groups = [];
    var curGroup = [periods[0]];
    for(var i=1; i<periods.length; i++) {
        var prevD = new Date(periods[i-1]);
        var curD = new Date(periods[i]);
        var diffDays = Math.round((curD - prevD) / 86400000);
        if(diffDays <= 2) {
            curGroup.push(periods[i]);
        } else {
            groups.push(curGroup);
            curGroup = [periods[i]];
        }
    }
    groups.push(curGroup);

    var cycles = [];
    for(var g=0; g<groups.length; g++) {
        var startStr = groups[g][0];
        var endStr = groups[g][groups[g].length - 1];
        var duration = Math.round((new Date(endStr) - new Date(startStr)) / 86400000) + 1;
        var cycleLen = null;
        if(g < groups.length - 1) {
            var nextStartStr = groups[g+1][0];
            cycleLen = Math.round((new Date(nextStartStr) - new Date(startStr)) / 86400000);
        }
        cycles.push({ start: startStr, end: endStr, duration, cycleLen, days: groups[g] });
    }

    var validCycles = cycles.filter(c => c.cycleLen && c.cycleLen >= 18 && c.cycleLen <= 45).slice(-6);
    var avgCycle = validCycles.length > 0 ? Math.round(validCycles.reduce((a,b)=>a+b.cycleLen, 0) / validCycles.length) : 28;
    var avgDuration = Math.round(cycles.slice(-6).reduce((a,b)=>a+b.duration, 0) / Math.min(cycles.length, 6)) || 5;

    var lastCycle = cycles[cycles.length - 1];
    var nextStartDate = new Date(lastCycle.start + 'T00:00:00');
    nextStartDate.setDate(nextStartDate.getDate() + avgCycle);
    var nextStartStr = fmtDateStr(nextStartDate.getFullYear(), nextStartDate.getMonth(), nextStartDate.getDate());

    var todayMidnight = new Date(getTodayStr() + 'T00:00:00');
    var daysUntilNext = Math.round((nextStartDate - todayMidnight) / 86400000);

    var currentDayOfPeriod = null;
    if(periods.includes(getTodayStr())) {
        var lastStartMidnight = new Date(lastCycle.start + 'T00:00:00');
        currentDayOfPeriod = Math.round((todayMidnight - lastStartMidnight) / 86400000) + 1;
    }

    var predictedDates = [];
    for(var d=0; d<avgDuration; d++) {
        var pd = new Date(nextStartDate);
        pd.setDate(pd.getDate() + d);
        predictedDates.push(fmtDateStr(pd.getFullYear(), pd.getMonth(), pd.getDate()));
    }

    var ovuCenter = new Date(nextStartDate);
    ovuCenter.setDate(ovuCenter.getDate() - 14);
    var ovulationDates = [];
    for(var o=-2; o<=2; o++) {
        var od = new Date(ovuCenter);
        od.setDate(od.getDate() + o);
        ovulationDates.push(fmtDateStr(od.getFullYear(), od.getMonth(), od.getDate()));
    }

    return {
        cycles,
        avgCycle,
        avgDuration,
        predictedDates,
        ovulationDates,
        nextStart: nextStartStr,
        daysUntilNext,
        currentDayOfPeriod
    };
}

window.renderCalendar = function() {
    var grid = document.getElementById('cal-grid');
    var monthYear = document.getElementById('cal-month-year');
    var year = currentCalDate.getFullYear();
    var month = currentCalDate.getMonth();
    var todayStr = getTodayStr();
    if(!window.selectedCalDateStr) window.selectedCalDateStr = todayStr;
    
    monthYear.innerText = year + ' 年 ' + (month + 1) + ' 月';
    var html = '';
    var days = ['日','一','二','三','四','五','六'];
    for(var d=0; d<7; d++) html += '<div class="cal-day-name">' + days[d] + '</div>';
    
    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    for(var i=0; i<firstDay; i++) html += '<div></div>';
    
    var records = window.appLogic ? window.appLogic.getRecords() : [];
    var periods = window.appLogic ? window.appLogic.getPeriods() : [];
    var pAnalysis = analyzePeriodCycles();
    var dayRecords = {}; 
    
    records.forEach(r => {
        var d = new Date(r.time);
        if(d.getFullYear() === year && d.getMonth() === month) {
            var dateKey = d.getDate();
            var p = parseInt(r.pain.charAt(0)) || 1;
            if(r.changes) { r.changes.forEach(c => { var cp = parseInt(c.pain.charAt(0))||1; if(cp>p) p=cp; }); }
            if(!dayRecords[dateKey]) dayRecords[dateKey] = [];
            dayRecords[dateKey].push(p);
        }
    });

    for(var i=1; i<=daysInMonth; i++) {
        var dateStr = fmtDateStr(year, month, i);
        var isPeriod = periods.includes(dateStr);
        var isPred = !isPeriod && pAnalysis.predictedDates.includes(dateStr);
        var isToday = (dateStr === todayStr);
        var isSelected = (dateStr === window.selectedCalDateStr);
        
        var cellClass = 'cal-cell';
        if(isPeriod) cellClass += ' period-border';
        else if(isPred) cellClass += ' period-predicted';
        if(isSelected) cellClass += ' selected-day';

        var dateNumHtml = isToday ? `<div class="today-highlight">${i}</div>` : `<div style="margin-bottom:2px;">${i}</div>`;
        var dotHtml = '';
        if(dayRecords[i]) {
            dotHtml = '<div class="dots-wrapper">';
            dayRecords[i].forEach(painVal => { dotHtml += '<div class="cal-dot pain-' + painVal + '"></div>'; });
            dotHtml += '</div>';
        }
        html += `<div class="${cellClass}" onclick="window.selectCalDate('${dateStr}')">${dateNumHtml}${dotHtml}</div>`;
    }
    grid.innerHTML = html;
    window.renderSelectedDatePreview(window.selectedCalDateStr);
};

window.selectCalDate = function(dateStr) {
    window.selectedCalDateStr = dateStr;
    window.renderCalendar();
};

window.renderSelectedDatePreview = function(dateStr) {
    var titleEl = document.getElementById('selected-date-title');
    var listEl = document.getElementById('selected-date-list');
    var addBtnEl = document.getElementById('btn-add-selected-date');
    var records = window.appLogic ? window.appLogic.getRecords() : [];
    var periods = window.appLogic ? window.appLogic.getPeriods() : [];
    var pDetails = window.appLogic ? window.appLogic.getPeriodDetails() : {};

    var isPeriod = periods.includes(dateStr);
    titleEl.innerHTML = `📅 ${dateStr} 紀錄 ${isPeriod ? '<span class="chip period" style="margin-left:6px;">🩸 生理期</span>' : ''}`;

    var dayRecs = records.filter(r => r.time && r.time.startsWith(dateStr));
    if(addBtnEl) {
        addBtnEl.style.display = (dayRecs.length > 0) ? 'none' : 'inline-flex';
    }

    var html = '';
    if(isPeriod && pDetails[dateStr]) {
        var pd = pDetails[dateStr];
        html += `<div style="background:rgba(154,80,94,0.15); border:1px solid var(--period-bg-color); padding:10px; border-radius:8px; margin-bottom:10px; font-size:13px;">
            <strong>🩸 生理期狀態：</strong>血量 ${pd.flow} ｜ 經痛：${pd.cramp} ${pd.symps && pd.symps.length ? '｜ ' + pd.symps.join('、') : ''}
        </div>`;
    }

    if(dayRecs.length === 0) {
        html += `<div style="color:#888; font-size:14px; padding:8px 0;">當日無頭痛發作紀錄。點擊右上角按鈕可快速補登。</div>`;
    } else {
        dayRecs.forEach(r => {
            var timeOnly = r.time.slice(11, 16);
            var changeCount = (r.changes && r.changes.length) ? r.changes.length : 0;
            html += `<div class="record-card" style="margin-bottom:8px; padding:12px;" onclick="this.classList.toggle('expanded')">
                <div class="record-card-top">
                    <div style="font-weight:bold; color:var(--primary-color); font-size:16px;">🕒 ${timeOnly} 發作</div>
                    <div style="display:flex; gap:6px; white-space:nowrap;" onclick="event.stopPropagation();">
                        <button class="action-btn equal-action-btn" onclick="openChangeTab(${r.id})">⏱️ 變化</button>
                        <button class="action-btn equal-action-btn" onclick="editRecord(${r.id})">✏️ 編輯</button>
                    </div>
                </div>
                ${getRecordPainEvolutionHtml(r)}
                <div class="chips-container">
                    ${makeChipsHtml(r.locs, 'loc')}
                    ${makeChipsHtml(r.triggers, 'trig')}
                    ${makeChipsHtml(r.meds, 'med')}
                    ${r.effect ? `<span class="chip">${r.effect}</span>` : ''}
                </div>
                <div class="expand-hint">
                    <span>持續：${r.duration || '未確認'} ${changeCount > 0 ? `｜ ⏱️ 共 ${changeCount} 次轉移變化` : ''}</span>
                    <span class="expand-toggle-btn">
                        <span class="text-expand">▾ 點擊展開詳情</span>
                        <span class="text-collapse">▴ 收合詳情</span>
                    </span>
                </div>
                <div class="record-card-body" onclick="event.stopPropagation();">
                    ${buildRecordExpandedBodyHtml(r)}
                </div>
            </div>`;
        });
    }
    listEl.innerHTML = html;
};

window.setHistoryPainFilter = function(val, pillEl) {
    window.currentHistoryPainFilter = val;
    document.querySelectorAll('#history-pain-pills .filter-pill').forEach(el => el.classList.remove('active'));
    if(pillEl) pillEl.classList.add('active');
    window.renderHistory();
};

window.renderHistory = function() {
    var records = window.appLogic ? window.appLogic.getRecords() : [];
    var listDiv = document.getElementById('records-list');
    if(records.length === 0) { listDiv.innerHTML = "<p>尚無紀錄。</p>"; return; }

    var painFilter = window.currentHistoryPainFilter || 'all';
    var kw = document.getElementById('history-filter-keyword') ? document.getElementById('history-filter-keyword').value.trim().toLowerCase() : '';

    var filtered = records.filter(r => {
        var levels = [parseInt((r.pain||'').charAt(0)) || 1];
        if(r.changes) r.changes.forEach(c => levels.push(parseInt((c.pain||'').charAt(0))||1));
        var maxP = Math.max(...levels);
        if(painFilter !== 'all' && maxP !== parseInt(painFilter) && !levels.includes(parseInt(painFilter))) return false;
        if(kw) {
            var blob = `${r.locs||''} ${r.triggers||''} ${r.meds||''} ${r.symptoms||''} ${r.contexts||''} ${r.memo||''}`.toLowerCase();
            if(!blob.includes(kw)) return false;
        }
        return true;
    });

    if(filtered.length === 0) { listDiv.innerHTML = "<p style='color:#aaa;'>沒有符合篩選條件的紀錄。</p>"; return; }

    var html = '';
    filtered.forEach(r => {
        var dateStr = formatHistoryDate(r.time);
        var changeCount = (r.changes && r.changes.length) ? r.changes.length : 0;

        html += `<div class="record-card" id="record-card-${r.id}" onclick="this.classList.toggle('expanded')">
            <div class="record-card-top">
                <div class="record-time" style="font-size:16px; margin-bottom:0;">${dateStr}</div>
                <div style="white-space:nowrap;" onclick="event.stopPropagation();">
                    <span style="cursor:pointer; margin-right:12px; font-size:18px;" onclick="editRecord(${r.id})">✏️</span>
                    <span style="cursor:pointer; font-size:18px;" onclick="window.appLogic.deleteRecord(${r.id})">🗑️</span>
                </div>
            </div>
            ${getRecordPainEvolutionHtml(r)}
            <div class="chips-container">
                ${makeChipsHtml(r.locs, 'loc')}
                ${makeChipsHtml(r.triggers, 'trig')}
                ${makeChipsHtml(r.meds, 'med')}
                ${r.effect ? `<span class="chip">${r.effect}</span>` : ''}
            </div>
            <div class="expand-hint">
                <span>持續：${r.duration || '未確認'} ${changeCount > 0 ? `｜ ⏱️ 共 ${changeCount} 次轉移變化` : ''}</span>
                <span class="expand-toggle-btn">
                    <span class="text-expand">▾ 點擊展開詳情</span>
                    <span class="text-collapse">▴ 收合詳情</span>
                </span>
            </div>
            <div class="record-card-body" onclick="event.stopPropagation();">
                ${buildRecordExpandedBodyHtml(r)}
            </div>
        </div>`;
    });
    listDiv.innerHTML = html;

    if (window.lastEditedId) {
        setTimeout(() => {
            var targetCard = document.getElementById('record-card-' + window.lastEditedId);
            if (targetCard) {
                targetCard.classList.add('expanded');
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetCard.classList.add('highlight-card');
            }
            window.lastEditedId = null; 
        }, 100);
    }
};

// ==================== 生理期模組渲染 ====================
window.renderPeriodCalendar = function() {
    var grid = document.getElementById('period-grid');
    var monthYear = document.getElementById('period-month-year');
    var year = window.periodCalDate.getFullYear();
    var month = window.periodCalDate.getMonth();
    var todayStr = getTodayStr();
    if(!window.selectedPeriodDateStr) window.selectedPeriodDateStr = todayStr;

    var pAnalysis = analyzePeriodCycles();
    var bannerEl = document.getElementById('period-prediction-banner');
    if(bannerEl) {
        var statusHtml = '';
        if(pAnalysis.currentDayOfPeriod) {
            statusHtml = `<div style="color:#f48fb1; font-size:21px; font-weight:bold;">🩸 目前為生理期第 ${pAnalysis.currentDayOfPeriod} 天</div>
                          <div style="font-size:13px; color:#ccc; margin-top:4px;">預計下次經期：${pAnalysis.nextStart} (還有 ${pAnalysis.daysUntilNext} 天)</div>`;
        } else if(pAnalysis.nextStart) {
            var countdownBadge = '';
            if(pAnalysis.daysUntilNext > 0) {
                countdownBadge = `<span style="background:var(--period-bg-color); color:#fff; padding:3px 10px; border-radius:15px; font-size:15px; margin-left:8px;">還有 ${pAnalysis.daysUntilNext} 天</span>`;
            } else if(pAnalysis.daysUntilNext === 0) {
                countdownBadge = `<span style="background:#e53935; color:#fff; padding:3px 10px; border-radius:15px; font-size:15px; margin-left:8px;">預計今日來潮</span>`;
            } else {
                countdownBadge = `<span style="background:#ff9800; color:#121212; padding:3px 10px; border-radius:15px; font-size:14px; font-weight:bold; margin-left:8px;">已延遲 ${Math.abs(pAnalysis.daysUntilNext)} 天</span>`;
            }
            statusHtml = `<div style="color:#fff; font-size:18px; font-weight:bold; display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:4px;">
                            <span>預計下次經期：<span style="color:#f48fb1;">${pAnalysis.nextStart}</span></span>
                            ${countdownBadge}
                          </div>`;
        } else {
            statusHtml = `<div style="color:#aaa; font-size:15px;">尚無經期紀錄，請點擊下方「✏️ 點擊月曆快速圈選」開始紀錄</div>`;
        }

        bannerEl.innerHTML = `${statusHtml}
            <div style="font-size:13px; color:#aaa; margin-top:8px;">
                平均週期：<strong style="color:#eee;">${pAnalysis.avgCycle}</strong> 天 ｜ 平均行經：<strong style="color:#eee;">${pAnalysis.avgDuration}</strong> 天
            </div>`;
    }

    monthYear.innerText = year + ' 年 ' + (month + 1) + ' 月';
    var html = '';
    var days = ['日','一','二','三','四','五','六'];
    for(var d=0; d<7; d++) html += '<div class="cal-day-name">' + days[d] + '</div>';
    
    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    for(var i=0; i<firstDay; i++) html += '<div></div>';
    
    var periods = window.appLogic ? window.appLogic.getPeriods() : [];
    var pDetails = window.appLogic ? window.appLogic.getPeriodDetails() : {};

    for(var i=1; i<=daysInMonth; i++) {
        var dateStr = fmtDateStr(year, month, i);
        var isPeriod = periods.includes(dateStr);
        var isPred = !isPeriod && pAnalysis.predictedDates.includes(dateStr);
        var isOvu = !isPeriod && pAnalysis.ovulationDates.includes(dateStr);
        var isToday = (dateStr === todayStr);
        var isSelected = (dateStr === window.selectedPeriodDateStr);
        
        var cellClass = 'cal-cell';
        if(isPeriod) cellClass += ' period-filled';
        else if(isPred) cellClass += ' period-predicted';
        else if(isOvu) cellClass += ' ovulation-day';
        if(window.isPeriodGridEditMode) cellClass += ' editable-pulse';
        if(isSelected && !window.isPeriodGridEditMode) cellClass += ' selected-day';

        var dateNumHtml = (isToday && !isPeriod) ? `<div class="today-highlight">${i}</div>` : `<div>${i}</div>`;
        var subDot = (pDetails[dateStr] && pDetails[dateStr].cramp && pDetails[dateStr].cramp !== '無') ? `<div style="font-size:10px; line-height:1;">⚡</div>` : '';
        html += `<div class="${cellClass}" onclick="window.handlePeriodCellClick('${dateStr}')">${dateNumHtml}${subDot}</div>`;
    }
    grid.innerHTML = html;
    window.loadPeriodDayForm(window.selectedPeriodDateStr);
};

window.handlePeriodCellClick = function(dateStr) {
    window.selectedPeriodDateStr = dateStr;
    if(window.isPeriodGridEditMode) {
        var periods = window.appLogic.getPeriods();
        var idx = periods.indexOf(dateStr);
        if(idx > -1) {
            periods.splice(idx, 1);
            var pDetails = window.appLogic.getPeriodDetails();
            delete pDetails[dateStr];
        } else {
            periods.push(dateStr);
        }
    }
    window.renderPeriodCalendar();
};

window.loadPeriodDayForm = function(dateStr) {
    document.getElementById('period-selected-date-label').innerText = `🩸 ${dateStr} 經期狀態與症狀`;
    var periods = window.appLogic ? window.appLogic.getPeriods() : [];
    var pDetails = window.appLogic ? window.appLogic.getPeriodDetails() : {};
    var pp = window.appLogic ? window.appLogic.getPeriodPrefs() : {flows:[], cramps:[]};
    var isPeriod = periods.includes(dateStr);

    var emptyHint = document.getElementById('period-detail-empty-hint');
    var detailForm = document.getElementById('period-detail-form');

    if(isPeriod) {
        emptyHint.style.display = 'none';
        detailForm.style.display = 'block';
    } else {
        emptyHint.style.display = 'block';
        detailForm.style.display = 'none';
    }

    document.querySelectorAll('#period-detail-form input[type="radio"], #period-detail-form input[type="checkbox"]').forEach(e => e.checked = false);
    document.getElementById('p-memo').value = '';

    if(isPeriod && pDetails[dateStr]) {
        var d = pDetails[dateStr];
        if(d.flow) { var f = document.querySelector(`#period-detail-form input[name="p-flow"][value="${d.flow}"]`); if(f) f.checked = true; }
        if(d.cramp) { var c = document.querySelector(`#period-detail-form input[name="p-cramp"][value="${d.cramp}"]`); if(c) c.checked = true; }
        (d.colors||[]).forEach(v => { var cb = document.querySelector(`#period-detail-form .p-color[value="${v}"]`); if(cb) cb.checked = true; });
        (d.symps||[]).forEach(v => { var cb = document.querySelector(`#period-detail-form .p-symp[value="${v}"]`); if(cb) cb.checked = true; });
        document.getElementById('p-memo').value = d.memo || '';
    } else if(isPeriod) {
        var defFlowVal = (pp.flows && pp.flows.includes('中')) ? '中' : (pp.flows && pp.flows[0] ? pp.flows[0] : '');
        var defCrampVal = (pp.cramps && pp.cramps.includes('無')) ? '無' : (pp.cramps && pp.cramps[0] ? pp.cramps[0] : '');
        var defFlow = document.querySelector(`#period-detail-form input[name="p-flow"][value="${defFlowVal}"]`);
        var defCramp = document.querySelector(`#period-detail-form input[name="p-cramp"][value="${defCrampVal}"]`);
        if(defFlow) defFlow.checked = true;
        if(defCramp) defCramp.checked = true;
    }
};

window.renderPeriodHistoryList = function() {
    var pAnalysis = analyzePeriodCycles();
    var listEl = document.getElementById('period-cycles-list');
    if(pAnalysis.cycles.length === 0) {
        listEl.innerHTML = `<div class="section">尚無生理期週期紀錄。</div>`;
        return;
    }
    var html = '';
    [...pAnalysis.cycles].reverse().forEach((c) => {
        html += `<div class="record-card" style="cursor:default;">
            <div style="font-weight:bold; color:#f48fb1; font-size:16px;">🩸 ${c.start} ～ ${c.end}</div>
            <div style="font-size:14px; color:#ddd; margin-top:6px;">
                行經天數：<strong>${c.duration}</strong> 天 ｜ 週期長度：<strong>${c.cycleLen ? c.cycleLen + ' 天' : '最新週期進行中'}</strong>
            </div>
        </div>`;
    });
    listEl.innerHTML = html;
};

window.renderPeriodCharts = function() {
    var pAnalysis = analyzePeriodCycles();
    var ctx = document.getElementById('chartPeriodCycle');
    if(ctx) {
        if(chartInstances.periodCycle) chartInstances.periodCycle.destroy();
        var labels = pAnalysis.cycles.map(c => c.start.slice(5));
        var cycleData = pAnalysis.cycles.map(c => c.cycleLen || pAnalysis.avgCycle);
        var durData = pAnalysis.cycles.map(c => c.duration);
        chartInstances.periodCycle = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    { label: '週期總天數', data: cycleData, borderColor: '#f48fb1', backgroundColor: 'rgba(244,143,177,0.2)', tension: 0.3, yAxisID: 'y' },
                    { label: '行經天數', data: durData, borderColor: '#ab47bc', backgroundColor: 'rgba(171,71,188,0.2)', tension: 0.3, yAxisID: 'y1' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { type: 'linear', position: 'left', suggestedMin: 20, suggestedMax: 38, ticks: { color: '#ccc' } },
                    y1: { type: 'linear', position: 'right', suggestedMin: 1, suggestedMax: 10, grid: { drawOnChartArea: false }, ticks: { color: '#ccc' } },
                    x: { ticks: { color: '#ccc' } }
                },
                plugins: { legend: { labels: { color: '#ddd' } } }
            }
        });
    }

    var pDetails = window.appLogic ? window.appLogic.getPeriodDetails() : {};
    var sympCounts = {};
    Object.values(pDetails).forEach(d => {
        if(d.cramp && d.cramp !== '無') sympCounts['生理痛:' + d.cramp] = (sympCounts['生理痛:' + d.cramp]||0) + 1;
        (d.symps||[]).forEach(s => sympCounts[s] = (sympCounts[s]||0) + 1);
    });
    var sorted = Object.entries(sympCounts).sort((a,b)=>b[1]-a[1]);
    var maxVal = sorted.length ? sorted[0][1] : 0;
    document.getElementById('period-symp-bars').innerHTML = sorted.length ? sorted.map(s => makeBarHtml(s[0], s[1], maxVal, 'pain-4')).join('') : '<div style="color:#888;">尚無詳細伴隨症狀紀錄</div>';
};

// ==================== 模組 3：睡眠紀錄 (月曆、預覽、表單、歷史、圖表、設定) ====================
window.renderSleepDynamicButtons = function() {
    var sp = window.appLogic ? window.appLogic.getSleepPrefs() : {tags:[]};
    var el = document.getElementById('dynamic-sleep-tags');
    if(el) el.innerHTML = (sp.tags||[]).map(t => `<label><input type="checkbox" class="slp-tag" value="${t}"><div class="btn-check">${t}</div></label>`).join('');
};

window.renderSleepPrefsManager = function() {
    var container = document.getElementById('sleep-prefs-manager');
    if(!container || !window.appLogic) return;
    var items = window.appLogic.getSleepPrefs().tags || [];
    var tagsHtml = items.map((val, idx) => `
        <div class="pref-tag-item">
            <span>${val}</span>
            <span class="icon-btn" title="修改名稱" onclick="appLogic.editSleepPrefItem(${idx})">✏️</span>
            <span class="icon-btn" title="刪除選項" onclick="appLogic.deleteSleepPrefItem(${idx})">🗑️</span>
        </div>
    `).join('');

    container.innerHTML = `<div class="section">
        <div class="section-title">😴 睡眠干擾與輔助標籤選項</div>
        <div class="pref-tag-box">${tagsHtml || '<span style="color:#777; font-size:13px;">尚無選項</span>'}</div>
        <div style="display:flex; gap:8px;">
            <input type="text" id="new-spref-tags" placeholder="輸入要新增的睡眠標籤..." style="flex:1; padding:9px 12px;">
            <button class="action-btn" style="background:var(--primary-color); border:none; padding:0 16px; font-weight:bold; white-space:nowrap;" onclick="appLogic.addSleepPrefItem()">➕ 新增</button>
        </div>
    </div>`;
};

window.changeSleepMonth = function(offset) {
    window.sleepCalDate.setMonth(window.sleepCalDate.getMonth() + offset);
    window.renderSleepCalendar();
};

window.renderSleepCalendar = function() {
    var grid = document.getElementById('sleep-grid');
    var monthYear = document.getElementById('sleep-month-year');
    var year = window.sleepCalDate.getFullYear();
    var month = window.sleepCalDate.getMonth();
    var todayStr = getTodayStr();
    if(!window.selectedSleepDateStr) window.selectedSleepDateStr = todayStr;

    monthYear.innerText = year + ' 年 ' + (month + 1) + ' 月';
    var html = '';
    var days = ['日','一','二','三','四','五','六'];
    for(var d=0; d<7; d++) html += '<div class="cal-day-name">' + days[d] + '</div>';

    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    for(var i=0; i<firstDay; i++) html += '<div></div>';

    var sleepList = (window.appLogic && window.appLogic.getModules().sleep) ? window.appLogic.getModules().sleep : [];
    var dayMap = {};
    sleepList.forEach(s => { dayMap[s.date] = s; });

    for(var i=1; i<=daysInMonth; i++) {
        var dateStr = fmtDateStr(year, month, i);
        var isToday = (dateStr === todayStr);
        var isSelected = (dateStr === window.selectedSleepDateStr);
        var cellClass = 'cal-cell' + (isSelected ? ' selected-day' : '');
        var dateNumHtml = isToday ? `<div class="today-highlight">${i}</div>` : `<div style="margin-bottom:2px;">${i}</div>`;
        var dotHtml = '';
        if(dayMap[dateStr]) {
            var sc = dayMap[dateStr].score || 3;
            var dotColorClass = sc >= 4 ? 'pain-fill' : (sc === 3 ? 'pain-1' : 'pain-4');
            dotHtml = `<div class="dots-wrapper"><div class="cal-dot ${dotColorClass}"></div><span style="font-size:10px; color:#aaa;">${dayMap[dateStr].hours}h</span></div>`;
        }
        html += `<div class="${cellClass}" onclick="window.selectSleepDate('${dateStr}')">${dateNumHtml}${dotHtml}</div>`;
    }
    grid.innerHTML = html;
    window.renderSleepDatePreview(window.selectedSleepDateStr);
};

window.selectSleepDate = function(dateStr) {
    window.selectedSleepDateStr = dateStr;
    window.renderSleepCalendar();
};

function buildSleepCardHtml(item, isPreview) {
    var scoreColors = ['#e53935', '#f57c00', '#fbc02d', '#4f8bc9', '#4caf50'];
    var col = scoreColors[(item.score || 3) - 1] || '#4f8bc9';
    return `<div class="record-card" style="margin-bottom:8px; padding:12px;" onclick="this.classList.toggle('expanded')">
        <div class="record-card-top">
            <div style="font-weight:bold; color:var(--primary-color); font-size:16px;">📅 ${item.date} ｜ 睡眠 ${item.hours} 小時</div>
            <div style="display:flex; gap:6px; white-space:nowrap;" onclick="event.stopPropagation();">
                <button class="action-btn equal-action-btn" onclick="window.editSleepRecord(${item.id})">✏️ 編輯</button>
                ${!isPreview ? `<button class="action-btn" onclick="appLogic.deleteSleepRecord(${item.id})">🗑️</button>` : ''}
            </div>
        </div>
        <div style="margin-top:6px; font-size:14px; color:#ccc;">
            🕒 作息：${item.bed} 入睡 ～ ${item.wake} 起床 ｜ <strong style="color:${col};">品質 ${item.score} 分</strong>
        </div>
        <div class="chips-container">
            ${(item.tags||[]).map(t=>`<span class="chip loc">${t}</span>`).join('')}
        </div>
        <div class="expand-hint">
            <span>${item.memo ? '有填寫備註' : '點擊查看詳情'}</span>
            <span class="expand-toggle-btn">
                <span class="text-expand">▾ 點擊展開詳情</span>
                <span class="text-collapse">▴ 收合詳情</span>
            </span>
        </div>
        <div class="record-card-body" onclick="event.stopPropagation();">
            <div class="record-detail"><strong>入睡～起床：</strong>${item.bed} ～ ${item.wake} (共 ${item.hours} 小時)</div>
            <div class="record-detail"><strong>睡眠品質評分：</strong>${item.score} 分</div>
            ${item.tags && item.tags.length ? `<div class="record-detail"><strong>睡眠標籤：</strong>${item.tags.join('、')}</div>` : ''}
            ${item.memo ? `<div class="record-detail"><strong>備註：</strong>${item.memo}</div>` : ''}
            ${isPreview ? `<button class="action-btn" style="background:#444; margin-top:8px;" onclick="appLogic.deleteSleepRecord(${item.id})">🗑️ 刪除此筆睡眠紀錄</button>` : ''}
        </div>
    </div>`;
}

window.renderSleepDatePreview = function(dateStr) {
    document.getElementById('sleep-selected-date-title').innerText = `📅 ${dateStr} 睡眠紀錄`;
    var sleepList = (window.appLogic && window.appLogic.getModules().sleep) ? window.appLogic.getModules().sleep : [];
    var dayItems = sleepList.filter(x => x.date === dateStr);
    var addBtn = document.getElementById('btn-add-sleep-date');
    if(addBtn) addBtn.style.display = dayItems.length > 0 ? 'none' : 'inline-flex';

    var listEl = document.getElementById('sleep-selected-date-list');
    if(dayItems.length === 0) {
        listEl.innerHTML = `<div style="color:#888; font-size:14px; padding:8px 0;">當日無睡眠紀錄。點擊右上角按鈕可快速補登。</div>`;
    } else {
        listEl.innerHTML = dayItems.map(item => buildSleepCardHtml(item, true)).join('');
    }
};

window.startNewSleepRecord = function(useSelectedDate) {
    document.getElementById('sleep-edit-id').value = '';
    document.getElementById('sleep-form-title').innerText = '➕ 新增睡眠紀錄';
    document.getElementById('slp-date').value = useSelectedDate ? (window.selectedSleepDateStr || getTodayStr()) : getTodayStr();
    document.getElementById('slp-hours').value = '8';
    document.getElementById('slp-bed').value = '23:00';
    document.getElementById('slp-wake').value = '07:00';
    document.querySelectorAll('#sleep-sub-record input[type="checkbox"]').forEach(e => e.checked = false);
    var defScore = document.querySelector('#sleep-sub-record input[name="slp-score"][value="3"]');
    if(defScore) defScore.checked = true;
    document.getElementById('slp-memo').value = '';
    document.getElementById('custom-sleep-tag').value = '';

    document.getElementById('sleep-sub-dash').style.display = 'none';
    document.getElementById('sleep-sub-record').style.display = 'block';
    var fab = document.getElementById('fab-container');
    fab.style.display = 'flex';
    fab.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'auto' });
};

window.editSleepRecord = function(id) {
    var item = (window.appLogic.getModules().sleep || []).find(x => x.id == id);
    if(!item) return;
    document.getElementById('sleep-edit-id').value = item.id;
    document.getElementById('sleep-form-title').innerText = '✏️ 編輯睡眠紀錄';
    document.getElementById('slp-date').value = item.date;
    document.getElementById('slp-hours').value = item.hours;
    document.getElementById('slp-bed').value = item.bed || '23:00';
    document.getElementById('slp-wake').value = item.wake || '07:00';
    document.querySelectorAll('#sleep-sub-record input[type="checkbox"], #sleep-sub-record input[type="radio"]').forEach(e => e.checked = false);
    var scEl = document.querySelector(`#sleep-sub-record input[name="slp-score"][value="${item.score || 3}"]`);
    if(scEl) scEl.checked = true;
    (item.tags || []).forEach(t => {
        var cb = document.querySelector(`#sleep-sub-record .slp-tag[value="${t}"]`);
        if(cb) cb.checked = true;
    });
    document.getElementById('slp-memo').value = item.memo || '';

    document.getElementById('sleep-sub-dash').style.display = 'none';
    document.getElementById('sleep-sub-history').style.display = 'none';
    document.getElementById('sleep-sub-record').style.display = 'block';
    var fab = document.getElementById('fab-container');
    fab.style.display = 'flex';
    fab.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'auto' });
};

window.setSleepFilter = function(val, pillEl) {
    window.currentSleepFilter = val;
    document.querySelectorAll('#sleep-score-pills .filter-pill').forEach(el => el.classList.remove('active'));
    if(pillEl) pillEl.classList.add('active');
    window.renderSleepHistory();
};

window.renderSleepHistory = function() {
    var list = (window.appLogic.getModules().sleep || []);
    var el = document.getElementById('sleep-list');
    if(!list.length) { el.innerHTML = '<div style="color:#888;">尚無睡眠紀錄。</div>'; return; }

    var fVal = window.currentSleepFilter || 'all';
    var kw = (document.getElementById('sleep-filter-keyword').value || '').trim().toLowerCase();
    var filtered = list.filter(item => {
        if(fVal !== 'all' && String(item.score) !== fVal) return false;
        if(kw) {
            var blob = `${item.date} ${(item.tags||[]).join(' ')} ${item.memo||''}`.toLowerCase();
            if(!blob.includes(kw)) return false;
        }
        return true;
    });
    if(!filtered.length) { el.innerHTML = '<div style="color:#888;">沒有符合篩選條件的睡眠紀錄。</div>'; return; }
    el.innerHTML = filtered.map(item => buildSleepCardHtml(item, false)).join('');
};

window.renderSleepCharts = function() {
    var list = (window.appLogic.getModules().sleep || []);
    var ctx = document.getElementById('chartSleepModule');
    if(ctx) {
        if(chartInstances.sleepMod) chartInstances.sleepMod.destroy();
        var recent = [...list].slice(0, 14).reverse();
        chartInstances.sleepMod = new Chart(ctx, {
            type: 'line',
            data: {
                labels: recent.map(x => x.date.slice(5)),
                datasets: [
                    { label: '睡眠時數 (h)', data: recent.map(x => x.hours), borderColor: '#4f8bc9', tension: 0.3 },
                    { label: '睡眠品質 (1-5)', data: recent.map(x => x.score), borderColor: '#4caf50', borderDash: [4,4], tension: 0.3 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks:{color:'#ccc'} }, x: { ticks:{color:'#ccc'} } }, plugins:{legend:{labels:{color:'#ddd'}}} }
        });
    }

    var tagCounts = {};
    list.forEach(item => { (item.tags||[]).forEach(t => { tagCounts[t] = (tagCounts[t]||0) + 1; }); });
    var sorted = Object.entries(tagCounts).sort((a,b)=>b[1]-a[1]);
    var maxVal = sorted.length ? sorted[0][1] : 0;
    document.getElementById('sleep-tag-bars').innerHTML = sorted.length ? sorted.map(s => makeBarHtml(s[0], s[1], maxVal, 'pain-fill')).join('') : '<div style="color:#888;">尚無標籤統計資料</div>';
};

// ==================== 模組 4：身體異常情況紀錄 (月曆、預覽、表單、歷史、圖表、設定) ====================
window.renderAbnormalDynamicButtons = function() {
    var ap = window.appLogic ? window.appLogic.getAbnormalPrefs() : {cats:[], symps:[], treats:[]};
    var cEl = document.getElementById('dynamic-abn-cats');
    var sEl = document.getElementById('dynamic-abn-symps');
    var tEl = document.getElementById('dynamic-abn-treats');

    if(cEl) cEl.innerHTML = (ap.cats||[]).map(v => `<label><input type="checkbox" class="abn-cat" value="${v}"><div class="btn-check">${v}</div></label>`).join('');
    if(sEl) sEl.innerHTML = (ap.symps||[]).map(v => `<label><input type="checkbox" class="abn-symp" value="${v}"><div class="btn-check">${v}</div></label>`).join('');
    if(tEl) tEl.innerHTML = (ap.treats||[]).map(v => `<label><input type="checkbox" class="abn-treat" value="${v}"><div class="btn-check">${v}</div></label>`).join('');
};

window.renderAbnormalPrefsManager = function() {
    var container = document.getElementById('abnormal-prefs-manager');
    if(!container || !window.appLogic) return;
    var ap = window.appLogic.getAbnormalPrefs();
    var categories = [
        { key: 'cats', title: '🗂️ 異常類別選項' },
        { key: 'symps', title: '🩺 具體異常症狀選項' },
        { key: 'treats', title: '💊 處置方式與用藥保養選項' }
    ];

    container.innerHTML = categories.map(cat => {
        var items = ap[cat.key] || [];
        var tagsHtml = items.map((val, idx) => `
            <div class="pref-tag-item">
                <span>${val}</span>
                <span class="icon-btn" title="修改名稱" onclick="appLogic.editAbnormalPrefItem('${cat.key}', ${idx})">✏️</span>
                <span class="icon-btn" title="刪除選項" onclick="appLogic.deleteAbnormalPrefItem('${cat.key}', ${idx})">🗑️</span>
            </div>
        `).join('');

        return `<div class="section">
            <div class="section-title">${cat.title}</div>
            <div class="pref-tag-box">${tagsHtml || '<span style="color:#777; font-size:13px;">尚無選項</span>'}</div>
            <div style="display:flex; gap:8px;">
                <input type="text" id="new-apref-${cat.key}" placeholder="輸入要新增的選項名稱..." style="flex:1; padding:9px 12px;">
                <button class="action-btn" style="background:var(--primary-color); border:none; padding:0 16px; font-weight:bold; white-space:nowrap;" onclick="appLogic.addAbnormalPrefItem('${cat.key}')">➕ 新增</button>
            </div>
        </div>`;
    }).join('');
};

window.changeAbnormalMonth = function(offset) {
    window.abnormalCalDate.setMonth(window.abnormalCalDate.getMonth() + offset);
    window.renderAbnormalCalendar();
};

window.renderAbnormalCalendar = function() {
    var grid = document.getElementById('abnormal-grid');
    var monthYear = document.getElementById('abnormal-month-year');
    var year = window.abnormalCalDate.getFullYear();
    var month = window.abnormalCalDate.getMonth();
    var todayStr = getTodayStr();
    if(!window.selectedAbnormalDateStr) window.selectedAbnormalDateStr = todayStr;

    monthYear.innerText = year + ' 年 ' + (month + 1) + ' 月';
    var html = '';
    var days = ['日','一','二','三','四','五','六'];
    for(var d=0; d<7; d++) html += '<div class="cal-day-name">' + days[d] + '</div>';

    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    for(var i=0; i<firstDay; i++) html += '<div></div>';

    var abnList = (window.appLogic && window.appLogic.getModules().abnormal) ? window.appLogic.getModules().abnormal : [];
    var dayMap = {};
    abnList.forEach(item => {
        var dStr = (item.time || '').slice(0, 10);
        if(!dayMap[dStr]) dayMap[dStr] = [];
        dayMap[dStr].push(item);
    });

    for(var i=1; i<=daysInMonth; i++) {
        var dateStr = fmtDateStr(year, month, i);
        var isToday = (dateStr === todayStr);
        var isSelected = (dateStr === window.selectedAbnormalDateStr);
        var cellClass = 'cal-cell' + (isSelected ? ' selected-day' : '');
        var dateNumHtml = isToday ? `<div class="today-highlight">${i}</div>` : `<div style="margin-bottom:2px;">${i}</div>`;
        var dotHtml = '';
        if(dayMap[dateStr]) {
            dotHtml = '<div class="dots-wrapper">';
            dayMap[dateStr].forEach(it => {
                var lv = parseInt((it.level||'2').charAt(0)) || 2;
                var dotClass = lv === 1 ? 'pain-1' : (lv === 2 ? 'pain-2' : 'pain-4');
                dotHtml += `<div class="cal-dot ${dotClass}"></div>`;
                if(it.hasClinic) dotHtml += `<span style="font-size:9px; line-height:1;">🏥</span>`;
            });
            dotHtml += '</div>';
        }
        html += `<div class="${cellClass}" onclick="window.selectAbnormalDate('${dateStr}')">${dateNumHtml}${dotHtml}</div>`;
    }
    grid.innerHTML = html;
    window.renderAbnormalDatePreview(window.selectedAbnormalDateStr);
};

window.selectAbnormalDate = function(dateStr) {
    window.selectedAbnormalDateStr = dateStr;
    window.renderAbnormalCalendar();
};

function buildAbnormalCardHtml(item, isPreview) {
    var lv = parseInt((item.level||'2').charAt(0)) || 2;
    var lvColors = ['#fbc02d', '#ff9800', '#e53935'];
    var col = lvColors[lv - 1] || '#ff9800';
    var timeLabel = isPreview ? (item.time || '').slice(11, 16) : formatHistoryDate(item.time);

    return `<div class="record-card" style="margin-bottom:8px; padding:12px;" onclick="this.classList.toggle('expanded')">
        <div class="record-card-top">
            <div style="font-weight:bold; color:var(--primary-color); font-size:16px;">
                🕒 ${timeLabel} <span style="color:${col}; font-size:14px; margin-left:6px;">(${item.level})</span>
            </div>
            <div style="display:flex; gap:6px; white-space:nowrap;" onclick="event.stopPropagation();">
                <button class="action-btn equal-action-btn" onclick="window.editAbnormalRecord(${item.id})">✏️ 編輯</button>
                ${!isPreview ? `<button class="action-btn" onclick="appLogic.deleteAbnormalRecord(${item.id})">🗑️</button>` : ''}
            </div>
        </div>
        <div class="chips-container">
            ${item.hasClinic ? `<span class="chip period">🏥 就診: ${item.clinicDept || '未填科別'}</span>` : ''}
            ${(item.cats||[]).map(c=>`<span class="chip loc">${c}</span>`).join('')}
            ${(item.symps||[]).map(s=>`<span class="chip trig">${s}</span>`).join('')}
            ${(item.treats||[]).map(t=>`<span class="chip med">${t}</span>`).join('')}
        </div>
        <div class="expand-hint">
            <span>${item.hasClinic ? `🏥 就診日：${item.clinicDate || '當日'}` : '點擊查看完整內容'}</span>
            <span class="expand-toggle-btn">
                <span class="text-expand">▾ 點擊展開詳情</span>
                <span class="text-collapse">▴ 收合詳情</span>
            </span>
        </div>
        <div class="record-card-body" onclick="event.stopPropagation();">
            ${item.cats && item.cats.length ? `<div class="record-detail"><strong>異常類別：</strong>${item.cats.join('、')}</div>` : ''}
            ${item.symps && item.symps.length ? `<div class="record-detail"><strong>具體症狀：</strong>${item.symps.join('、')}</div>` : ''}
            ${item.treats && item.treats.length ? `<div class="record-detail"><strong>處置與用藥：</strong>${item.treats.join('、')}</div>` : ''}
            ${item.hasClinic ? `<div class="record-detail" style="color:#f48fb1;"><strong>🏥 就診資訊：</strong>${item.clinicDate || '未填日期'} ｜ 科別/院所：${item.clinicDept || '未填'}</div>` : `<div class="record-detail"><strong>是否就診：</strong>無</div>`}
            ${item.memo ? `<div class="record-detail"><strong>詳細備註：</strong>${item.memo}</div>` : ''}
            ${isPreview ? `<button class="action-btn" style="background:#444; margin-top:8px;" onclick="appLogic.deleteAbnormalRecord(${item.id})">🗑️ 刪除此筆異常紀錄</button>` : ''}
        </div>
    </div>`;
}

window.renderAbnormalDatePreview = function(dateStr) {
    document.getElementById('abnormal-selected-date-title').innerText = `📅 ${dateStr} 身體異常紀錄`;
    var abnList = (window.appLogic && window.appLogic.getModules().abnormal) ? window.appLogic.getModules().abnormal : [];
    var dayItems = abnList.filter(x => (x.time || '').startsWith(dateStr));
    var addBtn = document.getElementById('btn-add-abnormal-date');
    if(addBtn) addBtn.style.display = dayItems.length > 0 ? 'none' : 'inline-flex';

    var listEl = document.getElementById('abnormal-selected-date-list');
    if(dayItems.length === 0) {
        listEl.innerHTML = `<div style="color:#888; font-size:14px; padding:8px 0;">當日無身體異常紀錄。點擊右上角按鈕可快速補登。</div>`;
    } else {
        listEl.innerHTML = dayItems.map(item => buildAbnormalCardHtml(item, true)).join('');
    }
};

window.startNewAbnormalRecord = function(useSelectedDate) {
    document.getElementById('abnormal-edit-id').value = '';
    document.getElementById('abnormal-form-title').innerText = '➕ 新增身體異常紀錄';
    var baseDate = useSelectedDate ? (window.selectedAbnormalDateStr || getTodayStr()) : getTodayStr();
    var nowTime = new Date().toTimeString().slice(0,5);
    document.getElementById('abn-time').value = `${baseDate}T${nowTime}`;
    document.querySelectorAll('#abnormal-sub-record input[type="checkbox"]').forEach(e => e.checked = false);
    var defLv = document.querySelector('#abnormal-sub-record input[name="abn-level"][value="2分: 中度不適"]');
    if(defLv) defLv.checked = true;
    document.getElementById('abn-clinic-fields').style.display = 'none';
    document.getElementById('abn-clinic-date').value = baseDate;
    document.getElementById('abn-clinic-dept').value = '';
    document.getElementById('abn-memo').value = '';
    ['custom-abn-cat', 'custom-abn-symp', 'custom-abn-treat'].forEach(id => document.getElementById(id).value = '');

    document.getElementById('abnormal-sub-dash').style.display = 'none';
    document.getElementById('abnormal-sub-record').style.display = 'block';
    var fab = document.getElementById('fab-container');
    fab.style.display = 'flex';
    fab.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'auto' });
};

window.editAbnormalRecord = function(id) {
    var item = (window.appLogic.getModules().abnormal || []).find(x => x.id == id);
    if(!item) return;
    document.getElementById('abnormal-edit-id').value = item.id;
    document.getElementById('abnormal-form-title').innerText = '✏️ 編輯身體異常紀錄';
    document.getElementById('abn-time').value = item.time;
    document.querySelectorAll('#abnormal-sub-record input[type="checkbox"], #abnormal-sub-record input[type="radio"]').forEach(e => e.checked = false);

    var lvEl = document.querySelector(`#abnormal-sub-record input[name="abn-level"][value="${item.level}"]`);
    if(lvEl) lvEl.checked = true;
    (item.cats||[]).forEach(v => { var cb = document.querySelector(`#abnormal-sub-record .abn-cat[value="${v}"]`); if(cb) cb.checked = true; });
    (item.symps||[]).forEach(v => { var cb = document.querySelector(`#abnormal-sub-record .abn-symp[value="${v}"]`); if(cb) cb.checked = true; });
    (item.treats||[]).forEach(v => { var cb = document.querySelector(`#abnormal-sub-record .abn-treat[value="${v}"]`); if(cb) cb.checked = true; });

    document.getElementById('abn-clinic-toggle').checked = !!item.hasClinic;
    document.getElementById('abn-clinic-fields').style.display = item.hasClinic ? 'block' : 'none';
    document.getElementById('abn-clinic-date').value = item.clinicDate || (item.time || '').slice(0,10);
    document.getElementById('abn-clinic-dept').value = item.clinicDept || '';
    document.getElementById('abn-memo').value = item.memo || '';

    document.getElementById('abnormal-sub-dash').style.display = 'none';
    document.getElementById('abnormal-sub-history').style.display = 'none';
    document.getElementById('abnormal-sub-record').style.display = 'block';
    var fab = document.getElementById('fab-container');
    fab.style.display = 'flex';
    fab.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'auto' });
};

window.setAbnormalFilter = function(val, pillEl) {
    window.currentAbnormalFilter = val;
    document.querySelectorAll('#abnormal-level-pills .filter-pill').forEach(el => el.classList.remove('active'));
    if(pillEl) pillEl.classList.add('active');
    window.renderAbnormalHistory();
};

window.renderAbnormalHistory = function() {
    var list = (window.appLogic.getModules().abnormal || []);
    var el = document.getElementById('abnormal-list');
    if(!list.length) { el.innerHTML = '<div style="color:#888;">尚無身體異常紀錄。</div>'; return; }

    var fVal = window.currentAbnormalFilter || 'all';
    var kw = (document.getElementById('abnormal-filter-keyword').value || '').trim().toLowerCase();
    var filtered = list.filter(item => {
        if(fVal === 'clinic' && !item.hasClinic) return false;
        if(['1','2','3'].includes(fVal) && !(item.level||'').startsWith(fVal)) return false;
        if(kw) {
            var blob = `${(item.cats||[]).join(' ')} ${(item.symps||[]).join(' ')} ${(item.treats||[]).join(' ')} ${item.clinicDept||''} ${item.memo||''}`.toLowerCase();
            if(!blob.includes(kw)) return false;
        }
        return true;
    });
    if(!filtered.length) { el.innerHTML = '<div style="color:#888;">沒有符合篩選條件的異常紀錄。</div>'; return; }
    el.innerHTML = filtered.map(item => buildAbnormalCardHtml(item, false)).join('');
};

window.renderAbnormalCharts = function() {
    var list = (window.appLogic.getModules().abnormal || []);
    var catCounts = {}, sympCounts = {};
    list.forEach(item => {
        (item.cats||[]).forEach(c => { catCounts[c] = (catCounts[c]||0) + 1; });
        (item.symps||[]).forEach(s => { sympCounts[s] = (sympCounts[s]||0) + 1; });
    });

    var ctx = document.getElementById('chartAbnormalCats');
    if(ctx) {
        if(chartInstances.abnCats) chartInstances.abnCats.destroy();
        var cLabels = Object.keys(catCounts);
        chartInstances.abnCats = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: cLabels.length ? cLabels : ['尚無資料'],
                datasets: [{ label: '發生次數', data: cLabels.map(k => catCounts[k]), backgroundColor: '#4f8bc9' }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks:{color:'#ccc', stepSize: 1} }, x: { ticks:{color:'#ccc'} } }, plugins:{legend:{labels:{color:'#ddd'}}} }
        });
    }

    var sortedSymps = Object.entries(sympCounts).sort((a,b)=>b[1]-a[1]).slice(0, 8);
    var maxS = sortedSymps.length ? sortedSymps[0][1] : 0;
    document.getElementById('abnormal-symp-bars').innerHTML = sortedSymps.length ? sortedSymps.map(s => makeBarHtml(s[0], s[1], maxS, 'pain-2')).join('') : '<div style="color:#888;">尚無症狀統計資料</div>';
};

// ==================== 頭痛圖表分析 ====================
window.changeChartMonth = function(offset) {
    chartCalDate.setMonth(chartCalDate.getMonth() + offset);
    window.renderCharts();
};

window.changeChartYear = function(offset) {
    chartTrendYear += offset;
    window.renderCharts();
};

function makeBarHtml(label, count, maxCount, colorClass) {
    var pct = maxCount === 0 ? 0 : Math.round((count/maxCount)*100);
    return `<div style="display:flex; align-items:center; margin-bottom:10px; font-size:14px;">
        <div style="width:110px; text-align:right; margin-right:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${label}</div>
        <div style="flex-grow:1; background:#333; border-radius:4px; height:18px; overflow:hidden;">
            <div class="${colorClass}" style="width:${pct}%; height:100%;"></div>
        </div>
        <div style="width:30px; text-align:right; margin-left:10px;">${count}</div>
    </div>`;
}

window.renderCharts = function() {
    var records = window.appLogic ? window.appLogic.getRecords() : [];
    var periods = window.appLogic ? window.appLogic.getPeriods() : [];
    var modules = window.appLogic ? window.appLogic.getModules() : {};

    var yr = chartCalDate.getFullYear();
    var mo = chartCalDate.getMonth() + 1;
    var labelEl = document.getElementById('chart-month-label');
    if(labelEl) labelEl.innerText = `${yr} 年 ${mo} 月`;

    var daysInM = new Date(yr, mo, 0).getDate();
    var dailyLabels = [];
    var dailyPainData = [];
    var periodBgData = [];

    for(var d=1; d<=daysInM; d++) {
        var dStr = fmtDateStr(yr, mo-1, d);
        dailyLabels.push(d + '日');
        var dayRecs = records.filter(r => r.time && r.time.startsWith(dStr));
        var maxP = 0;
        dayRecs.forEach(r => {
            var p = parseInt((r.pain||'').charAt(0))||0;
            if(p > maxP) maxP = p;
            if(r.changes) r.changes.forEach(c => { var cp = parseInt((c.pain||'').charAt(0))||0; if(cp > maxP) maxP = cp; });
        });
        dailyPainData.push(maxP);
        periodBgData.push(periods.includes(dStr) ? 5 : 0);
    }

    var ctxDaily = document.getElementById('chartDailyPainPeriod');
    if(ctxDaily) {
        if(chartInstances.dailyPain) chartInstances.dailyPain.destroy();
        chartInstances.dailyPain = new Chart(ctxDaily, {
            type: 'bar',
            data: {
                labels: dailyLabels,
                datasets: [
                    { type: 'line', label: '當日最高痛覺 (Lv)', data: dailyPainData, borderColor: '#4f8bc9', backgroundColor: 'rgba(79,139,201,0.25)', borderWidth: 2, tension: 0.3, fill: true, order: 1 },
                    { type: 'bar', label: '生理期區間', data: periodBgData, backgroundColor: 'rgba(216, 27, 96, 0.28)', borderWidth: 0, barPercentage: 1.0, categoryPercentage: 1.0, order: 2 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { min: 0, max: 5, ticks: { stepSize: 1, color: '#ccc' } },
                    x: { ticks: { color: '#aaa', maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } }
                },
                plugins: { legend: { labels: { color: '#ddd' } } }
            }
        });
    }

    var yearLabelEl = document.getElementById('chart-year-label');
    if(yearLabelEl) yearLabelEl.innerText = `${chartTrendYear} 年`;

    var mLabels = [];
    var mCounts = [];
    var mAvgPains = [];
    for(var m=1; m<=12; m++) {
        var mPrefix = `${chartTrendYear}-${String(m).padStart(2,'0')}`;
        mLabels.push(m + '月');
        var mRecs = records.filter(r => r.time && r.time.startsWith(mPrefix));
        mCounts.push(mRecs.length);
        if(mRecs.length > 0) {
            var sumP = mRecs.reduce((acc, r) => {
                var mp = parseInt((r.pain||'').charAt(0))||1;
                if(r.changes) r.changes.forEach(c => { var cp = parseInt((c.pain||'').charAt(0))||1; if(cp>mp) mp=cp; });
                return acc + mp;
            }, 0);
            mAvgPains.push((sumP / mRecs.length).toFixed(1));
        } else {
            mAvgPains.push(0);
        }
    }
    var ctxMonthly = document.getElementById('chartMonthlyTrend');
    if(ctxMonthly) {
        if(chartInstances.monthlyTrend) chartInstances.monthlyTrend.destroy();
        chartInstances.monthlyTrend = new Chart(ctxMonthly, {
            type: 'line',
            data: {
                labels: mLabels,
                datasets: [
                    { label: '發作次數', data: mCounts, borderColor: '#4f8bc9', backgroundColor: '#4f8bc9', tension: 0.3, yAxisID: 'y' },
                    { label: '平均最高痛覺', data: mAvgPains, borderColor: '#ff9800', backgroundColor: '#ff9800', borderDash: [5,5], tension: 0.3, yAxisID: 'y1' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { type: 'linear', position: 'left', beginAtZero: true, ticks: { color: '#ccc' } },
                    y1: { type: 'linear', position: 'right', min: 0, max: 5, grid: { drawOnChartArea: false }, ticks: { color: '#ff9800' } },
                    x: { ticks: { color: '#ccc' } }
                },
                plugins: { legend: { labels: { color: '#ddd' } } }
            }
        });
    }

    var sleepBuckets = { '5h以下': {cnt:0, sumP:0}, '6h': {cnt:0, sumP:0}, '7h': {cnt:0, sumP:0}, '8h': {cnt:0, sumP:0}, '9h以上': {cnt:0, sumP:0} };
    var sleepMap = {};
    (modules.sleep || []).forEach(s => { sleepMap[s.date] = s.hours; });

    records.forEach(r => {
        var hrs = null;
        if(r.time) {
            var dStr = r.time.slice(0, 10);
            if(sleepMap[dStr] !== undefined) hrs = Math.round(sleepMap[dStr]);
        }
        if(hrs === null && r.sleep && r.sleep !== '未填寫') {
            hrs = parseInt(r.sleep);
        }
        if(hrs !== null && !isNaN(hrs)) {
            var key = hrs <= 5 ? '5h以下' : (hrs === 6 ? '6h' : (hrs === 7 ? '7h' : (hrs === 8 ? '8h' : '9h以上')));
            var mp = parseInt((r.pain||'').charAt(0))||1;
            if(r.changes) r.changes.forEach(c => { var cp = parseInt((c.pain||'').charAt(0))||1; if(cp>mp) mp=cp; });
            sleepBuckets[key].cnt++;
            sleepBuckets[key].sumP += mp;
        }
    });
    var sLabels = Object.keys(sleepBuckets);
    var sCounts = sLabels.map(k => sleepBuckets[k].cnt);
    var sAvgP = sLabels.map(k => sleepBuckets[k].cnt ? (sleepBuckets[k].sumP / sleepBuckets[k].cnt).toFixed(1) : 0);

    var ctxSleepCorr = document.getElementById('chartSleepHeadache');
    if(ctxSleepCorr) {
        if(chartInstances.sleepCorr) chartInstances.sleepCorr.destroy();
        chartInstances.sleepCorr = new Chart(ctxSleepCorr, {
            type: 'bar',
            data: {
                labels: sLabels,
                datasets: [
                    { type: 'bar', label: '頭痛發作次數', data: sCounts, backgroundColor: 'rgba(79,139,201,0.6)', yAxisID: 'y' },
                    { type: 'line', label: '平均最高痛覺', data: sAvgP, borderColor: '#e53935', backgroundColor: '#e53935', tension: 0.3, yAxisID: 'y1' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, position: 'left', ticks: { color: '#ccc' } },
                    y1: { min: 0, max: 5, position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#e53935' } },
                    x: { ticks: { color: '#ccc' } }
                },
                plugins: { legend: { labels: { color: '#ddd' } } }
            }
        });
    }

    var hydByDate = {};
    (modules.hydration || []).forEach(h => {
        if(!hydByDate[h.date]) hydByDate[h.date] = { ml: 0, caf: 0 };
        hydByDate[h.date].ml += (h.ml || 0);
        hydByDate[h.date].caf += (h.caf || 0);
    });
    var headacheDates = new Set(records.map(r => (r.time||'').slice(0,10)));
    var abnDates = new Set((modules.abnormal || []).map(g => (g.time||'').slice(0,10)));

    var grpStats = { headache: {d:0, ml:0, caf:0}, normal: {d:0, ml:0, caf:0}, abn: {d:0, ml:0, caf:0} };
    Object.keys(hydByDate).forEach(d => {
        if(headacheDates.has(d)) { grpStats.headache.d++; grpStats.headache.ml += hydByDate[d].ml; grpStats.headache.caf += hydByDate[d].caf; }
        else { grpStats.normal.d++; grpStats.normal.ml += hydByDate[d].ml; grpStats.normal.caf += hydByDate[d].caf; }
        if(abnDates.has(d)) { grpStats.abn.d++; grpStats.abn.ml += hydByDate[d].ml; grpStats.abn.caf += hydByDate[d].caf; }
    });

    var ctxHydCorr = document.getElementById('chartHydrationCorr');
    if(ctxHydCorr) {
        if(chartInstances.hydCorr) chartInstances.hydCorr.destroy();
        chartInstances.hydCorr = new Chart(ctxHydCorr, {
            type: 'bar',
            data: {
                labels: ['頭痛發作日', '無頭痛平日', '身體異常日'],
                datasets: [
                    { label: '平均飲水量 (百ml)', data: [
                        grpStats.headache.d ? Math.round(grpStats.headache.ml / grpStats.headache.d / 100) : 0,
                        grpStats.normal.d ? Math.round(grpStats.normal.ml / grpStats.normal.d / 100) : 0,
                        grpStats.abn.d ? Math.round(grpStats.abn.ml / grpStats.abn.d / 100) : 0
                    ], backgroundColor: '#4f8bc9' },
                    { label: '平均咖啡因 (十mg)', data: [
                        grpStats.headache.d ? Math.round(grpStats.headache.caf / grpStats.headache.d / 10) : 0,
                        grpStats.normal.d ? Math.round(grpStats.normal.caf / grpStats.normal.d / 10) : 0,
                        grpStats.abn.d ? Math.round(grpStats.abn.caf / grpStats.abn.d / 10) : 0
                    ], backgroundColor: '#ff9800' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, ticks: { color: '#ccc' } }, x: { ticks: { color: '#ccc' } } },
                plugins: { legend: { labels: { color: '#ddd' } } }
            }
        });
    }

    var locCategories = ['前額', '眼眶', '太陽穴', '側腦', '後上方', '後下方', '深部/腦內'];
    var leftCounts = [0,0,0,0,0,0,0];
    var rightCounts = [0,0,0,0,0,0,0];
    records.forEach(r => {
        var allLocs = (r.locs||'').split('、');
        if(r.changes) r.changes.forEach(c => { if(c.locs) allLocs.push(...c.locs.split('、')); });
        allLocs.forEach(l => {
            if(l === '深部/腦內') { leftCounts[6]++; rightCounts[6]++; }
            locCategories.slice(0,6).forEach((cat, idx) => {
                if(l === '左' + cat) leftCounts[idx]++;
                if(l === '右' + cat) rightCounts[idx]++;
            });
        });
    });

    var ctxRadar = document.getElementById('chartLocRadar');
    if(ctxRadar) {
        if(chartInstances.locRadar) chartInstances.locRadar.destroy();
        chartInstances.locRadar = new Chart(ctxRadar, {
            type: 'radar',
            data: {
                labels: locCategories,
                datasets: [
                    { label: '左側部位', data: leftCounts, borderColor: '#4f8bc9', backgroundColor: 'rgba(79,139,201,0.25)' },
                    { label: '右側部位', data: rightCounts, borderColor: '#f57c00', backgroundColor: 'rgba(245,124,0,0.25)' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { r: { angleLines: { color: '#444' }, grid: { color: '#333' }, pointLabels: { color: '#ddd', font: { size: 12 } }, ticks: { display: false } } },
                plugins: { legend: { labels: { color: '#ddd' } } }
            }
        });
    }

    var medStats = {};
    records.forEach(r => {
        if(r.meds) {
            r.meds.split('、').filter(Boolean).forEach(m => {
                if(!medStats[m]) medStats[m] = { '完全壓制':0, '稍微緩解':0, '無效':0 };
                if(r.effect && medStats[m][r.effect] !== undefined) medStats[m][r.effect]++;
            });
        }
        if(r.changes) r.changes.forEach(c => {
            if(c.meds) c.meds.split('、').filter(Boolean).forEach(m => {
                if(!medStats[m]) medStats[m] = { '完全壓制':0, '稍微緩解':0, '無效':0 };
                if(c.effect && medStats[m][c.effect] !== undefined) medStats[m][c.effect]++;
            });
        });
    });
    var medNames = Object.keys(medStats);
    var ctxMed = document.getElementById('chartMedEffect');
    if(ctxMed) {
        if(chartInstances.medEffect) chartInstances.medEffect.destroy();
        chartInstances.medEffect = new Chart(ctxMed, {
            type: 'bar',
            data: {
                labels: medNames.length ? medNames : ['尚無用藥數據'],
                datasets: [
                    { label: '完全壓制', data: medNames.map(m => medStats[m]['完全壓制']), backgroundColor: '#4caf50' },
                    { label: '稍微緩解', data: medNames.map(m => medStats[m]['稍微緩解']), backgroundColor: '#ff9800' },
                    { label: '無效', data: medNames.map(m => medStats[m]['無效']), backgroundColor: '#e53935' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { x: { stacked: true, ticks: { color: '#ccc' } }, y: { stacked: true, beginAtZero: true, ticks: { color: '#ccc' } } },
                plugins: { legend: { labels: { color: '#ddd' } } }
            }
        });
    }

    var container = document.getElementById('charts-container');
    if(records.length === 0) { container.innerHTML = ""; return; }
    var triggerCounts = {}, symptomCounts = {};
    records.forEach(r => {
        if(r.triggers) r.triggers.split('、').forEach(t => { if(t) triggerCounts[t] = (triggerCounts[t] || 0) + 1; });
        if(r.symptoms) r.symptoms.split('、').forEach(t => { if(t) symptomCounts[t] = (symptomCounts[t] || 0) + 1; });
    });
    var sortedTriggers = Object.entries(triggerCounts).sort((a,b)=>b[1]-a[1]).slice(0, 5);
    var maxT = sortedTriggers.length ? sortedTriggers[0][1] : 0;
    var sortedSymps = Object.entries(symptomCounts).sort((a,b)=>b[1]-a[1]).slice(0, 5);
    var maxS = sortedSymps.length ? sortedSymps[0][1] : 0;

    container.innerHTML = `
        <div class="section">
            <div class="section-title">⚡ 潛在誘因排行榜 (Top 5)</div>
            ${sortedTriggers.map(t => makeBarHtml(t[0], t[1], maxT, 'pain-fill')).join('') || '尚無紀錄'}
        </div>
        <div class="section">
            <div class="section-title">🤢 伴隨症狀排行榜 (Top 5)</div>
            ${sortedSymps.map(t => makeBarHtml(t[0], t[1], maxS, 'pain-fill')).join('') || '尚無紀錄'}
        </div>`;
};

// ==================== B 類模組畫面渲染 ====================
window.renderHydrationModule = function() {
    var list = (window.appLogic.getModules().hydration || []);
    var dateStr = document.getElementById('hyd-date').value || getTodayStr();
    var dayItems = list.filter(x => x.date === dateStr);
    var totalMl = dayItems.reduce((a,b)=>a + (b.ml||0), 0);
    var totalCaf = dayItems.reduce((a,b)=>a + (b.caf||0), 0);
    var pct = Math.min(100, Math.round((totalMl / 2000) * 100));

    document.getElementById('hyd-summary-box').innerHTML = `
        <div style="display:flex; justify-content:space-between; font-size:15px; margin-bottom:6px;">
            <span>💧 當日總水量：<strong style="color:#4f8bc9;">${totalMl} / 2000 ml</strong> (${pct}%)</span>
            <span>☕ 咖啡因：<strong style="color:${totalCaf > 300 ? '#e53935' : '#ffcc80'};">${totalCaf} mg</strong></span>
        </div>
        <div style="width:100%; height:10px; background:#333; border-radius:5px; overflow:hidden;">
            <div style="width:${pct}%; height:100%; background:#4f8bc9;"></div>
        </div>`;

    var el = document.getElementById('hydration-list');
    if(!dayItems.length) { el.innerHTML = '<div style="color:#888;">本日尚無飲水或咖啡紀錄。</div>'; return; }
    el.innerHTML = dayItems.map(item => `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #2c2c2c; font-size:14px;">
        <div>
            <span style="color:#888; margin-right:6px;">${item.time}</span>
            <strong>${item.name}</strong>
            <span class="chip loc" style="margin-left:6px;">${item.ml} ml</span>
            ${item.caf > 0 ? `<span class="chip trig">咖啡因 ${item.caf} mg</span>` : ''}
        </div>
        <span style="cursor:pointer;" onclick="appLogic.deleteModuleItem('hydration', ${item.id})">🗑️</span>
    </div>`).join('');
};

window.renderCoffeeModule = function() {
    var list = (window.appLogic.getModules().coffee || []);
    var el = document.getElementById('coffee-list');
    if(!list.length) { el.innerHTML = '<div style="color:#888;">尚無咖啡豆品鑑筆記。</div>'; return; }
    el.innerHTML = list.map(item => `<div class="record-card" style="cursor:default;">
        <div style="display:flex; justify-content:space-between;">
            <strong style="color:#ffcc80; font-size:16px;">☕ ${item.name}</strong>
            <span style="cursor:pointer;" onclick="appLogic.deleteModuleItem('coffee', ${item.id})">🗑️</span>
        </div>
        <div class="chips-container">
            <span class="chip">${item.roast}</span>
            <span class="chip loc">${item.method}</span>
            <span style="color:#fbc02d; font-size:14px;">${'⭐'.repeat(item.rating || 4)}</span>
        </div>
        ${item.memo ? `<div style="font-size:14px; color:#ddd; margin-top:6px;">${item.memo}</div>` : ''}
    </div>`).join('');
};

window.exportCSV = function() {
    var records = window.appLogic ? window.appLogic.getRecords() : [];
    if(records.length === 0) return window.showToast("無資料可匯出");
    var csvContent = "\uFEFF時間,痛覺評分,部位,持續時間,潛在誘因,疼痛方式,伴隨症狀,發作情境,用藥,藥效,備註,轉移軌跡\n";
    
    records.forEach(r => {
        var track = (r.changes && r.changes.length > 0) ? r.changes.map((c, i) => `[變化${i+1}] ${formatHistoryDate(c.time)} 痛:${parseInt(c.pain.charAt(0))||1} 部位:${c.locs||'無'}`).join(' / ') : '無';
        var row = [
            formatHistoryDate(r.time), parseInt(r.pain.charAt(0))||1, r.locs, r.duration||'', r.triggers, r.painTypes||'', r.symptoms||'', r.contexts||'', r.meds, r.effect, 
            (r.memo || '').replace(/,/g, "，").replace(/\n/g, " "), track
        ];
        csvContent += row.join(",") + "\n";
    });

    var link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `頭痛日記雲端報表_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
