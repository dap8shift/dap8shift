// Import the functions we need from the Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getDatabase, ref, onValue, set, get } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

// Your web app's Firebase configuration for the AMAZON site
const firebaseConfig = {
    apiKey: "AIzaSyAMNlSlss_4AsFto0X3s0QHl1LQIQH8hqM",
    authDomain: "dap8-shift.firebaseapp.com",
    databaseURL: "https://dap8-shift-default-rtdb.firebaseio.com",
    projectId: "dap8-shift",
    storageBucket: "dap8-shift.firebasestorage.app",
    messagingSenderId: "850102198782",
    appId: "1:850102198782:web:413ad2e95c5b70ea29a0af"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// --- HELPER FUNCTIONS ---
const generateDateOptions = () => {
    const options = [];
    const today = new Date();
    const formatter = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', weekday: 'long' });
    for (let i = 0; i < 60; i++) {
        const date = new Date();
        date.setDate(today.getDate() + i);
        const parts = formatter.formatToParts(date);
        const day = parts.find(p => p.type === 'day').value;
        const month = parts.find(p => p.type === 'month').value;
        const year = parts.find(p => p.type === 'year').value;
        const weekday = parts.find(p => p.type === 'weekday').value;
        options.push(`${day}.${month}.${year}, ${weekday}`);
    }
    return options;
};

const generateTimeOptions = () => {
    const options = [];
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 30) {
            const hour = h.toString().padStart(2, '0');
            const minute = m.toString().padStart(2, '0');
            options.push(`${hour}:${minute}`);
        }
    }
    return options;
};


// --- RENDER FUNCTIONS ---
const renderEmployeeList = (employeeList, shiftType) => {
    const employeeGrid = document.querySelector('.employee-grid');
    if (!employeeGrid) return;
    
    employeeGrid.innerHTML = '';
    if (!employeeList || employeeList.length === 0) {
        employeeGrid.innerHTML = '<p>No employees found.</p>';
        return;
    }

    const isAdminPage = document.body.classList.contains('admin-page');
    const pageName = isAdminPage ? 'employee_schedule_admin.html' : 'employee_schedule.html';

    employeeList.forEach(employee => {
        if (!employee) return;
        const card = document.createElement('div');
        card.className = 'employee-card';
        
        if (isAdminPage) {
            card.innerHTML = `
                <a href="${pageName}?shift=${shiftType}&id=${employee.id}" class="employee-name-link">${employee.name}</a>
                <div class="user-controls">
                    <button class="edit-user-btn" data-id="${employee.id}" data-name="${employee.name}">Edit Name</button>
                    <button class="delete-user-btn" data-id="${employee.id}">Delete User</button>
                </div>
            `;
        } else {
            card.innerHTML = `<a href="${pageName}?shift=${shiftType}&id=${employee.id}" class="employee-card-link"><span class="employee-name">${employee.name}</span></a>`;
        }
        employeeGrid.appendChild(card);
    });

    if (isAdminPage) {
        addUserAdminEventListeners(shiftType);
    }
};

