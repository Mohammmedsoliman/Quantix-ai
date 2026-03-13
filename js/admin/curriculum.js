// 1. استدعاء إعدادات فايربيز
import { auth, db } from "../auth/firebase-config.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// ==========================================
// --- 🛡️ حارس الأمان (Security Guard) ---
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "../../index.html"; 
    } else {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const role = userDoc.data().role;
            if (role !== "teacher" && role !== "admin") {
                window.location.href = "../levels.html"; 
            } else {
                const nameDisplay = document.getElementById('admin-name-display');
                if (nameDisplay) {
                    const firstName = userDoc.data().name.split(" ")[0];
                    nameDisplay.innerText = "Prof. " + firstName;
                }
            }
        }
    }
});

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

let curriculumData = []; 
const container = document.getElementById('curriculum-container');

const defaultCurriculum = [
    {
        world: "World 1: The Fundamentals", color: "#8b5cf6",
        levels: [
            { id: 1, title: "The Neural Architect", desc: "Connect inputs to outputs to train your first AI.", type: "Visual" },
            { id: 2, title: "The Hidden Layer", desc: "Unlock deep learning by routing through hidden nodes.", type: "Visual" },
            { id: 3, title: "Signal & Noise", desc: "Filter out bad data before it corrupts the network.", type: "Visual" },
            { id: 4, title: "The Overfitting Trap", desc: "Use a Dropout node to stop the AI from memorizing the test.", type: "Visual" },
            { id: 5, title: "Feature Engineering", desc: "Detect a cyber threat by selecting the right inputs.", type: "Visual" }
        ]
    },
    {
        world: "World 2: Advanced Architectures", color: "#06b6d4",
        levels: [
            { id: 6, title: "The Vision Filter", desc: "Route raw camera feeds through convolutional filters to see the road.", type: "Visual" },
            { id: 7, title: "The Language Decoder", desc: "Break sentences into tokens and translate them into math.", type: "Visual" },
            { id: 8, title: "The Memory Matrix", desc: "Use LSTM memory cells to predict stock market trends.", type: "Visual" },
            { id: 9, title: "The Reward Function", desc: "Train an RL agent using rewards and penalties to navigate a maze.", type: "Visual" },
            { id: 10, title: "The Deepfake Duel", desc: "Wire a Generator and Discriminator to battle in a GAN.", type: "Visual" }
        ]
    },
    {
        world: "World 3: The Python Bridge", color: "#ec4899",
        levels: [
            { id: 11, title: "The Syntax Bridge", desc: "Translate visual architectures into raw Keras Python code.", type: "Code IDE" },
            { id: 12, title: "The Optimizer", desc: "Tune the Learning Rate and Epochs using pure math.", type: "Code IDE" },
            { id: 13, title: "Code the Matrix", desc: "Write the Python script for a CNN self-driving model.", type: "Code IDE" },
            { id: 14, title: "Text to Tensor", desc: "Write the NLP code to tokenize and pad sentence sequences.", type: "Code IDE" },
            { id: 15, title: "The Sequence", desc: "Write the RNN/LSTM code for time-series forecasting.", type: "Code IDE" }
        ]
    }
];

async function loadCurriculum() {
    const docRef = doc(db, "app_data", "curriculum");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        curriculumData = docSnap.data().worlds; 
    } else {
        curriculumData = defaultCurriculum;
        await setDoc(docRef, { worlds: curriculumData });
    }
    renderCurriculum();
}

