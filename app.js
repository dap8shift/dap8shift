// Import functions from the Firebase SDKs
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    createUserWithEmailAndPassword,
    updatePassword
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    collection,
    query,
    where,
    getDocs,
    addDoc,
    deleteDoc,
    updateDoc,
    orderBy,
    limit,
    writeBatch,
    serverTimestamp,
    Timestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// =================================================================
// PASTE YOUR FIREBASE CONFIGURATION OBJECT HERE
// =================================================================
const firebaseConfig = {
    apiKey: "AIzaSyBiWqIO8uaWDJeCwIsHEOiYOHM94UajAP0",
    authDomain: "workschedule-b82b5.firebaseapp.com",
    projectId: "workschedule-b82b5",
    storageBucket: "workschedule-b82b5.firebasestorage.app",
    messagingSenderId: "48719295397",
    appId: "1:48719295397:web:1a26f943f6efbdb7132e4c"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- DOM Element References ---
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const logoutBtn = document.getElementById('logout-btn');
const userDisplay = document.getElementById('user-display');
const adminPanelModern = document.getElementById('admin-panel-modern');
const employeeDashboard = document.getElementById('employee-dashboard');
const supervisorDashboard = document.getElementById('supervisor-dashboard');
const createUserModal = document.getElementById('create-user-modal');
const editUserModal = document.getElementById('edit-user-modal');
const deleteModal = document.getElementById('delete-modal');
const addEventModal = document.getElementById('add-event-modal');
const editEventModal = document.getElementById('edit-event-modal');
const changePasswordModal = document.getElementById('change-password-modal');

// --- Global State ---
let itemToDelete = { id: null, name: null, type: null };
let currentDisplayDate = new Date();

// --- Activity Logging Function ---
async function logActivity(details) {
    try {
        await addDoc(collection(db, "activity"), { details, timestamp: serverTimestamp() });
    } catch (error) { console.error("Error logging activity:", error); }
}

// --- AUTHENTICATION & CORE APP LOGIC ---
onAuthStateChanged(auth, user => {
    if (user) {
        loginContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        loadUserDashboard(user.uid);
    } else {
        loginContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
    }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        document.getElementById('login-error').textContent = 'Invalid email or password.';
    }
});

logoutBtn.addEventListener('click', () => signOut(auth));

async function loadUserDashboard(uid) {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.passwordChanged === false) {
            changePasswordModal.classList.remove('hidden');
            return;
        }

        userDisplay.textContent = `Welcome, ${userData.name} (${userData.role})`;
        document.querySelectorAll('.dashboard').forEach(p => p.classList.add('hidden'));
        
        currentDisplayDate = new Date();

        if (userData.role === 'L1') {
            employeeDashboard.classList.remove('hidden');
            loadEmployeeView(uid);
        } else if (userData.role === 'L3') {
            supervisorDashboard.classList.remove('hidden');
            loadSupervisorView();
        } else if (userData.role === 'L4+') {
            adminPanelModern.classList.remove('hidden');
            setupAdminNavigation();
            loadAdminDashboardData();
        }
    } else {
        alert("Could not find user data.");
        signOut(auth);
    }
}

// =========================================================================
// L1 EMPLOYEE PANEL LOGIC
// =========================================================================
async function loadEmployeeView(uid) {
    const scheduleView = document.getElementById('employee-schedule-view');
    const title = document.getElementById('employee-schedule-title');
    
    const year = currentDisplayDate.getFullYear();
    const month = currentDisplayDate.getMonth();

    title.textContent = `My Schedule for ${currentDisplayDate.toLocaleString('default', { month: 'long', year: 'numeric' })}`;
    
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

    const q = query(collection(db, 'schedules'), where("userId", "==", uid), where("startTime", ">=", startOfMonth), where("startTime", "<=", endOfMonth));
    const scheduleSnapshot = await getDocs(q);
    const events = {};
    scheduleSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.startTime) {
            const day = data.startTime.toDate().getDate();
            if (!events[day]) events[day] = [];
            events[day].push({ 
                id: doc.id,
                type: data.type || 'Work',
                time: data.startTime ? `${formatTime(data.startTime.toDate())} - ${formatTime(data.endTime.toDate())}` : ''
            });
        }
    });
    scheduleView.innerHTML = generateScheduleBarViewHTML(year, month, events, false);
}

