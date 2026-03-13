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
    printToTerminal('> Parsing train.py...', 'system');
    compilerStatus.innerText = "Compiling...";
    compilerStatus.style.color = "#ffbd2e";
    runBtn.disabled = true;

    const code = editor.value;

    setTimeout(() => {
        evaluateHyperparameters(code);
    }, 600);
});

function evaluateHyperparameters(code) {
    const lrMatch = code.match(/learning_rate\s*=\s*([0-9.]+)/);
    const epochMatch = code.match(/epochs\s*=\s*([0-9]+)/);
    const batchMatch = code.match(/batch_size\s*=\s*([0-9]+)/);

    if (!lrMatch || !epochMatch || !batchMatch) {
        printToTerminal("SyntaxError: Check your variable assignments. Did you delete a variable name?", "error");
        resetCompiler();
        return;
    }

    const lr = parseFloat(lrMatch[1]);
    const epochs = parseInt(epochMatch[1]);
    const batchSize = parseInt(batchMatch[1]);

    printToTerminal(`Detected LR: ${lr} | Epochs: ${epochs} | Batch: ${batchSize}`, 'system');
    
    if (lr >= 0.1) {
        printToTerminal("ValueError: Learning rate is too high! The model will explode.", "error");
        simulateExplosion(epochs);
        return;
    }

    if (lr <= 0.00001) {
         printToTerminal("Warning: Learning rate is incredibly slow. This might take days.", "system");
    }

    if (batchSize % 2 !== 0 && batchSize !== 1) {
         printToTerminal("Warning: Batch sizes are usually powers of 2 (16, 32, 64) for memory efficiency, but training will proceed.", "system");
    }

    simulateDynamicTraining(lr, epochs);
}

function simulateExplosion(epochs) {
    let currentEpoch = 1;
    let loss = 1.0;
    
    const explosionInterval = setInterval(() => {
        loss = loss * 5; 
        printToTerminal(`Epoch ${currentEpoch}/${epochs} - loss: ${loss.toFixed(2)} - accuracy: 0.1000`, 'error');
        currentEpoch++;

        if (loss > 1000 || currentEpoch > epochs) {
            clearInterval(explosionInterval);
            printToTerminal("Exception: Model diverged. Loss is NaN (Not a Number). Lower your learning rate!", "error");
            resetCompiler();
        }
    }, 200);
}

function simulateDynamicTraining(lr, totalEpochs) {
    compilerStatus.innerText = "Training...";
    compilerStatus.style.color = "#06b6d4";

    let currentEpoch = 1;
    let acc = 15.0;
    let loss = 2.0;

    const optimalLr = 0.001;
    const learningEfficiency = 1 - Math.abs(optimalLr - lr) * 100; 
    const stepSize = Math.max(0.5, learningEfficiency * 0.8);

    const trainingInterval = setInterval(() => {
        acc += stepSize + (Math.random() * 2);
        loss -= (stepSize / 50) + (Math.random() * 0.02);

        if (acc > 96) acc = 96 + Math.random() * 2;
        if (loss < 0.05) loss = 0.05 + Math.random() * 0.01;

        printToTerminal(`Epoch ${currentEpoch}/${totalEpochs} - loss: ${loss.toFixed(4)} - accuracy: ${(acc/100).toFixed(4)}`, 'system');
        currentEpoch++;

        if (currentEpoch > totalEpochs) {
            clearInterval(trainingInterval);
            finishTraining(acc);
        }
    }, 100);
}

async function finishTraining(finalAcc) {
    if (finalAcc < 85) {
        printToTerminal(`Training complete, but accuracy is only ${Math.floor(finalAcc)}%.`, 'error');
        printToTerminal("Hint: Increase your epochs to give the model more time to learn!", "system");
        resetCompiler();
    } else {
        printToTerminal(`Optimization Successful! Final Accuracy: ${Math.floor(finalAcc)}%.`, 'success');
        compilerStatus.innerText = "Level Cleared!";
        compilerStatus.style.color = "#27c93f";
        
        await updateProgress(12, 13); 
        
        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn btn-primary';
        nextBtn.style.marginTop = '15px';
        nextBtn.innerText = 'Go to Teacher Dashboard';
        nextBtn.onclick = () => alert("Proceeding to Dashboard...");
        terminal.appendChild(nextBtn);
        terminal.scrollTop = terminal.scrollHeight;
    }
}

function resetCompiler() {
    compilerStatus.innerText = "Build Failed";
    compilerStatus.style.color = "#ff5f56";
    document.getElementById('run-code-btn').disabled = false;
}