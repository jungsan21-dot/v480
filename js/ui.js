// UI 관리 모듈
App.UI = (function() {
    // ✨ App.Data 모듈을 직접 참조하도록 변경하여 오류 수정
    const DOMElements = {
        chartContainer: document.getElementById('chart-container'),
        mainTitle: document.getElementById('main-title'),
        versionDisplay: document.getElementById('version-display'),
        wakeLockStatus: document.getElementById('wake-lock-status'),
        dateDisplaySection: document.getElementById('date-display-section'),
        timeDisplaySection: document.getElementById('time-display-section'),
        loanDateContainer: document.getElementById('loan-date-container'),
        returnDateContainer: document.getElementById('return-date-container'),
        gachaModal: document.getElementById('gacha-modal'),
        gachaIframe: document.getElementById('gacha-iframe')
    };
    
    const cardColors = ['#eff6ff', '#f0fdf4', '#fefce8', '#fef2f2', '#faf5ff', '#fdf2f8', '#eef2ff', '#f0fdfa'];
    const buttonColors = ['#2563eb', '#16a34a', '#ca8a04', '#dc2626', '#9333ea', '#db2777', '#4f46e5', '#0d9488'];
    let lastRenderedDate = null;

    function applyDesignSettings(settings) {
        const styleTag = document.getElementById('dynamic-styles') || document.createElement('style');
        styleTag.id = 'dynamic-styles';
        styleTag.innerHTML = `
            :root { --top-display-height: ${settings.topDisplayHeight}vh; }
            .student-name, .student-name-input { font-size: clamp(${settings.studentNameSize * 0.8}em, ${settings.studentNameSize * 2}vh, ${settings.studentNameSize}em) !important; }
        `;
        document.head.appendChild(styleTag);
    }
    
    function renderStudents(state, modes, handlers) {
        DOMElements.chartContainer.innerHTML = '';
        const maxAttendance = Math.max(0, ...state.studentData.map(s => s.attendanceCount));
        
        state.initialStudentNames.forEach(name => {
            const student = state.studentData.find(s => s.name === name);
            if (!student) return;

            const studentIndex = state.studentData.indexOf(student);
            const card = document.createElement('div');
            card.className = 'student-card';
            const colorIndex = state.initialStudentNames.indexOf(student.name) % cardColors.length;
            card.style.backgroundColor = cardColors[colorIndex];
            
            const hasAttendedToday = student.lastCheckInDate === App.Data.getCurrentDate(); // ✨ 직접 참조
            const nameDiv = document.createElement('div');
            nameDiv.className = 'student-name';
            nameDiv.textContent = (maxAttendance > 0 && student.attendanceCount === maxAttendance) ? `${student.name} 👑` : student.name;
            
            if (modes.isStudentManage) {
                card.setAttribute('draggable', true);
                card.dataset.studentName = student.name;
                nameDiv.classList.add('editable');
                nameDiv.title = '클릭하여 이름 수정';
                nameDiv.onclick = (e) => handlers.nameEdit(e.currentTarget, studentIndex);

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-student-btn';
                deleteBtn.textContent = 'X';
                deleteBtn.onclick = () => handlers.deleteStudent(studentIndex);
                card.appendChild(deleteBtn);
            }
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'attendance-info';
            infoDiv.innerHTML = `<span class="count">${student.attendanceCount}</span><span class="label"> / ${state.TOTAL_DAYS_IN_MONTH}회</span>`;

            const buttonsDiv = document.createElement('div');
            buttonsDiv.className = 'action-buttons';

            if (modes.isManual) {
                const plusBtn = document.createElement('button');
                plusBtn.className = 'circular-btn';
                plusBtn.textContent = '+1';
                plusBtn.style.backgroundColor = '#28a745';
                plusBtn.onclick = () => handlers.manualIncrement(studentIndex);
                
                const minusBtn = document.createElement('button');
                minusBtn.className = 'circular-btn';
                minusBtn.textContent = '-1';
                minusBtn.style.backgroundColor = '#dc3545';
                minusBtn.onclick = () => handlers.manualDecrement(studentIndex);
                buttonsDiv.appendChild(minusBtn);
                buttonsDiv.appendChild(plusBtn);
            } else if (!modes.isStudentManage) {
                const mainBtn = document.createElement('button');
                mainBtn.className = 'circular-btn';
                if (hasAttendedToday) {
                    mainBtn.textContent = '성공! 🎉';
                    mainBtn.classList.add('undo-btn');
                    mainBtn.onclick = () => handlers.undo(studentIndex);
                } else {
                    mainBtn.textContent = '출석';
                    mainBtn.style.backgroundColor = buttonColors[colorIndex];
                    mainBtn.onclick = () => handlers.checkIn(studentIndex);
                }
                buttonsDiv.appendChild(mainBtn);
            }
            
            const giftContainer = document.createElement('div');
            giftContainer.className = 'gift-btn-container';
            [13, 18].forEach(day => {
                if (student.attendanceCount >= day) {
                    const giftBtn = document.createElement('button');
                    giftBtn.className = 'circular-btn gift-btn';
                    giftBtn.innerHTML = '🎁';
                    giftBtn.title = `${day}일 출석 선물`;
                    if (student.usedGachas.includes(day)) {
                        giftBtn.disabled = true;
                    }
                    giftBtn.onclick = () => {
                        student.usedGachas.push(day);
                        App.Data.saveData(); // ✨ 직접 참조
                        handlers.render();
                        openGachaModal();
                    };
                    giftContainer.appendChild(giftBtn);
                }
            });

            if (giftContainer.hasChildNodes()) buttonsDiv.appendChild(giftContainer);
            card.appendChild(nameDiv);
            card.appendChild(infoDiv);
            card.appendChild(buttonsDiv);
            DOMElements.chartContainer.appendChild(card);
        });

        if (modes.isStudentManage) handlers.setupDragAndDrop();
    }

    function renderDateDisplay() {
        const todayDateString = App.Data.getCurrentDate(); // ✨ 직접 참조
        if (lastRenderedDate === todayDateString) return;
        const koreanHolidays = new Set(['2025-01-01', '2025-01-28', '2025-01-29', '2025-01-30', '2025-03-01', '2025-05-05', '2025-05-06', '2025-06-06', '2025-08-15', '2025-10-03', '2025-10-06', '2025-10-07', '2025-10-08', '2025-10-09', '2025-12-25']);
        function isWeekendOrHoliday(date) {
            const day = date.getDay();
            if (day === 0 || day === 6) return true;
            const dateString = date.getFullYear() + '-' + ('0' + (date.getMonth() + 1)).slice(-2) + '-' + ('0' + date.getDate()).slice(-2);
            return koreanHolidays.has(dateString);
        }
        function formatDateToHTML(date) {
            const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
            return `<span class="date-number">${date.getMonth() + 1}</span><span class="date-text">월</span><span class="date-number">${date.getDate()}</span><span class="date-text">일 (${dayOfWeek})</span>`;
        }
        const loanDate = new Date();
        DOMElements.loanDateContainer.innerHTML = formatDateToHTML(loanDate);
        const returnDate = new Date();
        returnDate.setDate(loanDate.getDate() + 14);
        while (isWeekendOrHoliday(returnDate)) {
            returnDate.setDate(returnDate.getDate() + 1);
        }
        DOMElements.returnDateContainer.innerHTML = formatDateToHTML(returnDate);
        lastRenderedDate = todayDateString;
    }

function updateTimeDisplay() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = days[now.getDay()];

    const hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? '오후' : '오전';
    const displayHours = hours % 12 || 12;
    
    // 날짜 문자열 생성
    const dateString = `${month}월 ${date}일 (${dayName})`;

    // 시간과 날짜를 함께 표시하도록 HTML 구조 변경
    DOMElements.timeDisplaySection.innerHTML = `
        <div class="time-wrapper">
            <span class="time-icon">🕒</span>
            <span class="time-sub">${ampm}</span>
            <span class="time-main">${displayHours}</span>
            <span class="time-sub">시</span>
            <span class="time-main">${minutes}</span>
            <span class="time-sub">분</span>
        </div>
        <div class="time-date-info">${dateString}</div>
    `;
}
    
    function openGachaModal() {
        notifyParent('pauseTimer'); // ✨ 가챠 모달 열 때 타이머 중지
        DOMElements.gachaIframe.src = 'gacha.html';
        DOMElements.gachaModal.style.display = 'flex';
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.student-card:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    return { DOMElements, applyDesignSettings, renderStudents, renderDateDisplay, updateTimeDisplay, openGachaModal, getDragAfterElement };

})();

