/**
 * 极简记账 - 核心交互逻辑
 * 纯前端实现，数据存储在 localStorage
 */

// ========================================
// 数据存储管理
// ========================================
const Storage = {
    KEY: 'simple记账_records',
    SETTINGS_KEY: 'simple记账_settings',

    // 获取所有记录
    getRecords() {
        const data = localStorage.getItem(this.KEY);
        return data ? JSON.parse(data) : [];
    },

    // 保存记录
    saveRecords(records) {
        localStorage.setItem(this.KEY, JSON.stringify(records));
    },

    // 添加记录
    addRecord(record) {
        const records = this.getRecords();
        records.unshift(record);
        this.saveRecords(records);
        return record;
    },

    // 删除记录
    deleteRecord(id) {
        const records = this.getRecords();
        const filtered = records.filter(r => r.id !== id);
        this.saveRecords(filtered);
    },

    // 清空所有数据
    clearAll() {
        localStorage.removeItem(this.KEY);
    },

    // 获取设置
    getSettings() {
        const data = localStorage.getItem(this.SETTINGS_KEY);
        return data ? JSON.parse(data) : { currency: '¥', darkMode: false };
    },

    // 保存设置
    saveSettings(settings) {
        localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
    }
};

// ========================================
// 分类配置
// ========================================
const Categories = {
    expense: ['餐饮', '交通', '购物', '娱乐', '日用品', '医疗', '其他'],
    income: ['工资', '红包', '兼职', '理财', '其他']
};

