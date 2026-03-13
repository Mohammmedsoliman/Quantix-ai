// 1. استدعاء إعدادات فايربيز 
import { auth, db } from "../auth/firebase-config.js";
import { collection, query, where, getDocs, onSnapshot, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// ==========================================
// --- 🛡️ حارس الأمان (Security Guard) ---
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // لو مش عامل تسجيل دخول، اطرده لصفحة الدخول
        window.location.href = "../../index.html"; 
    } else {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        if (userDoc.exists()) {
            const role = userDoc.data().role;
            if (role !== "teacher" && role !== "admin") {
                // لو طالب حاول يفتح الداشبورد، نرجعه لخريطته
                window.location.href = "../levels.html"; 
            } else {
                // التوثيق سليم: عرض اسم الأدمن
                const nameDisplay = document.getElementById('admin-name-display');
                if (nameDisplay) {
                    const firstName = userDoc.data().name.split(" ")[0];
                    nameDisplay.innerText = "Prof. " + firstName;
                }
                
                // تشغيل الداشبورد بعد التأكد من الصلاحيات
                initDashboard();
            }
        }
    }
});

// --- زرار تسجيل الخروج (Logout) ---
const adminLogoutBtn = document.getElementById('admin-logout-btn');
if (adminLogoutBtn) {
    adminLogoutBtn.addEventListener('click', () => {
        if(confirm("Are you sure you want to exit the Instructor Command Center?")) {
            signOut(auth).then(() => {
                window.location.href = "../../index.html"; 
            });
        }
    });
}

// ==========================================
// --- منطق الداشبورد (Dashboard Logic) ---
// ==========================================
const tableBody = document.getElementById('student-table-body');
const searchInput = document.getElementById('search-student');

let allStudentsData = [];
let studentsStatsMap = {}; 

// دالة تحديث المربعات
function updateOverviewCards() {
    let totalStudents = Object.keys(studentsStatsMap).length;
    let sumLevels = 0;
    let stuckCount = 0;

    for (const uid in studentsStatsMap) {
        let student = studentsStatsMap[uid];
        sumLevels += student.maxLevel;
        if (student.isStuck) stuckCount++;
    }

    let avgLevel = totalStudents === 0 ? 0 : Math.round(sumLevels / totalStudents);

    const activeEl = document.getElementById('stat-active-students');
    const avgEl = document.getElementById('stat-avg-level');
    const alertsEl = document.getElementById('stat-alerts');

    if (activeEl) activeEl.innerText = totalStudents;
    if (avgEl) avgEl.innerText = `Level ${avgLevel}`;
    if (alertsEl) {
        alertsEl.innerText = `${stuckCount} Alerts`;
        if (stuckCount > 0) {
            alertsEl.style.color = '#ff5f56'; 
        } else {
            alertsEl.style.color = '#fff';
        }
    }
}