function renderCurriculum() {
    container.innerHTML = '';
    curriculumData.forEach((world, wIndex) => {
        const worldSection = document.createElement('div');
        worldSection.className = 'world-container';

        worldSection.innerHTML = `
            <div class="world-header">
                <h2 style="color: ${world.color}; margin: 0;">${world.world}</h2>
                <span class="text-muted" style="font-size: 0.9rem;">${world.levels.length} Modules</span>
            </div>
            <div class="curriculum-grid" id="grid-${world.world.replace(/\s+/g, '-')}"></div>
        `;
        
        container.appendChild(worldSection);
        const grid = worldSection.querySelector('.curriculum-grid');

        world.levels.forEach((level, lIndex) => {
            const card = document.createElement('div');
            card.className = 'level-admin-card glass-panel';
            card.style.setProperty('--card-color', world.color); 

            const isActive = level.isActive !== false; 
            const opacity = isActive ? '1' : '0.4'; 
            const statusText = isActive ? 'Live' : 'Draft';

            card.innerHTML = `
                <div style="opacity: ${opacity}; transition: 0.3s;">
                    <div class="level-meta">
                        <span class="lvl-badge">Level ${level.id}</span>
                        <span style="font-size: 0.8rem; color: #94a3b8; background: rgba(0,0,0,0.2); padding: 2px 8px; border-radius: 10px;">${level.type}</span>
                    </div>
                    <div class="level-title">${level.title}</div>
                    <div class="level-desc">${level.desc}</div>
                </div>
                
                <div class="card-footer">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <label class="switch">
                            <input type="checkbox" ${isActive ? 'checked' : ''} onchange="window.toggleLevelStatus(${wIndex}, ${lIndex})">
                            <span class="slider"></span>
                        </label>
                        <span style="font-size: 0.8rem; color: ${isActive ? '#10b981' : '#ffbd2e'}; font-weight: bold;">${statusText}</span>
                    </div>
                    <div class="action-btns">
                        <button class="btn-outline" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; border-color: #ff5f56; color: #ff5f56;" onclick="window.deleteLevel(${wIndex}, ${lIndex})" title="Delete Mission">🗑️</button>
                        <button class="btn-outline" style="padding: 0.3rem 0.8rem; font-size: 0.8rem;" onclick="window.openEditModal(${wIndex}, ${lIndex})">Edit</button>
                        <button class="btn-primary" style="padding: 0.3rem 0.8rem; font-size: 0.8rem; background: ${world.color}; border-color: ${world.color};" onclick="window.open('../level${level.id}.html', '_blank')">Preview</button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    });
}

window.openEditModal = function(wIndex, lIndex) {
    const level = curriculumData[wIndex].levels[lIndex];
    document.getElementById('edit-lvl-id').innerText = level.id;
    document.getElementById('edit-world-idx').value = wIndex;
    document.getElementById('edit-level-idx').value = lIndex;
    document.getElementById('edit-title').value = level.title;
    document.getElementById('edit-desc').value = level.desc;
    document.getElementById('edit-type').value = level.type;
    document.getElementById('edit-level-modal').classList.remove('hidden');
};

window.closeEditModal = function() {
    document.getElementById('edit-level-modal').classList.add('hidden');
};

window.saveLevelEdit = async function() {
    const wIndex = document.getElementById('edit-world-idx').value;
    const lIndex = document.getElementById('edit-level-idx').value;
    
    curriculumData[wIndex].levels[lIndex].title = document.getElementById('edit-title').value;
    curriculumData[wIndex].levels[lIndex].desc = document.getElementById('edit-desc').value;
    curriculumData[wIndex].levels[lIndex].type = document.getElementById('edit-type').value;
    
    try {
        await setDoc(doc(db, "app_data", "curriculum"), { worlds: curriculumData });
        renderCurriculum();
        closeEditModal();
        alert("Mission Updated Globally!");
    } catch (error) {
        alert("Failed to save changes!");
    }
};

window.openAddModal = function() {
    document.getElementById('add-title').value = '';
    document.getElementById('add-desc').value = '';
    document.getElementById('add-type').value = 'Visual';
    
    const worldSelect = document.getElementById('add-world-idx');
    worldSelect.innerHTML = '';
    curriculumData.forEach((world, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.innerText = world.world;
        worldSelect.appendChild(option);
    });

    document.getElementById('add-level-modal').classList.remove('hidden');
};

window.closeAddModal = function() {
    document.getElementById('add-level-modal').classList.add('hidden');
};

// 🔴 دالة إنشاء التحدي أصبحت نظيفة وبدون Mechanics
window.saveNewLevel = async function() {
    const wIndex = document.getElementById('add-world-idx').value;
    const title = document.getElementById('add-title').value;
    const desc = document.getElementById('add-desc').value;
    const type = document.getElementById('add-type').value;

    if (!title || !desc) {
        alert("Please fill in all fields!");
        return;
    }

    let maxId = 0;
    curriculumData.forEach(world => {
        world.levels.forEach(lvl => {
            if (lvl.id > maxId) maxId = lvl.id;
        });
    });
    const newId = maxId + 1;

    const newLevel = {
        id: newId,
        title: title,
        desc: desc,
        type: type,
        isActive: true
    };

    curriculumData[wIndex].levels.push(newLevel);

    const btn = document.querySelector('#add-level-modal .btn-primary');
    const originalText = btn.innerText;
    btn.innerText = "Creating...";
    btn.disabled = true;

    try {
        await setDoc(doc(db, "app_data", "curriculum"), { worlds: curriculumData });
        
        btn.innerText = originalText;
        btn.disabled = false;
        
        renderCurriculum();
        closeAddModal();
        alert(`Success! Mission created with Level ID: ${newId}.\nMake sure you create the file 'level${newId}.html' in your pages folder!`);
    } catch (error) {
        alert("Failed to create mission!");
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

window.toggleLevelStatus = async function(wIndex, lIndex) {
    const level = curriculumData[wIndex].levels[lIndex];
    if (level.isActive === undefined) { level.isActive = false; } 
    else { level.isActive = !level.isActive; }

    try {
        await setDoc(doc(db, "app_data", "curriculum"), { worlds: curriculumData });
        renderCurriculum(); 
    } catch (error) {
        alert("Failed to update status!");
    }
};

window.deleteLevel = async function(wIndex, lIndex) {
    const levelTitle = curriculumData[wIndex].levels[lIndex].title;
    if (confirm(`Are you absolutely sure you want to permanently delete "${levelTitle}"?`)) {
        curriculumData[wIndex].levels.splice(lIndex, 1);
        try {
            await setDoc(doc(db, "app_data", "curriculum"), { worlds: curriculumData });
            renderCurriculum(); 
        } catch (error) {
            alert("Failed to delete mission!");
        }
    }
};

document.addEventListener('DOMContentLoaded', loadCurriculum);