// ========================================
// 工具函数
// ========================================
const Utils = {
    // 生成唯一ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // 格式化金额
    formatAmount(amount, currency = '¥') {
        return `${currency}${parseFloat(amount).toFixed(2)}`;
    },

    // 格式化日期
    formatDate(dateStr) {
        const date = new Date(dateStr);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const monthNames = ['', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        return { month: monthNames[month], day, full: `${month}月${day}日` };
    },

    // 获取今天的日期字符串
    getTodayString() {
        return new Date().toISOString().split('T')[0];
    },

    // 获取当前年月
    getCurrentMonth() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    },

    // 判断是否今天
    isToday(dateStr) {
        return dateStr === this.getTodayString();
    },

    // 判断是否本月
    isThisMonth(dateStr) {
        return dateStr.startsWith(this.getCurrentMonth());
    },

    // 防抖函数
    debounce(fn, delay) {
        let timer = null;
        return function (...args) {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }
};

// ========================================
// 应用主类
// ========================================
class AccountingApp {
    constructor() {
        this.records = [];
        this.settings = { currency: '¥', darkMode: false };
        this.currentFilter = 'month';
        this.deleteTargetId = null;
        this.longPressTimer = null;
        this.isLongPress = false;

        this.init();
    }

    // 初始化
    init() {
        this.loadData();
        this.bindEvents();
        this.updateCategoryOptions();
        this.render();
        this.applyTheme();
        this.charts = {
            expensePie: null,
            trend: null,
            monthly: null
        };
    }

    // 加载数据
    loadData() {
        this.records = Storage.getRecords();
        this.settings = Storage.getSettings();

        // 设置表单默认值
        document.getElementById('dateInput').value = Utils.getTodayString();
        document.getElementById('currencySelect').value = this.settings.currency;
        document.getElementById('darkModeToggle').checked = this.settings.darkMode;
    }

    // 绑定事件
    bindEvents() {
        // 类型切换
        document.getElementById('typeSelect').addEventListener('change', (e) => {
            this.updateCategoryOptions(e.target.value);
        });

        // 保存记录
        document.getElementById('saveBtn').addEventListener('click', () => this.saveRecord());

        // 筛选切换
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.renderRecords();
            });
        });

        // 设置面板
        document.getElementById('settingsBtn').addEventListener('click', () => {
            document.getElementById('settingsModal').classList.add('active');
        });

        document.getElementById('closeSettings').addEventListener('click', () => {
            document.getElementById('settingsModal').classList.remove('active');
        });

        // 货币切换
        document.getElementById('currencySelect').addEventListener('change', (e) => {
            this.settings.currency = e.target.value;
            Storage.saveSettings(this.settings);
            this.render();
        });

        // 深色模式切换
        document.getElementById('darkModeToggle').addEventListener('change', (e) => {
            this.settings.darkMode = e.target.checked;
            Storage.saveSettings(this.settings);
            this.applyTheme();
        });

        // 清空数据
        document.getElementById('clearAllBtn').addEventListener('click', () => {
            document.getElementById('clearModal').classList.add('active');
        });

        document.getElementById('cancelClear').addEventListener('click', () => {
            document.getElementById('clearModal').classList.remove('active');
        });

        document.getElementById('confirmClear').addEventListener('click', () => {
            this.clearAllData();
            document.getElementById('clearModal').classList.remove('active');
            document.getElementById('settingsModal').classList.remove('active');
        });

        // 删除确认
        document.getElementById('cancelDelete').addEventListener('click', () => {
            document.getElementById('deleteModal').classList.remove('active');
            this.deleteTargetId = null;
        });

        document.getElementById('confirmDelete').addEventListener('click', () => {
            if (this.deleteTargetId) {
                this.deleteRecord(this.deleteTargetId);
                document.getElementById('deleteModal').classList.remove('active');
                this.deleteTargetId = null;
            }
        });

        // 点击模态框背景关闭
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });

        // 统计按钮
        document.getElementById('statsBtn').addEventListener('click', () => {
            document.getElementById('statsModal').classList.add('active');
            this.initDateRange();
            this.renderStatsModal();
        });

        document.getElementById('closeStats').addEventListener('click', () => {
            document.getElementById('statsModal').classList.remove('active');
        });

        // 日期范围应用
        document.getElementById('applyDateRange').addEventListener('click', () => {
            this.renderStatsModal();
        });

        // 键盘事件
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
            }
        });
    }

    // 更新分类选项
    updateCategoryOptions(type = 'expense') {
        const select = document.getElementById('categorySelect');
        const categories = Categories[type];
        select.innerHTML = categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }

    // 保存记录
    saveRecord() {
        const type = document.getElementById('typeSelect').value;
        const category = document.getElementById('categorySelect').value;
        const amount = parseFloat(document.getElementById('amountInput').value);
        const note = document.getElementById('noteInput').value.trim();
        const date = document.getElementById('dateInput').value;

        // 验证
        if (!amount || amount <= 0) {
            this.showToast('请输入有效的金额');
            document.getElementById('amountInput').focus();
            return;
        }

        if (!date) {
            this.showToast('请选择日期');
            return;
        }

        // 创建记录
        const record = {
            id: Utils.generateId(),
            type,
            category,
            amount,
            note,
            date,
            createdAt: new Date().toISOString()
        };

        // 保存
        Storage.addRecord(record);
        this.records = Storage.getRecords();

        // 重置表单
        document.getElementById('amountInput').value = '';
        document.getElementById('noteInput').value = '';
        document.getElementById('dateInput').value = Utils.getTodayString();

        // 刷新显示
        this.render();
        this.showToast('记录成功');
    }

    // 删除记录
    deleteRecord(id) {
        Storage.deleteRecord(id);
        this.records = Storage.getRecords();
        this.render();
        this.showToast('已删除');
    }

    // 清空所有数据
    clearAllData() {
        Storage.clearAll();
        this.records = [];
        this.render();
        this.showToast('数据已清空');
    }

    // 应用主题
    applyTheme() {
        if (this.settings.darkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }

    // 显示提示
    showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }

    // 渲染全部
    render() {
        this.renderStats();
        this.renderRecords();
        this.renderCategoryStats();
    }

    // 渲染统计
    renderStats() {
        const currency = this.settings.currency;

        // 今日统计
        const todayRecords = this.records.filter(r => Utils.isToday(r.date));
        const todayExpense = todayRecords.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
        const todayIncome = todayRecords.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0);

        // 本月统计
        const monthRecords = this.records.filter(r => Utils.isThisMonth(r.date));
        const monthExpense = monthRecords.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
        const monthIncome = monthRecords.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0);

        // 更新显示
        document.getElementById('todayExpense').textContent = Utils.formatAmount(todayExpense, currency);
        document.getElementById('todayIncome').textContent = Utils.formatAmount(todayIncome, currency);
        document.getElementById('monthExpense').textContent = Utils.formatAmount(monthExpense, currency);
        document.getElementById('monthIncome').textContent = Utils.formatAmount(monthIncome, currency);
    }

    // 渲染分类统计
    renderCategoryStats() {
        const monthRecords = this.records.filter(r => Utils.isThisMonth(r.date) && r.type === 'expense');
        const categoryStats = {};
        let total = 0;

        monthRecords.forEach(r => {
            categoryStats[r.category] = (categoryStats[r.category] || 0) + r.amount;
            total += r.amount;
        });

        const categoryList = document.getElementById('categoryList');

        if (total === 0) {
            categoryList.innerHTML = '<span class="category-item">暂无支出记录</span>';
            return;
        }

        // 按金额排序
        const sorted = Object.entries(categoryStats).sort((a, b) => b[1] - a[1]);
        const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#8b5cf6'];

        categoryList.innerHTML = sorted.map(([cat, amount], index) => {
            const percentage = Math.round((amount / total) * 100);
            const color = colors[index % colors.length];
            return `
                <div class="category-item">
                    <span class="category-dot" style="background: ${color}"></span>
                    <span>${cat} ${percentage}%</span>
                </div>
            `;
        }).join('');
    }

    // 渲染记录列表
    renderRecords() {
        const listContainer = document.getElementById('recordsList');

        // 筛选记录
        let filtered = this.records;
        if (this.currentFilter === 'today') {
            filtered = this.records.filter(r => Utils.isToday(r.date));
        } else {
            filtered = this.records.filter(r => Utils.isThisMonth(r.date));
        }

        // 空状态
        if (filtered.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-receipt"></i>
                    <p>暂无记录，开始记账吧～</p>
                </div>
            `;
            return;
        }

        // 渲染列表
        const currency = this.settings.currency;
        listContainer.innerHTML = filtered.map(record => {
            const dateInfo = Utils.formatDate(record.date);
            const amountClass = record.type === 'expense' ? 'expense' : 'income';
            const sign = record.type === 'expense' ? '-' : '+';

            return `
                <div class="record-item" data-id="${record.id}">
                    <div class="record-date">
                        <span class="record-day">${dateInfo.day}</span>
                        <span class="record-month">${dateInfo.month}</span>
                    </div>
                    <div class="record-info">
                        <span class="record-category">${record.category}</span>
                        ${record.note ? `<span class="record-note">${record.note}</span>` : ''}
                    </div>
                    <span class="record-amount ${amountClass}">${sign}${Utils.formatAmount(record.amount, currency)}</span>
                </div>
            `;
        }).join('');

        // 绑定长按事件
        this.bindLongPressEvents();
    }

    // 绑定长按事件
    bindLongPressEvents() {
        const items = document.querySelectorAll('.record-item');

        items.forEach(item => {
            const startHandler = (e) => {
                this.isLongPress = false;
                item.classList.add('long-press');

                this.longPressTimer = setTimeout(() => {
                    this.isLongPress = true;
                    const id = item.dataset.id;
                    this.deleteTargetId = id;
                    document.getElementById('deleteModal').classList.add('active');
                    item.classList.remove('long-press');
                }, 600);
            };

            const endHandler = () => {
                if (this.longPressTimer) {
                    clearTimeout(this.longPressTimer);
                    this.longPressTimer = null;
                }
                item.classList.remove('long-press');
            };

            // 触摸事件
            item.addEventListener('touchstart', startHandler, { passive: true });
            item.addEventListener('touchend', endHandler);
            item.addEventListener('touchcancel', endHandler);
            item.addEventListener('touchmove', endHandler);

            // 鼠标事件
            item.addEventListener('mousedown', startHandler);
            item.addEventListener('mouseup', endHandler);
            item.addEventListener('mouseleave', endHandler);

            // 点击事件（如果不是长按）
            item.addEventListener('click', (e) => {
                if (this.isLongPress) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            });
        });
    }

    // 初始化日期范围
    initDateRange() {
        const today = Utils.getTodayString();
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const oneMonthAgoStr = oneMonthAgo.toISOString().split('T')[0];

        document.getElementById('startDate').value = oneMonthAgoStr;
        document.getElementById('endDate').value = today;
    }

    // 获取筛选后的记录
    getFilteredRecords() {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        return this.records.filter(record => {
            return record.date >= startDate && record.date <= endDate;
        });
    }

    // 渲染统计模态框
    renderStatsModal() {
        const records = this.getFilteredRecords();
        const currency = this.settings.currency;

        // 计算概览数据
        const totalExpense = records.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
        const totalIncome = records.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0);
        const balance = totalIncome - totalExpense;

        // 更新概览统计
        document.getElementById('totalExpense').textContent = Utils.formatAmount(totalExpense, currency);
        document.getElementById('totalIncome').textContent = Utils.formatAmount(totalIncome, currency);
        document.getElementById('balance').textContent = Utils.formatAmount(balance, currency);
        document.getElementById('recordCount').textContent = records.length;

        // 渲染图表
        this.renderExpensePieChart(records);
        this.renderTrendChart(records);
        this.renderMonthlyChart(records);
    }

    // 渲染支出分类饼图
    renderExpensePieChart(records) {
        const expenseRecords = records.filter(r => r.type === 'expense');
        const categoryStats = {};

        expenseRecords.forEach(r => {
            categoryStats[r.category] = (categoryStats[r.category] || 0) + r.amount;
        });

        const labels = Object.keys(categoryStats);
        const data = Object.values(categoryStats);
        const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#8b5cf6'];

        const ctx = document.getElementById('expensePieChart').getContext('2d');

        if (this.charts.expensePie) {
            this.charts.expensePie.destroy();
        }

        this.charts.expensePie = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: this.settings.darkMode ? '#f1f5f9' : '#1e293b',
                            font: {
                                family: 'inherit',
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(30, 41, 59, 0.9)',
                        titleColor: '#ffffff',
                        bodyColor: '#e2e8f0',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${Utils.formatAmount(value, this.settings.currency)} (${percentage}%)`;
                            }.bind(this)
                        }
                    }
                }
            }
        });
    }

    // 渲染收支趋势图
    renderTrendChart(records) {
        // 按日期分组
        const dailyData = {};
        records.forEach(record => {
            if (!dailyData[record.date]) {
                dailyData[record.date] = { expense: 0, income: 0 };
            }
            dailyData[record.date][record.type] += record.amount;
        });

        // 排序日期
        const dates = Object.keys(dailyData).sort();
        const expenses = dates.map(date => dailyData[date].expense);
        const incomes = dates.map(date => dailyData[date].income);

        const ctx = document.getElementById('trendChart').getContext('2d');

        if (this.charts.trend) {
            this.charts.trend.destroy();
        }

        this.charts.trend = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: '支出',
                        data: expenses,
                        backgroundColor: '#fee2e2',
                        borderColor: '#ef4444',
                        borderWidth: 1
                    },
                    {
                        label: '收入',
                        data: incomes,
                        backgroundColor: '#dcfce7',
                        borderColor: '#22c55e',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        ticks: {
                            color: this.settings.darkMode ? '#f1f5f9' : '#1e293b',
                            font: {
                                family: 'inherit',
                                size: 10
                            }
                        },
                        grid: {
                            color: this.settings.darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    y: {
                        ticks: {
                            color: this.settings.darkMode ? '#f1f5f9' : '#1e293b',
                            font: {
                                family: 'inherit',
                                size: 10
                            }
                        },
                        grid: {
                            color: this.settings.darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: this.settings.darkMode ? '#f1f5f9' : '#1e293b',
                            font: {
                                family: 'inherit',
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(30, 41, 59, 0.9)',
                        titleColor: '#ffffff',
                        bodyColor: '#e2e8f0',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 12
                    }
                }
            }
        });
    }

    // 渲染月度对比图
    renderMonthlyChart(records) {
        // 按月份分组
        const monthlyData = {};
        records.forEach(record => {
            const month = record.date.substring(0, 7); // YYYY-MM
            if (!monthlyData[month]) {
                monthlyData[month] = { expense: 0, income: 0 };
            }
            monthlyData[month][record.type] += record.amount;
        });

        // 排序月份
        const months = Object.keys(monthlyData).sort();
        const expenses = months.map(month => monthlyData[month].expense);
        const incomes = months.map(month => monthlyData[month].income);

        const ctx = document.getElementById('monthlyChart').getContext('2d');

        if (this.charts.monthly) {
            this.charts.monthly.destroy();
        }

        this.charts.monthly = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: months,
                datasets: [
                    {
                        label: '支出',
                        data: expenses,
                        backgroundColor: '#fee2e2',
                        borderColor: '#ef4444',
                        borderWidth: 1
                    },
                    {
                        label: '收入',
                        data: incomes,
                        backgroundColor: '#dcfce7',
                        borderColor: '#22c55e',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        ticks: {
                            color: this.settings.darkMode ? '#f1f5f9' : '#1e293b',
                            font: {
                                family: 'inherit',
                                size: 10
                            }
                        },
                        grid: {
                            color: this.settings.darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    y: {
                        ticks: {
                            color: this.settings.darkMode ? '#f1f5f9' : '#1e293b',
                            font: {
                                family: 'inherit',
                                size: 10
                            }
                        },
                        grid: {
                            color: this.settings.darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: this.settings.darkMode ? '#f1f5f9' : '#1e293b',
                            font: {
                                family: 'inherit',
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(30, 41, 59, 0.9)',
                        titleColor: '#ffffff',
                        bodyColor: '#e2e8f0',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 12
                    }
                }
            }
        });
    }
}

// ========================================
// 启动应用
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    new AccountingApp();
});

// 防止移动端双击缩放
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, { passive: false });