async function initDashboard() {
    const q = query(collection(db, "users"), where("role", "==", "student"));
    const querySnapshot = await getDocs(q);

    tableBody.innerHTML = ''; 

    querySnapshot.forEach((studentDoc) => {
        const studentData = studentDoc.data();
        const studentId = studentDoc.id;

        studentsStatsMap[studentId] = { maxLevel: 1, isStuck: false };

        const row = document.createElement('tr');
        row.id = `row-${studentId}`;
        
        row.innerHTML = `
            <td class="name-col" style="font-weight: 600;">${studentData.name || "Agent " + studentId.substring(0,4)}</td>
            <td class="id-col" style="font-family: monospace; color: #64748b; font-size: 0.85rem;">${studentId}</td>
            <td id="lvl-${studentId}" class="text-cyan">Loading...</td>
            <td id="acc-${studentId}">...</td>
            <td id="status-${studentId}">...</td>
        `;
        tableBody.appendChild(row);

        allStudentsData.push({ id: studentId, name: studentData.name, rowElement: row });

        const levelsRef = collection(db, "users", studentId, "levels");
        
        onSnapshot(levelsRef, (snapshot) => {
            let maxLevel = 1;
            let latestStatus = "Just Started";
            let latestCode = "warn";
            let lastError = "None";
            let isStuck = false;

            // 🔴 التعديل: حساب متوسط الدقة (Average Accuracy)
            let totalAccuracy = 0;
            let completedLevelsCount = 0;

            snapshot.forEach(levelDoc => {
                const lData = levelDoc.data();
                
                // بنحسب الدقة للمستويات اللي خلصت بس
                if (lData.status === 'completed') {
                    totalAccuracy += (lData.accuracy !== undefined ? lData.accuracy : 100); 
                    completedLevelsCount++;
                }

                if (lData.levelId >= maxLevel) {
                    maxLevel = lData.levelId;
                    lastError = lData.lastError || "None";
                    
                    if(lData.status === 'completed') {
                        latestStatus = "On Track";
                        latestCode = "good";
                        isStuck = false;
                    } else {
                        if(lastError && lastError !== "None") {
                            latestStatus = "Stuck: Needs Help";
                            latestCode = "danger";
                            isStuck = true;
                        } else {
                            latestStatus = "In Progress";
                            latestCode = "warn";
                            isStuck = false;
                        }
                    }
                }
            });

            // حساب المتوسط النهائي
            let displayAccuracy = completedLevelsCount === 0 ? 0 : Math.round(totalAccuracy / completedLevelsCount);

            studentsStatsMap[studentId] = { maxLevel, isStuck };
            updateOverviewCards();

            document.getElementById(`lvl-${studentId}`).innerText = `Level ${maxLevel}`;
            
            // تلوين شريط الدقة بناءً على المتوسط
            let accColor = displayAccuracy >= 80 ? '#10b981' : displayAccuracy > 40 ? '#ffbd2e' : '#ff5f56';
            document.getElementById(`acc-${studentId}`).innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 35px; text-align: right;">${displayAccuracy}%</div>
                    <div style="width: 50px; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px;">
                        <div style="width: ${displayAccuracy}%; height: 100%; background: ${accColor}; border-radius: 3px;"></div>
                    </div>
                </div>
            `;
            
            document.getElementById(`status-${studentId}`).innerHTML = `<span class="status-badge status-${latestCode}">${latestStatus}</span>`;
        });
    });
}

// بحث الفلتر
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    allStudentsData.forEach(student => {
        if (student.name && student.name.toLowerCase().includes(term)) {
            student.rowElement.style.display = '';
        } else {
            student.rowElement.style.display = 'none';
        }
    });
});

// ==========================================
// --- دالة استخراج التقرير (Export to Styled Excel) ---
// ==========================================
window.exportReport = function() {
    if (allStudentsData.length === 0) {
        alert("No student data available to export!");
        return;
    }

    const firstStudentId = allStudentsData[0].id;
    const firstLevelText = document.getElementById(`lvl-${firstStudentId}`).innerText;
    
    if (firstLevelText.includes("Loading")) {
        alert("⏳ Please wait a second for the live data to sync from the cloud before exporting.");
        return; 
    }

    let htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8">
            <style>
                table { border-collapse: collapse; width: 100%; font-family: 'Segoe UI', Arial, sans-serif; }
                th { background-color: #06b6d4; color: #ffffff; font-weight: bold; padding: 12px; border: 1px solid #334155; font-size: 14px; text-align: center; }
                td { padding: 10px; border: 1px solid #cbd5e1; text-align: center; vertical-align: middle; }
                .row-even { background-color: #f8fafc; }
                .row-odd { background-color: #ffffff; }
                .name-col { text-align: left; font-weight: bold; color: #0f172a; }
                .id-col { font-family: monospace; color: #64748b; }
                .status-good { color: #10b981; font-weight: bold; }
                .status-warn { color: #f59e0b; font-weight: bold; }
                .status-danger { color: #ff5f56; font-weight: bold; }
                h2 { color: #0f172a; font-family: sans-serif; }
            </style>
        </head>
        <body>
            <h2>QuantixAi - Class Overview Report</h2>
            <p><strong>Generated on:</strong> ${new Date().toLocaleDateString()}</p>
            <table>
                <thead>
                    <tr>
                        <th style="width: 200px;">Student Name</th>
                        <th style="width: 250px;">Student ID</th>
                        <th style="width: 120px;">Current Level</th>
                        <th style="width: 120px;">Accuracy</th>
                        <th style="width: 150px;">Status</th>
                    </tr>
                </thead>
                <tbody>
    `;

    allStudentsData.forEach((student, index) => {
        const name = student.name || "Unknown Agent";
        const id = student.id;
        
        const level = document.getElementById(`lvl-${id}`).innerText;
        const accuracyText = document.getElementById(`acc-${id}`).innerText.split('\n')[0].trim();
        const status = document.getElementById(`status-${id}`).innerText;

        let statusClass = "status-warn"; 
        if (status.includes("On Track") || status.includes("Cleared")) statusClass = "status-good"; 
        if (status.includes("Stuck") || status.includes("Error")) statusClass = "status-danger"; 

        const rowClass = index % 2 === 0 ? 'row-even' : 'row-odd';

        htmlContent += `
            <tr class="${rowClass}">
                <td class="name-col">${name}</td>
                <td class="id-col">${id}</td>
                <td><strong>${level}</strong></td>
                <td>${accuracyText}</td>
                <td class="${statusClass}">${status}</td>
            </tr>
        `;
    });

    htmlContent += `
                </tbody>
            </table>
        </body>
        </html>
    `;

    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    const date = new Date().toISOString().split('T')[0];
    link.setAttribute("href", url);
    link.setAttribute("download", `QuantixAi_Report_${date}.xls`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};