import { auth, db } from "./auth/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let currentUser = null;

// التأكد من هوية الطالب
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
    }
});

// دالة حفظ التقدم بحماية (Safe Unlock)
async function updateProgress(levelId, nextLevelId) {
    if (!currentUser) return;

    try {
        await setDoc(doc(db, "users", currentUser.uid, "levels", levelId.toString()), {
            levelId: levelId,
            status: "completed",
            accuracy: 100,
            lastActive: serverTimestamp(),
            lastError: "None"
        }, { merge: true });

        const nextRef = doc(db, "users", currentUser.uid, "levels", nextLevelId.toString());
        const nextSnap = await getDoc(nextRef);

        if (!nextSnap.exists() || nextSnap.data().status !== "completed") {
            await setDoc(nextRef, {
                levelId: nextLevelId,
                status: "active",
                lastActive: serverTimestamp()
            }, { merge: true });
            console.log(`Level ${levelId} completed. Level ${nextLevelId} is now active!`);
        } else {
            console.log(`Level ${nextLevelId} is already completed. Skipping downgrade.`);
        }
    } catch (error) {
        console.error("Error updating progress:", error);
    }
}

const editor = document.getElementById('python-editor');
const runBtn = document.getElementById('run-code-btn');
const terminal = document.getElementById('terminal-output');
const compilerStatus = document.getElementById('compiler-status');

function printToTerminal(text, type = 'system') {
    const p = document.createElement('p');
    p.innerText = text;
    if (type === 'error') p.className = 'terminal-error';
    if (type === 'success') p.className = 'terminal-success';
    if (type === 'warn') p.className = 'terminal-warn';
    if (type === 'system') p.className = 'terminal-system';
    
    terminal.appendChild(p);
    terminal.scrollTop = terminal.scrollHeight;
}

runBtn.addEventListener('click', () => {
    terminal.innerHTML = '';
    printToTerminal('> Compiling Transfer Learning Architecture...', 'system');
    compilerStatus.innerText = "Checking parameters...";
    compilerStatus.style.color = "#ffbd2e";
    runBtn.disabled = true;

    // مسح المسافات لسهولة قراءة الكود
    const code = editor.value.replace(/\s+/g, '');

    setTimeout(() => {
        evaluateTransferLearning(code);
    }, 800);
});

function evaluateTransferLearning(code) {
    let hasError = false;

    // 1. Check if they froze the base model
    const freezeRegex = /base_model\.trainable=False/;
    const unfreezeRegex = /base_model\.trainable=True/;
    
    if (unfreezeRegex.test(code)) {
        printToTerminal("ValueError: The Giant's brain is NOT frozen!", "error");
        printToTerminal("Hint: If you leave `base_model.trainable = True`, the millions of weights will be destroyed by our small medical dataset (Catastrophic Forgetting). Set it to False.", "system");
        hasError = true;
    } else if (!freezeRegex.test(code)) {
        printToTerminal("SyntaxError: Missing trainable parameter.", "error");
        printToTerminal("Hint: You must explicitly write `base_model.trainable = False`.", "system");
        hasError = true;
    }

    // 2. Check for Output Layer: Dense(1, activation='sigmoid')
    const outputLayerRegex = /model\.add\(Dense\(1,activation=['"]sigmoid['"]\)\)/;
    if (!hasError && !outputLayerRegex.test(code)) {
        printToTerminal("ValueError: Incorrect Output Layer.", "error");
        printToTerminal("Hint: We are doing a Yes/No classification (Sick or Healthy). You need exactly 1 neuron with a 'sigmoid' activation function at the very end.", "system");
        hasError = true;
    }

    if (hasError) {
        compilerStatus.innerText = "Build Failed";
        compilerStatus.style.color = "#ff5f56";
        runBtn.disabled = false;
    } else {
        compilerStatus.innerText = "Pipeline Valid";
        compilerStatus.style.color = "#27c93f";
        printToTerminal("Base model frozen successfully.", "success");
        printToTerminal("Custom Medical Head attached.", "success");
        printToTerminal("Initiating high-speed training loop...", "warn");
        
        simulateTransferTraining();
    }
}

function simulateTransferTraining() {
    let currentEpoch = 1;
    // Because it's transfer learning, it starts with very high accuracy!
    let acc = 75.0; 
    let loss = 0.50; 

    const trainingInterval = setInterval(async () => {
        acc += Math.floor(Math.random() * 4) + 2; 
        loss -= (Math.random() * 0.08 + 0.02);

        if (acc > 98) acc = 98.9;
        if (loss < 0.02) loss = 0.015;

        printToTerminal(`Epoch ${currentEpoch}/5 - loss: ${loss.toFixed(4)} - accuracy: ${(acc/100).toFixed(4)} [Very Fast ⚡]`, 'system');
        currentEpoch++;

        if (currentEpoch > 5) {
            clearInterval(trainingInterval);
            printToTerminal("Training Complete. The AI diagnosed the X-Rays with 98.9% accuracy in record time!", "success");
            
            compilerStatus.innerText = "Level Cleared!";
            compilerStatus.style.color = "#27c93f";
            
            // تحديث التقدم لليفل 17
            await updateProgress(16, 17); 
            
            const nextBtn = document.createElement('button');
            nextBtn.className = 'btn-run';
            nextBtn.style.marginTop = '15px';
            nextBtn.style.background = '#8b5cf6'; // لون مميز
            nextBtn.innerText = 'Next: Level 17';
            nextBtn.onclick = () => location.href = 'level17.html';
            terminal.appendChild(nextBtn);
            terminal.scrollTop = terminal.scrollHeight;
        }
    }, 400);
}