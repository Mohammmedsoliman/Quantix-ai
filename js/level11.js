import { auth, db } from "./auth/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let currentUser = null;

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
    }
});

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
    if (type === 'system') p.className = 'terminal-system';
    
    terminal.appendChild(p);
    terminal.scrollTop = terminal.scrollHeight; 
}

runBtn.addEventListener('click', () => {
    terminal.innerHTML = '';
    printToTerminal('> Executing model.py...', 'system');
    compilerStatus.innerText = "Compiling...";
    compilerStatus.style.color = "#ffbd2e";
    
    runBtn.disabled = true;

    const rawCode = editor.value;
    const code = rawCode.replace(/\s+/g, '');

    setTimeout(async () => {
        await evaluatePython(code);
    }, 800);
});

async function evaluatePython(code) {
    let hasError = false;

    if (!code.includes('model=Sequential()')) {
        printToTerminal("NameError: 'model' is not defined or not initialized as Sequential().", "error");
        printToTerminal("Hint: Did you write `model = Sequential()`?", "system");
        hasError = true;
    }

    const hiddenLayerRegex = /model\.add\(Dense\(16,activation=['"]relu['"]\)\)/;
    if (!hasError && !hiddenLayerRegex.test(code)) {
        printToTerminal("ValueError: Missing or incorrect Hidden Layer.", "error");
        printToTerminal("Hint: Check step 2. You need a Dense layer with 16 neurons and 'relu' activation.", "system");
        hasError = true;
    }

    const outputLayerRegex = /model\.add\(Dense\(1,activation=['"]sigmoid['"]\)\)/;
    if (!hasError && !outputLayerRegex.test(code)) {
        printToTerminal("ValueError: Missing or incorrect Output Layer.", "error");
        printToTerminal("Hint: The output needs to be a Dense layer with 1 neuron and 'sigmoid' activation.", "system");
        hasError = true;
    }

    if (hasError) {
        compilerStatus.innerText = "Build Failed";
        compilerStatus.style.color = "#ff5f56";
        runBtn.disabled = false;
    } else {
        compilerStatus.innerText = "Build Successful";
        compilerStatus.style.color = "#27c93f";
        
        await updateProgress(11, 12); 
        
        printToTerminal("Model Architecture Validated.", "success");
        printToTerminal("Initializing Training Sequence...", "system");
        
        simulateTraining();
    }
}

function simulateTraining() {
    let epoch = 1;
    let acc = 40;
    let loss = 0.85;

    const trainingInterval = setInterval(() => {
        acc += Math.floor(Math.random() * 6);
        loss -= 0.07;
        
        if (acc > 98) acc = 98;
        if (loss < 0.1) loss = 0.08;

        printToTerminal(`Epoch ${epoch}/10 - loss: ${loss.toFixed(4)} - accuracy: ${(acc/100).toFixed(4)}`, 'system');
        epoch++;

        if (epoch > 10) {
            clearInterval(trainingInterval);
            printToTerminal("Training Complete. Model Achieved 98% Accuracy.", "success");
            
            const nextBtn = document.createElement('button');
            nextBtn.className = 'btn btn-primary';
            nextBtn.style.marginTop = '15px';
            nextBtn.innerText = 'Return to Teacher Dashboard';
            nextBtn.onclick = () => alert("Game Complete! Moving to Dashboard layout.");
            terminal.appendChild(nextBtn);
            terminal.scrollTop = terminal.scrollHeight;
        }
    }, 400); 
}