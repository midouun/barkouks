import { Store } from './state.js';
import { CROPS, LEVELS, getLevelProgress } from './config.js';

/* =========================================
   مكتبة واجهة المستخدم (UI LIBRARY)
   ========================================= */

// تخزين عناصر DOM للوصول السريع (Caching)
const $ = {
    header: {
        money: document.getElementById('money'),
        xp: document.getElementById('xp'),
        level: document.getElementById('level-badge'), // سنضيفه للهيدر لاحقاً
        name: document.getElementById('u_name'),
        photo: document.getElementById('u_photo')
    },
    farm: document.getElementById('farmGrid'),
    panels: {
        shop: document.getElementById('tab-shop'),
        inventory: document.getElementById('tab-inventory'),
        container: document.querySelector('.slide-panel')
    },
    modals: {
        seed: document.getElementById('seedModal'),
        seedList: document.getElementById('seedList')
    },
    barn: {
        milk: document.getElementById('milk_storage'),
        cow: document.querySelector('.cow-interactive')
    }
};

export const UI = {
    // --- 1. التهيئة (Initialization) ---
    init() {
        // الاشتراك في تحديثات البيانات
        Store.subscribe((state, section) => {
            if (section === 'ALL' || section === 'player') this.renderHeader();
            if (section === 'ALL' || section === 'farm') this.renderGrid();
            if (section === 'ALL' || section === 'inventory') this.renderInventory();
            if (section === 'ALL' || section === 'barn') this.updateBarn();
        });

        // إعداد التبويبات السفلية
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = btn.dataset.target;
                this.togglePanel(target);
                
                // تحديث الأزرار النشطة
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // إغلاق المودال عند الضغط خارجه
        $.modals.seed.addEventListener('click', (e) => {
            if (e.target === $.modals.seed) this.closeModal();
        });
    },

    // --- 2. رسم الهيدر (Header) ---
    renderHeader() {
        const p = Store.state.player;
        $.header.money.innerText = Math.floor(p.money);
        
        // عرض المستوى
        const lvlInfo = LEVELS[p.level] || { title: 'Max' };
        // يمكنك إضافة شريط تقدم هنا مستقبلاً
    },

    updateBarn() {
        $.barn.milk.innerText = Store.state.barn.milk.toFixed(1);
    },

    // --- 3. رسم المزرعة (The Farm Grid) ---
    renderGrid() {
        const plots = Store.state.farm.plots;
        $.farm.innerHTML = '';

        plots.forEach(plot => {
            const el = document.createElement('div');
            el.className = 'plot-container';
            
            // تحديد حالة الأرض
            let content = '';
            let classes = 'plot-soil';
            
            // 1. أرض مقفلة
            if (plot.status === 'locked') {
                classes += ' locked';
                content = `<div style="opacity:0.5; font-size:24px">🔒</div>`;
            } 
            // 2. أرض فارغة
            else if (plot.status === 'empty') {
                content = `<div style="opacity:0.3; font-size:30px">🌱</div>`;
                el.onclick = () => this.openSeedModal(plot.id);
            } 
            // 3. نبات ينمو
            else if (plot.status === 'growing') {
                classes += ' watered'; // الأرض مسقية
                const crop = CROPS[plot.cropId];
                content = `
                    <div class="crop-sprite">${crop.icon}</div>
                    <div class="growth-indicator visible">
                        <div class="growth-fill" style="width: 0%" id="prog-${plot.id}"></div>
                    </div>
                `;
            } 
            // 4. جاهز للحصاد
            else if (plot.status === 'ready') {
                el.classList.add('ready-to-harvest');
                const crop = CROPS[plot.cropId];
                content = `<div class="crop-sprite">${crop.icon}</div>`;
                // ربط حدث الحصاد (سيتم تمريره من Main)
                el.onclick = () => window.dispatchEvent(new CustomEvent('req-harvest', { detail: plot.id }));
            }

            el.innerHTML = `<div class="${classes}">${content}</div>`;
            $.farm.appendChild(el);
        });
        
        // تحديث فوري لأشرطة التقدم بعد الرسم
        this.updateProgressBars();
    },

    // --- 4. تحديث أشرطة النمو (Animation Loop) ---
    // هذه الدالة ستستدعى كل ثانية من Main.js
    updateProgressBars() {
        const now = Date.now();
        Store.state.farm.plots.forEach(plot => {
            if (plot.status === 'growing') {
                const bar = document.getElementById(`prog-${plot.id}`);
                if (bar) {
                    const elapsed = now - plot.plantTime;
                    const percent = Math.min((elapsed / plot.duration) * 100, 100);
                    bar.style.width = `${percent}%`;
                }
            }
        });
    },

    // --- 5. القوائم والنوافذ (Panels & Modals) ---
    
    togglePanel(type) {
        const panel = $.panels.container;
        const shopContent = $.panels.shop;
        const invContent = $.panels.inventory;

        // إفراغ المحتوى القديم
        shopContent.style.display = 'none';
        invContent.style.display = 'none';

        if (type === 'shop') {
            this.renderShop();
            shopContent.style.display = 'block';
            panel.classList.add('open');
        } else if (type === 'inventory') {
            this.renderInventory();
            invContent.style.display = 'block';
            panel.classList.add('open');
        } else {
            panel.classList.remove('open');
        }
    },

    renderShop() {
        const container = $.panels.shop;
        container.innerHTML = '<h3 class="section-header">متجر البذور</h3>';
        
        const playerLevel = Store.state.player.level;

        Object.values(CROPS).forEach(crop => {
            const isLocked = playerLevel < crop.levelReq;
            const btnClass = isLocked ? 'btn-disabled' : 'btn-action';
            const btnText = isLocked ? `مستوى ${crop.levelReq}` : `${crop.cost} 💰`;

            const item = document.createElement('div');
            item.className = 'item-card';
            item.innerHTML = `
                <div class="item-icon-box">${crop.icon}</div>
                <div class="item-details">
                    <div class="item-name">${crop.name}</div>
                    <div class="item-desc">تستغرق: ${crop.time/1000}ث | ${crop.description}</div>
                </div>
                <button class="${btnClass}" ${isLocked ? 'disabled' : ''} 
                    onclick="window.dispatchEvent(new CustomEvent('req-buy', {detail: '${crop.id}'}))">
                    ${btnText}
                </button>
            `;
            container.appendChild(item);
        });
    },

    renderInventory() {
        const container = $.panels.inventory;
        container.innerHTML = '<h3 class="section-header">المخزون والحصاد</h3>';
        const crops = Store.state.inventory.crops;
        let isEmpty = true;

        Object.keys(crops).forEach(key => {
            const count = crops[key];
            if (count > 0) {
                isEmpty = false;
                const crop = CROPS[key];
                const item = document.createElement('div');
                item.className = 'item-card';
                item.innerHTML = `
                    <div class="item-icon-box">${crop.icon}</div>
                    <div class="item-details">
                        <div class="item-name">${crop.name} (x${count})</div>
                        <div class="item-desc">سعر البيع: ${crop.sell} 💰</div>
                    </div>
                    <button class="btn-action sell" 
                        onclick="window.dispatchEvent(new CustomEvent('req-sell', {detail: '${key}'}))">
                        بيع الكل
                    </button>
                `;
                container.appendChild(item);
            }
        });

        if (isEmpty) {
            container.innerHTML += '<div style="text-align:center; color:#999; margin-top:20px;">المخزون فارغ 🎒</div>';
        }
    },

    openSeedModal(plotId) {
        const list = $.modals.seedList;
        list.innerHTML = '';
        const seeds = Store.state.inventory.seeds;
        let hasSeeds = false;

        Object.keys(seeds).forEach(key => {
            if (seeds[key] > 0) {
                hasSeeds = true;
                const crop = CROPS[key];
                const el = document.createElement('div');
                el.className = 'seed-option';
                el.innerHTML = `<div style="font-size:30px">${crop.icon}</div><div>${crop.name}</div><div style="font-size:12px">x${seeds[key]}</div>`;
                el.onclick = () => {
                    window.dispatchEvent(new CustomEvent('req-plant', { detail: { plotId, cropId: key } }));
                    this.closeModal();
                };
                list.appendChild(el);
            }
        });

        if (!hasSeeds) {
            list.innerHTML = '<p>لا توجد لديك بذور! <br>اذهب للمتجر لشراء البعض.</p>';
        }

        $.modals.seed.classList.add('active');
    },

    closeModal() {
        $.modals.seed.classList.remove('active');
    },

    // --- 6. المؤثرات (Effects) ---
    
    showToast(message, type = 'success') {
        // إنشاء عنصر التنبيه ديناميكياً
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: ${type === 'error' ? '#e53935' : '#2e7d32'};
            color: white; padding: 10px 20px; border-radius: 20px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3); z-index: 1000;
            font-weight: bold; animation: fadeIn 0.3s;
        `;
        toast.innerText = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    },

    showFloatingText(x, y, text) {
        const el = document.createElement('div');
        el.className = 'floating-text';
        el.innerText = text;
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1000);
    },

    haptic(style = 'light') {
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred(style);
        }
    }
};