const renderEmployeeSchedule = (employee, shiftType) => {
    const scheduleContainer = document.querySelector('.schedule-container');
    const employeeNameTitle = document.getElementById('employee-name-title');
    const isAdminPage = document.body.classList.contains('admin-schedule-page');

    if (!scheduleContainer || !employee) {
        if (employeeNameTitle) employeeNameTitle.textContent = "Employee Not Found";
        return;
    };

    employeeNameTitle.textContent = `${employee.name}'s Schedule`;
    scheduleContainer.innerHTML = '';

    if (!employee.schedule || employee.schedule.length === 0) {
        scheduleContainer.innerHTML = '<p class="no-schedule">No schedule assigned.</p>';
    } else {
        const scheduleWithIndices = employee.schedule.map((shift, index) => ({...shift, originalIndex: index}));
        const sortedSchedule = scheduleWithIndices.sort((a, b) => {
            if (!a || !b) return 0;
            const [dayA, monthA, yearA] = a.day.split('.').map(p => p.trim().split(',')[0]);
            const [dayB, monthB, yearB] = b.day.split('.').map(p => p.trim().split(',')[0]);
            return new Date(`${yearA}-${monthA}-${dayA}`) - new Date(`${yearB}-${monthB}-${dayB}`);
        });

        sortedSchedule.forEach((shift) => {
            if (!shift) return;
            const shiftDiv = document.createElement('div');
            shiftDiv.className = 'shift-item';
            
            if (shift.status) {
                shiftDiv.classList.add(shift.status.toLowerCase());
            }
            const isWorkShift = shift.status === 'Dienst';
            shiftDiv.innerHTML = `
                <div class="shift-day">${shift.day}</div>
                ${isWorkShift ? `
                    <div class="shift-time">${shift.time}</div>
                    <div class="shift-task">${shift.task}</div>
                ` : `<div class="shift-status-display">${shift.status}</div>`}
                
                ${isAdminPage ? `
                <div class="schedule-controls">
                    <button class="edit-shift-btn" data-index="${shift.originalIndex}">Edit</button>
                    <button class="delete-shift-btn" data-index="${shift.originalIndex}">Delete</button>
                </div>
                ` : ''}
            `;
            scheduleContainer.appendChild(shiftDiv);
        });
    }
    if (isAdminPage) {
        addScheduleAdminEventListeners(employee.id, shiftType);
    }
};


// --- ADMIN EVENT LISTENER FUNCTIONS ---
function addUserAdminEventListeners(shiftType) {
    const employeeListRef = ref(database, `${shiftType}/bb`);
    document.querySelectorAll('.edit-user-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const userId = btn.dataset.id;
            const currentName = btn.dataset.name;
            const newName = prompt("Enter new name for employee:", currentName);
            if (newName && newName.trim() !== '') {
                get(employeeListRef).then(snapshot => {
                    const allEmployees = snapshot.val() || [];
                    const employeeIndex = allEmployees.findIndex(emp => emp && emp.id === userId);
                    if (employeeIndex > -1) {
                        set(ref(database, `${shiftType}/bb/${employeeIndex}/name`), newName.trim());
                    }
                });
            }
        });
    });
    document.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const userId = btn.dataset.id;
            if (confirm("Are you sure you want to delete this user and all their shifts? This cannot be undone.")) {
                get(employeeListRef).then(snapshot => {
                    let allEmployees = snapshot.val() || [];
                    allEmployees = allEmployees.filter(emp => emp && emp.id !== userId);
                    set(employeeListRef, allEmployees);
                });
            }
        });
    });
    const addUserBtn = document.getElementById('add-employee-btn');
    const addUserModal = document.getElementById('add-user-modal');
    if (addUserBtn && addUserModal) {
        addUserBtn.addEventListener('click', () => { addUserModal.style.display = 'flex'; });
        addUserModal.querySelector('.close-button').addEventListener('click', () => addUserModal.style.display = 'none');
        window.addEventListener('click', (event) => { if (event.target == addUserModal) { addUserModal.style.display = 'none'; } });
        const addUserForm = document.getElementById('add-user-form');
        addUserForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const newNameInput = document.getElementById('new-employee-name');
            const newName = newNameInput.value;
            if (newName && newName.trim() !== '') {
                get(employeeListRef).then((snapshot) => {
                    const list = snapshot.val() || [];
                    const newEmployee = { id: Date.now() + Math.random().toString(36).substr(2, 9), name: newName.trim(), schedule: [] };
                    list.push(newEmployee);
                    set(employeeListRef, list);
                });
                newNameInput.value = '';
                addUserModal.style.display = 'none';
            }
        });
    }
}
    