// =========================================================================
// L3 SUPERVISOR PANEL LOGIC
// =========================================================================
async function loadSupervisorView() {
    const rosterBody = document.getElementById('supervisor-roster-body');
    const title = document.getElementById('supervisor-roster-title');
    rosterBody.innerHTML = '<tr><td colspan="2">Loading...</td></tr>';
    
    const today = new Date();
    title.textContent = `Today's Roster - ${today.toLocaleDateString('en-US', {dateStyle: 'long'})}`;

    const startOfToday = new Date(new Date().setHours(0,0,0,0));
    const endOfToday = new Date(new Date().setHours(23,59,59,999));
    
    const q = query(collection(db, "schedules"), where("startTime", ">=", startOfToday), where("startTime", "<=", endOfToday), where("type", "==", "Work"));
    const scheduleSnapshot = await getDocs(q);

    if (scheduleSnapshot.empty) {
        rosterBody.innerHTML = `<tr><td colspan="2">No employees are scheduled for a shift today.</td></tr>`;
        return;
    }

    const usersMap = {};
    const usersSnapshot = await getDocs(collection(db, 'users'));
    usersSnapshot.forEach(doc => usersMap[doc.id] = doc.data().name);

    rosterBody.innerHTML = scheduleSnapshot.docs.map(doc => {
        const schedule = doc.data();
        const userName = usersMap[schedule.userId] || 'Unknown';
        return `<tr>
            <td>${userName}</td>
            <td>${formatTime(schedule.startTime.toDate())} - ${formatTime(schedule.endTime.toDate())}</td>
        </tr>`;
    }).join('');
}

// =========================================================================
// ADMIN PANEL LOGIC
// =========================================================================

function setupAdminNavigation() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    const mainContentPages = document.querySelectorAll('.main-content');
    const schedulesDropdown = document.querySelector('.nav-item-dropdown');
    const subMenuItems = document.querySelectorAll('.nav-submenu .nav-sub-item');
    
    if (navItems[0].dataset.listenerAttached) return;

    navItems.forEach(item => {
        item.dataset.listenerAttached = 'true';
        item.addEventListener('click', (e) => {
            const page = e.currentTarget.dataset.page;
            if (page && page !== 'schedules') {
                mainContentPages.forEach(p => p.classList.add('hidden'));
                document.getElementById(`${page}-page`).classList.remove('hidden');
                
                navItems.forEach(i => i.classList.remove('active'));
                subMenuItems.forEach(i => i.classList.remove('active'));
                schedulesDropdown.classList.remove('submenu-open');
                e.currentTarget.classList.add('active');
                currentDisplayDate = new Date();
                if (page === 'dashboard') loadAdminDashboardData();
                else if (page === 'users') loadUsersPage();
                else if (page === 'settings') loadSettingsPage();
            }
        });
    });

    schedulesDropdown.querySelector('.nav-item').addEventListener('click', () => {
        schedulesDropdown.classList.toggle('submenu-open');
    });

    subMenuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const view = e.currentTarget.dataset.view;
            mainContentPages.forEach(p => p.classList.add('hidden'));
            document.getElementById('schedules-page').classList.remove('hidden');
            
            navItems.forEach(i => i.classList.remove('active'));
            subMenuItems.forEach(i => i.classList.remove('active'));
            schedulesDropdown.querySelector('.nav-item').classList.add('active');
            e.currentTarget.classList.add('active');
            
            const calendarView = document.getElementById('schedule-calendar-view');
            const todayView = document.getElementById('schedule-today-view');
            const pageTitle = document.getElementById('schedules-page-title');
            currentDisplayDate = new Date();
            if (view === 'bb-shifts-today') {
                calendarView.classList.add('hidden');
                todayView.classList.remove('hidden');
                pageTitle.textContent = 'BB Shifts (Today)';
                loadTodayRoster('BB');
            } else {
                calendarView.classList.remove('hidden');
                todayView.classList.add('hidden');
                pageTitle.textContent = view === 'bb-shifts' ? 'BB Shifts' : 'GB Shifts';
                loadSchedulesPage();
            }
        });
    });
}

