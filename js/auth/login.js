// 1. استدعاء إعدادات فايربيز اللي عملناها في الملف المركزي
import { auth, db } from "./firebase-config.js";

// 2. استدعاء دوال تسجيل الدخول والتحكم في الجلسات من فايربيز
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let currentRole = 'student';

// --- دالة تغيير الشكل بناءً على الدور (طالب/معلم) ---
window.setRole = function(role) {
    currentRole = role;
    document.getElementById('btn-student').classList.remove('active');
    document.getElementById('btn-teacher').classList.remove('active');
    document.getElementById(`btn-${role}`).classList.add('active');
    
    const loginBtn = document.querySelector('.login-btn');
    if(role === 'teacher') {
        loginBtn.style.background = 'linear-gradient(135deg, #ec4899, #8b5cf6)';
    } else {
        loginBtn.style.background = 'linear-gradient(135deg, #8b5cf6, #06b6d4)';
    }
}

// --- دالة تسجيل الدخول (Login) ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const isRememberMe = document.getElementById('remember-me').checked;
    const loginBtn = document.querySelector('.login-btn');
    
    loginBtn.innerText = "Authenticating..."; 

    try {
        const persistenceType = isRememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistenceType);

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            
            // 🔴 التعديل هنا: السماح للأدمن بالدخول من بوابة الـ Teacher
            const isTeacherOrAdmin = (currentRole === 'teacher' && (userData.role === 'teacher' || userData.role === 'admin'));
            const isStudent = (currentRole === 'student' && userData.role === 'student');

            if (!isTeacherOrAdmin && !isStudent) {
                alert(`Access Denied: You are registered as a ${userData.role}, not a ${currentRole}.`);
                loginBtn.innerText = "Initialize Session";
                return;
            }

            // توجيه المستخدم للصفحة الصحيحة
            if (userData.role === 'teacher' || userData.role === 'admin') {
                window.location.href = '../../pages/admin/dashboard.html';
            } else {
                window.location.href = '../../pages/levels.html';
            }
        } else {
            alert("Error: User authenticated but missing from the database!");
            loginBtn.innerText = "Initialize Session";
        }

    } catch (error) {
        console.error("Login Error:", error.code);
        alert("Login failed! Please check your email and password.");
        loginBtn.innerText = "Initialize Session";
    }
});

// --- دالة نسيان كلمة المرور ---
document.getElementById('forgot-password').addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();

    if (!email) {
        alert("⚠️ Please enter your email address in the field first to reset your password.");
        document.getElementById('email').focus();
        return;
    }

    if (confirm(`Send a password reset link to ${email}?`)) {
        try {
            await sendPasswordResetEmail(auth, email);
            alert(`✅ Success! A password reset link has been sent to ${email}. Check your inbox or spam folder.`);
        } catch (error) {
            console.error("Reset Password Error:", error);
            if (error.code === 'auth/user-not-found') {
                alert("❌ No user found with this email address in the Neural Grid.");
            } else {
                alert("❌ Failed to send reset email: " + error.message);
            }
        }
    }
});

// --- دالة إنشاء حسابات (للطـلاب فـقـط) ---
document.querySelector('.signup-link a').addEventListener('click', async (e) => {
    e.preventDefault();
    
    // 🔴 المنع الأمني: قفل إنشاء حساب معلم
    if (currentRole === 'teacher') {
        alert("⚠️ Access Denied: Instructor accounts can only be provisioned by System Administrators. Please contact support.");
        return;
    }

    const email = prompt("Enter new student email to register:");
    const password = prompt("Enter a password (min 6 chars):");
    const name = prompt("Enter your full name:");
    
    if (!email || !password || !name) return;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // إجبار التسجيل كطالب مهما حصل
        await setDoc(doc(db, "users", user.uid), {
            name: name,
            email: email,
            role: 'student', 
            createdAt: serverTimestamp()
        });

        alert(`Success! Student account created for ${name}. You can now log in.`);
    } catch (error) {
        alert("Registration Failed: " + error.message);
    }
});

// ==============================================================
// 🛠️ أداة سرية للمطور: لإنشاء 3 حسابات Admin أوتوماتيك
// ==============================================================
window.createSystemAdmins = async function() {
    const admins = [
        { email: "admin1@quantix.ai", pass: "admin123", name: "Super Admin 1" },
        { email: "admin2@quantix.ai", pass: "admin123", name: "Super Admin 2" },
        { email: "admin3@quantix.ai", pass: "admin123", name: "Super Admin 3" }
    ];

    console.log("Initializing Admin Accounts...");
    for (let admin of admins) {
        try {
            const cred = await createUserWithEmailAndPassword(auth, admin.email, admin.pass);
            await setDoc(doc(db, "users", cred.user.uid), {
                name: admin.name,
                email: admin.email,
                role: "admin",
                createdAt: serverTimestamp()
            });
            console.log(`✅ Success: Created ${admin.email}`);
        } catch (error) {
            // لو الحساب موجود مسبقاً هيتجاهله
            console.error(`❌ Failed for ${admin.email}:`, error.message);
        }
    }
    alert("System Admins generated successfully! Check console for details.");
};