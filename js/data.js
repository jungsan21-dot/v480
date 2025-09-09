// 전역 네임스페이스 객체를 만들어 변수 충돌을 방지합니다.
const App = {};

// 데이터 관리 모듈
App.Data = (function() {
    const APP_VERSION = "4.8.1";
    
    // 앱의 모든 상태를 관리하는 객체
    let state = {
        studentData: [],
        initialStudentNames: [],
        TOTAL_DAYS_IN_MONTH: 20,
        alarmTimes: ['11:08', '13:38'],
        designSettings: { studentNameSize: 2.2, topDisplayHeight: 28 },
    };

    function saveData() {
        // 학생 순서를 initialStudentNames 기준으로 정렬하여 저장
        const orderedStudentData = state.initialStudentNames.map(name => {
            return state.studentData.find(s => s.name === name) || { name, attendanceCount: 0, lastCheckInDate: null, usedGachas: [] };
        });
        state.studentData = orderedStudentData;

        localStorage.setItem('libraryAttendanceData', JSON.stringify({
            totalDays: state.TOTAL_DAYS_IN_MONTH,
            studentNames: state.initialStudentNames,
            students: state.studentData,
            alarmTimes: state.alarmTimes,
            designSettings: state.designSettings
        }));
    }

    function loadData() {
        const storedData = JSON.parse(localStorage.getItem('libraryAttendanceData'));
        if (storedData) {
            state.studentData = storedData.students || [];
            state.initialStudentNames = storedData.studentNames;
            state.TOTAL_DAYS_IN_MONTH = storedData.totalDays || 20;
            state.alarmTimes = storedData.alarmTimes || ['11:08', '13:38'];
            state.designSettings = storedData.designSettings || { studentNameSize: 2.2, topDisplayHeight: 28 };
            state.studentData.forEach(s => { if (!s.usedGachas) s.usedGachas = []; });
        } else {
            // 저장된 데이터가 없을 경우 초기 학생 명단 설정
            state.initialStudentNames = [
                '이지한', '장별', '이기원', '이다경', '최온유', '주하엘', '김세현', '안서윤', '정해나', '원소정', 
                '우찬영', '전제준', '강한봄', '이기웅', '용해인', '이효율', '장설', '이하윤', '곽재은', '김태이', 
                '강시호', '정모세', '김도희', '김라엘', '이기백', '이건우', '김다인', '김도준', '신지우', '한재이', 
                '신수빈', '박지유', '권도연', '우예빈', '김도훈', '차태호', '박경민', '권나윤', '강한아'
            ].reverse();
            state.studentData = state.initialStudentNames.map(name => ({ name, attendanceCount: 0, lastCheckInDate: null, usedGachas: [] }));
        }
        saveData(); // 초기 데이터 저장
    }
    
    function getCurrentDate() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    // 외부에서 접근할 수 있도록 공개
    return {
        APP_VERSION,
        state,
        saveData,
        loadData,
        getCurrentDate
    };
})();

// 마지막에 있던 불필요한 '}'를 제거했습니다.