// --- Dashboard Page ---
async function loadAdminDashboardData() {
    const recentActivityList = document.getElementById('widget-recent-activity');
    try {
        const today = new Date();
        const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));
        const endOfToday = new Date(new Date().setHours(23, 59, 59, 999));
        
        const dayOfWeek = today.getDay();
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const startOfWeek = new Date(new Date().setDate(diff));
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const onShiftQuery = query(collection(db, "schedules"), where("startTime", ">=", startOfToday), where("startTime", "<=", endOfToday), where("type", "==", "Work"));
        const totalEmployeesQuery = query(collection(db, "users"), where("role", "==", "L1"));
        const weeklyHoursQuery = query(collection(db, "schedules"), where("startTime", ">=", startOfWeek), where("startTime", "<=", endOfWeek), where("type", "==", "Work"));
        const recentActivityQuery = query(collection(db, "activity"), orderBy("timestamp", "desc"), limit(5));
        
        const [onShiftSnapshot, totalEmployeesSnapshot, weeklyHoursSnapshot, recentActivitySnapshot] = await Promise.all([
            getDocs(onShiftQuery),
            getDocs(totalEmployeesQuery),
            getDocs(weeklyHoursQuery),
            getDocs(recentActivityQuery),
        ]);

        document.getElementById('widget-on-shift').textContent = onShiftSnapshot.size;
        document.getElementById('widget-total-employees').textContent = totalEmployeesSnapshot.size;
        let totalHours = 0;
        weeklyHoursSnapshot.forEach(doc => {
            const shift = doc.data();
            if (shift.endTime && shift.startTime) {
                const durationMillis = shift.endTime.toMillis() - shift.startTime.toMillis();
                totalHours += durationMillis / (1000 * 60 * 60);
            }
        });
        document.getElementById('widget-hours-week').textContent = totalHours.toFixed(1);
        
        if (recentActivitySnapshot.empty) {
            recentActivityList.innerHTML = '<li>No recent actions.</li>';
        } else {
            recentActivityList.innerHTML = recentActivitySnapshot.docs.map(doc => `<li>${doc.data().details}</li>`).join('');
        }
    } catch (error) {
        console.error("Error loading dashboard widgets:", error);
        recentActivityList.innerHTML = '<li>Error loading activity. Database may need an index.</li>';
    }
}

