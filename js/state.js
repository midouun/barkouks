import { GAME_CONFIG, CROPS, LEVELS } from './config.js';

/* =========================================
   نظام إدارة الحالة المتقدم (STATE MANAGER)
   هذا النظام يستخدم نمط (Observer Pattern)
   لتحديث الواجهة تلقائياً عند تغيير البيانات.
   ========================================= */

// الحالة الافتراضية (Default State)
// هذه هي البنية التي نبدأ بها إذا لم يكن هناك حفظ سابق
const INITIAL_STATE = {
    // بيانات النظام
    meta: {
        version: GAME_CONFIG.version,
        lastLogin: Date.now(),
        startTimestamp: Date.now()
    },
    // بيانات اللاعب
    player: {
        name: 'مزارع جديد',
        money: GAME_CONFIG.startMoney,
        xp: GAME_CONFIG.startXP,
        level: GAME_CONFIG.startLevel,
        avatar: null
    },
    // المخزون (يتم توليده ديناميكياً من ملف Config)
    inventory: {
        seeds: {},  // سيتم ملؤها لاحقاً
        crops: {}   // سيتم ملؤها لاحقاً
    },
    // المزرعة
    farm: {
        plots: [], // سيتم إنشاؤها بناءً على العدد المسموح
        unlockedPlots: GAME_CONFIG.plotsCount // في البداية
    },
    // الحظيرة
    barn: {
        milk: 0,
        cows: 1,
        lastMilkTime: 0
    },
    // إعدادات المستخدم
    settings: {
        sound: true,
        music: true,
        vibration: true
    }
};

// تهيئة المخزون بناءً على المحاصيل الموجودة في Config
// هذا يضمن أن كل محصول جديد نضيفه يظهر تلقائياً في بيانات اللاعب
Object.keys(CROPS).forEach(cropKey => {
    INITIAL_STATE.inventory.seeds[cropKey] = 0; // 0 بذور
    INITIAL_STATE.inventory.crops[cropKey] = 0; // 0 محاصيل
});
// هدية البداية: 3 بذور قمح
if(INITIAL_STATE.inventory.seeds['wheat'] !== undefined) {
    INITIAL_STATE.inventory.seeds['wheat'] = 3;
}

// إنشاء الأراضي
for (let i = 0; i < GAME_CONFIG.plotsCount; i++) {
    INITIAL_STATE.farm.plots.push({
        id: i,
        status: 'empty', // empty, growing, ready
        cropId: null,
        plantTime: 0,
        duration: 0
    });
}

/* =========================================
   كلاس المتجر (THE STORE CLASS)
   ========================================= */
class GameStore {
    constructor() {
        this.state = JSON.parse(JSON.stringify(INITIAL_STATE)); // نسخة عميقة
        this.listeners = []; // قائمة المستمعين للتحديثات
        this.saveKey = 'RoyalFarm_SaveData_v3_Secure';
    }

    // --- 1. التحميل والحماية (Load & Security) ---

    load() {
        try {
            const encoded = localStorage.getItem(this.saveKey);
            if (encoded) {
                // فك التشفير (Base64) لمنع التعديل البسيط
                const json = atob(encoded);
                const savedState = JSON.parse(json);

                // دمج ذكي: نأخذ الحفظ القديم وندمجه مع الهيكل الجديد
                // هذا يمنع الأخطاء عند تحديث اللعبة وإضافة مميزات جديدة
                this.state = this._deepMerge(this.state, savedState);
                
                // معالجة الوقت الضائع (Offline Calculation)
                this._processOfflineProgress();
                
                console.log("✅ تم تحميل البيانات بنجاح.");
            } else {
                console.log("🆕 لاعب جديد، جاري إنشاء البيانات...");
            }
        } catch (e) {
            console.error("❌ خطأ في تحميل البيانات (قد يكون الملف تالفاً):", e);
            // في حالة التلف، نعود للبداية (يمكن إضافة نظام نسخ احتياطي هنا)
        }
        
        // تحديث وقت الدخول
        this.state.meta.lastLogin = Date.now();
        this.notifyAll(); // تحديث الواجهة فوراً
    }

