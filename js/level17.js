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
    printToTerminal('> Initializing Autoencoder Architecture...', 'system');
    compilerStatus.innerText = "Analyzing latent space...";
    compilerStatus.style.color = "#ffbd2e";
    runBtn.disabled = true;

    // Remove spaces for easier parsing
    const code = editor.value.replace(/\s+/g, '');

    setTimeout(() => {
        evaluateAutoencoder(code);
    }, 800);
});

function evaluateAutoencoder(code) {
    let hasError = false;

    // 1. Check Bottleneck Layer: Dense(8, activation='relu')
    const bottleneckRegex = /model\.add\(Dense\(8,activation=['"]relu['"]\)\)/;
    if (!hasError && !bottleneckRegex.test(code)) {
        printToTerminal("ValueError: The Latent Space (Bottleneck) is incorrectly sized.", "error");
        printToTerminal("Hint: Did you create `model.add(Dense(8, activation='relu'))` to compress the data down to 8 neurons?", "system");
        hasError = true;
    }

    // 2. Check Output Layer: Dense(64, activation='sigmoid')
    const outputLayerRegex = /model\.add\(Dense\(64,activation=['"]sigmoid['"]\)\)/;
    if (!hasError && !outputLayerRegex.test(code)) {
        printToTerminal("ValueError: Shape mismatch in Reconstruction.", "error");
        printToTerminal("Hint: The output layer must EXACTLY match the input layer's 64 features. Use `model.add(Dense(64, activation='sigmoid'))`.", "system");
        hasError = true;
    }

    if (hasError) {
        compilerStatus.innerText = "Build Failed";
        compilerStatus.style.color = "#ff5f56";
        runBtn.disabled = false;
    } else {
        compilerStatus.innerText = "Pipeline Valid";
        compilerStatus.style.color = "#27c93f";
        printToTerminal("Compression Bottleneck verified.", "success");
        printToTerminal("Reconstruction Dimensions matched.", "success");
        printToTerminal("Training on Normal Network Traffic...", "system");
        
        simulateAnomalyDetection();
    }
}

function simulateAnomalyDetection() {
    let epoch = 1;
    let loss = 0.8500; 

    // Phase 1: Train on NORMAL data (loss goes down)
    const trainingInterval = setInterval(() => {
        loss = loss * 0.70; 
        if (loss < 0.015) loss = 0.012 + Math.random() * 0.005;

        printToTerminal(`Epoch ${epoch}/10 - [Normal Traffic] - Reconstruction Loss: ${loss.toFixed(4)}`, 'system');
        epoch++;

        if (epoch > 10) {
            clearInterval(trainingInterval);
            printToTerminal("Autoencoder trained successfully. Deploying to live server...", "success");
            
            // Phase 2: Test against FRAUD data (loss spikes!)
            setTimeout(triggerCyberAttack, 1500);
        }
    }, 400);
}

function triggerCyberAttack() {
    printToTerminal("--- INCOMING LIVE TRAFFIC STREAM ---", "warn");
    
    let packets = 1;
    const streamInterval = setInterval(async () => {
        if (packets === 3) {
            // THE ANOMALY
            printToTerminal(`Packet ${packets}: Reconstruction Loss: 4.8932 [CRITICAL SPIKE]`, 'error');
            printToTerminal("🚨 ANOMALY DETECTED: Zero-Day Exploit Blocked! 🚨", 'warn');
        } else {
            // Normal traffic
            let normalLoss = 0.012 + Math.random() * 0.005;
            printToTerminal(`Packet ${packets}: Reconstruction Loss: ${normalLoss.toFixed(4)} [Safe]`, 'system');
        }
        
        packets++;

        if (packets > 4) {
            clearInterval(streamInterval);
            printToTerminal("Network secured. Threat neutralized by Autoencoder.", "success");
            
            compilerStatus.innerText = "Level Cleared!";
            compilerStatus.style.color = "#27c93f";
            
            await updateProgress(17, 18); 
            
            const nextBtn = document.createElement('button');
            nextBtn.className = 'btn-run';
            nextBtn.style.marginTop = '25px';
            nextBtn.style.background = '#8b5cf6'; 
            nextBtn.innerText = 'Next: Level 18';
            nextBtn.onclick = () => location.href = 'level18.html';
            terminal.appendChild(nextBtn);
            terminal.scrollTop = terminal.scrollHeight;
        }
    }, 800);
}