function openShiftModal(employeeId, shiftType, shiftIndex = null) {
    const modal = document.getElementById('shift-edit-modal');
    const form = document.getElementById('shift-form');
    const modalTitle = document.getElementById('modal-title');
    const dayCheckboxContainer = document.getElementById('day-checkbox-container');
    const daySelectLabel = document.getElementById('day-select-label');
    const editingDayDisplay = document.getElementById('editing-day-display');
    const startTimeSelect = document.getElementById('shift-start-time');
    const endTimeSelect = document.getElementById('shift-end-time');
    const statusRadios = form.querySelectorAll('input[name="status"]');
    const workFields = document.getElementById('work-fields');
    if (startTimeSelect.innerHTML === '') {
        startTimeSelect.innerHTML = generateTimeOptions().map(t => `<option value="${t}">${t}</option>`).join('');
        endTimeSelect.innerHTML = generateTimeOptions().map(t => `<option value="${t}">${t}</option>`).join('');
    }
    const toggleWorkFields = () => {
        const selectedStatus = form.querySelector('input[name="status"]:checked').value;
        workFields.style.display = selectedStatus === 'Dienst' ? 'flex' : 'none';
    };
    statusRadios.forEach(radio => radio.addEventListener('change', toggleWorkFields));
    if (shiftIndex !== null) {
        modalTitle.textContent = "Edit Shift";
        dayCheckboxContainer.style.display = 'none';
        daySelectLabel.style.display = 'none';
        editingDayDisplay.style.display = 'block';
        get(ref(database, `${shiftType}/bb`)).then(snapshot => {
            const employee = snapshot.val().find(e => e.id === employeeId);
            const shift = employee.schedule[shiftIndex];
            editingDayDisplay.textContent = `Editing shift for: ${shift.day}`;
            form.querySelector(`input[name="status"][value="${shift.status}"]`).checked = true;
            if (shift.status === 'Dienst') {
                const [startTime, endTime] = shift.time.split(' - ');
                form.startTime.value = startTime || '02:00';
                form.endTime.value = endTime || '10:00';
                form.task.value = shift.task;
            }
            toggleWorkFields();
        });
    } else {
        modalTitle.textContent = "Add New Shift(s)";
        dayCheckboxContainer.style.display = 'block';
        daySelectLabel.style.display = 'block';
        editingDayDisplay.style.display = 'none';
        dayCheckboxContainer.innerHTML = generateDateOptions().map((d, i) => `<div class="checkbox-item"><input type="checkbox" id="date-${i}" name="day" value="${d}"><label for="date-${i}">${d}</label></div>`).join('');
        form.reset();
        startTimeSelect.value = '02:00';
        endTimeSelect.value = '10:00';
        document.getElementById('status-dienst').checked = true;
        toggleWorkFields();
    }
    modal.style.display = 'flex';
    form.onsubmit = (e) => {
        e.preventDefault();
        const status = form.querySelector('input[name="status"]:checked').value;
        const newShiftData = { status: status, time: status === 'Dienst' ? `${form.startTime.value} - ${form.endTime.value}` : 'N/A', task: status === 'Dienst' ? form.task.value || 'N/A' : 'N/A' };
        get(ref(database, `${shiftType}/bb`)).then(snapshot => {
            const allEmployees = snapshot.val();
            const employeeIndex = allEmployees.findIndex(emp => emp && emp.id === employeeId);
            if (employeeIndex > -1) {
                const employee = allEmployees[employeeIndex];
                if (!employee.schedule) employee.schedule = [];
                if (shiftIndex !== null) {
                    newShiftData.day = employee.schedule[shiftIndex].day;
                    employee.schedule[shiftIndex] = newShiftData;
                } else {
                    const selectedDays = Array.from(form.querySelectorAll('input[name="day"]:checked')).map(cb => cb.value);
                    if (selectedDays.length === 0) {
                        alert("Please select at least one day.");
                        return;
                    }
                    selectedDays.forEach(day => { employee.schedule.push({ ...newShiftData, day: day }); });
                }
                set(ref(database, `${shiftType}/bb/${employeeIndex}`), employee);
            }
        });
        modal.style.display = 'none';
    };
}

