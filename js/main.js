// ✨ 부모 창(display.html)에 메시지를 보내는 함수
function notifyParent(message) {
    // 현재 창이 iframe 안에 있을 경우에만 메시지를 보냄
    if (window.self !== window.top) {
        window.parent.postMessage(message, '*');
    }
}
document.addEventListener('DOMContentLoaded', () => {
    const Data = App.Data;
    const UI = App.UI;
    const DOMElements = UI.DOMElements;

    let isManualModeActive = false;
    let isStudentManageModeActive = false;
    let audioCtx, wakeLockSentinel, alarmOscillator, alarmInterval;
    let alarmFlags = {};
    let draggedStudentName = null;

    function playSound(type) {
        if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } }
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        if (type === 'check-in') {
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1);
        } else {
            oscillator.type = 'triangle';
            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(660, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(330, audioCtx.currentTime + 0.1);
        }
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.1);
    }
    
    function handleCheckIn(studentIndex) {
        // ✨ 수정: 항상 최신 데이터를 직접 참조하도록 변경
        const student = Data.state.studentData[studentIndex];
        if (student.lastCheckInDate === Data.getCurrentDate()) return;
        playSound('check-in');
        student.attendanceCount++;
        student.lastCheckInDate = Data.getCurrentDate();
        Data.saveData();
        renderApp();
    }
    
    function handleUndo(studentIndex) {
        // ✨ 수정
        const student = Data.state.studentData[studentIndex];
        if (student.lastCheckInDate === Data.getCurrentDate()) {
            playSound('undo');
            student.attendanceCount--;
            student.lastCheckInDate = null;
            Data.saveData();
            renderApp();
        }
    }
    
    function handleManualIncrement(studentIndex) {
        playSound('check-in');
        // ✨ 수정
        Data.state.studentData[studentIndex].attendanceCount++;
        Data.saveData();
        renderApp();
    }
    
    function handleManualDecrement(studentIndex) {
        // ✨ 수정
        if (Data.state.studentData[studentIndex].attendanceCount > 0) {
            playSound('undo');
            Data.state.studentData[studentIndex].attendanceCount--;
            Data.saveData();
            renderApp();
        }
    }

    function handleNameEdit(nameDiv, studentIndex) {
        // ✨ 수정
        const currentName = Data.state.studentData[studentIndex].name;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'student-name-input';
        input.value = currentName;
        nameDiv.replaceWith(input);
        input.focus();
        const saveName = () => {
            const newName = input.value.trim();
            // ✨ 수정
            if (newName && newName !== currentName && !Data.state.initialStudentNames.includes(newName)) {
                Data.state.initialStudentNames[Data.state.initialStudentNames.indexOf(currentName)] = newName;
                Data.state.studentData[studentIndex].name = newName;
                Data.saveData();
            }
            renderApp();
        };
        input.onblur = saveName;
        input.onkeydown = (e) => { if (e.key === 'Enter') input.blur(); };
    }

    function handleDeleteStudent(studentIndex) {
        // ✨ 수정
        const studentName = Data.state.studentData[studentIndex].name;
        if (confirm(`'${studentName}' 학생을 정말로 삭제하시겠습니까?`)) {
            Data.state.studentData.splice(studentIndex, 1);
            Data.state.initialStudentNames = Data.state.initialStudentNames.filter(name => name !== studentName);
            Data.saveData();
            renderApp();
        }
    }
    
    function enterManualMode() {
        isManualModeActive = true;
        document.getElementById('admin-button').style.display = 'none';
        document.getElementById('manual-mode-button').style.display = 'none';
        document.getElementById('gacha-unlimited-button').style.display = 'none';
        document.getElementById('student-manage-button').style.display = 'none';
        document.getElementById('exit-mode-button').style.display = 'inline-block';
        document.getElementById('manual-mode-all-controls').style.display = 'flex';
        renderApp();
    }

    function enterStudentManageMode() {
        isStudentManageModeActive = true;
        document.getElementById('admin-button').style.display = 'none';
        document.getElementById('manual-mode-button').style.display = 'none';
        document.getElementById('gacha-unlimited-button').style.display = 'none';
        document.getElementById('student-manage-button').style.display = 'none';
        document.getElementById('exit-mode-button').style.display = 'inline-block';
        document.getElementById('add-student-button-header').style.display = 'inline-block';
        renderApp();
    }

    function openAdminModal() {
        const adminModal = document.getElementById('admin-modal');
        // ✨ 수정
        document.getElementById('student-select-reward').innerHTML = Data.state.studentData.map((s, i) => `<option value="${i}">${s.name}</option>`).join('');
        document.getElementById('alarm-time-1').value = Data.state.alarmTimes[0];
        document.getElementById('alarm-time-2').value = Data.state.alarmTimes[1];
        const fontSizeSlider = document.getElementById('font-size-slider');
        const topDisplayHeightSlider = document.getElementById('top-display-height-slider');
        fontSizeSlider.value = Data.state.designSettings.studentNameSize;
        topDisplayHeightSlider.value = Data.state.designSettings.topDisplayHeight;
        document.getElementById('font-size-value').textContent = `${Data.state.designSettings.studentNameSize}em`;
        document.getElementById('top-display-height-value').textContent = `${Data.state.designSettings.topDisplayHeight}vh`;
        adminModal.style.display = 'flex';
    }
    
    function setupDragAndDropListeners() {
        const cards = DOMElements.chartContainer.querySelectorAll('.student-card');
        cards.forEach(card => {
            card.addEventListener('dragstart', () => setTimeout(() => card.classList.add('dragging'), 0));
            card.addEventListener('dragend', () => card.classList.remove('dragging'));
        });
        DOMElements.chartContainer.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = UI.getDragAfterElement(DOMElements.chartContainer, e.clientY);
            const draggable = document.querySelector('.dragging');
            if (draggable) {
                if (afterElement == null) DOMElements.chartContainer.appendChild(draggable);
                else DOMElements.chartContainer.insertBefore(draggable, afterElement);
            }
        });
        DOMElements.chartContainer.addEventListener('drop', () => {
            const newOrder = [...DOMElements.chartContainer.querySelectorAll('.student-card')].map(card => card.dataset.studentName);
            // ✨ 수정
            Data.state.initialStudentNames = newOrder;
            Data.saveData();
            renderApp();
        });
    }

    function renderApp() {
        const handlers = {
            checkIn: handleCheckIn,
            undo: handleUndo,
            manualIncrement: handleManualIncrement,
            manualDecrement: handleManualDecrement,
            nameEdit: handleNameEdit,
            deleteStudent: handleDeleteStudent,
            setupDragAndDrop: setupDragAndDropListeners,
            render: renderApp
        };
        const modes = { isManual: isManualModeActive, isStudentManage: isStudentManageModeActive };
        // ✨ 수정
        UI.renderStudents(Data.state, modes, handlers);
    }
    
    function setupEventListeners() {
    const adminCodeModal = document.getElementById('admin-code-modal');
    const adminCodeInput = document.getElementById('admin-code-input');
    const adminCodeTitle = document.getElementById('admin-code-title');
    let currentAdminAction = null;

    const openCodeModal = (action, title) => {
        notifyParent('pauseTimer'); // ✨ 타이머 중지 신호 보내기
        currentAdminAction = action;
        adminCodeTitle.textContent = title;
        adminCodeInput.value = '';
        adminCodeModal.style.display = 'flex';
        adminCodeInput.focus();
    };

    document.getElementById('admin-button').onclick = () => openCodeModal('admin', '관리자 코드 입력');
    document.getElementById('manual-mode-button').onclick = () => openCodeModal('manual', '수동 조정 코드 입력');
    document.getElementById('gacha-unlimited-button').onclick = () => openCodeModal('gacha', '뽑기 기계 코드 입력');
    document.getElementById('student-manage-button').onclick = () => openCodeModal('student-manage', '학생 관리 코드 입력');

    document.getElementById('admin-code-cancel').onclick = () => {
        adminCodeModal.style.display = 'none';
        notifyParent('resumeTimer'); // ✨ 타이머 재개 신호 보내기
    };
    document.getElementById('admin-code-confirm').onclick = () => {
        if (adminCodeInput.value === '6408') {
            adminCodeModal.style.display = 'none';
            // 확인 버튼을 누르면 다른 모달이 열리므로, 여기서는 resume 신호를 보내지 않음
            if (currentAdminAction === 'admin') openAdminModal();
            else if (currentAdminAction === 'manual') enterManualMode();
            else if (currentAdminAction === 'gacha') UI.openGachaModal();
            else if (currentAdminAction === 'student-manage') enterStudentManageMode();
        } else {
            alert('코드가 일치하지 않습니다.');
            adminCodeInput.value = '';
        }
    };

    document.getElementById('exit-mode-button').onclick = () => {
        isManualModeActive = false;
        isStudentManageModeActive = false;
        document.getElementById('admin-button').style.display = 'inline-block';
        document.getElementById('manual-mode-button').style.display = 'inline-block';
        document.getElementById('gacha-unlimited-button').style.display = 'inline-block';
        document.getElementById('student-manage-button').style.display = 'inline-block';
        document.getElementById('exit-mode-button').style.display = 'none';
        document.getElementById('manual-mode-all-controls').style.display = 'none';
        document.getElementById('add-student-button-header').style.display = 'none';
        renderApp();
        notifyParent('resumeTimer'); // ✨ 모드에서 나갈 때 타이머 재개
    };

    document.getElementById('add-student-button-header').onclick = () => {
        const newName = prompt('추가할 학생의 이름을 입력하세요:');
        if (newName && newName.trim() !== '' && !Data.state.initialStudentNames.includes(newName.trim())) {
            const newStudent = { name: newName.trim(), attendanceCount: 0, lastCheckInDate: null, usedGachas: [] };
            Data.state.studentData.push(newStudent);
            Data.state.initialStudentNames.push(newName.trim());
            Data.saveData();
            renderApp();
        } else if (newName) {
            alert('이름을 입력하지 않았거나 이미 존재하는 이름입니다.');
        }
    };

    document.getElementById('all-plus-button').onclick = () => {
        Data.state.studentData.forEach(s => s.attendanceCount++);
        Data.saveData();
        renderApp();
    };
    document.getElementById('all-minus-button').onclick = () => {
        Data.state.studentData.forEach(s => { if (s.attendanceCount > 0) s.attendanceCount--; });
        Data.saveData();
        renderApp();
    };

    document.getElementById('gacha-modal-close-button').onclick = () => {
        document.getElementById('gacha-iframe').src = '';
        document.getElementById('gacha-modal').style.display = 'none';
        notifyParent('resumeTimer'); // ✨ 가챠 모달 닫을 때 타이머 재개
    };
}
    
    function setupAdminModalListeners() {
        const adminModal = document.getElementById('admin-modal');
        document.getElementById('modal-close-button').onclick = () => {
    adminModal.style.display = 'none';
    notifyParent('resumeTimer'); // ✨ 관리자 모달 닫을 때 타이머 재개
};
        
        const resetGift = (day) => {
            const studentIndex = parseInt(document.getElementById('student-select-reward').value);
            // ✨ 수정
            const student = Data.state.studentData[studentIndex];
            student.usedGachas = student.usedGachas.filter(gachaDay => gachaDay !== day);
            Data.saveData();
            renderApp();
            alert(`'${student.name}' 학생의 ${day}일 선물이 초기화되었습니다.`);
        };
        document.getElementById('reset-gift-13-button').onclick = () => resetGift(13);
        document.getElementById('reset-gift-18-button').onclick = () => resetGift(18);
        
        document.getElementById('save-alarm-times-button').onclick = () => {
            // ✨ 수정
            Data.state.alarmTimes = [document.getElementById('alarm-time-1').value, document.getElementById('alarm-time-2').value];
            Data.saveData();
            alert(`알람 시간이 저장되었습니다.`);
        };

        const fontSizeSlider = document.getElementById('font-size-slider');
        const topDisplayHeightSlider = document.getElementById('top-display-height-slider');
        fontSizeSlider.oninput = () => document.getElementById('font-size-value').textContent = `${fontSizeSlider.value}em`;
        topDisplayHeightSlider.oninput = () => document.getElementById('top-display-height-value').textContent = `${topDisplayHeightSlider.value}vh`;
        document.getElementById('save-design-button').onclick = () => {
            // ✨ 수정
            Data.state.designSettings.studentNameSize = parseFloat(fontSizeSlider.value);
            Data.state.designSettings.topDisplayHeight = parseInt(topDisplayHeightSlider.value);
            Data.saveData();
            UI.applyDesignSettings(Data.state.designSettings);
            alert('디자인 설정이 저장되었습니다.');
        };

        document.getElementById('export-data-button').onclick = () => {
            const dataStr = JSON.stringify(JSON.parse(localStorage.getItem('libraryAttendanceData')), null, 2);
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([dataStr], {type: 'application/json'}));
            a.download = `도담마루_출석기록_${new Date().getMonth()+1}월.json`;
            a.click();
            URL.revokeObjectURL(a.href);
        };

        const fileInput = document.getElementById('import-file-input');
        document.getElementById('import-data-button').onclick = () => fileInput.click();
        fileInput.onchange = (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const importedData = JSON.parse(e.target.result);
                        if (importedData.students && importedData.studentNames && confirm("데이터를 불러오면 현재 기록이 덮어씌워집니다. 계속하시겠습니까?")) {
                            localStorage.setItem('libraryAttendanceData', JSON.stringify(importedData));
                            location.reload();
                        } else { alert("파일 형식이 올바르지 않습니다."); }
                    } catch (error) { alert("파일을 읽는 중 오류가 발생했습니다."); }
                };
                reader.readAsText(file);
            }
        };

        document.getElementById('full-reset-button').onclick = () => {
            if (confirm("정말로 모든 학생의 출석 기록과 설정을 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
                localStorage.removeItem('libraryAttendanceData');
                location.reload();
            }
        };
    }

    function init() {
        DOMElements.versionDisplay.textContent = `v${Data.APP_VERSION}`;
        DOMElements.mainTitle.textContent = `${new Date().getMonth() + 1}월 도담마루 도서관 출석부 📚`;
        Data.loadData();
        // ✨ 수정
        UI.applyDesignSettings(Data.state.designSettings);
        renderApp();
        
        let isDateVisible = true;
        UI.renderDateDisplay();
        UI.updateTimeDisplay();
        setInterval(() => {
            isDateVisible = !isDateVisible;
            DOMElements.dateDisplaySection.classList.toggle('display-visible', isDateVisible);
            DOMElements.dateDisplaySection.classList.toggle('display-hidden', !isDateVisible);
            DOMElements.timeDisplaySection.classList.toggle('display-visible', !isDateVisible);
            DOMElements.timeDisplaySection.classList.toggle('display-hidden', isDateVisible);
        }, 10000);
        
        setInterval(() => {
            UI.updateTimeDisplay();
            UI.renderDateDisplay();
        }, 1000);

        setupEventListeners();
        setupAdminModalListeners();
    }

    init();

});
