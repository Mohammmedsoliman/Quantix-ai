// 1. استدعاء إعدادات فايربيز وأدوات قاعدة البيانات
import { auth, db } from "../auth/firebase-config.js";
import { doc, getDoc, setDoc, collection, query, where, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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

// --- دالة التبديل بين التبويبات (Tabs) ---
window.switchTab = function(tabId, clickedElement) {
    const allSections = document.querySelectorAll('.settings-section');
    allSections.forEach(section => section.classList.remove('active'));

    const allTabs = document.querySelectorAll('.settings-tab');
    allTabs.forEach(tab => tab.classList.remove('active'));

    document.getElementById(`tab-${tabId}`).classList.add('active');
    clickedElement.classList.add('active');
};

// --- دالة إظهار/إخفاء مفتاح الـ API ---
window.toggleApiKey = function() {
    const input = document.getElementById('api-key-input');
    const btn = document.getElementById('eye-btn');
    
    if (input.type === 'password') {
        input.type = 'text';
        btn.innerText = '🙈';
    } else {
        input.type = 'password';
        btn.innerText = '👁️';
    }
};

// ==========================================
// --- دوال ربط الإعدادات بـ Firebase ---
// ==========================================

// 1. جلب الإعدادات المحفوظة أول ما الصفحة تفتح
async function loadSettings() {
    try {
        const docRef = doc(db, "app_data", "settings");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            // تعبئة الحقول بالبيانات الحقيقية
            document.getElementById('org-name').value = data.orgName || "AFAQ Cohort A";
            document.getElementById('org-lang').value = data.language || "en";
            document.getElementById('allow-reg').checked = data.allowRegistration !== false; 
            
            const forceResetEl = document.getElementById('force-reset');
            if (forceResetEl) forceResetEl.checked = data.forcePasswordReset === true;
        }
    } catch (error) {
        console.error("Error loading settings:", error);
    }
}

// 2. حفظ الإعدادات في الفايربيز
window.saveSettings = async function() {
    const orgName = document.getElementById('org-name').value;
    const language = document.getElementById('org-lang').value;
    const allowRegistration = document.getElementById('allow-reg').checked;
    
    let forcePasswordReset = false;
    const forceResetEl = document.getElementById('force-reset');
    if (forceResetEl) forcePasswordReset = forceResetEl.checked;
    
    // تأثير بصري للزرار
    const btn = document.querySelector('.actions .btn-primary');
    const originalText = btn.innerText;
    btn.innerText = "Saving to Cloud...";
    btn.disabled = true;

    try {
        // رفع الداتا لفايربيز
        await setDoc(doc(db, "app_data", "settings"), {
            orgName: orgName,
            language: language,
            allowRegistration: allowRegistration,
            forcePasswordReset: forcePasswordReset,
            lastUpdated: new Date()
        }, { merge: true });

        btn.innerText = "Saved Successfully!";
        btn.style.backgroundColor = "#10b981"; // لون أخضر
        btn.style.borderColor = "#10b981";

        setTimeout(() => { 
            btn.innerText = originalText; 
            btn.disabled = false; 
            btn.style.backgroundColor = ""; 
            btn.style.borderColor = ""; 
        }, 2000);

    } catch (error) {
        console.error("Error saving:", error);
        btn.innerText = "Error Saving!";
        btn.style.backgroundColor = "#ff5f56";
        setTimeout(() => { btn.innerText = originalText; btn.disabled = false; btn.style.backgroundColor = ""; }, 2000);
    }
};

// 3. مسح بيانات الطلاب (Danger Zone)
window.wipeDatabase = async function() {
    // 1. تحذير قوي للأدمن
    const confirmWord = prompt("⚠️ DANGER ZONE ⚠️\nThis will reset ALL students back to Level 1 and delete their progress.\n\nType 'CONFIRM' in capital letters to proceed:");
    
    if (confirmWord !== "CONFIRM") {
        alert("Operation cancelled. Database is safe.");
        return;
    }

    alert("Starting wipe process... Please don't close the page.");

    try {
        // 2. نجيب كل المستخدمين اللي دورهم طالب
        const q = query(collection(db, "users"), where("role", "==", "student"));
        const studentsSnapshot = await getDocs(q);

        let wipeCount = 0;

        // 3. نلف عليهم طالب طالب
        for (const studentDoc of studentsSnapshot.docs) {
            const studentId = studentDoc.id;
            const levelsRef = collection(db, "users", studentId, "levels");
            const levelsSnapshot = await getDocs(levelsRef);

            // 4. استخدام Batch لمسح تقدم الطالب بسرعة وأمان
            const batch = writeBatch(db);
            
            levelsSnapshot.forEach((lvlDoc) => {
                batch.delete(lvlDoc.ref); // مسح كل الليفلات
            });

            // 5. نفتحله ليفل 1 من جديد
            const firstLevelRef = doc(db, "users", studentId, "levels", "1");
            batch.set(firstLevelRef, {
                levelId: 1,
                status: "active",
                lastActive: new Date()
            });

            await batch.commit();
            wipeCount++;
        }

        alert(`✅ System Wipe Complete!\nSuccessfully reset progress for ${wipeCount} students.`);

    } catch (error) {
        console.error("Wipe Error:", error);
        alert("An error occurred while wiping the database. Check console for details.");
    }
};

// تشغيل جلب الإعدادات أول ما الصفحة تحمل
document.addEventListener('DOMContentLoaded', loadSettings);