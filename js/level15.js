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
    printToTerminal('> Compiling Recurrent Neural Network...', 'system');
    compilerStatus.innerText = "Checking memory cells...";
    compilerStatus.style.color = "#ffbd2e";
    runBtn.disabled = true;

    const code = editor.value.replace(/\s+/g, '');

    setTimeout(() => {
        evaluateLSTM(code);
    }, 800);
});

function evaluateLSTM(code) {
    let hasError = false;

    const denseTrapRegex = /model\.add\(Dense\(50/;
    if (denseTrapRegex.test(code)) {
        printToTerminal("ValueError: Amnesia Detected.", "error");
        printToTerminal("Hint: You used a Dense layer! It will process all 30 days at exactly the same time and lose the chronological order. Use an LSTM layer to step through time.", "system");
        hasError = true;
    }

    const lstmRegex = /model\.add\(LSTM\(50,input_shape=\(30,1\)\)\)/;
    if (!hasError && !lstmRegex.test(code)) {
        if (code.includes('LSTM(50)')) {
            printToTerminal("ValueError: This model has not yet been built. Shape missing.", "error");
            printToTerminal("Hint: The first layer of any Keras model needs to know the shape of the data. Add `input_shape=(30,1)` to your LSTM layer.", "system");
        } else {
            printToTerminal("SyntaxError: Missing or incorrectly formatted LSTM layer.", "error");
            printToTerminal("Hint: Did you write `model.add(LSTM(50, input_shape=(30, 1)))`?", "system");
        }
        hasError = true;
    }

    const denseOutRegex = /model\.add\(Dense\(1\)\)/;
    if (!hasError && !denseOutRegex.test(code)) {
        printToTerminal("ValueError: Incorrect Output Layer.", "error");
        printToTerminal("Hint: We are predicting exactly ONE price for tomorrow. You need `model.add(Dense(1))`.", "system");
        hasError = true;
    }

    if (hasError) {
        compilerStatus.innerText = "Build Failed";
        compilerStatus.style.color = "#ff5f56";
        runBtn.disabled = false;
    } else {
        compilerStatus.innerText = "Pipeline Valid";
        compilerStatus.style.color = "#27c93f";
        printToTerminal("LSTM Memory Cells initialized successfully.", "success");
        printToTerminal("Beginning chronological training loop...", "system");
        simulateTimeSeriesTraining();
    }
}

function simulateTimeSeriesTraining() {
    let currentEpoch = 1;
    let loss = 450.0; 
    let mae = 15.0; 

    const trainingInterval = setInterval(async () => {
        loss = loss * 0.75; 
        mae = mae * 0.8; 

        if (loss < 2.5) loss = 2.5 + Math.random() * 0.5;
        if (mae < 1.2) mae = 1.2 + Math.random() * 0.2;

        printToTerminal(`Epoch ${currentEpoch}/20 - loss: ${loss.toFixed(4)} - mae: $${mae.toFixed(2)}`, 'system');
        currentEpoch++;

        if (currentEpoch > 20) {
            clearInterval(trainingInterval);
            printToTerminal("Training Complete. The AI's predictions are within $1.20 of reality.", "success");
            
            compilerStatus.innerText = "Level Cleared!";
            compilerStatus.style.color = "#27c93f";
            
            await updateProgress(15, 16); 
            
            const nextBtn = document.createElement('button');
            nextBtn.className = 'btn btn-primary';
            nextBtn.style.marginTop = '15px';
            nextBtn.innerText = 'Next: Level 16';
            nextBtn.onclick = () => location.href = 'level16.html';
            terminal.appendChild(nextBtn);
            terminal.scrollTop = terminal.scrollHeight;
        }
    }, 250);
}