    save() {
        this.state.meta.lastLogin = Date.now();
        // تحويل لـ JSON ثم تشفير Base64
        const json = JSON.stringify(this.state);
        const encoded = btoa(json);
        localStorage.setItem(this.saveKey, encoded);
        // console.log("💾 تم الحفظ.");
    }

    reset() {
        if(confirm("هل أنت متأكد من حذف المزرعة والبدء من جديد؟")) {
            localStorage.removeItem(this.saveKey);
            location.reload();
        }
    }

    // --- 2. التعديل والتفاعل (Actions & Mutations) ---

    // دالة لتغيير أي قيمة في الحالة وإبلاغ الواجهة
    commit(key, value) {
        // دعم المسارات المتداخلة مثل 'player.money'
        const keys = key.split('.');
        let current = this.state;
        
        for (let i = 0; i < keys.length - 1; i++) {
            current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;

        this.save(); // حفظ تلقائي عند كل تغيير مهم
        this.notify(keys[0]); // إبلاغ الجزء المختص فقط (تحسين للأداء)
    }

    // إضافة مال
    addMoney(amount) {
        this.state.player.money += amount;
        this.checkLevelUp(); // فحص إذا كان المال شرطاً للمستوى (اختياري)
        this.commit('player.money', this.state.player.money);
    }

    // إضافة خبرة (مع فحص ترقية المستوى)
    addXP(amount) {
        this.state.player.xp += amount;
        this.checkLevelUp();
        this.commit('player.xp', this.state.player.xp);
    }

    // منطق ترقية المستوى
    checkLevelUp() {
        const currentLevel = this.state.player.level;
        const nextLevelData = LEVELS[currentLevel + 1];
        
        if (nextLevelData && this.state.player.xp >= nextLevelData.xp) {
            this.state.player.level++;
            // إطلاق حدث خاص للاحتفال (يمكن التقاطه في UI)
            window.dispatchEvent(new CustomEvent('levelUp', { 
                detail: { level: this.state.player.level, title: nextLevelData.title } 
            }));
            this.save();
        }
    }

    // عمليات المخزون
    hasSeed(cropId) {
        return (this.state.inventory.seeds[cropId] || 0) > 0;
    }

    useSeed(cropId) {
        if (this.hasSeed(cropId)) {
            this.state.inventory.seeds[cropId]--;
            this.save();
            this.notify('inventory');
            return true;
        }
        return false;
    }

    addCrop(cropId, amount = 1) {
        if (!this.state.inventory.crops[cropId]) this.state.inventory.crops[cropId] = 0;
        this.state.inventory.crops[cropId] += amount;
        this.save();
        this.notify('inventory');
    }

    // --- 3. النظام التفاعلي (Observer System) ---

    // الاشتراك في التحديثات
    subscribe(callback) {
        this.listeners.push(callback);
    }

    // إبلاغ المستمعين
    notify(section) {
        this.listeners.forEach(callback => callback(this.state, section));
    }
    
    notifyAll() {
        this.listeners.forEach(callback => callback(this.state, 'ALL'));
    }

    // --- 4. وظائف داخلية مساعدة (Helpers) ---

    // دالة لحساب نمو النباتات أثناء غياب اللاعب
    _processOfflineProgress() {
        const now = Date.now();
        let changes = 0;

        this.state.farm.plots.forEach(plot => {
            if (plot.status === 'growing') {
                const timePassed = now - plot.plantTime;
                // إذا مر وقت كافٍ، اجعلها جاهزة فوراً
                if (timePassed >= plot.duration) {
                    plot.status = 'ready';
                    changes++;
                }
            }
        });

        if (changes > 0) {
            console.log(`🌱 تم تحديث ${changes} قطع أرض أثناء الغياب.`);
            this.save();
        }
    }

    // دمج الكائنات (Deep Merge) للحفاظ على البيانات القديمة مع الهيكل الجديد
    _deepMerge(target, source) {
        for (const key in source) {
            if (source[key] instanceof Object && key in target) {
                Object.assign(source[key], this._deepMerge(target[key], source[key]));
            }
        }
        Object.assign(target || {}, source);
        return target;
    }
}

// تصدير نسخة واحدة (Singleton) لتستخدمها كل الملفات
export const Store = new GameStore();
