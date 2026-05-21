const app = (() => {
    
    // --- STATE & CONFIG ---
    let currentTab = 'view-dashboard';
    let currentUserRole = null;
    let currentUsername = null;
    const refreshInterval = 10000;
    let refreshTimer = null;
    let globalBins = []; 

    // --- DOM ELEMENTS ---
    const toast = document.getElementById('toast');
    const headerTitle = document.getElementById('header-title');
    const navItems = document.querySelectorAll('.nav-item');
    const viewSections = document.querySelectorAll('.view-section');
    const screens = document.querySelectorAll('.screen-view');

    // --- INIT ---
    const init = () => {
        setupAuth();
        setupNavigation();
        setupModals();
        setupActionListeners();
        checkAuthStatus();
    };

    // --- AUTHENTICATION ---
    const checkAuthStatus = async () => {
        const data = await fetchData('/api/auth/status');
        if (data && data.logged_in) {
            currentUserRole = data.role;
            currentUsername = data.username;
            document.querySelectorAll('.display-username').forEach(el => el.textContent = currentUsername);
            switchScreen(currentUserRole === 'admin' ? 'admin-portal' : 'user-portal');
        } else {
            currentUserRole = null;
            currentUsername = null;
            switchScreen('login-screen');
        }
    };

    const switchScreen = (screenId) => {
        screens.forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');

        clearInterval(refreshTimer);
        
        if (screenId === 'admin-portal') {
            currentTab = 'view-dashboard';
            document.querySelector('[data-target="view-dashboard"]').click();
            refreshTimer = setInterval(loadActiveTabData, refreshInterval);
        } else if (screenId === 'user-portal') {
            currentTab = 'view-user-dashboard';
            loadUserDashboard();
            refreshTimer = setInterval(loadUserDashboard, refreshInterval);
        }
    };

    const showAuthView = (viewId) => {
        document.getElementById('auth-main').style.display = 'none';
        document.getElementById('auth-admin').style.display = 'none';
        document.getElementById('auth-user').style.display = 'none';

        if (viewId === 'admin-login') document.getElementById('auth-admin').style.display = 'flex';
        else if (viewId === 'user-login') document.getElementById('auth-user').style.display = 'flex';
        else document.getElementById('auth-main').style.display = 'flex';
    };

    const setupAuth = () => {
        const btnNavAdmin = document.getElementById('nav-admin-login');
        if(btnNavAdmin) btnNavAdmin.addEventListener('click', () => showAuthView('admin-login'));
        
        const btnNavUser = document.getElementById('nav-user-login');
        if(btnNavUser) btnNavUser.addEventListener('click', () => showAuthView('user-login'));
        
        document.querySelectorAll('.nav-auth-back').forEach(btn => btn.addEventListener('click', () => showAuthView('main')));

        document.getElementById('btn-login-admin').addEventListener('click', async () => {
            const user = document.getElementById('admin-username').value;
            const pass = document.getElementById('admin-password').value;
            const res = await postData('/api/login', {username: user, password: pass});
            if (res && res.success) {
                document.getElementById('admin-username').value = '';
                document.getElementById('admin-password').value = '';
                checkAuthStatus();
            }
        });

        document.getElementById('btn-login-user').addEventListener('click', async () => {
            const user = document.getElementById('user-username').value;
            const pass = document.getElementById('user-password').value;
            const res = await postData('/api/login', {username: user, password: pass});
            if (res && res.success) {
                document.getElementById('user-username').value = '';
                document.getElementById('user-password').value = '';
                checkAuthStatus();
            }
        });

        document.getElementById('btn-register-user').addEventListener('click', async () => {
            const user = document.getElementById('user-username').value;
            const pass = document.getElementById('user-password').value;
            await postData('/api/register', {username: user, password: pass});
        });

        document.querySelectorAll('.btn-logout').forEach(btn => {
            btn.addEventListener('click', async () => {
                await postData('/api/logout');
                showAuthView('main');
                checkAuthStatus();
            });
        });
    };

    // --- NAVIGATION ---
    const setupNavigation = () => {
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const parentNav = item.closest('.nav-menu');
                parentNav.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                const targetId = item.getAttribute('data-target');
                const parentPortal = item.closest('.app-container');
                parentPortal.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
                document.getElementById(targetId).classList.add('active');
                
                currentTab = targetId;
                const header = parentPortal.querySelector('.top-header h2');
                if(header) header.textContent = item.textContent.trim();
                
                if (currentUserRole === 'admin') loadActiveTabData();
            });
        });
    };

    const loadActiveTabData = () => {
        if(currentUserRole !== 'admin') return;
        switch(currentTab) {
            case 'view-dashboard': loadDashboard(); break;
            case 'view-bins': loadBins(); break;
            case 'view-fleet': loadFleet(); break;
            case 'view-facilities': loadFacilities(); break;
            case 'view-weather': loadWeather(); break;
        }
    };

    // --- UTILS ---
    const showToast = (message, type) => {
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => toast.classList.remove('show'), 3000);
    };

    const showWarnings = (warnings) => {
        if (!warnings || warnings.length === 0) return;
        const container = document.getElementById('warning-messages-container');
        container.innerHTML = warnings.map(w => `<div>• ${w}</div>`).join('');
        document.getElementById('warning-modal').classList.add('active');
    };

    const postData = async (url, data = {}) => {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            
            showToast(result.message, result.success ? 'success' : 'error');
            
            if (result.warnings) showWarnings(result.warnings);
            
            if (result.success && currentUserRole === 'admin') loadActiveTabData();
            if (result.success && currentUserRole === 'user') loadUserDashboard();
            
            return result;
        } catch (error) {
            showToast('Network error occurred.', 'error');
            console.error(error);
        }
    };

    const fetchData = async (url) => {
        try {
            const res = await fetch(url);
            return await res.json();
        } catch (error) {
            console.error(`Error fetching ${url}:`, error);
            return null;
        }
    };

    // --- ADMIN PORTAL ---
    const loadDashboard = async () => {
        const data = await fetchData('/api/dashboard');
        if (!data) return;

        document.getElementById('stat-treasury').textContent = `₹${data.stats.treasury.toFixed(2)}`;
        document.getElementById('stat-profit').textContent = `₹${(data.stats.revenue - data.stats.expense).toFixed(2)}`;
        document.getElementById('stat-profit').className = `stat-value ${data.stats.revenue >= data.stats.expense ? 'text-success' : 'text-danger'}`;
        document.getElementById('stat-total-waste').textContent = `${data.stats.total_waste.toFixed(1)} kg`;
        document.getElementById('stat-active-bins').textContent = `${data.stats.active_bins} / ${data.stats.total_bins}`;
        document.getElementById('sys-version-text').textContent = data.stats.system_version;

        const logsList = document.getElementById('session-logs-list');
        logsList.innerHTML = data.session_logs.reverse().map(log => `<li>${log}</li>`).join('');
    };

    const loadBins = async () => {
        const data = await fetchData('/api/bins');
        if (!data) return;

        globalBins = data.bins;
        
        const tbody = document.getElementById('bins-table-body');
        tbody.innerHTML = data.bins.map(b => {
            const loadPercent = (b.fill / b.max_limit) * 100;
            let statusBadge = '';
            if (b.overflow > 0) statusBadge = '<span class="badge badge-closed">OVERFLOW</span>';
            else if (loadPercent >= 100) statusBadge = '<span class="badge badge-warning">FULL</span>';
            else statusBadge = '<span class="badge badge-open">OK</span>';
            const contamColor = b.contaminated ? 'text-danger' : 'text-success';

            return `
                <tr>
                    <td><strong>${b.id}</strong></td>
                    <td>${b.area}</td>
                    <td><span class="badge" style="background:rgba(255,255,255,0.1)">${b.source}</span></td>
                    <td>
                        <div class="progress-bar-bg" style="width: 100px; height: 6px; margin-bottom: 4px;">
                            <div class="progress-bar-fill" style="width: ${Math.min(100, loadPercent)}%; background: ${loadPercent >= 90 ? 'var(--accent-red)' : 'var(--accent-cyan)'}"></div>
                        </div>
                        <small>${b.fill.toFixed(1)} / ${b.max_limit}</small>
                        ${statusBadge}
                    </td>
                    <td class="${b.overflow > 0 ? 'text-danger' : ''}">${b.overflow.toFixed(1)} kg</td>
                    <td class="${contamColor}">${b.contaminated ? 'YES' : 'NO'}</td>
                    <td>${b.active_vehicle}</td>
                </tr>
            `;
        }).join('');

        const zoneSelect = document.getElementById('zone-select');
        if (zoneSelect && zoneSelect.options.length === 0) {
            zoneSelect.innerHTML = data.areas.map(a => `<option value="${a}">${a}</option>`).join('');
        }
        
        const singleBinArea = document.getElementById('single-bin-area-select');
        if (singleBinArea && singleBinArea.options.length <= 1) {
            singleBinArea.innerHTML = '<option value="">Select Area...</option>' + data.areas.map(a => `<option value="${a}">${a}</option>`).join('');
        }
        
        const injectArea = document.getElementById('inject-area');
        if (injectArea && injectArea.options.length === 0) {
            injectArea.innerHTML = data.areas.map(a => `<option value="${a}">${a}</option>`).join('');
        }
    };

    const loadFleet = async () => {
        const data = await fetchData('/api/fleet');
        if (!data) return;

        const tbody = document.getElementById('fleet-table-body');
        tbody.innerHTML = data.fleet.map(v => {
            const fColor = v.fuel > 50 ? 'text-success' : (v.fuel > 20 ? 'text-warning' : 'text-danger');
            const hColor = v.health > 60 ? 'text-success' : (v.health > 30 ? 'text-warning' : 'text-danger');
            const rColor = v.role === 'ACTIVE' ? 'badge-open' : (v.role === 'STANDBY' ? 'badge-warning' : 'badge-closed');

            return `
                <tr>
                    <td><strong>${v.id}</strong></td>
                    <td>${v.type}</td>
                    <td>${v.area}</td>
                    <td class="${fColor}">${v.fuel.toFixed(1)}%</td>
                    <td class="${hColor}">${v.health.toFixed(1)}%</td>
                    <td class="${v.broken ? 'text-danger' : 'text-success'}">${v.broken ? 'YES' : 'NO'}</td>
                    <td><span class="badge ${rColor}">${v.role}</span></td>
                </tr>
            `;
        }).join('');
    };

    const loadWeather = async () => {
        const data = await fetchData('/api/weather');
        if (!data) return;

        const tbody = document.getElementById('weather-table-body');
        tbody.innerHTML = data.areas.map(a => {
            let tColor = 'text-success';
            if (['HIGH', 'VERY HIGH', 'BLOCKED'].includes(a.traffic)) tColor = 'text-danger';
            else if (a.traffic === 'MEDIUM') tColor = 'text-warning';

            return `
                <tr>
                    <td><strong>${a.area}</strong></td>
                    <td>${a.condition}</td>
                    <td>${a.rain}</td>
                    <td>${a.wind}</td>
                    <td>${a.temp}</td>
                    <td class="${tColor}">${a.traffic}</td>
                    <td><span class="badge ${a.road_closed ? 'badge-closed' : 'badge-open'}">${a.road_closed ? 'CLOSED' : 'OPEN'}</span></td>
                </tr>
            `;
        }).join('');
    };

    const loadFacilities = async () => {
        const data = await fetchData('/api/facilities');
        if (!data) return;

        const container = document.getElementById('facilities-container');
        container.innerHTML = data.facilities.map(facility => {
            const loadPercent = facility.capacity > 0 ? (facility.current_load / facility.capacity) * 100 : 0;
            let loadColor = loadPercent > 90 ? 'var(--accent-red)' : (loadPercent > 70 ? 'var(--accent-yellow)' : 'var(--accent-green)');
            const statusClass = facility.status === 'OPEN' ? 'badge-open' : 'badge-closed';
            const wtHtml = facility.waste_types.map(wt => `<span class="waste-tag">${wt}</span>`).join('');

            return `
                <div class="facility-card glass-panel">
                    <div class="card-header">
                        <div>
                            <h4 class="facility-name">${facility.name}</h4>
                            <div class="waste-types">${wtHtml}</div>
                        </div>
                        <span class="badge ${statusClass}">${facility.status}</span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-header">
                            <span>Current Load</span>
                            <span>${Math.round(facility.current_load)} / ${facility.capacity} kg</span>
                        </div>
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill" style="width: ${Math.min(100, loadPercent)}%; background-color: ${loadColor}"></div>
                        </div>
                    </div>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">Temp Storage</span>
                            <span class="stat-value ${facility.temporary_storage > 0 ? 'text-warning' : ''}">${facility.temporary_storage} kg</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Cost/kg</span>
                            <span class="stat-value text-success">₹${facility.cost_per_kg}</span>
                        </div>
                    </div>
                    <button class="btn btn-danger clear-btn" data-facility="${facility.raw_name}" data-name="${facility.name}" style="margin-top: 0.5rem; justify-content: center;">
                        Clear Facility
                    </button>
                </div>
            `;
        }).join('');

        document.querySelectorAll('.clear-btn').forEach(btn => {
            btn.addEventListener('click', (e) => openClearModal(e.target.getAttribute('data-facility'), e.target.getAttribute('data-name')));
        });
    };

    // --- USER PORTAL ---
    const loadUserDashboard = async () => {
        const data = await fetchData('/api/user/info');
        if (!data) return;

        document.getElementById('user-penalty-amount').textContent = `₹${data.penalty}`;
        document.getElementById('btn-user-pay').style.display = data.penalty > 0 ? 'block' : 'none';
        
        // Also fetch bins to prep inject modal if needed
        const binsData = await fetchData('/api/bins');
        if (binsData) globalBins = binsData.bins;
    };


    // --- MODALS ---
    let currentFacilityToClear = null;
    const modalClear = document.getElementById('clear-modal');
    const modalInject = document.getElementById('inject-modal');

    const openClearModal = (raw, name) => {
        currentFacilityToClear = raw;
        document.getElementById('modal-facility-name').textContent = name;
        modalClear.classList.add('active');
    };

    const updateInjectBins = () => {
        const injectArea = document.getElementById('inject-area');
        const injectBin = document.getElementById('inject-bin');
        if (!injectArea || !injectBin) return;
        
        const area = injectArea.value;
        const binsInArea = globalBins.filter(b => b.area === area);
        injectBin.innerHTML = binsInArea.map(b => `<option value="${b.id}">${b.id} (${b.source})</option>`).join('');
        
        updateInjectAllowed();
    };

    const updateInjectAllowed = () => {
        const injectBin = document.getElementById('inject-bin');
        const injectAllowedInfo = document.getElementById('inject-allowed-info');
        if (!injectBin || !injectAllowedInfo) return;
        
        const binId = injectBin.value;
        const bin = globalBins.find(b => b.id === binId);
        if (bin && bin.allowed_waste) {
            injectAllowedInfo.textContent = `(Allowed: ${bin.allowed_waste.join(', ')})`;
        } else {
            injectAllowedInfo.textContent = '';
        }
    };

    const setupModals = () => {
        document.getElementById('cancel-clear').addEventListener('click', () => modalClear.classList.remove('active'));
        document.getElementById('confirm-clear').addEventListener('click', () => {
            if (currentFacilityToClear) {
                postData('/api/facilities/clear', { facility: currentFacilityToClear });
                modalClear.classList.remove('active');
            }
        });

        const clearAllBtn = document.getElementById('clear-all-btn');
        if(clearAllBtn) clearAllBtn.addEventListener('click', () => openClearModal('ALL', 'ALL FACILITIES'));
        
        document.getElementById('inject-area').addEventListener('change', updateInjectBins);
        document.getElementById('inject-bin').addEventListener('change', updateInjectAllowed);

        const openInjectHandler = () => {
            if (globalBins.length > 0) {
                const injectArea = document.getElementById('inject-area');
                if (injectArea.options.length === 0) {
                    const areas = [...new Set(globalBins.map(b => b.area))].sort();
                    injectArea.innerHTML = areas.map(a => `<option value="${a}">${a}</option>`).join('');
                }
                updateInjectBins();
            }
            modalInject.classList.add('active');
        };

        const btnOpenInject = document.getElementById('btn-open-inject');
        if(btnOpenInject) btnOpenInject.addEventListener('click', openInjectHandler);
        
        const btnUserInject = document.getElementById('btn-user-inject-open');
        if(btnUserInject) btnUserInject.addEventListener('click', openInjectHandler);

        document.getElementById('btn-submit-inject').addEventListener('click', () => {
            postData('/api/bins/inject', {
                area: document.getElementById('inject-area').value,
                bin_id: document.getElementById('inject-bin').value,
                wtype: document.getElementById('inject-wtype').value,
                qty: document.getElementById('inject-qty').value
            }).then((res) => {
                if(res && res.success) {
                    document.getElementById('inject-wtype').value = '';
                    document.getElementById('inject-qty').value = '10';
                    modalInject.classList.remove('active');
                }
            });
        });
    };

    // --- ACTIONS SETUP ---
    const setupActionListeners = () => {
        // Admin
        const btnClearLogs = document.getElementById('btn-clear-logs');
        if(btnClearLogs) btnClearLogs.addEventListener('click', () => postData('/api/logs/clear'));
        
        const btnPriorityClear = document.getElementById('btn-priority-clear');
        if(btnPriorityClear) btnPriorityClear.addEventListener('click', () => postData('/api/dispatch/priority'));
        
        const btnZoneClear = document.getElementById('btn-zone-clear');
        if(btnZoneClear) btnZoneClear.addEventListener('click', () => {
            const zone = document.getElementById('zone-select').value;
            const mode = document.getElementById('zone-mode-select') ? document.getElementById('zone-mode-select').value : 'standard';
            if(zone) postData('/api/dispatch/zone', { area: zone, mode: mode });
        });
        
        const btnFullSweep = document.getElementById('btn-full-sweep');
        if(btnFullSweep) btnFullSweep.addEventListener('click', () => {
            const reroute = document.getElementById('sweep-mode-select') && document.getElementById('sweep-mode-select').value === 'reroute';
            postData('/api/dispatch/sweep', { reroute: reroute });
        });

        const singleBinArea = document.getElementById('single-bin-area-select');
        if (singleBinArea) {
            singleBinArea.addEventListener('change', () => {
                const area = singleBinArea.value;
                const binSelect = document.getElementById('single-bin-select');
                if (area) {
                    const binsInArea = globalBins.filter(b => b.area === area);
                    binSelect.innerHTML = binsInArea.map(b => `<option value="${b.id}">${b.id} (${b.source})</option>`).join('');
                } else {
                    binSelect.innerHTML = '<option value="">Select Bin...</option>';
                }
            });
        }

        const btnSingleBinClear = document.getElementById('btn-single-bin-clear');
        if(btnSingleBinClear) btnSingleBinClear.addEventListener('click', () => {
            const bin_id = document.getElementById('single-bin-select').value;
            if(bin_id) postData('/api/dispatch/bin', { bin_id: bin_id });
        });

        const btnToggleWeather = document.getElementById('btn-toggle-weather');
        if(btnToggleWeather) btnToggleWeather.addEventListener('click', () => postData('/api/weather/toggle'));
        
        const btnAddAdmin = document.getElementById('btn-add-admin');
        if(btnAddAdmin) btnAddAdmin.addEventListener('click', () => {
            postData('/api/admin/add', {
                username: document.getElementById('new-admin-user').value,
                password: document.getElementById('new-admin-pass').value
            });
        });

        // User Portal actions
        const btnUserPay = document.getElementById('btn-user-pay');
        if(btnUserPay) btnUserPay.addEventListener('click', () => postData('/api/user/pay'));
    };

    // Return public methods
    return {
        init,
        postFleetAction: (action) => postData('/api/fleet/action', { action })
    };
})();

// Start App
document.addEventListener('DOMContentLoaded', app.init);