function addScheduleAdminEventListeners(employeeId, shiftType) {
    const employeeListRef = ref(database, `${shiftType}/bb`);

    const whatsappBtn = document.getElementById('whatsapp-notify-btn');
    if (whatsappBtn) {
        const message = "Attention: The Amazon schedule has been updated. Please check the site. https://dap8shift.github.io/dap8shift";
        const whatsappURL = `https://wa.me/?text=${encodeURIComponent(message)}`;
        whatsappBtn.href = whatsappURL;
    }

    const addShiftBtn = document.getElementById('add-shift-btn');
    if (addShiftBtn) {
        addShiftBtn.addEventListener('click', () => openShiftModal(employeeId, shiftType));
    }
    const clearScheduleBtn = document.getElementById('clear-schedule-btn');
    if (clearScheduleBtn) {
        clearScheduleBtn.addEventListener('click', () => {
            const confirmModal = document.getElementById('confirm-modal');
            if(confirmModal) confirmModal.style.display = 'flex';
        });
    }

    const confirmBtn = document.getElementById('confirm-delete-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            get(employeeListRef).then(snapshot => {
                const allEmployees = snapshot.val();
                const employeeIndex = allEmployees.findIndex(emp => emp && emp.id === employeeId);
                if(employeeIndex > -1) {
                    allEmployees[employeeIndex].schedule = [];
                    set(ref(database, `${shiftType}/bb/${employeeIndex}`), allEmployees[employeeIndex]);
                }
            });
            document.getElementById('confirm-modal').style.display = 'none';
        }, { once: true });
    }

    document.querySelectorAll('.edit-shift-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const shiftIndex = parseInt(btn.dataset.index, 10);
            openShiftModal(employeeId, shiftType, shiftIndex);
        });
    });
    document.querySelectorAll('.delete-shift-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const shiftIndexToDelete = parseInt(btn.dataset.index, 10);
            if (confirm("Are you sure you want to delete this shift?")) {
                get(employeeListRef).then(snapshot => {
                    const allEmployees = snapshot.val();
                    const employeeIndex = allEmployees.findIndex(emp => emp && emp.id === employeeId);
                    if (employeeIndex > -1 && allEmployees[employeeIndex].schedule) {
                        allEmployees[employeeIndex].schedule.splice(shiftIndexToDelete, 1);
                        set(ref(database, `${shiftType}/bb/${employeeIndex}`), allEmployees[employeeIndex]);
                    }
                });
            }
        });
    });
    
    const shiftModal = document.getElementById('shift-edit-modal');
    if(shiftModal) {
        shiftModal.querySelector('.close-button').addEventListener('click', () => shiftModal.style.display = 'none');
        window.addEventListener('click', (event) => { if (event.target == shiftModal) { shiftModal.style.display = 'none'; }});
    }
}


// --- MAIN APP INITIALIZATION (STABLE VERSION) ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Check for a unique element on the current page to run its specific setup function
    if (document.querySelector('.options-container')) {
        setupShiftPage();
    } else if (document.querySelector('.employee-grid')) {
        setupEmployeeListPage();
    } else if (document.querySelector('.schedule-container')) {
        setupSchedulePage();
    }
});


function setupShiftPage() {
    const adminLoginBtn = document.getElementById('admin-login-btn');
    const loginModal = document.getElementById('login-modal');
    if (!adminLoginBtn || !loginModal) return;

    const closeModalBtn = loginModal.querySelector('.close-button');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');

    adminLoginBtn.addEventListener('click', () => {
        const targetShift = adminLoginBtn.dataset.shiftType;
        localStorage.setItem('adminShiftTarget', targetShift);
        loginModal.style.display = 'flex';
    });

    closeModalBtn.addEventListener('click', () => { loginModal.style.display = 'none'; loginError.style.display = 'none'; });
    window.addEventListener('click', (event) => { if (event.target === loginModal) { loginModal.style.display = 'none'; loginError.style.display = 'none'; } });

    loginForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const idInput = document.getElementById('admin-id').value;
        const passInput = document.getElementById('admin-pass').value;
        if (idInput === 'DAP8' && passInput === '123456') {
            const targetShift = localStorage.getItem('adminShiftTarget');
            if (targetShift) {
                const redirectName = targetShift.replace('_shift', '');
                window.location.href = `mitarbeiter_bb_${redirectName}_admin.html`;
            }
        } else {
            loginError.style.display = 'block';
        }
    });
}

