// Import the functions we need from the Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getDatabase, ref, onValue, set, get } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAMNlSlss_4AsFto0X3s0QHl1LQIQH8hqM",
    authDomain: "dap8-shift.firebaseapp.com",
    databaseURL: "https://dap8-shift-default-rtdb.firebaseio.com",
    projectId: "dap8-shift",
    storageBucket: "dap8-shift.firebasestorage.app",
    messagingSenderId: "850102198782",
    appId: "1:850102198782:web:413ad2e95c5b70ea29a0af"
};

// Initialize Firebase and get a reference to the database
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const employeeListRef = ref(database, 'employees/bb');

// --- HELPER FUNCTIONS for generating dates and times ---
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


document.addEventListener('DOMContentLoaded', () => {

    const initialNames = [
        'Basel Murdeaa', 'Andrej Opancar', 'Kristijan Vrbanic', 'Bocsan Patrik Robert Alexandru',
        'Hamidi Hamid', 'Sabanagic Tarik', 'Yaser Saif', 'Hamza Dalal', 'Abdulhamid Halawa',
        'Mohanad Makram', 'Omar Makram', 'Hassan Huseein Abdi', 'Mohammad Alhawama', 'Shirsha Muhabat',
        'Fuad Hassan', 'Iriskan Garsiev', 'Almatar Abdel Baki', 'Elbeih Karim', 'Mohammed Abdulahi',
        'Moser Patrick', 'Osman Mohamed', 'mahir Mahir', 'Bashir Osman Ali'
    ];

    const sampleDates = generateDateOptions();
    const initialEmployeeList = initialNames.map(name => ({
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        name: name,
        schedule: [
            { day: sampleDates[1], time: "02:00 - 10:00", task: "Picking", status: "Dienst" },
            { day: sampleDates[2], time: "N/A", task: "N/A", status: "Frei" }
        ]
    }));
    
    // --- RENDER EMPLOYEE LIST on mitarbeiter_bb pages ---
    const renderEmployeeList = (employeeList) => {
        const employeeGrid = document.querySelector('.employee-grid');
        if (!employeeGrid) return;
        
        employeeGrid.innerHTML = '';
        if (!employeeList || employeeList.length === 0) {
            employeeGrid.innerHTML = '<p>No employees found.</p>';
            return;
        }

        const isAdminPage = document.body.classList.contains('admin-page');

        employeeList.forEach(employee => {
            if (!employee) return;
            const card = document.createElement('div');
            card.className = 'employee-card';
            
            if (isAdminPage) {
                card.innerHTML = `
                    <a href="employee_schedule_admin.html?id=${employee.id}" class="employee-name-link">${employee.name}</a>
                    <div class="user-controls">
                        <button class="edit-user-btn" data-id="${employee.id}" data-name="${employee.name}">Edit Name</button>
                        <button class="delete-user-btn" data-id="${employee.id}">Delete User</button>
                    </div>
                `;
            } else {
                card.innerHTML = `<a href="employee_schedule.html?id=${employee.id}" class="employee-card-link"><span class="employee-name">${employee.name}</span></a>`;
            }
            employeeGrid.appendChild(card);
        });

        if (isAdminPage) {
            addUserAdminEventListeners();
        }
    };

    // --- RENDER INDIVIDUAL SCHEDULE on employee_schedule pages ---
    const renderEmployeeSchedule = (employee) => {
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
            const sortedSchedule = employee.schedule.sort((a, b) => {
                const [dayA, monthA, yearA] = a.day.split('.').map(p => p.trim().split(',')[0]);
                const [dayB, monthB, yearB] = b.day.split('.').map(p => p.trim().split(',')[0]);
                return new Date(`${yearA}-${monthA}-${dayA}`) - new Date(`${yearB}-${monthB}-${dayB}`);
            });

            sortedSchedule.forEach((shift, index) => {
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
                        <button class="delete-shift-btn" data-index="${index}">Delete</button>
                    </div>
                    ` : ''}
                `;
                scheduleContainer.appendChild(shiftDiv);
            });
        }
        if (isAdminPage) {
            addScheduleAdminEventListeners(employee.id);
        }
    };
    
    // --- DATA HANDLING & PAGE LOGIC ---
    if (document.querySelector('.employee-grid')) {
        onValue(employeeListRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                renderEmployeeList(data);
            } else {
                set(employeeListRef, initialEmployeeList);
            }
        });
    }

    if (document.querySelector('.schedule-container')) {
        const urlParams = new URLSearchParams(window.location.search);
        const employeeId = urlParams.get('id');

        if (employeeId) {
            onValue(employeeListRef, (snapshot) => {
                const allEmployees = snapshot.val();
                if (allEmployees) {
                    const employeeData = allEmployees.find(emp => emp && emp.id === employeeId);
                    renderEmployeeSchedule(employeeData);
                }
            });
        }
    }

    // --- ADMIN FUNCTIONALITY ---
    function addUserAdminEventListeners() {
        // Edit User Name
        document.querySelectorAll('.edit-user-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const userId = btn.dataset.id;
                const currentName = btn.dataset.name;
                const newName = prompt("Enter new name for employee:", currentName);
                if(newName && newName.trim() !== '') {
                    get(employeeListRef).then(snapshot => {
                        const allEmployees = snapshot.val();
                        const employeeIndex = allEmployees.findIndex(emp => emp && emp.id === userId);
                        if (employeeIndex > -1) {
                            set(ref(database, `employees/bb/${employeeIndex}/name`), newName.trim());
                        }
                    });
                }
            });
        });

        // Delete User
        document.querySelectorAll('.delete-user-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const userId = btn.dataset.id;
                if (confirm("Are you sure you want to delete this user and all their shifts? This cannot be undone.")) {
                    get(employeeListRef).then(snapshot => {
                        let allEmployees = snapshot.val();
                        allEmployees = allEmployees.filter(emp => emp && emp.id !== userId);
                        set(employeeListRef, allEmployees);
                    });
                }
            });
        });

        // Add User Button opens modal
        const addUserBtn = document.getElementById('add-employee-btn');
        const addUserModal = document.getElementById('add-user-modal');
        if (addUserBtn && addUserModal) {
            addUserBtn.addEventListener('click', () => {
                addUserModal.style.display = 'flex';
            });

            addUserModal.querySelector('.close-button').addEventListener('click', () => addUserModal.style.display = 'none');
            window.addEventListener('click', (event) => { if (event.target == addUserModal) { addUserModal.style.display = 'none'; }});
            
            const addUserForm = document.getElementById('add-user-form');
            addUserForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const newNameInput = document.getElementById('new-employee-name');
                const newName = newNameInput.value;
                
                if (newName && newName.trim() !== '') {
                    get(employeeListRef).then((snapshot) => {
                        const list = snapshot.val() || [];
                        const newEmployee = {
                            id: Date.now() + Math.random().toString(36).substr(2, 9),
                            name: newName.trim(),
                            schedule: []
                        };
                        list.push(newEmployee);
                        set(employeeListRef, list);
                    });
                    newNameInput.value = '';
                    addUserModal.style.display = 'none';
                }
            });
        }
    }
    
    function openShiftModal(employeeId) {
        const modal = document.getElementById('shift-edit-modal');
        const form = document.getElementById('shift-form');
        const dayCheckboxContainer = document.getElementById('day-checkbox-container');
        const startTimeSelect = document.getElementById('shift-start-time');
        const endTimeSelect = document.getElementById('shift-end-time');
        const statusRadios = form.querySelectorAll('input[name="status"]');
        const workFields = document.getElementById('work-fields');
        
        dayCheckboxContainer.innerHTML = generateDateOptions().map((d, i) => `
            <div class="checkbox-item">
                <input type="checkbox" id="date-${i}" name="day" value="${d}">
                <label for="date-${i}">${d}</label>
            </div>
        `).join('');
        
        startTimeSelect.innerHTML = generateTimeOptions().map(t => `<option value="${t}">${t}</option>`).join('');
        endTimeSelect.innerHTML = generateTimeOptions().map(t => `<option value="${t}">${t}</option>`).join('');
        
        form.reset();
        startTimeSelect.value = '02:00';
        endTimeSelect.value = '10:00';
        document.getElementById('status-dienst').checked = true;
        workFields.style.display = 'flex';

        statusRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'Dienst') {
                    workFields.style.display = 'flex';
                } else {
                    workFields.style.display = 'none';
                }
            });
        });
        
        modal.style.display = 'flex';
        
        form.onsubmit = (e) => {
            e.preventDefault();
            const selectedDays = Array.from(form.querySelectorAll('input[name="day"]:checked')).map(cb => cb.value);
            const status = form.querySelector('input[name="status"]:checked').value;

            if (selectedDays.length === 0) {
                alert("Please select at least one day.");
                return;
            }

            const newShiftData = {
                status: status,
                time: status === 'Dienst' ? `${form.startTime.value} - ${form.endTime.value}` : 'N/A',
                task: status === 'Dienst' ? form.task.value || 'N/A' : 'N/A'
            };

            get(employeeListRef).then(snapshot => {
                const allEmployees = snapshot.val();
                const employeeIndex = allEmployees.findIndex(emp => emp && emp.id === employeeId);
                if (employeeIndex > -1) {
                    const employee = allEmployees[employeeIndex];
                    if (!employee.schedule) employee.schedule = [];

                    selectedDays.forEach(day => {
                        employee.schedule.push({ ...newShiftData, day: day });
                    });
                    
                    set(ref(database, `employees/bb/${employeeIndex}`), employee);
                }
            });

            modal.style.display = 'none';
        };
    }

    function addScheduleAdminEventListeners(employeeId) {
        const addShiftBtn = document.getElementById('add-shift-btn');
        if (addShiftBtn) {
            addShiftBtn.addEventListener('click', () => openShiftModal(employeeId));
        }
        
        const clearScheduleBtn = document.getElementById('clear-schedule-btn');
        if (clearScheduleBtn) {
            clearScheduleBtn.addEventListener('click', () => {
                if (confirm("Are you sure you want to permanently delete all shifts for this user?")) {
                    get(employeeListRef).then(snapshot => {
                        const allEmployees = snapshot.val();
                        const employeeIndex = allEmployees.findIndex(emp => emp && emp.id === employeeId);
                        if(employeeIndex > -1) {
                            set(ref(database, `employees/bb/${employeeIndex}/schedule`), []);
                        }
                    });
                }
            });
        }

        document.querySelectorAll('.delete-shift-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const shiftIndexToDelete = parseInt(btn.dataset.index, 10);
                 if (confirm("Are you sure you want to delete this shift?")) {
                    get(employeeListRef).then(snapshot => {
                        const allEmployees = snapshot.val();
                        const employeeIndex = allEmployees.findIndex(emp => emp && emp.id === employeeId);
                        if (employeeIndex > -1 && allEmployees[employeeIndex].schedule) {
                            allEmployees[employeeIndex].schedule = allEmployees[employeeIndex].schedule.filter((_, i) => i !== shiftIndexToDelete);
                            set(ref(database, `employees/bb/${employeeIndex}`), allEmployees[employeeIndex]);
                        }
                    });
                 }
            });
        });
        
        const modal = document.getElementById('shift-edit-modal');
        if(modal) {
            modal.querySelector('.close-button').addEventListener('click', () => modal.style.display = 'none');
            window.addEventListener('click', (event) => { if (event.target == modal) { modal.style.display = 'none'; }});
        }
    }

    const adminLoginBtn = document.getElementById('admin-login-btn');
    if (adminLoginBtn) {
        const loginModal = document.getElementById('login-modal');
        const closeModalBtn = document.querySelector('#login-modal .close-button');
        const loginForm = document.getElementById('login-form');
        const loginError = document.getElementById('login-error');

        adminLoginBtn.addEventListener('click', () => { loginModal.style.display = 'flex'; });
        closeModalBtn.addEventListener('click', () => { loginModal.style.display = 'none'; loginError.style.display = 'none'; });
        window.addEventListener('click', (event) => { if (event.target === loginModal) { loginModal.style.display = 'none'; loginError.style.display = 'none'; } });

        loginForm.addEventListener('submit', (event) => {
            event.preventDefault();
            if (document.getElementById('admin-id').value === 'DAP8' && document.getElementById('admin-pass').value === '123456') {
                window.location.href = 'mitarbeiter_bb_admin.html';
            } else {
                loginError.style.display = 'block';
            }
        });
    }
});