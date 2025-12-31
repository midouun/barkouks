import { state } from './state.js';
import { CROPS } from './config.js';

// عناصر DOM
const els = {
    money: document.getElementById('money'),
    xp: document.getElementById('xp'),
    milk: document.getElementById('milk_storage'),
    grid: document.getElementById('farmGrid'),
    shop: document.getElementById('tab-shop'),
    inv: document.getElementById('tab-inventory')
};

export const UI = {
    updateHeader() {
        els.money.innerText = Math.floor(state.money);
        els.xp.innerText = state.xp;
        els.milk.innerText = state.milk.toFixed(1);
    },

    renderPlots(onPlotClick) {
        els.grid.innerHTML = '';
        state.plots.forEach((plot, index) => {
            const el = document.createElement('div');
            el.className = `plot ${plot.status}`;
            
            if (plot.status === 'empty') {
                el.innerHTML = '🌱';
                el.onclick = () => onPlotClick(index, 'plant');
            } else if (plot.status === 'growing') {
                const crop = CROPS[plot.crop];
                // حساب نسبة النمو
                const passed = Date.now() - plot.plantTime;
                const percent = Math.min((passed / crop.time) * 100, 100);
                
                el.innerHTML = `
                    <div style="font-size:30px; opacity:${0.5 + percent/200}">${crop.icon}</div>
                    <div class="bar"><div class="fill" style="width:${percent}%"></div></div>
                `;
            } else if (plot.status === 'ready') {
                el.classList.add('ready-anim');
                el.innerHTML = `IT'S READY! <br> ${CROPS[plot.crop].icon}`;
                el.onclick = () => onPlotClick(index, 'harvest');
            }
            els.grid.appendChild(el);
        });
    },

    renderShop(onBuy) {
        els.shop.innerHTML = '';
        for (let [key, data] of Object.entries(CROPS)) {
            const div = document.createElement('div');
            div.className = 'item-row';
            div.innerHTML = `
                <span>${data.icon} ${data.name} (لديك: ${state.seeds[key]})</span>
                <button class="btn" onclick="this.dispatchEvent(new CustomEvent('buy', {detail: '${key}', bubbles: true}))">شراء ${data.cost}💰</button>
            `;
            // طريقة للربط بدون مشاكل النطاق
            div.addEventListener('buy', (e) => onBuy(e.detail));
            els.shop.appendChild(div);
        }
    },
    
    // دالة مساعدة للاهتزاز
    haptic(type = 'light') {
        if(window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred(type);
        }
    }
};