function setupEmployeeListPage() {
    const shiftType = document.body.dataset.shiftType;
    if (!shiftType) return;
    
    const initialNames_night_shift = [ 'Basel Murdeaa', 'Andrej Opancar', 'Kristijan Vrbanic', 'Bocsan Patrik Robert Alexandru', 'Hamidi Hamid', 'Sabanagic Tarik', 'Yaser Saif', 'Hamza Dalal', 'Abdulhamid Halawa', 'Mohanad Makram', 'Omar Makram', 'Hassan Huseein Abdi', 'Mohammad Alhawama', 'Shirsha Muhabat', 'Fuad Hassan', 'Iriskan Garsiev', 'Almatar Abdel Baki', 'Elbeih Karim', 'Mohammed Abdulahi', 'Moser Patrick', 'Osman Mohamed', 'mahir Mahir', 'Bashir Osman Ali' ];
    const initialNames_hybrid_shift = [ 'Feysal Abdifatah', 'Ahmmad Albakar Alabdalah', 'Maulid Yussuf', 'Duska Ramsak', 'Robert Glavina', 'Aladi Zayan', 'Ibe Mark', 'Mehmet Akif Uenal', 'Bahzad Badini' ];
    const initialNames_early_shift = [ 'Ibrahim Nesar', 'Nuur Abdirahman', 'Akindutire Gbolahan Tijani', 'Ahmadi Ali Ullah', 'Rashid Gulstan', 'Sleman Sheikho', 'Berivan Ali', 'Fauster Daniela', 'Arab Farhan', 'Saleh Marwan' ];
    const initialNames_late_shift = [ 'Chikwakwa Chimwemmwe', 'Farghaly Hager' ];
    const createInitialList = (names) => names.map(name => ({ id: Date.now() + Math.random().toString(36).substr(2, 9), name: name, schedule: [] }));
    const initialData = {
        night_shift: { bb: createInitialList(initialNames_night_shift) },
        hybrid_shift: { bb: createInitialList(initialNames_hybrid_shift) },
        early_shift: { bb: createInitialList(initialNames_early_shift) },
        late_shift: { bb: createInitialList(initialNames_late_shift) }
    };

    const employeeListRef = ref(database, `${shiftType}/bb`);
    onValue(employeeListRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            renderEmployeeList(data, shiftType);
        } else {
            set(ref(database, shiftType), initialData[shiftType]);
        }
    });
}

function setupSchedulePage() {
    const urlParams = new URLSearchParams(window.location.search);
    const shiftType = urlParams.get('shift');
    const employeeId = urlParams.get('id');
    if (shiftType && employeeId) {
        onValue(ref(database, `${shiftType}/bb`), (snapshot) => {
            const allEmployees = snapshot.val();
            if (allEmployees) {
                const employeeData = allEmployees.find(emp => emp && emp.id === employeeId);
                renderEmployeeSchedule(employeeData, shiftType);
            }
        });
    }

    const confirmModal = document.getElementById('confirm-modal');
    if (confirmModal) {
        const cancelBtn = document.getElementById('cancel-delete-btn');
        const closeBtn = confirmModal.querySelector('.close-button');
        const closeHandler = () => confirmModal.style.display = 'none';
        if(closeBtn) closeBtn.addEventListener('click', closeHandler);
        if(cancelBtn) cancelBtn.addEventListener('click', closeHandler);
        window.addEventListener('click', (event) => { if (event.target === confirmModal) { closeHandler(); } });
    }
}