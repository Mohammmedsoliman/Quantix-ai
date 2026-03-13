import { auth, db } from "./auth/firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, doc, getDoc , setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let curriculumData = []; 

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "../index.html"; 
        return;
    }

    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));

        if (userDoc.exists()) {
            const role = userDoc.data().role;

            if (role === "teacher" || role === "admin") {
                window.location.href = "admin/dashboard.html";
                return;
            }

            const nameDisplay = document.getElementById('student-name-display');
            if (nameDisplay) {
                const firstName = userDoc.data().name.split(" ")[0]; 
                nameDisplay.innerText = "Agent " + firstName;
            }

            const docRef = doc(db, "app_data", "curriculum");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                curriculumData = docSnap.data().worlds;
                await fetchAndMergeProgress(user.uid);
            } else {
                console.error("Curriculum not found!");
            }
        } else {
            window.location.href = "../index.html";
        }
    } catch (error) {
        console.error("Auth Error:", error);
    }
});

async function fetchAndMergeProgress(uid) {
    try {
        const levelsRef = collection(db, "users", uid, "levels");
        const snapshot = await getDocs(levelsRef);
        
        const studentProgress = {};
        let totalMastery = 0; 

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            studentProgress[data.levelId] = data.status; 
            if (data.status === 'completed') {
                totalMastery += 3;
            }
        });

        updateHeaderStats(totalMastery);

        curriculumData.forEach(world => {
            world.levels.forEach(level => {
                if (studentProgress[level.id]) {
                    level.status = studentProgress[level.id]; 
                } else {
                    level.status = (level.id === 1) ? "active" : "locked";
                }
            });
        });

    } catch (error) {
        console.error("❌ Firebase Error:", error.message);
    } finally {
        renderSkillTree(); 
    }
}

function updateHeaderStats(mastery) {
    const masteryEl = document.getElementById('user-mastery');
    const rankEl = document.getElementById('user-rank');
    
    if (masteryEl) {
        masteryEl.innerText = `${mastery}/90`;
    }

    let rank = "Data Novice";
    if (mastery >= 20) rank = "Neural Squire";
    if (mastery >= 50) rank = "Logic Knight";
    if (mastery >= 80) rank = "AI Grandmaster";

    if (rankEl) {
        rankEl.innerText = rank;
    }
}

const container = document.getElementById('worlds-container');

function renderSkillTree() {
    container.innerHTML = ''; 
    curriculumData.forEach(world => {
        
        const activeLevels = world.levels.filter(l => l.isActive !== false);
        if (activeLevels.length === 0) return; 

        const totalLevels = activeLevels.length;
        const completedLevels = activeLevels.filter(l => l.status === "completed").length;
        const progressPercent = Math.round((completedLevels / totalLevels) * 100) || 0;

        const worldSection = document.createElement('section');
        worldSection.className = 'world-section';
        
        worldSection.innerHTML = `
            <div class="world-header">
                <h2 class="world-title" style="color: ${world.color};">${world.world}</h2>
                <div class="world-progress-container">
                    <span class="progress-text">${completedLevels}/${totalLevels} Completed (${progressPercent}%)</span>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: ${progressPercent}%; background: ${world.color};"></div>
                    </div>
                </div>
            </div>
        `;

        const grid = document.createElement('div');
        grid.className = 'level-grid';

        activeLevels.forEach(level => {
            const card = document.createElement('div');
            card.className = `level-card ${level.status}`;
            
            let actionText = "Locked";
            let actionColor = "#64748b";
            if (level.status === "completed") { actionText = "Cleared"; actionColor = "#10b981"; }
            if (level.status === "active") { actionText = "In Progress"; actionColor = "#06b6d4"; }

            card.innerHTML = `
                <div class="level-number" style="${level.status === 'completed' ? `color: ${world.color}; border-color: ${world.color}50;` : ''}">${level.id}</div>
                <h4>${level.title}</h4>
                <p>${level.desc}</p>
                <div class="status-indicator" style="color: ${actionColor};">
                    <div class="status-dot"></div>
                    ${actionText}
                </div>
            `;

            if (level.status !== "locked") {
                card.onclick = () => {
                    // 🔴 التوجيه دايماً ثابت للملفات
                    window.location.href = `level${level.id}.html`;
                };
            }

            grid.appendChild(card);
        });

        worldSection.appendChild(grid);
        container.appendChild(worldSection);
    });
}

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if(confirm("Are you sure you want to disconnect?")) {
            signOut(auth).then(() => {
                window.location.href = '../index.html';
            });
        }
    });
}