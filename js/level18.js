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
    if (type === 'warn') p.className = 'terminal-warn';
    if (type === 'system') p.className = 'terminal-system';
    
    terminal.appendChild(p);
    terminal.scrollTop = terminal.scrollHeight;
}

runBtn.addEventListener('click', () => {
    terminal.innerHTML = '';
    printToTerminal('> Parsing train_guard.py...', 'system');
    compilerStatus.innerText = "Analyzing callbacks...";
    compilerStatus.style.color = "#ffbd2e";
    runBtn.disabled = true;

    // مسح المسافات للـ Regex
    const code = editor.value.replace(/\s+/g, '');

    setTimeout(() => {
        evaluateEarlyStopping(code);
    }, 800);
});

function evaluateEarlyStopping(code) {
    let hasError = false;

    // 1. Check EarlyStopping creation
    const earlyStopRegex = /EarlyStopping\(monitor=['"]val_loss['"],patience=3\)/;
    if (!hasError && !earlyStopRegex.test(code)) {
        printToTerminal("ValueError: The Watchman is configured incorrectly.", "error");
        printToTerminal("Hint: Did you write `EarlyStopping(monitor='val_loss', patience=3)`?", "system");
        hasError = true;
    }

    // 2. Check if it's passed into the fit function
    const fitRegex = /callbacks=\[watchman\]/;
    if (!hasError && !fitRegex.test(code)) {
        printToTerminal("SyntaxError: The Watchman was created but never deployed!", "error");
        printToTerminal("Hint: Update the fit function to include `callbacks=[watchman]`.", "system");
        hasError = true;
    }

    if (hasError) {
        compilerStatus.innerText = "Build Failed";
        compilerStatus.style.color = "#ff5f56";
        runBtn.disabled = false;
    } else {
        compilerStatus.innerText = "Pipeline Valid";
        compilerStatus.style.color = "#27c93f";
        printToTerminal("Callback verified. Model guarded against Overfitting.", "success");
        printToTerminal("Initiating 200-Epoch Training Run...", "system");
        
        simulateGuardedTraining();
    }
}

function simulateGuardedTraining() {
    let epoch = 1;
    let trainLoss = 1.0;
    let valLoss = 1.0;
    let patienceCounter = 0;

    const trainingInterval = setInterval(async () => {
        // Training loss always goes down
        trainLoss *= 0.8;
        
        // Validation loss goes down initially, then starts going up (Overfitting)
        if (epoch <= 6) {
            valLoss *= 0.82;
        } else {
            valLoss *= 1.15; // Starts increasing!
            patienceCounter++;
        }

        printToTerminal(`Epoch ${epoch}/200 - loss: ${trainLoss.toFixed(4)} - val_loss: ${valLoss.toFixed(4)}`, 'system');
        
        // If validation loss increased for 3 epochs (patience=3), stop!
        if (patienceCounter >= 3) {
            clearInterval(trainingInterval);
            printToTerminal("🚨 WARNING: val_loss has not improved for 3 epochs!", "warn");
            printToTerminal("--- EarlyStopping Callback Triggered ---", "warn");
            printToTerminal("Training Halted. Restoring best weights.", "success");
            
            compilerStatus.innerText = "Level Cleared!";
            compilerStatus.style.color = "#27c93f";
            
            await updateProgress(18, 19); 
            
            const nextBtn = document.createElement('button');
            nextBtn.className = 'btn-run';
            nextBtn.style.marginTop = '15px';
            nextBtn.innerText = 'Next: Level 19';
            nextBtn.onclick = () => location.href = 'level19.html';
            terminal.appendChild(nextBtn);
            terminal.scrollTop = terminal.scrollHeight;
        }
        
        epoch++;
    }, 400);
}