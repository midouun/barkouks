import { Store } from './state.js';
import { UI } from './ui.js';
import { CROPS, GAME_CONFIG, LEVELS } from './config.js';

/* =========================================
   المحرك الرئيسي (MAIN ENGINE)
   ========================================= */

const App = {
    // --- 1. التشغيل (Bootstrap) ---
    async init() {
        console.log("🚀 جاري تشغيل المزرعة الملكية...");

        // 1. إعداد تليجرام
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
        
        // منع إغلاق التطبيق بالسحب للأسفل (مهم للاندرويد)
        tg.enableClosingConfirmation();

        // 2. تحميل البيانات
        Store.load();

        // 3. تحديث بيانات اللاعب من تليجرام (الاسم والصورة)
        const user = tg.initDataUnsafe.user;
        if (user) {
            // تحديث البيانات فقط إذا تغيرت
            if (Store.state.player.name !== user.first_name) {
                Store.commit('player.name', user.first_name);
            }
            // يمكن حفظ الصورة أيضاً إذا أردت
        }

        // 4. تشغيل الواجهة
        UI.init();

        // 5. ربط الأحداث (Event Listeners)
        this.bindEvents();

        // 6. بدء حلقة اللعبة
        this.startGameLoop();

        console.log("✅ اللعبة جاهزة!");
    },

    // --- 2. ربط الأحداث (Wiring) ---
    bindEvents() {
        // استقبال طلب الشراء من المتجر
        window.addEventListener('req-buy', (e) => {
            const cropId = e.detail;
            this.handleBuy(cropId);
        });

        // استقبال طلب الزراعة
        window.addEventListener('req-plant', (e) => {
            const { plotId, cropId } = e.detail;
            this.handlePlant(plotId, cropId);
        });

        // استقبال طلب الحصاد
        window.addEventListener('req-harvest', (e) => {
            const plotId = e.detail;
            this.handleHarvest(plotId);
        });

        // استقبال طلب البيع
        window.addEventListener('req-sell', (e) => {
            const cropId = e.detail;
            this.handleSell(cropId);
        });

        // استقبال حدث ترقية المستوى (للاحتفال)
        window.addEventListener('levelUp', (e) => {
            const { level, title } = e.detail;
            UI.showToast(`🎉 مبروك! وصلت للمستوى ${level}: ${title}`);
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            // هنا يمكن إضافة نافذة منبثقة للمكافأة
        });
    },

    // --- 3. منطق اللعبة (Business Logic) ---

    handleBuy(cropId) {
        const crop = CROPS[cropId];
        const player = Store.state.player;

        // التحقق من المستوى
        if (player.level < crop.levelReq) {
            UI.showToast(`تحتاج مستوى ${crop.levelReq} لفتح هذا!`, 'error');
            UI.haptic('error');
            return;
        }

        // التحقق من المال
        if (player.money >= crop.cost) {
            // خصم المال
            Store.addMoney(-crop.cost);
            // إضافة البذور
            if (!Store.state.inventory.seeds[cropId]) Store.state.inventory.seeds[cropId] = 0;
            Store.state.inventory.seeds[cropId]++;
            
            Store.save();
            Store.notify('inventory'); // تحديث الواجهة
            
            UI.showToast(`تم شراء بذور ${crop.name}`);
            UI.haptic('selection');
        } else {
            UI.showToast('ليس لديك مال كافٍ! 💸', 'error');
            UI.haptic('error');
        }
    },

    handlePlant(plotId, cropId) {
        // هل الأرض فارغة؟
        const plot = Store.state.farm.plots.find(p => p.id === plotId);
        if (plot.status !== 'empty') return;

        // هل لديه بذور؟
        if (Store.hasSeed(cropId)) {
            // استهلاك بذرة
            Store.useSeed(cropId);

            // تحديث الأرض
            plot.status = 'growing';
            plot.cropId = cropId;
            plot.plantTime = Date.now();
            plot.duration = CROPS[cropId].time;

            Store.save();
            Store.notify('farm'); // إعادة رسم المزرعة
            
            UI.showToast('تمت الزراعة 🌱');
            UI.haptic('light');
        } else {
            UI.showToast('نفذت البذور!', 'error');
        }
    },

    handleHarvest(plotId) {
        const plot = Store.state.farm.plots.find(p => p.id === plotId);
        
        // حماية إضافية: التأكد أنه جاهز فعلاً
        if (plot.status !== 'ready') return;

        const crop = CROPS[plot.cropId];

        // 1. إضافة المحصول للمخزون
        Store.addCrop(plot.cropId, 1);

        // 2. إضافة الخبرة (XP)
        Store.addXP(crop.xp);

        // 3. تنظيف الأرض
        plot.status = 'empty';
        plot.cropId = null;
        plot.plantTime = 0;
        plot.duration = 0;

        Store.save();
        Store.notify('farm');
        Store.notify('inventory'); // لتحديث زر البيع

        // تأثيرات بصرية
        UI.showToast(`+${crop.xp} خبرة ⭐`);
        UI.haptic('success');
        
        // البحث عن عنصر الأرض لإظهار النص العائم فوقه
        // (يمكن تحسين هذا بتمرير الإحداثيات من UI)
    },

    handleSell(cropId) {
        const count = Store.state.inventory.crops[cropId];
        if (count > 0) {
            const crop = CROPS[cropId];
            const total = count * crop.sell;

            // تصفير المحصول
            Store.state.inventory.crops[cropId] = 0;
            
            // إضافة المال
            Store.addMoney(total);
            
            Store.save();
            Store.notify('inventory');
            
            UI.showToast(`تم بيع ${crop.name} مقابل ${total} 💰`);
            UI.haptic('success');
        }
    },

    // --- 4. حلقة اللعبة (The Loop) ---
    startGameLoop() {
        // استخدام requestAnimationFrame لأداء أفضل من setInterval
        const loop = () => {
            this.updateCrops();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    },

    updateCrops() {
        const now = Date.now();
        let changed = false;

        Store.state.farm.plots.forEach(plot => {
            if (plot.status === 'growing') {
                const elapsed = now - plot.plantTime;
                
                // هل انتهى الوقت؟
                if (elapsed >= plot.duration) {
                    plot.status = 'ready';
                    changed = true;
                    // اهتزاز عند نضوج محصول (اختياري، قد يكون مزعجاً إذا كثر)
                    // UI.haptic('selection'); 
                }
            }
        });

        // إذا تغيرت حالة أي نبتة من growing إلى ready، نحفظ ونحدث الواجهة
        if (changed) {
            Store.save();
            Store.notify('farm');
        }

        // تحديث أشرطة التقدم (UI Animation)
        // هذا يحدث في كل فريم (سلس جداً)
        UI.updateProgressBars();
    }
};

// تشغيل التطبيق
App.init();

// تصدير للتجربة في الكونسول
window.GameApp = App;