// --- Users Page ---
async function loadUsersPage() {
    const usersTableBody = document.getElementById('users-table-body');
    usersTableBody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
    const usersSnapshot = await getDocs(query(collection(db, 'users'), orderBy("name")));
    if (usersSnapshot.empty) {
        usersTableBody.innerHTML = '<tr><td colspan="4">No users found.</td></tr>';
        return;
    }
    usersTableBody.innerHTML = usersSnapshot.docs.map(doc => {
        const user = doc.data();
        return `
            <tr>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${user.role}</td>
                <td class="user-actions">
                    <button class="action-btn edit-btn" data-id="${doc.id}">✏️</button>
                    <button class="action-btn delete-btn" data-id="${doc.id}" data-name="${user.name}">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

// --- Schedules Page ---
async function loadSchedulesPage() {
    await populateScheduleEmployeeDropdown();
    await loadScheduleView();
    document.getElementById('view-schedule-employee').addEventListener('change', () => {
        currentDisplayDate = new Date();
        loadScheduleView();
    });
}

async function populateScheduleEmployeeDropdown() {
    const employeeSelects = [
        document.getElementById('view-schedule-employee'),
        document.getElementById('add-event-employee')
    ];
    const userSnapshot = await getDocs(query(collection(db, 'users'), where("role", "==", "L1")));
    
    const currentViewSelection = employeeSelects[0].value;
    
    employeeSelects.forEach(select => {
        if (!select) return;
        select.innerHTML = '';
        userSnapshot.forEach(doc => {
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = doc.data().name;
            select.appendChild(option);
        });
    });

    if (currentViewSelection) {
        employeeSelects[0].value = currentViewSelection;
    }
}

async function loadScheduleView() {
    const barViewContainer = document.getElementById('schedule-bar-view');
    const title = document.getElementById('admin-schedule-month-title');
    const selectedUserId = document.getElementById('view-schedule-employee').value;
    if (!selectedUserId) {
        barViewContainer.innerHTML = `<p style="text-align:center; padding: 40px;">Please create an L1 employee to see a schedule.</p>`;
        title.textContent = 'Select Employee';
        return;
    }
    const year = currentDisplayDate.getFullYear();
    const month = currentDisplayDate.getMonth();
    title.textContent = currentDisplayDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

    const q = query(collection(db, 'schedules'), where("userId", "==", selectedUserId), where("startTime", ">=", startOfMonth), where("startTime", "<=", endOfMonth));
    const scheduleSnapshot = await getDocs(q);
    const events = {};
    scheduleSnapshot.forEach(doc => {
        const data = doc.data();
        if(data.startTime) {
            const day = data.startTime.toDate().getDate();
            if (!events[day]) events[day] = [];
            events[day].push({ 
                id: doc.id,
                type: data.type || 'Work',
                time: data.startTime ? `${formatTime(data.startTime.toDate())} - ${formatTime(data.endTime.toDate())}` : ''
            });
        }
    });
    barViewContainer.innerHTML = generateScheduleBarViewHTML(year, month, events, true);
}

async function loadTodayRoster(department) {
    const rosterBody = document.getElementById('today-roster-body');
    rosterBody.innerHTML = '<tr><td colspan="3">Loading...</td></tr>';
    const today = new Date(new Date().setHours(0,0,0,0));
    const endOfToday = new Date(new Date().setHours(23,59,59,999));
    
    const q = query(collection(db, "schedules"), where("startTime", ">=", today), where("startTime", "<=", endOfToday), where("type", "==", "Work"));
    const scheduleSnapshot = await getDocs(q);

    if (scheduleSnapshot.empty) {
        rosterBody.innerHTML = `<tr><td colspan="3">No employees on a shift in ${department} today.</td></tr>`;
        return;
    }

    const usersMap = {};
    const usersSnapshot = await getDocs(collection(db, 'users'));
    usersSnapshot.forEach(doc => usersMap[doc.id] = doc.data().name);

    rosterBody.innerHTML = scheduleSnapshot.docs.map(doc => {
        const schedule = doc.data();
        const userName = usersMap[schedule.userId] || 'Unknown';
        return `<tr><td>${userName}</td><td>${formatTime(schedule.startTime.toDate())} - ${formatTime(schedule.endTime.toDate())}</td><td>${department}</td></tr>`;
    }).join('');
}

// --- Settings Page ---
function loadSettingsPage() {
    document.getElementById('export-users-btn').addEventListener('click', exportUsersToCSV);
    document.getElementById('export-schedule-btn').addEventListener('click', exportSchedulesToCSV);
    const fileInput = document.getElementById('import-file-input');
    const uploadBtn = document.getElementById('upload-schedule-btn');
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            document.getElementById('file-name-display').textContent = fileInput.files[0].name;
            uploadBtn.disabled = false;
        } else {
            document.getElementById('file-name-display').textContent = 'No file chosen';
            uploadBtn.disabled = true;
        }
    });
    uploadBtn.addEventListener('click', async () => {
        if (fileInput.files.length > 0) { await processScheduleImport(fileInput.files[0]); }
    });
}

async function exportUsersToCSV() {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    let csvContent = "Name,Email,Role\n";
    usersSnapshot.forEach(doc => {
        const user = doc.data();
        csvContent += `"${user.name}","${user.email}","${user.role}"\n`;
    });
    downloadCSV(csvContent, 'user-list.csv');
    logActivity('Exported the user list.');
}

async function exportSchedulesToCSV() {
    const [scheduleSnapshot, usersSnapshot] = await Promise.all([
        getDocs(collection(db, 'schedules')),
        getDocs(collection(db, 'users'))
    ]);
    const usersMap = {};
    usersSnapshot.forEach(doc => { usersMap[doc.id] = doc.data().name; });

    let csvContent = "EmployeeName,Date,StartTime,EndTime,Type\n";
    scheduleSnapshot.forEach(doc => {
        const s = doc.data();
        if (!s.startTime) { return; }
        const name = usersMap[s.userId] || 'Unknown User';
        const date = s.startTime.toDate().toISOString().split('T')[0];
        const startTime = s.type === 'Work' ? formatTime(s.startTime.toDate()) : '';
        const endTime = s.type === 'Work' ? formatTime(s.endTime.toDate()) : '';
        csvContent += `"${name}","${date}","${startTime}","${endTime}","${s.type}"\n`;
    });
    downloadCSV(csvContent, 'full-schedule.csv');
    logActivity('Exported the full schedule.');
}

function downloadCSV(csvContent, fileName) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function processScheduleImport(file) {
    const statusBox = document.getElementById('import-status');
    statusBox.classList.remove('hidden');
    statusBox.innerHTML = 'Processing file...';
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);

            statusBox.innerHTML = `Found ${json.length} rows. Validating...\n`;
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const usersMap = {};
            usersSnapshot.forEach(doc => {
                usersMap[doc.data().name.toLowerCase()] = doc.id;
            });
            const batch = writeBatch(db);
            let validEntries = 0;
            let errors = [];
            json.forEach((row, index) => {
                const { EmployeeName, Date: date, StartTime, EndTime, Type } = row;
                if (!EmployeeName || !date || !Type) {
                    errors.push(`Row ${index + 2}: Missing required fields.`);
                    return;
                }
                const userId = usersMap[EmployeeName.toLowerCase()];
                if (!userId) {
                    errors.push(`Row ${index + 2}: Employee "${EmployeeName}" not found.`);
                    return;
                }
                const excelDate = new Date(Math.round((date - 25569) * 86400 * 1000));
                const dateStr = excelDate.toISOString().split('T')[0];
                let startTime, endTime;
                if (Type === 'Work') {
                    startTime = Timestamp.fromDate(new Date(`${dateStr}T${StartTime || '00:00'}`));
                    endTime = Timestamp.fromDate(new Date(`${dateStr}T${EndTime || '00:00'}`));
                } else {
                    startTime = Timestamp.fromDate(new Date(dateStr));
                    endTime = Timestamp.fromDate(new Date(dateStr));
                }
                const newScheduleRef = doc(collection(db, 'schedules'));
                batch.set(newScheduleRef, { userId, type: Type, startTime, endTime });
                validEntries++;
            });
            if (validEntries > 0) {
                await batch.commit();
                statusBox.innerHTML += `\nSUCCESS: Imported ${validEntries} entries.\n`;
                await logActivity(`Imported ${validEntries} entries from Excel.`);
                await loadAdminDashboardData();
            } else {
                statusBox.innerHTML += `\nNo valid entries found to import.\n`;
            }
            if (errors.length > 0) {
                statusBox.innerHTML += `\nERRORS:\n${errors.join('\n')}`;
            }
        } catch (error) {
            statusBox.innerHTML = `An error occurred: ${error.message}`;
            console.error(error);
        }
    };
    reader.readAsArrayBuffer(file);
}

// --- EVENT LISTENERS ---
document.getElementById('create-user-button').addEventListener('click', () => createUserModal.classList.remove('hidden'));
document.getElementById('users-table-body').addEventListener('click', async (e) => {
    const target = e.target.closest('.action-btn');
    if (!target) return;
    const userId = target.dataset.id;
    if (target.classList.contains('edit-btn')) {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            const user = userDoc.data();
            document.getElementById('edit-user-id').value = userId;
            document.getElementById('edit-user-name').value = user.name;
            document.getElementById('edit-user-role').value = user.role;
            editUserModal.classList.remove('hidden');
        }
    } else if (target.classList.contains('delete-btn')) {
        itemToDelete = { id: userId, name: target.dataset.name, type: 'user' };
        deleteModal.classList.remove('hidden');
    }
});
document.getElementById('schedule-bar-view').addEventListener('click', async (e) => {
    const target = e.target.closest('.action-btn');
    if (!target) return;
    const eventId = target.dataset.id;
    if (target.classList.contains('edit-event-btn')) {
        const eventDoc = await getDoc(doc(db, 'schedules', eventId));
        if (eventDoc.exists()) {
            const event = eventDoc.data();
            const employeeName = document.getElementById('view-schedule-employee').options[document.getElementById('view-schedule-employee').selectedIndex].text;
            document.getElementById('edit-event-id').value = eventId;
            document.getElementById('edit-event-employee-name').value = employeeName;
            document.getElementById('edit-event-date').value = event.startTime.toDate().toISOString().split('T')[0];
            document.getElementById('edit-event-type').value = event.type;
            const timeInputs = document.getElementById('edit-time-inputs-container');
            if (event.type === 'Work') {
                timeInputs.classList.remove('hidden');
                document.getElementById('edit-event-start-time').value = formatTime(event.startTime.toDate());
                document.getElementById('edit-event-end-time').value = formatTime(event.endTime.toDate());
            } else {
                timeInputs.classList.add('hidden');
            }
            editEventModal.classList.remove('hidden');
        }
    } else if (target.classList.contains('delete-event-btn')) {
        itemToDelete = { id: eventId, name: 'this event', type: 'event' };
        deleteModal.classList.remove('hidden');
    }
});
document.getElementById('add-event-button').addEventListener('click', () => {
    document.getElementById('add-event-form').reset();
    document.getElementById('time-inputs-container').classList.remove('hidden');
    flatpickr("#add-event-dates", { mode: "multiple", dateFormat: "Y-m-d", static: true });
    addEventModal.classList.remove('hidden');
});
document.getElementById('admin-prev-month-btn').addEventListener('click', () => {
    currentDisplayDate.setMonth(currentDisplayDate.getMonth() - 1);
    loadScheduleView();
});
document.getElementById('admin-next-month-btn').addEventListener('click', () => {
    currentDisplayDate.setMonth(currentDisplayDate.getMonth() + 1);
    loadScheduleView();
});
document.getElementById('employee-prev-month-btn').addEventListener('click', () => {
    currentDisplayDate.setMonth(currentDisplayDate.getMonth() - 1);
    const uid = auth.currentUser.uid;
    if(uid) loadEmployeeView(uid);
});
document.getElementById('employee-next-month-btn').addEventListener('click', () => {
    currentDisplayDate.setMonth(currentDisplayDate.getMonth() + 1);
    const uid = auth.currentUser.uid;
    if(uid) loadEmployeeView(uid);
});

// --- FORM SUBMISSION LISTENERS ---
document.getElementById('create-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-user-name').value;
    const email = document.getElementById('new-user-email').value;
    const password = document.getElementById('new-user-password').value;
    const role = document.getElementById('new-user-role').value;
    const secondaryApp = initializeApp(firebaseConfig, 'secondary-app-creation' + Date.now());
    const secondaryAuth = getAuth(secondaryApp);
    try {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        await setDoc(doc(db, "users", userCredential.user.uid), { name, email, role, passwordChanged: false });
        await logActivity(`Created new user: <strong>${name} (${role})</strong>.`);
        createUserModal.classList.add('hidden');
        e.target.reset();
        loadUsersPage();
        loadAdminDashboardData();
    } catch (error) { alert(`Error: ${error.message}`); }
    finally { await deleteApp(secondaryApp); }
});

document.getElementById('edit-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('edit-user-id').value;
    const name = document.getElementById('edit-user-name').value;
    const role = document.getElementById('edit-user-role').value;
    try {
        await updateDoc(doc(db, 'users', userId), { name, role });
        await logActivity(`Updated profile for <strong>${name}</strong>.`);
        editUserModal.classList.add('hidden');
        loadUsersPage();
        loadAdminDashboardData();
    } catch (error) { alert('Failed to update user.'); }
});

document.getElementById('add-event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('add-event-employee').value;
    const datesStr = document.getElementById('add-event-dates').value;
    const type = document.getElementById('event-type').value;
    const startTimeVal = document.getElementById('event-start-time').value;
    const endTimeVal = document.getElementById('event-end-time').value;
    const employeeSelect = document.getElementById('add-event-employee');
    const userName = employeeSelect.options[employeeSelect.selectedIndex].text;
    const dates = datesStr.split(', ').filter(d => d);
    if (dates.length === 0) {
        alert('Please select at least one date from the calendar.');
        return;
    }
    const batch = writeBatch(db);
    dates.forEach(dateStr => {
        let startTime, endTime;
        if (type === 'Work') {
            startTime = Timestamp.fromDate(new Date(`${dateStr}T${startTimeVal || '00:00'}`));
            endTime = Timestamp.fromDate(new Date(`${dateStr}T${endTimeVal || '00:00'}`));
        } else {
            startTime = Timestamp.fromDate(new Date(dateStr));
            endTime = Timestamp.fromDate(new Date(dateStr));
        }
        const newScheduleRef = doc(collection(db, 'schedules'));
        batch.set(newScheduleRef, { userId, type, startTime, endTime });
    });
    try {
        await batch.commit();
        await logActivity(`Added ${dates.length} event(s) for <strong>${userName}</strong>.`);
        addEventModal.classList.add('hidden');
        if (userId === document.getElementById('view-schedule-employee').value) {
            loadScheduleView();
        }
        loadAdminDashboardData();
    } catch (error) {
        alert('Failed to add events. Check format.');
    }
});

document.getElementById('edit-event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const eventId = document.getElementById('edit-event-id').value;
    const dateStr = document.getElementById('edit-event-date').value;
    const type = document.getElementById('edit-event-type').value;
    const startTimeVal = document.getElementById('edit-event-start-time').value;
    const endTimeVal = document.getElementById('edit-event-end-time').value;
    let startTime, endTime;
    if (type === 'Work') {
        startTime = Timestamp.fromDate(new Date(`${dateStr}T${startTimeVal || '00:00'}`));
        endTime = Timestamp.fromDate(new Date(`${dateStr}T${endTimeVal || '00:00'}`));
    } else {
        startTime = Timestamp.fromDate(new Date(dateStr));
        endTime = Timestamp.fromDate(new Date(dateStr));
    }
    try {
        await updateDoc(doc(db, 'schedules', eventId), { type, startTime, endTime });
        await logActivity(`Updated an event on ${dateStr}.`);
        editEventModal.classList.add('hidden');
        loadScheduleView();
        loadAdminDashboardData();
    } catch (error) {
        alert('Failed to update event.');
    }
});

document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
    if (!itemToDelete.id) return;
    if (itemToDelete.type === 'user') {
        try {
            await deleteDoc(doc(db, 'users', itemToDelete.id));
            await logActivity(`Deleted user: <strong>${itemToDelete.name}</strong>.`);
            loadUsersPage();
            loadAdminDashboardData();
            alert('User record deleted. Login credential must be removed manually from Firebase Console.');
        } catch (error) { alert('Failed to delete user.'); }
    } else if (itemToDelete.type === 'event') {
        try {
            await deleteDoc(doc(db, 'schedules', itemToDelete.id));
            await logActivity(`Deleted an event.`);
            loadScheduleView();
            loadAdminDashboardData();
        } catch (error) { alert('Failed to delete event.'); }
    }
    deleteModal.classList.add('hidden');
    itemToDelete = { id: null, name: null, type: null };
});

document.getElementById('change-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const errorEl = document.getElementById('password-change-error');
    errorEl.textContent = '';
    if (newPassword.length < 6) { errorEl.textContent = 'Password must be at least 6 characters.'; return; }
    if (newPassword !== confirmPassword) { errorEl.textContent = 'Passwords do not match.'; return; }
    try {
        const user = auth.currentUser;
        if (user) {
            await updatePassword(user, newPassword);
            await updateDoc(doc(db, 'users', user.uid), { passwordChanged: true });
            await logActivity('Changed their initial password.');
            changePasswordModal.classList.add('hidden');
            location.reload();
        }
    } catch (error) {
        errorEl.textContent = 'Failed to update password.';
    }
});

document.getElementById('event-type').addEventListener('change', (e) => {
    const timeInputs = document.getElementById('time-inputs-container');
    if (e.target.value === 'Work') { timeInputs.classList.remove('hidden'); } 
    else { timeInputs.classList.add('hidden'); }
});

document.getElementById('edit-event-type').addEventListener('change', (e) => {
    const timeInputs = document.getElementById('edit-time-inputs-container');
    if (e.target.value === 'Work') { timeInputs.classList.remove('hidden'); }
    else { timeInputs.classList.add('hidden'); }
});

document.querySelectorAll('.modal-close, #cancel-delete-btn').forEach(el => {
    el.addEventListener('click', () => {
        el.closest('.modal-backdrop').classList.add('hidden');
    });
});

// --- HELPER FUNCTIONS ---
function formatTime(date) {
    return date.toTimeString().slice(0, 5);
}

function generateScheduleBarViewHTML(year, month, events, isAdminView = false) {
    let html = `<div class="schedule-bar-month-header">${new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })}</div>`;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let eventsFound = false;

    for (let day = 1; day <= daysInMonth; day++) {
        if (events[day] && events[day].length > 0) {
            eventsFound = true;
            const date = new Date(year, month, day);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });

            let eventsHTML = '<div class="bar-events-container">';
            events[day].forEach(evt => {
                const type = evt.type || 'Work';
                const eventTypeClass = `event-${type}`;
                let displayText = type;
                let timeText = evt.time ? `<span class="bar-event-time">${evt.time}</span>` : '';

                if (type !== 'Work') {
                    timeText = '';
                }

                let actionButtons = '';
                if (isAdminView) {
                    actionButtons = `
                        <div class="event-actions">
                            <button class="action-btn edit-event-btn" data-id="${evt.id}">✏️</button>
                            <button class="action-btn delete-event-btn" data-id="${evt.id}">🗑️</button>
                        </div>
                    `;
                }

                eventsHTML += `
                    <div class="bar-event ${eventTypeClass}">
                        <span>${displayText}</span>
                        ${timeText}
                        ${actionButtons}
                    </div>
                `;
            });
            eventsHTML += '</div>';

            html += `
                <div class="schedule-bar">
                    <div class="bar-date">
                        ${dayName}<br>${String(day).padStart(2, '0')}
                    </div>
                    ${eventsHTML}
                </div>
            `;
        }
    }
    if (!eventsFound) {
        return html + '<p style="text-align:center; padding: 40px;">No events scheduled for this employee this month.</p>';
    }
    return html;
}