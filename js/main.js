import { loadGame, saveGame, state } from './state.js';
import { UI } from './ui.js';
import { Game } from './game.js';
import { CROPS } from './config.js';

// تهيئة تليجرام
const tg = window.Telegram.WebApp;
tg.expand();

// بدء اللعبة
function init() {
    loadGame();
    
    // إعداد واجهة المستخدم
    const user = tg.initDataUnsafe.user;
    if(user) {
        document.getElementById('u_name').innerText = user.first_name;
        if(user.photo_url) document.getElementById('u_photo').src = user.photo_url;
    }

    // رسم مبدئي
    UI.updateHeader();
    UI.renderShop((type) => Game.buySeed(type));
    refreshGrid();

    // حلقة اللعبة (Game Loop)
    setInterval(() => {
        const needUpdate = Game.checkGrowth();
        // نقوم بإعادة الرسم دائماً لتحديث شريط التقدم
        refreshGrid(); 
    }, 1000);
}

// دالة تحديث الشبكة والتعامل مع الضغط
function refreshGrid() {
    UI.renderPlots((index, action) => {
        if (action === 'harvest') {
            Game.harvest(index);
        } else if (action === 'plant') {
            openSeedModal(index);
        }
    });
}

// نافذة اختيار البذور
const modal = document.getElementById('seedModal');
const seedList = document.getElementById('seedList');

function openSeedModal(plotIndex) {
    seedList.innerHTML = '';
    let hasSeeds = false;
    
    for (let [key, count] of Object.entries(state.seeds)) {
        if (count > 0) {
            hasSeeds = true;
            const btn = document.createElement('div');
            btn.className = 'seed-item';
            btn.innerHTML = `${CROPS[key].icon} ${CROPS[key].name} (x${count})`;
            btn.onclick = () => {
                Game.plant(plotIndex, key);
                modal.style.display = 'none';
                refreshGrid();
            };
            seedList.appendChild(btn);
        }
    }
    
    if(!hasSeeds) seedList.innerHTML = "ما عندكش بذور، روح للمتجر!";
    modal.style.display = 'flex';
}

document.getElementById('closeModal').onclick = () => modal.style.display = 'none';

// تشغيل
init();
