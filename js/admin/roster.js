// 1. استدعاء إعدادات فايربيز (ضفنا دالة sendPasswordResetEmail)
import { auth, db } from "../auth/firebase-config.js";
import { collection, query, where, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
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
const rosterContainer = document.getElementById('roster-container');
const searchInput = document.getElementById('search-roster');

let allStudentsCards = [];

async function initRoster() {
    const q = query(collection(db, "users"), where("role", "==", "student"));
    const querySnapshot = await getDocs(q);

    rosterContainer.innerHTML = ''; 

    if (querySnapshot.empty) {
        rosterContainer.innerHTML = `<p style="color: #94a3b8; text-align: center; width: 100%;">No students found in the database.</p>`;
        return;
    }

    querySnapshot.forEach((studentDoc) => {
        const studentData = studentDoc.data();
        const studentId = studentDoc.id;
        const displayName = studentData.name || "Unknown Agent";
        const shortId = studentId.substring(0, 8);
        const email = studentData.email || ""; // هنجيب الإيميل عشان الباسورد

        const card = document.createElement('div');
        card.className = 'student-card glass-panel';
        card.id = `card-${studentId}`;
        
        card.innerHTML = `
            <div class="card-header">
                <div class="student-info">
                    <div class="student-avatar">👤</div>
                    <div>
                        <div class="student-name">${displayName}</div>
                        <div class="student-uid">ID: ${shortId}</div>
                    </div>
                </div>
                <div id="badge-${studentId}">
                    <span class="status-badge status-warn">Loading</span>
                </div>
            </div>
            
            <div class="card-stats">
                <div class="stat-item">
                    <p>Current Level</p>
                    <h4 id="lvl-${studentId}" class="text-cyan">Lvl --</h4>
                </div>
                <div class="stat-item">
                    <p>Total Mastery</p>
                    <h4 id="stars-${studentId}" class="text-purple">⭐ --</h4>
                </div>
            </div>

            <div class="card-actions">
                <button class="btn-primary" onclick="window.viewProfile('${studentId}', '${displayName}')">Profile</button>
                <button class="btn-outline" style="border-color: #64748b; color: #cbd5e1;" onclick="window.resetStudentPassword('${email}', '${displayName}')">Reset Pwd</button>
            </div>
        `;
        
        rosterContainer.appendChild(card);
        allStudentsCards.push({ id: studentId, name: displayName, element: card });

        const levelsRef = collection(db, "users", studentId, "levels");
        onSnapshot(levelsRef, (snapshot) => {
            let maxLevel = 1;
            let totalStars = 0;
            let latestStatus = "Offline";
            let latestCode = "warn";
            let lastError = "None";

            snapshot.forEach(levelDoc => {
                const lData = levelDoc.data();
                if (lData.status === 'completed') totalStars += 3;

                if (lData.levelId >= maxLevel) {
                    maxLevel = lData.levelId;
                    lastError = lData.lastError || "None";
                    
                    if(lData.status === 'completed') {
                        latestStatus = "Cleared Lvl " + maxLevel;
                        latestCode = "good";
                    } else {
                        if(lastError && lastError !== "None") {
                            latestStatus = "Stuck (Error)";
                            latestCode = "danger";
                        } else {
                            latestStatus = "Playing";
                            latestCode = "cyan"; 
                        }
                    }
                }
            });

            document.getElementById(`lvl-${studentId}`).innerText = `Lvl ${maxLevel}`;
            document.getElementById(`stars-${studentId}`).innerText = `⭐ ${totalStars}`;
            
            let badgeHtml = `<span class="status-badge status-${latestCode}">${latestStatus}</span>`;
            if (latestCode === "cyan") {
                badgeHtml = `<span class="status-badge" style="background: rgba(6, 182, 212, 0.1); color: #06b6d4; border-color: #06b6d4;">${latestStatus}</span>`;
            }
            document.getElementById(`badge-${studentId}`).innerHTML = badgeHtml;
        });
    });
}

// ==========================================
// --- دوال التحكم في الطلاب (Functions) ---
// ==========================================

// 1. دالة تغيير الباسورد (بتبعت إيميل حقيقي من Firebase)
window.resetStudentPassword = function(email, name) {
    if (!email || email === "undefined") {
        alert(`❌ Error: No email address found in the database for ${name}.`);
        return;
    }

    // رسالة تأكيد قبل الإرسال
    if (confirm(`⚠️ Send a password reset link to ${name} (${email})?`)) {
        sendPasswordResetEmail(auth, email)
            .then(() => {
                alert(`✅ Success! A password reset email has been sent to ${email}.`);
            })
            .catch((error) => {
                console.error("Error sending reset email:", error);
                alert("❌ Failed to send reset email. Check console for details.");
            });
    }
};

// 2. دالة عرض الملف الشخصي (بتولد نافذة منبثقة ديناميكية)
// 2. دالة عرض الملف الشخصي (بتولد نافذة منبثقة بتصميم Modern & Expanded)
window.viewProfile = async function(studentId, name) {
    // إزالة أي نافذة قديمة لو موجودة
    let existingModal = document.getElementById('dynamic-profile-modal');
    if (existingModal) existingModal.remove();

    // إضافة ستايل الأنيميشن لو مش موجود
    if (!document.getElementById('modal-animations')) {
        const style = document.createElement('style');
        style.id = 'modal-animations';
        style.innerHTML = `
            @keyframes scaleUpFade {
                from { transform: scale(0.95); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }
            .modern-stat-card {
                background: rgba(255,255,255,0.03); 
                padding: 15px; 
                border-radius: 12px; 
                border: 1px solid rgba(255,255,255,0.05);
                transition: transform 0.2s;
            }
            .modern-stat-card:hover { transform: translateY(-3px); border-color: rgba(6, 182, 212, 0.3); }
        `;
        document.head.appendChild(style);
    }

    // إنشاء النافذة المنبثقة (Modern Layout)
    const modal = document.createElement('div');
    modal.id = 'dynamic-profile-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-box glass-panel" style="max-width: 650px; width: 90%; position: relative; padding: 2.5rem; border-radius: 16px; animation: scaleUpFade 0.3s ease-out;">
            
            <button onclick="document.getElementById('dynamic-profile-modal').remove()" style="position: absolute; top: 15px; right: 20px; background: none; border: none; color: #94a3b8; font-size: 1.5rem; cursor: pointer; transition: color 0.3s;" onmouseover="this.style.color='#ff5f56'" onmouseout="this.style.color='#94a3b8'">✖</button>

            <div style="display: flex; gap: 2rem; align-items: stretch; flex-wrap: wrap;">
                
                <div style="flex: 1; min-width: 200px; text-align: center; background: rgba(0,0,0,0.2); padding: 2rem 1rem; border-radius: 14px; border: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; justify-content: center; align-items: center;">
                    <div style="font-size: 4rem; margin-bottom: 10px; background: linear-gradient(135deg, #06b6d4, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">👤</div>
                    <h2 style="margin: 0 0 5px 0; font-size: 1.6rem; letter-spacing: 0.5px;">${name}</h2>
                    <p style="color: #64748b; font-family: monospace; font-size: 0.85rem; margin: 0; background: rgba(0,0,0,0.3); padding: 4px 10px; border-radius: 20px;">ID: ${studentId}</p>
                    <div style="margin-top: 20px;">
                        <span class="status-badge" style="background: rgba(16, 185, 129, 0.1); color: #10b981; border-color: #10b981; padding: 6px 15px;">Active Agent</span>
                    </div>
                </div>

                <div id="profile-stats-container" style="flex: 1.5; min-width: 250px; display: flex; flex-direction: column; justify-content: center;">
                    <p style="color: #94a3b8; text-align: center;">🔄 Syncing neural data from cloud...</p>
                </div>

            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // جلب بيانات الطالب من الفايربيز
    const levelsRef = collection(db, "users", studentId, "levels");
    const snapshot = await getDocs(levelsRef);
    
    let completed = 0;
    let maxLevel = 1;
    
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.status === 'completed') completed++;
        if (data.levelId >= maxLevel) maxLevel = data.levelId;
    });

    // حساب نسبة التقدم (بافتراض إن المنهج 15 مستوى)
    const progressPercent = Math.min(Math.round((completed / 15) * 100), 100);

    // تحديث النافذة بالإحصائيات الحقيقية والتصميم الجديد
    document.getElementById('profile-stats-container').innerHTML = `
        <h3 style="margin-top: 0; margin-bottom: 1.5rem; color: #fff; font-size: 1.2rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">Performance Metrics</h3>
        
        <div style="margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #cbd5e1; font-size: 0.9rem;">Overall Course Progress</span>
                <strong style="color: #06b6d4; font-size: 0.9rem;">${progressPercent}%</strong>
            </div>
            <div style="width: 100%; height: 8px; background: rgba(0,0,0,0.3); border-radius: 4px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);">
                <div style="width: ${progressPercent}%; height: 100%; background: linear-gradient(90deg, #06b6d4, #8b5cf6); border-radius: 4px; transition: width 1s ease-out;"></div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            
            <div class="modern-stat-card">
                <span style="display: block; color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Highest Level</span>
                <strong style="color: #fff; font-size: 1.6rem;">${maxLevel}</strong><span style="color: #64748b; font-size: 0.9rem;"> / 15</span>
            </div>
            
            <div class="modern-stat-card">
                <span style="display: block; color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Total Stars</span>
                <strong style="color: #f59e0b; font-size: 1.6rem;">⭐ ${completed * 3}</strong>
            </div>
            
            <div class="modern-stat-card" style="grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #94a3b8; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px;">Missions Cleared</span>
                <strong style="color: #10b981; font-size: 1.2rem;">${completed} <span style="font-size: 0.8rem; color: #64748b;">Missions</span></strong>
            </div>

        </div>
    `;
};

// 3. تفعيل البحث بالاسم أو الـ ID
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    allStudentsCards.forEach(student => {
        if (student.name.toLowerCase().includes(term) || student.id.toLowerCase().includes(term)) {
            student.element.style.display = 'flex';
        } else {
            student.element.style.display = 'none';
        }
    });
});

document.addEventListener('DOMContentLoaded', initRoster);