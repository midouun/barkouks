import { state, saveGame } from './state.js';
import { CROPS, GAME_CONFIG } from './config.js';
import { UI } from './ui.js';

export const Game = {
    // شراء البذور
    buySeed(type) {
        const cost = CROPS[type].cost;
        if (state.money >= cost) {
            state.money -= cost;
            state.seeds[type]++;
            UI.haptic('medium');
            saveGame();
            UI.updateHeader();
            UI.renderShop(Game.buySeed); // إعادة رسم لتحديث العداد
        } else {
            // تنبيه تليجرام
            window.Telegram.WebApp.showAlert("ما عندكش دراهم كافية!");
        }
    },

    // زراعة
    plant(plotIndex, cropType) {
        if (state.seeds[cropType] > 0) {
            state.seeds[cropType]--;
            state.plots[plotIndex].status = 'growing';
            state.plots[plotIndex].crop = cropType;
            state.plots[plotIndex].plantTime = Date.now();
            
            saveGame();
            UI.updateHeader();
            return true; // نجحت الزراعة
        }
        return false;
    },

    // حصاد
    harvest(plotIndex) {
        const plot = state.plots[plotIndex];
        if (plot.status === 'ready') {
            const crop = CROPS[plot.crop];
            state.crops[plot.crop]++;
            state.xp += 5;
            
            // تفريغ الأرض
            plot.status = 'empty';
            plot.crop = null;
            
            UI.haptic('success');
            saveGame();
            UI.updateHeader();
            return true;
        }
        return false;
    },
    
    // فحص النمو (يتم استدعاؤه كل ثانية)
    checkGrowth() {
        let changed = false;
        state.plots.forEach(plot => {
            if (plot.status === 'growing') {
                const crop = CROPS[plot.crop];
                if (Date.now() - plot.plantTime >= crop.time) {
                    plot.status = 'ready';
                    changed = true;
                }
            }
        });
        if (changed) {
            UI.haptic('selection'); // هزة خفيفة عند نضوج محصول
        }
        return changed; // هل نحتاج لإعادة الرسم؟
    }
};
