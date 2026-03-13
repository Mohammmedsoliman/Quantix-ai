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
    printToTerminal('> Compiling CNN Architecture...', 'system');
    compilerStatus.innerText = "Analyzing layers...";
    compilerStatus.style.color = "#ffbd2e";
    runBtn.disabled = true;

    const code = editor.value.replace(/\s+/g, '');

    setTimeout(() => {
        evaluateCNN(code);
    }, 800);
});

function evaluateCNN(code) {
    let hasError = false;

    const convRegex = /model\.add\(Conv2D\(32,\(3,3\),activation=['"]relu['"]\)\)/;
    if (!hasError && !convRegex.test(code)) {
        printToTerminal("ValueError: Invalid Conv2D configuration.", "error");
        printToTerminal("Hint: Did you write `model.add(Conv2D(32, (3,3), activation='relu'))`?", "system");
        hasError = true;
    }

    const poolRegex = /model\.add\(MaxPooling2D\((pool_size=)?\(2,2\)\)\)/;
    if (!hasError && !poolRegex.test(code)) {
        printToTerminal("ValueError: Missing or invalid Max Pooling layer.", "error");
        printToTerminal("Hint: Did you write `model.add(MaxPooling2D((2,2)))`?", "system");
        hasError = true;
    }

    const flattenRegex = /model\.add\(Flatten\(\)\)/;
    if (!hasError && !flattenRegex.test(code)) {
        printToTerminal("ValueError: Shapes (None, 14, 14, 32) and (None, 1) are incompatible.", "error");
        printToTerminal("Hint: You cannot connect a 2D image grid directly to a 1D Dense layer! You must use Flatten() first.", "system");
        hasError = true;
    }

    if (hasError) {
        compilerStatus.innerText = "Build Failed";
        compilerStatus.style.color = "#ff5f56";
        runBtn.disabled = false;
    } else {
        compilerStatus.innerText = "Pipeline Valid";
        compilerStatus.style.color = "#27c93f";
        printToTerminal("Convolutional Layers verified.", "success");
        printToTerminal("Starting image processing loop...", "system");
        simulateImageTraining();
    }
}

function simulateImageTraining() {
    let currentEpoch = 1;
    let acc = 25.0; 
    let loss = 1.8;

    const trainingInterval = setInterval(async () => {
        acc += Math.floor(Math.random() * 8) + 5; 
        loss -= (Math.random() * 0.15 + 0.05);

        if (acc > 99) acc = 99.2;
        if (loss < 0.05) loss = 0.03;

        printToTerminal(`Epoch ${currentEpoch}/15 - loss: ${loss.toFixed(4)} - accuracy: ${(acc/100).toFixed(4)} - val_accuracy: ${(acc/100 - 0.02).toFixed(4)}`, 'system');
        currentEpoch++;

        if (currentEpoch > 15) {
            clearInterval(trainingInterval);
            printToTerminal("Training Complete. AI successfully detects Stop Signs.", "success");
            
            compilerStatus.innerText = "Level Cleared!";
            compilerStatus.style.color = "#27c93f";
            
            await updateProgress(13, 14); 
            
            const nextBtn = document.createElement('button');
            nextBtn.className = 'btn btn-primary';
            nextBtn.style.marginTop = '15px';
            nextBtn.innerText = 'Next Level: NLP Code';
            nextBtn.onclick = () => alert("Proceeding to Level 14...");
            terminal.appendChild(nextBtn);
            terminal.scrollTop = terminal.scrollHeight;
        }
    }, 300);
}